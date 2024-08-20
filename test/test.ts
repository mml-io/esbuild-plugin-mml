import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";
import { fail } from "node:assert";

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
      const config = {
        outdir,
        plugins: [
          mml({
            documents: ["test/src/a.ts"],
          }),
        ],
      };

      await esbuild.build(config);

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("world", async () => {
      const outdir = path.join(outPrefix, "world");
      const config = {
        outdir,
        plugins: [
          mml({
            worlds: ["test/src/world.ts"],
          }),
        ],
      };

      await esbuild.build(config);

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("with import prefix", async () => {
      const outdir = path.join(outPrefix, "import-prefix");
      const config = {
        outdir,
        plugins: [
          mml({
            documents: ["test/src/a.ts"],
            importPrefix: "foo/",
          }),
        ],
      };

      await esbuild.build(config);

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("with new path from output processor", async () => {
      const outdir = path.join(outPrefix, "new-path");
      const config = {
        outdir,
        plugins: [
          mml({
            documents: ["test/src/a.ts"],
            outputProcessor: () => ({
              onOutput(output) {
                return { path: path.join("bar/", output) };
              },
            }),
          }),
        ],
      };

      await esbuild.build(config);

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("with new import from output processor", async () => {
      const outdir = path.join(outPrefix, "new-import");
      const config = {
        outdir,
        plugins: [
          mml({
            documents: ["test/src/a.ts"],
            outputProcessor: () => ({
              onOutput(output: string) {
                return {
                  importStr: "quux/" + output,
                };
              },
            }),
          }),
        ],
      };

      await esbuild.build(config);

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });

    it("with new import and path from output processor", async () => {
      const outdir = path.join(outPrefix, "new-import-and-path");
      const config = {
        outdir,
        plugins: [
          mml({
            documents: ["test/src/a.ts"],
            outputProcessor: () => ({
              onOutput(output: string) {
                return {
                  path: "flump/" + output,
                  importStr: "blump/" + output,
                };
              },
            }),
          }),
        ],
      };

      await esbuild.build(config);

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    });
  });
});
