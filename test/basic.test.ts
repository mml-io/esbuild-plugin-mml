import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";
import { waitForDispose, walk, absoluteOutdir, relativeOutdir } from "./test-helpers";

describe("Basic MML Plugin Functionality", () => {
  describe.each([
    { name: "absolute", outPrefix: absoluteOutdir },
    { name: "relative", outPrefix: relativeOutdir },
  ])("with $name outdir path", ({ outPrefix }) => {
    it("with default options", async () => {
      const outdir = path.join(outPrefix, "default-options");
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

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("world", async () => {
      const outdir = path.join(outPrefix, "world");
      await fsp.rm(outdir, { recursive: true, force: true });
      const config = {
        outdir,
        entryPoints: ["mml:test/src/world.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      await esbuild.build(config);

      await waitForDispose();

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("with documentPrefix", async () => {
      const outdir = path.join(outPrefix, "documentPrefix");
      await fsp.rm(outdir, { recursive: true, force: true });
      const config = {
        outdir,
        entryPoints: ["mml:test/src/a.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [
          mml({
            assetDir: "assets",
            documentPrefix: "wss://example.com/v1/someprefix_",
          }),
        ],
      };

      await esbuild.build(config);

      await waitForDispose();

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("with new path from output processor", async () => {
      const outdir = path.join(outPrefix, "new-path");
      await fsp.rm(outdir, { recursive: true, force: true });
      const config = {
        outdir,
        entryPoints: ["mml:test/src/a.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [
          mml({
            assetDir: "baz",
          }),
        ],
      };

      await esbuild.build(config);

      await waitForDispose();

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("with new import from output processor", async () => {
      const outdir = path.join(outPrefix, "new-import");
      await fsp.rm(outdir, { recursive: true, force: true });
      const config = {
        outdir,
        entryPoints: ["mml:test/src/a.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [
          mml({
            documentPrefix: "quux:",
            assetDir: "qack",
          }),
        ],
      };

      await esbuild.build(config);

      await waitForDispose();

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("with assetPrefix", async () => {
      const outdir = path.join(outPrefix, "assetPrefix");
      await fsp.rm(outdir, { recursive: true, force: true });
      const config = {
        outdir,
        entryPoints: ["mml:test/src/a.ts"],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [
          mml({
            documentPrefix: "blump:",
            assetDir: "flop",
            assetPrefix: "https://example.com/v1/blip/",
          }),
        ],
      };

      await esbuild.build(config);

      await waitForDispose();

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });
  });
}); 