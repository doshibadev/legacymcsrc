import { BehaviorSubject, distinctUntilChanged, filter, from, of, shareReplay, switchMap } from "rxjs";
import { agreedEula } from "./Settings";
import { openJar, type Jar } from "../utils/Jar";
import { selectedMinecraftVersion } from "./State";
import { remapJar, type MappingData } from "../workers/remap/client";
import { strFromU8, unzipSync } from "fflate";
import { parseLegacyTinyV2 } from "./LegacyTinyV2";

const CACHE_NAME = 'mcsrc-v1';
const DEOBF_CACHE_VERSION = 8;

export const MINECRAFT_VERSION = "1.7.10";
const VERSION_MANIFEST_URL = "https://piston-meta.mojang.com/v1/packages/ed5d8789ed29872ea2ef1c348302b0c55e3f3468/1.7.10.json";
const SRG_MAPPINGS_URL = "/mappings/mcp-1.7.10.zip";
const TINY_MAPPINGS_URL = "/mappings/legacymappings-1.7.10-build.1-pre1-v2.jar";

interface VersionManifest {
    id: string;
    downloads: {
        [key: string]: {
            url: string;
            sha1: string;
        };
    };
}

export interface MinecraftJar {
    version: string;
    jar: Jar;
    blob: Blob;
}

export const minecraftVersionIds = of([MINECRAFT_VERSION]);

export const downloadProgress = new BehaviorSubject<number | undefined>(undefined);
export const remapStatus = new BehaviorSubject<string | undefined>(undefined);

export const minecraftJar = agreedEula.observable.pipe(
    filter(agreed => agreed),
    switchMap(() => selectedMinecraftVersion),
    filter((id): id is string => id !== null),
    distinctUntilChanged(),
    switchMap(() => from(buildMinecraftJar())),
    shareReplay({ bufferSize: 1, refCount: false })
);

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch JSON from ${url}: ${response.statusText}`);
    }

    return response.json();
}

async function cachedFetch(url: string, onProgress?: (percent: number) => void): Promise<Blob> {
    if (!('caches' in window)) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return await consumeResponseWithProgress(response, onProgress);
    }

    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
        return await cachedResponse.blob();
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    const blob = await consumeResponseWithProgress(response, onProgress);

    await cache.put(url, new Response(blob, {
        headers: response.headers
    }));

    return blob;
}

async function consumeResponseWithProgress(response: Response, onProgress?: (percent: number) => void): Promise<Blob> {
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body || total === 0 || !onProgress) {
        return await response.blob();
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let receivedLength = 0;
    let lastPercent = -1;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        const percent = Math.round((receivedLength / total) * 100);

        if (percent !== lastPercent) {
            onProgress(percent);
            lastPercent = percent;
        }
    }

    return new Blob(chunks);
}

async function downloadMappings(): Promise<MappingData> {
    const srgBlob = await cachedFetch(SRG_MAPPINGS_URL);
    const srgZip = unzipSync(new Uint8Array(await srgBlob.arrayBuffer()));
    const missingSrg = ["joined.srg"].filter(name => !srgZip[name]);

    if (missingSrg.length > 0) {
        throw new Error(`SRG mapping zip missing required files: ${missingSrg.join(", ")}. Found: ${Object.keys(srgZip).join(", ")}`);
    }

    const tinyBlob = await cachedFetch(TINY_MAPPINGS_URL);
    const tinyJar = unzipSync(new Uint8Array(await tinyBlob.arrayBuffer()));
    const missingTiny = ["mappings/mappings.tiny"].filter(name => !tinyJar[name]);

    if (missingTiny.length > 0) {
        throw new Error(`Tiny mapping jar missing required files: ${missingTiny.join(", ")}. Found: ${Object.keys(tinyJar).join(", ")}`);
    }

    const tinyMappings = parseLegacyTinyV2(strFromU8(tinyJar["mappings/mappings.tiny"]));

    return {
        srg: strFromU8(srgZip["joined.srg"]),
        methodsCsv: tinyMappings.methodsCsv,
        fieldsCsv: tinyMappings.fieldsCsv,
        paramsCsv: tinyMappings.paramsCsv,
    };
}

async function downloadObfJar(): Promise<Blob> {
    const versionManifest = await getJson<VersionManifest>(VERSION_MANIFEST_URL);
    const clientUrl = versionManifest.downloads.client.url;

    return cachedFetch(clientUrl, percent => {
        downloadProgress.next(percent);
    });
}

async function buildMinecraftJar(): Promise<MinecraftJar> {
    const cacheKey = `mcsrc-deobf-${MINECRAFT_VERSION}-v${DEOBF_CACHE_VERSION}`;
    const cache = 'caches' in window ? await caches.open(CACHE_NAME) : null;

    if (cache) {
        for (const request of await cache.keys()) {
            const key = typeof request === "string" ? request : request.url;
            if (key.includes(`mcsrc-deobf-${MINECRAFT_VERSION}-`) && !key.endsWith(cacheKey)) {
                await cache.delete(request);
            }
        }

        const cached = await cache.match(cacheKey);
        if (cached) {
            const blob = await cached.blob();
            const jar = await openJar(MINECRAFT_VERSION, blob);
            return { version: MINECRAFT_VERSION, jar, blob };
        }
    }

    remapStatus.next("Downloading Minecraft 1.7.10 jar...");
    const obfBlob = await downloadObfJar();
    downloadProgress.next(undefined);

    remapStatus.next("Downloading MCP and LegacyMappings Tiny V2 mappings...");
    const mappings = await downloadMappings();

    remapStatus.next("Opening obfuscated jar...");
    const obfJar = await openJar(MINECRAFT_VERSION + "-obf", obfBlob);

    remapStatus.next("Remapping with LegacyMappings Tiny V2 names...");
    const deobfBlob = await remapJar(obfJar, mappings);

    if (cache) {
        await cache.put(cacheKey, new Response(deobfBlob, { headers: { "content-type": "application/java-archive" } }));
    }

    remapStatus.next(undefined);
    const jar = await openJar(MINECRAFT_VERSION, deobfBlob);
    return { version: MINECRAFT_VERSION, jar, blob: deobfBlob };
}
