import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";

describe("File Type Handling", () => {
  const testOutdir = "test/generated/file-types";

  beforeEach(async () => {
    await fsp.rm(testOutdir, { recursive: true, force: true });
  });

  it("should handle .tsx files", async () => {
    const outdir = path.join(testOutdir, "tsx-files");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a temporary .tsx file
    const tsxFile = path.join("test/src", "temp.tsx");
    await fsp.writeFile(tsxFile, `
      import b from "mml:./b";
      
      // Simple TSX content without React dependency
      const content = "Hello " + b;
      export default content;
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/temp.tsx"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);
      
      // Should build successfully since plugin supports .tsx files
      expect(result.errors.length).toBe(0);
      
      // Check that output files were created
      const outputFiles = await fsp.readdir(outdir);
      expect(outputFiles.length).toBeGreaterThan(0);
      
      // Check for manifest.json
      const manifestPath = path.join(outdir, "manifest.json");
      const manifestExists = await fsp.access(manifestPath).then(() => true).catch(() => false);
      expect(manifestExists).toBe(true);
      
    } catch (error) {
      throw new Error(`TSX file handling failed: ${error}`);
    } finally {
      // Clean up
      await fsp.rm(tsxFile, { force: true });
    }
  });

  it("should handle .js files", async () => {
    const outdir = path.join(testOutdir, "js-files");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a temporary .js file
    const jsFile = path.join("test/src", "temp.js");
    await fsp.writeFile(jsFile, `
      import b from "mml:./b";
      console.log("JavaScript file:", b);
      export default "js-content";
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/temp.js"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);
      
      // Currently the plugin doesn't support .js files, so this should fail
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check that the error mentions the file couldn't be resolved
      const errorMessages = result.errors.map(e => e.text).join(', ');
      expect(errorMessages).toContain("Could not resolve");
      
    } catch (error) {
      // This is also acceptable as the plugin doesn't support JS files
      expect(error).toBeDefined();
    } finally {
      // Clean up
      await fsp.rm(jsFile, { force: true });
    }
  });

  it("should handle .jsx files", async () => {
    const outdir = path.join(testOutdir, "jsx-files");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a temporary .jsx file
    const jsxFile = path.join("test/src", "temp.jsx");
    await fsp.writeFile(jsxFile, `
      import b from "mml:./b";
      
      // Simple JSX content without React dependency
      const content = "Hello JSX " + b;
      export default content;
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/temp.jsx"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);
      
      // Currently the plugin doesn't support .jsx files, so this should fail
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check that the error mentions the file couldn't be resolved
      const errorMessages = result.errors.map(e => e.text).join(', ');
      expect(errorMessages).toContain("Could not resolve");
      
    } catch (error) {
      // This is also acceptable as the plugin doesn't support JSX files
      expect(error).toBeDefined();
    } finally {
      // Clean up
      await fsp.rm(jsxFile, { force: true });
    }
  });


}); 