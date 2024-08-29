import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";
import { fail } from "node:assert";
import { documentContext } from "../src/documents";
import { worldContext } from "../src/world";
import { makeResultProcessor } from "../src/results";

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

describe("worldContext", () => {
  let ctx: esbuild.BuildContext | undefined = undefined;

  afterEach(() => ctx?.dispose());

  it("creates world JSON", async () => {
    const outdir = path.join(relativeOutdir, "world-context");

    ctx = await worldContext({
      worlds: ["test/src/world.ts"],
      options: { outdir },
      onEnd: async (_, discoveredDocuments, importStubs) => {
        for await (const { path, content } of walk(outdir)) {
          expect(content).toMatchSnapshot(path);
        }
        expect(discoveredDocuments).toEqual(new Set(["test/src/a.ts"]));
        expect(importStubs).toEqual({
          "test/src/a.ts": "mml:test/src/a.ts",
        });
      },
    });

    await ctx.rebuild();

    expect.hasAssertions();
  });
});

describe("resultProcessor", () => {
  let ctx: esbuild.BuildContext | undefined = undefined;

  afterEach(() => ctx?.dispose());

  it("re-writes import paths for worlds", async () => {
    const outdir = path.join(relativeOutdir, "result-processor", "world");

    const onEnd = makeResultProcessor(outdir, "wss://", console.log);

    ctx = await worldContext({
      worlds: ["test/src/world.ts"],
      options: { outdir },
      onEnd: async (result, _, importStubs) => {
        onEnd("world", result, importStubs);
        for await (const { path, content } of walk(outdir)) {
          expect(content).toMatchSnapshot(path);
        }
      },
    });

    await ctx.rebuild();

    expect.hasAssertions();
  });

  it("re-writes import paths for documents", async () => {
    const outdir = path.join(relativeOutdir, "result-processor", "world");

    const onEnd = makeResultProcessor(outdir, "wss://", console.log);

    ctx = await documentContext({
      documents: ["test/src/a.ts"],
      options: { outdir },
      onEnd: async (result, importStubs) => {
        onEnd("document", result, importStubs);
        for await (const { path, content } of walk(outdir)) {
          expect(content).toMatchSnapshot(path);
        }
      },
    });

    await ctx.rebuild();

    expect.hasAssertions();
  });
});

describe("documentContext", () => {
  let ctx: esbuild.BuildContext | undefined = undefined;

  afterEach(() => ctx?.dispose());

  it("creates MML HTML documents", async () => {
    const outdir = path.join(relativeOutdir, "document-context");

    ctx = await documentContext({
      documents: ["test/src/a.ts"],
      options: { outdir },
      onEnd: async (_result, importStubs) => {
        for await (const { path, content } of walk(outdir)) {
          expect(content).toMatchSnapshot(path);
        }
        expect(importStubs).toEqual({
          "test/src/b.ts": "mml:test/src/b.ts",
          "test/src/c/d.html": "mml:test/src/c/d.html",
        });
      },
    });

    await ctx.rebuild();

    expect.hasAssertions();
  });
});

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

describe("context", () => {
  it("rebuild", async () => {
    // copy src files to a scratch directory
    const scratchDir = path.join(__dirname, "scratch", "rebuild");
    await fsp.rm(scratchDir, { recursive: true, force: true });
    await fsp.mkdir(scratchDir, { recursive: true });
    await fsp.cp("test/src", scratchDir, { recursive: true });

    const outdir = path.join(relativeOutdir, "context", "rebuild");
    const config = {
      outdir,
      plugins: [
        mml({
          worlds: ["test/scratch/rebuild/world.ts"],
        }),
      ],
    };

    const ctx = await esbuild.context(config);

    await ctx.rebuild();

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }

    await fsp.appendFile(
      "test/scratch/rebuild/a.ts",
      "\nimport e from 'mml:./e'; console.log(e);",
    );

    await ctx.rebuild();

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }

    await ctx.dispose();
  });

  it("watch", async () => {
    // copy src files to a scratch directory
    const scratchDir = path.join(__dirname, "scratch", "watch");
    await fsp.rm(scratchDir, { recursive: true, force: true });
    await fsp.mkdir(scratchDir, { recursive: true });
    await fsp.cp("test/src", scratchDir, { recursive: true });

    const outdir = path.join(relativeOutdir, "context", "watch");
    const config = {
      outdir,
      plugins: [
        mml({
          worlds: ["test/scratch/watch/world.ts"],
        }),
      ],
    };

    const ctx = await esbuild.context(config);

    await ctx.watch();

    await ctx.rebuild(); // Wait for initial build

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }

    await fsp.appendFile(
      "test/scratch/watch/a.ts",
      "\nimport e from 'mml:./e'; console.log(e);",
    );

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });

    await ctx.dispose();

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path + ".new");
    }
  });
});
