# mcsrc-1.7.10

Fork of [mcsrc.dev](https://mcsrc.dev/) targeting **Minecraft 1.7.10 (vanilla)**.

The original mcsrc.dev assumes Mojang ships an unobfuscated `client.jar` (true since 1.20.1) or a Fabric pre-deobfuscated build for snapshots. 1.7.10 is fully obfuscated, so this fork inserts an in-browser remap step using **MCP stable_12 SRG mappings** plus **LegacyMappings Tiny V2 names** before feeding the jar to the existing Vineflower decompiler + ASM indexer.

## How it works

1. Browser fetches vanilla 1.7.10 `client.jar` directly from Mojang's CDN.
2. Browser fetches `mcp-1.7.10.zip` for obfuscated -> SRG class/member mappings.
3. Browser fetches `legacymappings-1.7.10-build.1-pre1-v2.jar` and parses its Tiny V2 `srg -> named` mappings.
4. A remap worker (TeaVM-compiled ASM `ClassRemapper`) renames every class/field/method using MCP SRG plus LegacyMappings names, and injects mapped parameter metadata for the decompiler.
5. Result is repacked and handed to the existing pipeline (indexer + Vineflower) unchanged.

The deobf jar is cached in the browser Cache API after first remap.

Not affiliated with Mojang or Microsoft. No Minecraft code or bytecode is redistributed; the jar is downloaded directly from Mojang's servers to your browser at runtime.

## How to build locally

First build the Java side (TeaVM transpiles ASM/remapper/indexer to WASM + JS):

```
cd java
./gradlew build
```

Then run the web app:

```
nvm use
npm install
npm run dev
```

Mappings are stored at `public/mappings/mcp-1.7.10.zip` and `public/mappings/legacymappings-1.7.10-build.1-pre1-v2.jar`.

## Credits

- Decompiler: [Vineflower](https://github.com/Vineflower/vineflower)
- Wasm wrapper: [@run-slicer/vf](https://www.npmjs.com/package/@run-slicer/vf)
- Mappings: [MCPMappingsArchive](https://github.com/ModCoderPack/MCPMappingsArchive) (MCP stable_12 for 1.7.10) and [LegacyMappings](https://github.com/LegacyModdingMC/LegacyMappings)
- Bytecode rewriting: [ASM](https://asm.ow2.io/) `commons.ClassRemapper`

`./src/ui/intellij-icons/` includes icons from [IntelliJ Platform](https://intellij-icons.jetbrains.design), Apache 2.0.
