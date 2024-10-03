import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";
import { fail } from "node:assert";
import { waitForDebugger } from "node:inspector";

if (process.cwd() !== path.dirname(__dirname)) {
  console.log(process.cwd(), path.dirname(__dirname));
  fail(
    "These tests include cases that rely on relative paths. Please run jest from the project root or use `npm run jest`",
  );
}

const commentRegExp = /\s+\/\/.*(?=\n)/g;

function stripComments(content: string): string {
  return content.replaceAll(commentRegExp, "");
}

async function waitForDispose() {
  // NOTE: this is required because the onDispose callback is synchronous, so we
  //  can't wait for the child processes to finish before returning without
  //  blocking the main thread. This _feels_ like a bug in the API as we're
  //  expected to `await` the dispose call anyway. Hopefully we can resolve
  //  this after adding the capability upstream.
  await new Promise((resolve) => setTimeout(resolve, 200));
}

async function* walk(dir: string): AsyncGenerator<{
  path: string;
  content: string;
}> {
  const files = await fsp.readdir(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = await fsp.stat(fullPath);

    if (stat.isDirectory()) {
      yield* walk(fullPath);
    } else {
      if (
        !file.endsWith(".html") &&
        !file.endsWith(".json") &&
        !file.endsWith(".js")
      ) {
        yield {
          path: path.relative(__dirname, fullPath),
          content: file,
        };
        continue;
      }
      const content = await fsp.readFile(fullPath, "utf-8");
      yield {
        path: path.relative(__dirname, fullPath),
        content: stripComments(content),
      };
    }
  }
}

const absoluteOutdir = __dirname + "/generated/absolute-outpath";
const relativeOutdir = "test/generated/relative-outpath";

describe("mml plugin", () => {
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
        plugins: [mml()],
      };

      await esbuild.build(config);

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
        plugins: [mml()],
      };

      await esbuild.build(config);

      await waitForDispose();

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("with import prefix", async () => {
      const outdir = path.join(outPrefix, "import-prefix");
      await fsp.rm(outdir, { recursive: true, force: true });
      const config = {
        outdir,
        entryPoints: ["mml:test/src/a.ts"],
        plugins: [
          mml({
            importPrefix: "foo/",
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
        plugins: [
          mml({
            outputProcessor: () => ({
              onOutput(output) {
                return { path: path.join("bar/", output) };
              },
              onAsset(asset) {
                return { path: path.join("baz/", asset) };
              },
            }),
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
        plugins: [
          mml({
            outputProcessor: () => ({
              onOutput(output: string) {
                return {
                  importStr: "quux/" + output,
                };
              },
              onAsset(asset) {
                return { path: path.join("qack/", asset) };
              },
            }),
          }),
        ],
      };

      await esbuild.build(config);

      await waitForDispose();

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("with new import and path from output processor", async () => {
      const outdir = path.join(outPrefix, "new-import-and-path");
      await fsp.rm(outdir, { recursive: true, force: true });
      const config = {
        outdir,
        entryPoints: ["mml:test/src/a.ts"],
        plugins: [
          mml({
            outputProcessor: () => ({
              onOutput(output: string) {
                return {
                  path: "flump/" + output,
                  importStr: "blump/" + output,
                };
              },
              onAsset(asset) {
                return {
                  path: path.join("flop/", asset),
                  importStr: "blip/" + asset,
                };
              },
            }),
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

describe("context", () => {
  it("watch", async () => {
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
      plugins: [mml({})],
    };

    const ctx = await esbuild.context(config);

    await ctx.watch();

    await new Promise((resolve) => setTimeout(resolve, 200));

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path + "/1");
    }

    await fsp.appendFile(
      "test/scratch/watch/a.ts",
      "\nimport e from 'mml:./e'; console.log(e);",
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path + "/2");
    }

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
