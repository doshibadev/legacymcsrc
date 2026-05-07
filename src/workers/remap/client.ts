import * as Comlink from "comlink";
import { BehaviorSubject } from "rxjs";
import { type Jar, repackJar } from "../../utils/Jar";
import type { RemapWorker } from "./types";

export const remapProgress = new BehaviorSubject<number>(-1);

function createWorker() {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "remap" });
    return {
        c: Comlink.wrap<RemapWorker>(worker),
        w: worker,
    };
}

export interface MappingData {
    srg: string;
    methodsCsv: string;
    fieldsCsv: string;
    paramsCsv: string;
}

export async function remapJar(
    obfJar: Jar,
    mappings: MappingData,
    progress: BehaviorSubject<number> = remapProgress
): Promise<Blob> {
    const { c: native, w: rawWorker } = createWorker();

    try {
        progress.next(0);
        await native.loadMappings(mappings.srg, mappings.methodsCsv, mappings.fieldsCsv, mappings.paramsCsv);

        const allEntries = Object.values(obfJar.entries);
        const classEntries = allEntries.filter(e => e.name.endsWith(".class"));
        const resourceEntries = allEntries.filter(e => !e.name.endsWith(".class") && !e.isDirectory);

        const total = classEntries.length;
        let processed = 0;

        // Pre-pass: walk all classes to populate inheritance map (needed for method resolution)
        const classBytesCache: Uint8Array[] = [];
        for (const entry of classEntries) {
            const bytes = await entry.bytes();
            classBytesCache.push(bytes);
            const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
            await native.prepass(buf);
            processed++;
            if (processed % 200 === 0) {
                progress.next(Math.round((processed / total) * 50));
            }
        }
        progress.next(50);

        // Remap pass
        const remappedEntries: Record<string, Uint8Array> = {};
        processed = 0;
        for (let i = 0; i < classEntries.length; i++) {
            const bytes = classBytesCache[i];
            const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
            const remappedBuf = await native.remap(buf);
            const remapped = new Uint8Array(remappedBuf);

            const oldName = classEntries[i].name.replace(/\.class$/, "");
            const newName = await native.remapInternalName(oldName);
            remappedEntries[newName + ".class"] = remapped;

            processed++;
            if (processed % 200 === 0) {
                progress.next(50 + Math.round((processed / total) * 50));
            }
        }

        // Copy resources unchanged
        for (const entry of resourceEntries) {
            const bytes = await entry.bytes();
            remappedEntries[entry.name] = bytes;
        }

        progress.next(100);
        const blob = repackJar(remappedEntries);
        progress.next(-1);
        return blob;
    } finally {
        rawWorker.terminate();
    }
}
