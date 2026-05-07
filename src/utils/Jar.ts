import { type Entry, type Zip, readBlob } from "@katana-project/zip";
import { zipSync, type Zippable } from "fflate";

export interface Jar {
    name: string;
    blob: Blob;
    entries: { [key: string]: Entry; };
}

export async function openJar(name: string, blob: Blob): Promise<Jar> {
    const zip = await readBlob(blob, {
        naive: true
    });
    return new JarImpl(name, blob, zip);
}

export function repackJar(entries: Record<string, Uint8Array>): Blob {
    const data: Zippable = {};
    for (const [path, bytes] of Object.entries(entries)) {
        data[path] = [bytes, { level: 6 }];
    }
    const out = zipSync(data);
    return new Blob([out as BlobPart], { type: "application/java-archive" });
}

class JarImpl implements Jar {
    private zip: Zip;
    public name: string;
    public blob: Blob;
    public entries: { [key: string]: Entry; } = {};

    constructor(name: string, blob: Blob, zip: Zip) {
        this.name = name;
        this.blob = blob;
        this.zip = zip;
        zip.entries.forEach(entry => {
            this.entries[entry.name] = entry;
        });
    }
}
