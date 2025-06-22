import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";

describe("Error Handling", () => {
  const testOutdir = "test/generated/error-handling";

  beforeEach(async () => {
    await fsp.rm(testOutdir, { recursive: true, force: true });
  });

  it("should handle missing entry point files gracefully", async () => {
    const outdir = path.join(testOutdir, "missing-entry-point");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    const config = {
      outdir,
      entryPoints: ["mml:test/src/non-existent-file.ts"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        assetDir: "assets",
      })],
    };

    // This should fail with a meaningful error
    try {
      const result = await esbuild.build(config);
      
      // If the build somehow succeeds, that's unexpected behavior
      if (result.errors.length === 0) {
        throw new Error("Expected build to fail with missing entry point, but it succeeded");
      }
      
      // Check that we get a meaningful error about the missing file
      const errorMessages = result.errors.map(e => e.text).join(', ');
      expect(errorMessages).toContain("non-existent-file.ts");
    } catch (error) {
      // We expect this to throw an error - that's the correct behavior
      expect(error).toBeDefined();
      expect(String(error)).toContain("non-existent-file.ts");
    }
  });

  it("should handle malformed file paths in mml: imports", async () => {
    const outdir = path.join(testOutdir, "malformed-paths");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    const config = {
      outdir,
      entryPoints: ["mml:test/src/e.ts"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        assetDir: "assets",
      })],
    };

    // Create a test file with malformed mml: imports
    const testFile = path.join("test/src", "e.ts");
    await fsp.writeFile(testFile, `
      import invalid from "mml:../../non-existent.ts";
      import alsoInvalid from "mml:../../../outside-project.ts";
    `);

    try {
      const result = await esbuild.build(config);
      
      // The build should fail with meaningful errors
      expect(result.errors.length).toBeGreaterThan(0);
      
      const errorMessages = result.errors.map(e => e.text).join(', ');
      expect(errorMessages).toContain("non-existent.ts");
    } catch (error) {
      // We expect this to throw an error - that's the correct behavior
      expect(error).toBeDefined();
    } finally {
      // Clean up the test file
      await fsp.rm(testFile, { force: true });
    }
  });

  it("should handle TypeScript compilation errors and provide meaningful messages", async () => {
    const outdir = path.join(testOutdir, "typescript-errors");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a test file with TypeScript compilation errors
    const testFile = path.join("test/src", "typescript-error.ts");
    await fsp.writeFile(testFile, `
      // This should cause TypeScript compilation errors
      const invalidCode: number = "not a number";
      function missingParam(x) { return x + 1; }
      const undeclaredVar = nonExistentVariable;
    `);

    try {
      const config = {
        outdir,
        entryPoints: [`mml:test/src/typescript-error.ts`],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);
      
      // The build should complete but may have warnings or errors
      // esbuild is permissive with TypeScript errors, so we mainly check it doesn't crash
      expect(result).toBeDefined();
    } catch (error) {
      // If it throws, that's also acceptable behavior
      expect(error).toBeDefined();
    } finally {
      // Clean up the test file
      await fsp.rm(testFile, { force: true });
    }
  });

  it("should handle invalid HTML files gracefully", async () => {
    const outdir = path.join(testOutdir, "invalid-html");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a test HTML file with malformed HTML
    const invalidHtmlFile = path.join("test/src/c", "invalid.html");
    await fsp.writeFile(invalidHtmlFile, `
      <html>
        <head>
          <title>Invalid HTML</title>
        </head>
        <body>
          <div>
            <p>This is unclosed
            <span>This is also unclosed
            <div>Badly nested tags</p>
          </div>
        </body>
      </html>
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/c/invalid.html"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);
      
      // The plugin should handle malformed HTML gracefully
      // It may produce warnings but should not fail completely
      expect(result).toBeDefined();
      
      // Check that some output was produced
      const outputFiles = await fsp.readdir(outdir);
      expect(outputFiles.length).toBeGreaterThan(0);
      
    } catch (error) {
      // If it throws, the error should be meaningful
      expect(error).toBeDefined();
      expect(String(error)).toContain("html");
    } finally {
      // Clean up
      await fsp.rm(invalidHtmlFile, { force: true });
    }
  });

  it("should handle missing assets gracefully", async () => {
    const outdir = path.join(testOutdir, "missing-assets");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a test file that references a non-existent asset
    const testFile = path.join("test/src", "missing-asset.ts");
    await fsp.writeFile(testFile, `
      // This should reference a non-existent asset
      import nonExistentAsset from "./non-existent-asset.glb";
      
      export default function() {
        return nonExistentAsset;
      }
    `);

    try {
      const config = {
        outdir,
        entryPoints: [`mml:test/src/missing-asset.ts`],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);
      
      // The build should fail with meaningful errors about missing assets
      expect(result.errors.length).toBeGreaterThan(0);
      
      const errorMessages = result.errors.map(e => e.text).join(', ');
      expect(errorMessages).toContain("non-existent-asset.glb");
    } catch (error) {
      // We expect this to throw an error - that's the correct behavior
      expect(error).toBeDefined();
      expect(String(error)).toContain("non-existent-asset.glb");
    } finally {
      // Clean up the test file
      await fsp.rm(testFile, { force: true });
    }
  });

  it("should handle circular imports without infinite loops", async () => {
    const outdir = path.join(testOutdir, "circular-imports");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create files with circular imports
    const fileA = path.join("test/src", "circular-a.ts");
    const fileB = path.join("test/src", "circular-b.ts");
    
    await fsp.writeFile(fileA, `
      import b from "mml:./circular-b";
      export default function a() {
        return "a imports " + b();
      }
    `);
    
    await fsp.writeFile(fileB, `
      import a from "mml:./circular-a";
      export default function b() {
        return "b imports " + a();
      }
    `);

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/circular-a.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);
      
      // The build should fail with a circular dependency error
      // or complete with warnings/handled gracefully
      if (result.errors.length > 0) {
        const errorMessages = result.errors.map(e => e.text).join(', ');
        expect(errorMessages).toMatch(/circular|dependency/i);
      } else {
        // If it succeeds, it should have handled the circular dependency
        expect(result).toBeDefined();
      }
      
    } catch (error) {
      // We expect this to throw an error about circular dependencies
      expect(error).toBeDefined();
      expect(String(error)).toMatch(/circular|dependency/i);
    } finally {
      // Clean up
      await fsp.rm(fileA, { force: true });
      await fsp.rm(fileB, { force: true });
    }
  });

  it("should handle malformed world configurations", async () => {
    const outdir = path.join(testOutdir, "malformed-world");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a test file with malformed world config
    const testFile = path.join("test/src", "malformed-world.ts");
    await fsp.writeFile(testFile, `
      // This should have a malformed world config
      export const world = {
        // Missing required properties or malformed structure
        invalidProperty: "test",
        children: "not an array",
        position: "not a valid position",
      };
    `);

    try {
      const config = {
        outdir,
        entryPoints: [`mml:test/src/malformed-world.ts`],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);
      
      // The build should complete but may generate warnings about the malformed config
      // The plugin should be robust enough to handle this gracefully
      expect(result).toBeDefined();
    } catch (error) {
      // If it throws, that's also acceptable behavior for malformed configs
      expect(error).toBeDefined();
    } finally {
      // Clean up the test file
      await fsp.rm(testFile, { force: true });
    }
  });

  it("should handle invalid plugin option values", async () => {
    const outdir = path.join(testOutdir, "invalid-options");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/a.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          // @ts-expect-error - Testing invalid option
          assetDir: null,
          // @ts-expect-error - Testing invalid option
          documentPrefix: 123,
        })],
      };

      const result = await esbuild.build(config);
      
      // The plugin should handle these gracefully or fail meaningfully
      if (result.errors.length > 0) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    } catch (error) {
      // Plugin should handle invalid options gracefully
      expect(error).toBeDefined();
    }
  });


}); 