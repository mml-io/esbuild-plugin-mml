import fsp from "node:fs/promises";
import path from "node:path";
import { fail } from "node:assert";

// Ensure tests run from the correct directory
if (process.cwd() !== path.dirname(__dirname)) {
  console.log(process.cwd(), path.dirname(__dirname));
  fail(
    "These tests include cases that rely on relative paths. Please run jest from the project root or use `npm run jest`",
  );
}

const commentRegExp = /\s+\/\/.*(?=\n)/g;

export function stripComments(content: string): string {
  return content.replaceAll(commentRegExp, "");
}

export async function waitForDispose() {
  // NOTE: this is required because the onDispose callback is synchronous, so we
  //  can't wait for the child processes to finish before returning without
  //  blocking the main thread. This _feels_ like a bug in the API as we're
  //  expected to `await` the dispose call anyway. Hopefully we can resolve
  //  this after adding the capability upstream.
  await new Promise((resolve) => setTimeout(resolve, 200));
}

export async function* walk(dir: string): AsyncGenerator<{
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

export const absoluteOutdir = __dirname + "/generated/absolute-outpath";
export const relativeOutdir = "test/generated/relative-outpath"; 