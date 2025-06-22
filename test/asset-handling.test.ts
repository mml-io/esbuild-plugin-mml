import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";
import { waitForDispose, walk } from "./test-helpers";

describe("Asset Handling", () => {
  const testOutdir = "test/generated/asset-handling";

  beforeEach(async () => {
    await fsp.rm(testOutdir, { recursive: true, force: true });
  });

  it("should handle assets in subdirectories", async () => {
    const outdir = path.join(testOutdir, "nested-assets");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    const config = {
      outdir,
      entryPoints: ["mml:test/src/a.ts"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        assetDir: "assets",
      })],
    };

    const result = await esbuild.build(config);

    // Check for build errors and fail the test if any exist
    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Check that the .glb asset file was copied to the output directory
    const assetsDir = path.join(outdir, "assets");
    const files = await fsp.readdir(assetsDir);
    expect(files).toContain("test_src_duck.glb");

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });

  it("should handle different asset types beyond .glb files", async () => {
    const outdir = path.join(testOutdir, "different-assets");
    
    // Create test assets
    await fsp.mkdir(path.join(testOutdir, "src"), { recursive: true });
    await fsp.writeFile(path.join(testOutdir, "src", "image.png"), "fake png data");
    await fsp.writeFile(path.join(testOutdir, "src", "audio.mp3"), "fake mp3 data");
    await fsp.writeFile(path.join(testOutdir, "src", "data.json"), JSON.stringify({ test: "data" }));
    await fsp.writeFile(path.join(testOutdir, "src", "test.ts"), `
      import image from "./image.png";
      import audio from "./audio.mp3";
      import data from "./data.json";
      console.log(image, audio, data);
    `);

    const config = {
      outdir,
      entryPoints: [`mml:${testOutdir}/src/test.ts`],
      loader: {
        ".png": "file" as const,
        ".mp3": "file" as const,
        ".json": "file" as const,
      },
      plugins: [mml({
        assetDir: "assets",
      })],
    };

    const result = await esbuild.build(config);

    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Check that all asset files were copied
    const assetsDir = path.join(outdir, "assets");
    const files = await fsp.readdir(assetsDir);
    expect(files).toContain("test_generated_asset-handling_src_image.png");
    expect(files).toContain("test_generated_asset-handling_src_audio.mp3");
    expect(files).toContain("test_generated_asset-handling_src_data.json");

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });

  it("should generate correct asset URLs with custom assetPrefix", async () => {
    const outdir = path.join(testOutdir, "custom-prefix");
    
    const config = {
      outdir,
      entryPoints: ["mml:test/src/a.ts"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        assetDir: "static",
        assetPrefix: "https://cdn.example.com/v2/",
      })],
    };

    const result = await esbuild.build(config);

    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Check that assets use the custom prefix in the built file
    const builtFile = path.join(outdir, "test-src-a.html");
    const content = await fsp.readFile(builtFile, "utf-8");
    expect(content).toContain("https://cdn.example.com/v2/test_src_duck.glb");

    // Check that the asset was copied to the correct directory
    const staticDir = path.join(outdir, "static");
    const files = await fsp.readdir(staticDir);
    expect(files).toContain("test_src_duck.glb");

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });

  it("should copy assets to correct output directory based on assetDir option", async () => {
    const outdir = path.join(testOutdir, "custom-assetdir");
    
    const config = {
      outdir,
      entryPoints: ["mml:test/src/a.ts"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        assetDir: "media/files",
      })],
    };

    const result = await esbuild.build(config);

    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Check that assets were copied to the nested directory structure
    const mediaDir = path.join(outdir, "media", "files");
    const files = await fsp.readdir(mediaDir);
    expect(files).toContain("test_src_duck.glb");

    // Verify the manifest includes the correct path
    const manifestPath = path.join(outdir, "manifest.json");
    const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf-8"));
    expect(manifest.assetNameToPath["test_src_duck.glb"]).toBe("media/files/test_src_duck.glb");

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });

  it("should handle duplicate asset names in different directories", async () => {
    const outdir = path.join(testOutdir, "duplicate-names");
    
    // Create test structure with duplicate asset names
    await fsp.mkdir(path.join(testOutdir, "src/folder1"), { recursive: true });
    await fsp.mkdir(path.join(testOutdir, "src/folder2"), { recursive: true });
    await fsp.writeFile(path.join(testOutdir, "src/folder1", "asset.png"), "folder1 asset data");
    await fsp.writeFile(path.join(testOutdir, "src/folder2", "asset.png"), "folder2 asset data");
    await fsp.writeFile(path.join(testOutdir, "src", "test.ts"), `
      import asset1 from "./folder1/asset.png";
      import asset2 from "./folder2/asset.png";
      console.log(asset1, asset2);
    `);

    const config = {
      outdir,
      entryPoints: [`mml:${testOutdir}/src/test.ts`],
      loader: {
        ".png": "file" as const,
      },
      plugins: [mml({
        assetDir: "assets",
      })],
    };

    const result = await esbuild.build(config);

    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Check that both assets were copied with unique names
    const assetsDir = path.join(outdir, "assets");
    const files = await fsp.readdir(assetsDir);
    
    // Should have both assets with path-based naming to avoid conflicts
    const folder1Asset = files.find(f => f.includes("folder1") && f.includes("asset.png"));
    const folder2Asset = files.find(f => f.includes("folder2") && f.includes("asset.png"));
    
    expect(folder1Asset).toBeDefined();
    expect(folder2Asset).toBeDefined();
    expect(folder1Asset).not.toBe(folder2Asset);

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });



  it("should handle assets with complex paths containing special characters", async () => {
    const outdir = path.join(testOutdir, "special-chars");
    await fsp.rm(outdir, { recursive: true, force: true });

    // Create a subdirectory with special characters in the name
    const specialDir = path.join("test/src", "special-assets");
    await fsp.mkdir(specialDir, { recursive: true });

    // Create an asset with a complex path
    const assetPath = path.join(specialDir, "special-asset.glb");
    await fsp.copyFile("test/src/duck.glb", assetPath);

    // Create a test file that imports this asset
    const testFile = path.join("test/src", "special-import.ts");
    await fsp.writeFile(testFile, `
      import specialAsset from "./special-assets/special-asset.glb";
      export default function() {
        return specialAsset;
      }
    `);

    try {
      const config = {
        outdir,
        entryPoints: [`mml:test/src/special-import.ts`],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
          assetPrefix: "/special/",
        })],
      };

      const result = await esbuild.build(config);

      if (result.errors.length > 0) {
        throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
      }

      await waitForDispose();

      // Check that the asset was copied with a normalized name
      const manifestPath = path.join(outdir, "manifest.json");
      const manifestContent = await fsp.readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent);

      expect(Object.keys(manifest.assetNameToPath)).toContain("test_src_special-assets_special-asset.glb");
      expect(manifest.assetNameToPath["test_src_special-assets_special-asset.glb"]).toBe("assets/test_src_special-assets_special-asset.glb");

      // Check that the asset file exists
      const assetOutputPath = path.join(outdir, "assets", "test_src_special-assets_special-asset.glb");
      await expect(fsp.access(assetOutputPath)).resolves.toBeUndefined();

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    } finally {
      // Clean up
      await fsp.rm(specialDir, { recursive: true, force: true });
      await fsp.rm(testFile, { force: true });
    }
  });
}); 