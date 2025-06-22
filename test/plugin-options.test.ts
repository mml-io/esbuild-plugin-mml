import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";
import { waitForDispose, walk } from "./test-helpers";

describe("Plugin Options and Configuration", () => {
  const testOutdir = "test/generated/plugin-options";

  beforeEach(async () => {
    await fsp.rm(testOutdir, { recursive: true, force: true });
  });

  it("should respect verbose option for enhanced logging", async () => {
    const outdir = path.join(testOutdir, "verbose-true");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Capture console output
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/a.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          verbose: true,
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);

      // Check for build errors
      if (result.errors.length > 0) {
        throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
      }

      // Verify that verbose logging occurred
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.includes('discovered entry points'))).toBe(true);
    } finally {
      console.log = originalLog;
    }
  });

  it("should have minimal logging with verbose disabled", async () => {
    const outdir = path.join(testOutdir, "verbose-false");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Capture console output
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      const config = {
        outdir,
        entryPoints: ["mml:test/src/a.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          verbose: false, // Explicitly set to false
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);

      // Check for build errors
      if (result.errors.length > 0) {
        throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
      }

      // With verbose disabled, should not have detailed [mml]: logs
      const mmlDetailedLogs = logs.filter(log => log.includes('[mml]:'));
      expect(mmlDetailedLogs.length).toBe(0);
    } finally {
      console.log = originalLog;
    }
  });

  it("should handle all plugin options together", async () => {
    const outdir = path.join(testOutdir, "all-options");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    const config = {
      outdir,
      entryPoints: ["mml:test/src/a.ts"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        verbose: true,
        documentPrefix: "https://example.com/docs/",
        assetPrefix: "https://cdn.example.com/assets/",
        assetDir: "custom-assets",
      })],
    };

    const result = await esbuild.build(config);

    // Check for build errors
    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Check that manifest was created with all specified values
    const manifestPath = path.join(outdir, "manifest.json");
    const manifestContent = await fsp.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);
    
    expect(manifest.documentPrefix).toBe("https://example.com/docs/");
    expect(manifest.assetPrefix).toBe("https://cdn.example.com/assets/");

    // Verify that assets were copied to the custom directory
    const assetDir = path.join(outdir, "custom-assets");
    const assetExists = await fsp.access(assetDir).then(() => true).catch(() => false);
    expect(assetExists).toBe(true);
  });

  it("should handle edge cases in option values", async () => {
    const outdir = path.join(testOutdir, "edge-cases");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    const config = {
      outdir,
      entryPoints: ["mml:test/src/a.ts"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        documentPrefix: "", // Empty string
        assetPrefix: "//special-chars!@#$/",
        assetDir: "assets",
      })],
    };

    const result = await esbuild.build(config);

    // Check for build errors
    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Check that manifest was created with the specified values
    const manifestPath = path.join(outdir, "manifest.json");
    const manifestContent = await fsp.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);
    
    expect(manifest.documentPrefix).toBe("");
    expect(manifest.assetPrefix).toBe("//special-chars!@#$/");
  });

  it("should use appropriate defaults when options are not provided", async () => {
    const outdir = path.join(testOutdir, "default-options");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Test with no options provided
    const config = {
      outdir,
      entryPoints: ["mml:test/src/a.ts"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml()], // No options provided
    };

    const result = await esbuild.build(config);

    // Check for build errors and fail the test if any exist
    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Check that manifest was created with default values
    const manifestPath = path.join(outdir, "manifest.json");
    const manifestContent = await fsp.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);
    
    // Default values should be applied
    expect(manifest.documentPrefix).toBe("ws:///");
    expect(manifest.assetPrefix).toBe("/");
    expect(manifest.assetNameToPath).toBeDefined();

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });



  it("should strip html extension when stripHtmlExtension is true", async () => {
    const outdir = path.join(testOutdir, "strip-html-extension");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    const config = {
      outdir,
      entryPoints: ["mml:test/src/a.ts"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        stripHtmlExtension: true,
      })],
    };

    const result = await esbuild.build(config);

    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Check that manifest was created and URLs don't have .html extensions
    const manifestPath = path.join(outdir, "manifest.json");
    const manifestContent = await fsp.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);
    
    // The document URLs should not have .html extensions
    for (const docUrl of Object.values(manifest.documentNameToPath)) {
      expect(docUrl).not.toMatch(/\.html$/);
    }

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });
}); 