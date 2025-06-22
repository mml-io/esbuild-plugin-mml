import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";
import { walk, relativeOutdir } from "./test-helpers";

describe("Watch Mode and Context", () => {
  it("watch", async () => {
    // This test verifies watch mode functionality including:
    // 1. Initial build with valid files
    // 2. Error handling for imports to non-existent files (should fail build)
    // 3. Consistent error behavior across multiple file modifications
    // 4. Proper incremental rebuilds during watch mode
    
    // copy src files to a scratch directory
    const scratchDir = path.join(__dirname, "scratch", "watch");
    await fsp.rm(scratchDir, { recursive: true, force: true });
    await fsp.mkdir(scratchDir, { recursive: true });
    await fsp.cp("test/src", scratchDir, { recursive: true });

    const outdir = path.join(relativeOutdir, "context", "watch");
    await fsp.rm(outdir, { recursive: true, force: true });

    const config = {
      outdir,
      entryPoints: ["test/scratch/watch/world.ts"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        assetDir: "assets"
      })],
    };

    const ctx = await esbuild.context(config);

    await ctx.watch();

    await new Promise((resolve) => setTimeout(resolve, 200));

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path + "/1");
    }

    // Test error handling: Add import of non-existent file './e'
    // This should cause the build to fail with a resolution error,
    // consistent with standard esbuild behavior
    await fsp.appendFile(
      "test/scratch/watch/a.ts",
      "\nimport e from 'mml:./e'; console.log(e);",
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path + "/2");
    }

    // Test that multiple files importing the same non-existent file
    // both fail consistently
    await fsp.appendFile(
      "test/scratch/watch/b.ts",
      "\nimport e from 'mml:./e'; console.log(e);",
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path + "/3");
    }

    await ctx.dispose();

    // This is a hack to wait for dispose to finish, because the onDispose plugin
    // callback is not async so we cannot wait the promises running inside it.
    await new Promise((resolve) => setTimeout(resolve, 20));
  });


}); 