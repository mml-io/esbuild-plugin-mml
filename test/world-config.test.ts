import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";
import { fail } from "node:assert";

describe("World Configuration", () => {
  const testOutdir = "test/generated/world-config";

  beforeEach(async () => {
    await fsp.rm(testOutdir, { recursive: true, force: true });
  });

  it("should handle world config with position/rotation/scale", async () => {
    const outdir = path.join(testOutdir, "world-with-transform");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a temporary world config with transform properties
    const worldWithTransformFile = path.join("test/src", "world-with-transform.ts");
    await fsp.writeFile(worldWithTransformFile, `
      import type { MMLWorldConfig } from "@mml-io/esbuild-plugin-mml";
      
      export default {
        name: "my-world",
        mmlDocumentsConfiguration: {
          mmlDocuments: {
            "test-document": {
              url: "test-document.html",
              position: { x: 1, y: 2, z: 3 },
              rotation: { x: 0, y: 90, z: 0 },
              scale: { x: 2, y: 2, z: 2 }
            }
          }
        }
      } satisfies MMLWorldConfig;
    `);

    const config = {
      outdir,
      entryPoints: ["test/src/world-with-transform.ts"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        assetDir: "assets",
      })],
    };

    const result = await esbuild.build(config);
    
    // Should build successfully
    expect(result.errors.length).toBe(0);
    
    // Check that manifest.json was created
    const manifestPath = path.join(outdir, "manifest.json");
    const manifestExists = await fsp.access(manifestPath).then(() => true).catch(() => false);
    expect(manifestExists).toBe(true);
    
    if (manifestExists) {
      const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf-8"));
      expect(manifest.worlds).toBeDefined();
      expect(Array.isArray(manifest.worlds)).toBe(true);
      expect(manifest.worlds.length).toBe(1);
      
      // Check that the world config was preserved in the JSON file
      const worldFileName = manifest.worlds[0];
      const worldFilePath = path.join(outdir, worldFileName);
      const worldFileExists = await fsp.access(worldFilePath).then(() => true).catch(() => false);
      expect(worldFileExists).toBe(true);
      
      const worldConfig = JSON.parse(await fsp.readFile(worldFilePath, "utf-8"));
      expect(worldConfig).toBeDefined();
      expect(worldConfig.name).toBe("my-world");

      expect(worldConfig.mmlDocumentsConfiguration).toBeDefined();
      expect(worldConfig.mmlDocumentsConfiguration.mmlDocuments).toBeDefined();
      expect(worldConfig.mmlDocumentsConfiguration.mmlDocuments["test-document"]).toBeDefined();
      expect(worldConfig.mmlDocumentsConfiguration.mmlDocuments["test-document"].position).toEqual({ x: 1, y: 2, z: 3 });
      expect(worldConfig.mmlDocumentsConfiguration.mmlDocuments["test-document"].rotation).toEqual({ x: 0, y: 90, z: 0 });
      expect(worldConfig.mmlDocumentsConfiguration.mmlDocuments["test-document"].scale).toEqual({ x: 2, y: 2, z: 2 });
    }
  });

  it("should handle empty world configs", async () => {
    const outdir = path.join(testOutdir, "empty-world");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a temporary world config with empty mmlDocuments
    const emptyWorldFile = path.join("test/src", "empty-world.ts");
    await fsp.writeFile(emptyWorldFile, `
      import type { MMLWorldConfig } from "@mml-io/esbuild-plugin-mml";
      
      export default {
        mmlDocuments: {},
      } satisfies MMLWorldConfig;
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["test/src/empty-world.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);
      
      // Should build successfully even with empty mmlDocuments
      expect(result.errors.length).toBe(0);
      
      // Check that manifest.json was created
      const manifestPath = path.join(outdir, "manifest.json");
      const manifestExists = await fsp.access(manifestPath).then(() => true).catch(() => false);
      expect(manifestExists).toBe(true);
      
      if (manifestExists) {
        const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf-8"));
        expect(manifest.worlds).toBeDefined();
        expect(Array.isArray(manifest.worlds)).toBe(true);
      }
      
    } catch (error) {
      fail(`Empty world config handling failed: ${error}`);
    } finally {
      // Clean up
      await fsp.rm(emptyWorldFile, { force: true });
    }
  });

  it("should handle world with multiple documents", async () => {
    const outdir = path.join(testOutdir, "world-multiple-docs");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a temporary world config with multiple documents
    const multipleDocsWorldFile = path.join("test/src", "multiple-docs-world.ts");
    await fsp.writeFile(multipleDocsWorldFile, `
      import type { MMLWorldConfig } from "@mml-io/esbuild-plugin-mml";
      
      export default {
        mmlDocuments: {
          "document-one": {
            url: "doc1.html",
            position: { x: 0, y: 0, z: 0 }
          },
          "document-two": {
            url: "doc2.html",
            position: { x: 10, y: 0, z: 0 }
          },
          "document-three": {
            url: "doc3.html",
            position: { x: 20, y: 0, z: 0 },
            rotation: { x: 0, y: 45, z: 0 }
          },
          "document-four": {
            url: "doc4.html",
            position: { x: 30, y: 0, z: 0 },
            scale: { x: 0.5, y: 0.5, z: 0.5 }
          }
        }
      } satisfies MMLWorldConfig;
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["test/src/multiple-docs-world.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);
      
      // Should build successfully
      expect(result.errors.length).toBe(0);
      
      // Check that manifest.json was created
      const manifestPath = path.join(outdir, "manifest.json");
      const manifestExists = await fsp.access(manifestPath).then(() => true).catch(() => false);
      expect(manifestExists).toBe(true);
      
      if (manifestExists) {
        const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf-8"));
        expect(manifest.worlds).toBeDefined();
        expect(Array.isArray(manifest.worlds)).toBe(true);
        expect(manifest.worlds.length).toBe(1);
        
        // Check that the world config was preserved with multiple documents in the JSON file
        const worldFileName = manifest.worlds[0];
        const worldFilePath = path.join(outdir, worldFileName);
        const worldFileExists = await fsp.access(worldFilePath).then(() => true).catch(() => false);
        expect(worldFileExists).toBe(true);
        
        const worldConfig = JSON.parse(await fsp.readFile(worldFilePath, "utf-8"));
        expect(worldConfig).toBeDefined();
        expect(worldConfig.mmlDocuments).toBeDefined();
        expect(Object.keys(worldConfig.mmlDocuments)).toHaveLength(4);
        expect(worldConfig.mmlDocuments["document-one"]).toBeDefined();
        expect(worldConfig.mmlDocuments["document-two"]).toBeDefined();
        expect(worldConfig.mmlDocuments["document-three"]).toBeDefined();
        expect(worldConfig.mmlDocuments["document-four"]).toBeDefined();
        
        // Check specific document properties
        expect(worldConfig.mmlDocuments["document-one"].url).toBe("doc1.html");
        expect(worldConfig.mmlDocuments["document-three"].rotation).toEqual({ x: 0, y: 45, z: 0 });
        expect(worldConfig.mmlDocuments["document-four"].scale).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
      }
      
    } catch (error) {
      fail(`World config with multiple documents failed: ${error}`);
    } finally {
      // Clean up
      await fsp.rm(multipleDocsWorldFile, { force: true });
    }
  });


}); 