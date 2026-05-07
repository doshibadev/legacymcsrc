import { load } from "../../../java/build/generated/teavm/wasm-gc/java.wasm-runtime.js";
import indexerWasm from '../../../java/build/generated/teavm/wasm-gc/java.wasm?url';

interface RemapNative {
    loadSrg(srg: string): void;
    loadMethodCsv(csv: string): void;
    loadFieldCsv(csv: string): void;
    loadParamCsv(csv: string): void;
    prepass(classBytes: ArrayBufferLike): void;
    remap(classBytes: ArrayBufferLike): ArrayBuffer;
    remapInternalName(name: string): string;
}

export class RemapWorker {
    #native: RemapNative | null = null;

    getNative = async (): Promise<RemapNative> => {
        if (!this.#native) {
            try {
                const teavm = await load(indexerWasm);
                this.#native = teavm.exports as RemapNative;
            } catch (e) {
                console.warn("Failed to load WASM remap module, falling back to JS", e);
                this.#native = await import("../../../java/build/generated/teavm/js/java.js") as unknown as RemapNative;
            }
        }
        return this.#native;
    };

    loadMappings = async (srg: string, methodsCsv: string, fieldsCsv: string, paramsCsv: string): Promise<void> => {
        const native = await this.getNative();
        native.loadSrg(srg);
        native.loadMethodCsv(methodsCsv);
        native.loadFieldCsv(fieldsCsv);
        native.loadParamCsv(paramsCsv);
    };

    prepass = async (classBytes: ArrayBufferLike): Promise<void> => {
        const native = await this.getNative();
        native.prepass(classBytes);
    };

    remap = async (classBytes: ArrayBufferLike): Promise<ArrayBuffer> => {
        const native = await this.getNative();
        return native.remap(classBytes);
    };

    remapInternalName = async (name: string): Promise<string> => {
        const native = await this.getNative();
        return native.remapInternalName(name);
    };
}
