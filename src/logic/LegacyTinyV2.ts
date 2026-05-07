export interface LegacyTinyV2Mappings {
    methodsCsv: string;
    fieldsCsv: string;
    paramsCsv: string;
}

export function parseLegacyTinyV2(tinyText: string): LegacyTinyV2Mappings {
    const lines = tinyText.split(/\r?\n/);
    const header = lines[0]?.split("\t") ?? [];

    if (header[0] !== "tiny" || header[1] !== "2") {
        throw new Error("Expected Tiny V2 mappings");
    }

    const srgNamespaceIndex = header.indexOf("srg") - 3;
    const namedNamespaceIndex = header.indexOf("named") - 3;
    if (srgNamespaceIndex < 0 || namedNamespaceIndex < 0) {
        throw new Error("Expected Tiny V2 mappings to include srg and named namespaces");
    }

    const methods = new Map<string, string>();
    const fields = new Map<string, string>();
    const params = new Map<string, string>();

    for (const rawLine of lines.slice(1)) {
        if (!rawLine) {
            continue;
        }

        const line = rawLine.trimStart();
        const parts = line.split("\t");

        switch (parts[0]) {
            case "f":
                if (parts.length >= 2 + Math.max(srgNamespaceIndex, namedNamespaceIndex) + 1) {
                    fields.set(unescapeTiny(parts[2 + srgNamespaceIndex]), unescapeTiny(parts[2 + namedNamespaceIndex]));
                }
                break;
            case "m":
                if (parts.length >= 2 + Math.max(srgNamespaceIndex, namedNamespaceIndex) + 1) {
                    methods.set(unescapeTiny(parts[2 + srgNamespaceIndex]), unescapeTiny(parts[2 + namedNamespaceIndex]));
                }
                break;
            case "p":
                if (parts.length >= 2 + Math.max(srgNamespaceIndex, namedNamespaceIndex) + 1) {
                    params.set(unescapeTiny(parts[2 + srgNamespaceIndex]), unescapeTiny(parts[2 + namedNamespaceIndex]));
                }
                break;
        }
    }

    return {
        methodsCsv: toCsv("searge,name,side", methods),
        fieldsCsv: toCsv("searge,name,side", fields),
        paramsCsv: toCsv("param,name,side", params),
    };
}

function toCsv(header: string, entries: Map<string, string>): string {
    const rows = [header];
    for (const [key, value] of entries) {
        rows.push(`${escapeCsv(key)},${escapeCsv(value)},0`);
    }

    return rows.join("\n");
}

function escapeCsv(value: string): string {
    if (!/[",\n\r]/.test(value)) {
        return value;
    }

    return `"${value.replaceAll('"', '""')}"`;
}

function unescapeTiny(value: string): string {
    return value
        .replaceAll("\\n", "\n")
        .replaceAll("\\r", "\r")
        .replaceAll("\\t", "\t")
        .replaceAll("\\0", "\0")
        .replaceAll("\\\\", "\\");
}
