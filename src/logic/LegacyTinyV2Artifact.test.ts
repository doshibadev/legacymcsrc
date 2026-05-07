/// <reference types="node" />

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { parseLegacyTinyV2 } from "./LegacyTinyV2";

describe("LegacyMappings Tiny V2 artifact", () => {
    it("parses the checked-in LegacyMappings release artifact", () => {
        const jar = unzipSync(readFileSync("public/mappings/legacymappings-1.7.10-build.1-pre1-v2.jar"));
        const result = parseLegacyTinyV2(strFromU8(jar["mappings/mappings.tiny"]));

        expect(result.methodsCsv).toContain("func_150315_a,parse,0");
        expect(result.fieldsCsv).toContain("field_150491_b,tagList,0");
        expect(result.paramsCsv).toContain("p_150316_0_,key,0");
        expect(result.paramsCsv).toContain("p_150316_1_,value,0");
    });
});
