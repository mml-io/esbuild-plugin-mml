import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";

describe("Complex Import Scenarios", () => {
  const testOutdir = "test/generated/complex-imports";

  beforeEach(async () => {
    await fsp.rm(testOutdir, { recursive: true, force: true });
  });

  it("should handle circular MML imports gracefully", async () => {
    const outdir = path.join(testOutdir, "circular-mml");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create files with circular MML imports
    const fileX = path.join("test/src", "circular-x.ts");
    const fileY = path.join("test/src", "circular-y.ts");
    
    await fsp.writeFile(fileX, `
      import y from "mml:./circular-y";
      export default {
        type: "m-group",
        children: [y],
      };
    `);
    
    await fsp.writeFile(fileY, `
      import x from "mml:./circular-x";
      export default {
        type: "m-cube",
        attr: { id: "cube-from-y" },
      };
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/circular-x.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);
      
      // Should either handle gracefully or fail with meaningful error
      if (result.errors.length > 0) {
        const errorMessages = result.errors.map(e => e.text).join(', ');
        // Should mention circular dependency or similar
        expect(errorMessages).toMatch(/circular|dependency|resolve/i);
      } else {
        // If successful, check that output was created
        const outputFiles = await fsp.readdir(outdir);
        expect(outputFiles.length).toBeGreaterThan(0);
      }
      
    } catch (error) {
      // Should provide meaningful error about circular imports
      expect(error).toBeDefined();
      expect(String(error)).toMatch(/circular|dependency|resolve/i);
    } finally {
      // Clean up
      await fsp.rm(fileX, { force: true });
      await fsp.rm(fileY, { force: true });
    }
  });

  it("should handle deep import chains", async () => {
    const outdir = path.join(testOutdir, "deep-chains");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a chain of imports: chain-a -> chain-b -> chain-c -> chain-d
    const chainA = path.join("test/src", "chain-a.ts");
    const chainB = path.join("test/src", "chain-b.ts");
    const chainC = path.join("test/src", "chain-c.ts");
    const chainD = path.join("test/src", "chain-d.ts");
    
    await fsp.writeFile(chainD, `
      export default {
        type: "m-cube",
        attr: { id: "end-of-chain" },
      };
    `);
    
    await fsp.writeFile(chainC, `
      import d from "mml:./chain-d";
      export default {
        type: "m-group",
        children: [d],
        attr: { id: "chain-c" },
      };
    `);
    
    await fsp.writeFile(chainB, `
      import c from "mml:./chain-c";
      export default {
        type: "m-group",
        children: [c],
        attr: { id: "chain-b" },
      };
    `);
    
    await fsp.writeFile(chainA, `
      import b from "mml:./chain-b";
      export default {
        type: "m-group",
        children: [b],
        attr: { id: "chain-a" },
      };
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/chain-a.ts"],
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
      
      // Check that output files were created
      const outputFiles = await fsp.readdir(outdir);
      expect(outputFiles.length).toBeGreaterThan(0);
      
      // Check for manifest.json
      const manifestPath = path.join(outdir, "manifest.json");
      const manifestExists = await fsp.access(manifestPath).then(() => true).catch(() => false);
      expect(manifestExists).toBe(true);
      
      if (manifestExists) {
        const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf-8"));
        expect(manifest.documentNameToPath).toBeDefined();
        // Should have entries for all the chain files
        expect(Object.keys(manifest.documentNameToPath).length).toBeGreaterThan(0);
      }
      
    } catch (error) {
      fail(`Deep import chain handling failed: ${error}`);
    } finally {
      // Clean up
      await fsp.rm(chainA, { force: true });
      await fsp.rm(chainB, { force: true });
      await fsp.rm(chainC, { force: true });
      await fsp.rm(chainD, { force: true });
    }
  });

  it("should handle mixed regular and mml: imports", async () => {
    const outdir = path.join(testOutdir, "mixed-imports");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a test file that imports both regular and mml: modules
    const mixedFile = path.join("test/src", "mixed-imports.ts");
    await fsp.writeFile(mixedFile, `
      // Regular import
      import { d } from "./b";
      
      // MML import
      import b from "mml:./b";
      
      // Regular asset import
      import duck from "./duck.glb";
      
      console.log("Mixed imports:", d, b, duck);
      export default { d, b, duck };
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/mixed-imports.ts"],
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
      
      // Check that output files were created
      const outputFiles = await fsp.readdir(outdir);
      expect(outputFiles.length).toBeGreaterThan(0);
      
      // Check for manifest.json
      const manifestPath = path.join(outdir, "manifest.json");
      const manifestExists = await fsp.access(manifestPath).then(() => true).catch(() => false);
      expect(manifestExists).toBe(true);
      
      if (manifestExists) {
        const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf-8"));
        // Should have document mappings
        expect(manifest.documentNameToPath).toBeDefined();
        // Should have asset mappings
        expect(manifest.assetNameToPath).toBeDefined();
      }
      
    } catch (error) {
      throw new Error(`Mixed imports handling failed: ${error}`);
    } finally {
      // Clean up
      await fsp.rm(mixedFile, { force: true });
    }
  });

  it("should handle cross-directory imports", async () => {
    const outdir = path.join(testOutdir, "cross-directory");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a complex directory structure
    await fsp.mkdir(path.join("test/src", "modules", "ui"), { recursive: true });
    await fsp.mkdir(path.join("test/src", "components", "widgets"), { recursive: true });
    
    const uiModule = path.join("test/src", "modules", "ui", "button.ts");
    const widget = path.join("test/src", "components", "widgets", "panel.ts");
    const main = path.join("test/src", "cross-dir-main.ts");
    
    await fsp.writeFile(uiModule, `
      export default {
        type: "m-cube",
        attr: { id: "ui-button", color: "blue" },
      };
    `);
    
    await fsp.writeFile(widget, `
      import button from "mml:../../modules/ui/button";
      
      export default {
        type: "m-group",
        children: [button],
        attr: { id: "widget-panel" },
      };
    `);
    
    await fsp.writeFile(main, `
      import panel from "mml:./components/widgets/panel";
      import button from "mml:./modules/ui/button";
      
      export default {
        type: "m-group",
        children: [panel, button],
        attr: { id: "cross-dir-main" },
      };
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/cross-dir-main.ts"],
        plugins: [mml()],
      };

      const result = await esbuild.build(config);
      expect(result.errors.length).toBe(0);
      
      // Check that all cross-directory references were resolved
      const manifestPath = path.join(outdir, "manifest.json");
      const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf-8"));
      
      expect(manifest.documentNameToPath).toBeDefined();
      expect(Object.keys(manifest.documentNameToPath).length).toBeGreaterThan(0);
      
    } finally {
      await fsp.rm(uiModule, { force: true });
      await fsp.rm(widget, { force: true });
      await fsp.rm(main, { force: true });
      await fsp.rm(path.join("test/src", "modules"), { recursive: true, force: true });
      await fsp.rm(path.join("test/src", "components"), { recursive: true, force: true });
    }
  });

  it("should handle explicit file extensions in mml: imports", async () => {
    const outdir = path.join(testOutdir, "explicit-extensions");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    const moduleFile = path.join("test/src", "explicit-module.ts");
    const htmlFile = path.join("test/src", "explicit-template.html");
    const mainFile = path.join("test/src", "explicit-main.ts");
    
    await fsp.writeFile(moduleFile, `
      export default {
        type: "m-cube",
        attr: { id: "explicit-module" },
      };
    `);
    
    await fsp.writeFile(htmlFile, `
      <!DOCTYPE html>
      <html>
        <head><title>Explicit Template</title></head>
        <body><h1>Template with explicit extension</h1></body>
      </html>
    `);
    
    await fsp.writeFile(mainFile, `
      // Import with explicit .ts extension
      import module from "mml:./explicit-module.ts";
      
      // Import with explicit .html extension
      import template from "mml:./explicit-template.html";
      
      console.log("Explicit imports:", module, template);
      export default { module, template };
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/explicit-main.ts"],
        plugins: [mml()],
      };

      const result = await esbuild.build(config);
      expect(result.errors.length).toBe(0);
      
      const manifestPath = path.join(outdir, "manifest.json");
      const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf-8"));
      
      // Should handle both .ts and .html imports with explicit extensions
      expect(Object.keys(manifest.documentNameToPath).length).toBeGreaterThan(0);
      
    } finally {
      await fsp.rm(moduleFile, { force: true });
      await fsp.rm(htmlFile, { force: true });
      await fsp.rm(mainFile, { force: true });
    }
  });

  it("should handle implicit file extension resolution in mml: imports", async () => {
    const outdir = path.join(testOutdir, "implicit-extensions");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    const moduleFile = path.join("test/src", "implicit-module.ts");
    const mainFile = path.join("test/src", "implicit-main.ts");
    
    await fsp.writeFile(moduleFile, `
      export default {
        type: "m-cube",
        attr: { id: "implicit-module" },
      };
    `);
    
    await fsp.writeFile(mainFile, `
      // Import without explicit extension - should resolve to .ts
      import module from "mml:./implicit-module";
      
      console.log("Implicit import:", module);
      export default { module };
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/implicit-main.ts"],
        plugins: [mml()],
      };

      const result = await esbuild.build(config);
      expect(result.errors.length).toBe(0);
      
      const manifestPath = path.join(outdir, "manifest.json");
      const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf-8"));
      
      // Should resolve the implicit extension correctly
      expect(Object.keys(manifest.documentNameToPath).length).toBeGreaterThan(0);
      
    } finally {
      await fsp.rm(moduleFile, { force: true });
      await fsp.rm(mainFile, { force: true });
    }
  });

  it("should handle different import styles from MML modules", async () => {
    const outdir = path.join(testOutdir, "import-styles");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    const namedExportModule = path.join("test/src", "named-exports.ts");
    const defaultExportModule = path.join("test/src", "default-export.ts");
    const importStylesMain = path.join("test/src", "import-styles-main.ts");
    
    await fsp.writeFile(namedExportModule, `
      export const cube = {
        type: "m-cube",
        attr: { id: "named-cube" },
      };
      
      export const sphere = {
        type: "m-sphere",
        attr: { id: "named-sphere" },
      };
      
      export default {
        type: "m-group",
        children: [cube, sphere],
      };
    `);
    
    await fsp.writeFile(defaultExportModule, `
      export default {
        type: "m-cube",
        attr: { id: "default-cube", color: "red" },
      };
    `);
    
    await fsp.writeFile(importStylesMain, `
      // Default import
      import defaultCube from "mml:./default-export";
      
      // Named imports (though MML typically uses default exports for URLs)
      import namedGroup from "mml:./named-exports";
      
      console.log("Import styles:", defaultCube, namedGroup);
      export default { defaultCube, namedGroup };
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/import-styles-main.ts"],
        plugins: [mml()],
      };

      const result = await esbuild.build(config);
      expect(result.errors.length).toBe(0);
      
      const manifestPath = path.join(outdir, "manifest.json");
      const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf-8"));
      
      // Should handle different import styles
      expect(Object.keys(manifest.documentNameToPath).length).toBeGreaterThan(0);
      
    } finally {
      await fsp.rm(namedExportModule, { force: true });
      await fsp.rm(defaultExportModule, { force: true });
      await fsp.rm(importStylesMain, { force: true });
    }
  });

}); 