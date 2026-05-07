import { describe, expect, it } from "vitest";
import { parseLegacyTinyV2 } from "./LegacyTinyV2";

describe("parseLegacyTinyV2", () => {
    it("extracts named methods, fields, and params from Tiny V2 mappings", () => {
        const result = parseLegacyTinyV2([
            "tiny\t2\t0\tsrg\tnamed",
            "c\tnet/minecraft/nbt/JsonToNBT\tnet/minecraft/nbt/JsonToNBT",
            "\tf\tLorg/apache/logging/log4j/Logger;\tfield_150317_a\tlogger",
            "\tm\t(Ljava/lang/String;)Lnet/minecraft/nbt/NBTBase;\tfunc_150315_a\tparse",
            "\t\tp\t0\tp_150315_0_\trawNbt",
            "\tm\t(Ljava/lang/String;Ljava/lang/String;)Lnet/minecraft/nbt/JsonToNBT$Any;\tfunc_150316_a\tnameValueToNBT",
            "\t\tp\t0\tp_150316_0_\tkey",
            "\t\tp\t1\tp_150316_1_\tvalue",
        ].join("\n"));

        expect(result.methodsCsv).toContain("func_150315_a,parse,0");
        expect(result.methodsCsv).toContain("func_150316_a,nameValueToNBT,0");
        expect(result.fieldsCsv).toContain("field_150317_a,logger,0");
        expect(result.paramsCsv).toContain("p_150315_0_,rawNbt,0");
        expect(result.paramsCsv).toContain("p_150316_0_,key,0");
        expect(result.paramsCsv).toContain("p_150316_1_,value,0");
    });

    it("rejects non Tiny V2 mapping files", () => {
        expect(() => parseLegacyTinyV2("not tiny")).toThrow("Expected Tiny V2 mappings");
    });

    it("uses namespace positions from the Tiny header", () => {
        const result = parseLegacyTinyV2([
            "tiny\t2\t0\tobf\tsrg\tnamed",
            "c\teb\tnet/minecraft/nbt/JsonToNBT\tnet/minecraft/nbt/JsonToNBT",
            "\tm\t(Ljava/lang/String;)Ldy;\ta\tfunc_150315_a\tparse",
            "\t\tp\t0\tp_obf\tp_150315_0_\trawNbt",
        ].join("\n"));

        expect(result.methodsCsv).toContain("func_150315_a,parse,0");
        expect(result.paramsCsv).toContain("p_150315_0_,rawNbt,0");
    });

});
