import * as esbuild from "esbuild";
import {
  createMMLRefHandler,
  createTSXHandler,
  createWorldHandler,
  createHTMLHandler,
} from "../src/build-handlers";

describe("build-handlers", () => {
  describe("createMMLRefHandler", () => {
    it("should return existing URL mapping", () => {
      const sourceRoot = "/project";
      const entryPointToOutputUrl = {
        "src/component.tsx": "src-component.html",
      };
      const documentPrefix = "ws:///";
      
      const handler = createMMLRefHandler(sourceRoot, entryPointToOutputUrl, documentPrefix);
      
      const result = handler({
        path: "/project/src/component.tsx",
        namespace: "mml-build-ref",
        suffix: "",
        pluginData: undefined,
        with: {},
      });

      expect(result).toEqual({
        contents: "ws:///src-component.html",
        loader: "text",
        resolveDir: "/project/src",
        watchFiles: ["/project/src/component.tsx"],
      });
    });

    it("should create fallback URL for undiscovered files", async () => {
      const sourceRoot = "/project";
      const entryPointToOutputUrl: Record<string, string> = {};
      const documentPrefix = "ws:///";
      
      const handler = createMMLRefHandler(sourceRoot, entryPointToOutputUrl, documentPrefix);
      
      const result = await handler({
        path: "/project/src/new-file.tsx",
        namespace: "mml-build-ref",
        suffix: "",
        pluginData: undefined,
        with: {},
      });

      expect(result.contents).toBe("ws:///src-new-file.html");
      expect(result.loader).toBe("text");
      expect(entryPointToOutputUrl["src/new-file.tsx"]).toBe("src-new-file.html");
    });
  });

  describe("createTSXHandler", () => {
    it("should return a handler that reads TSX files", async () => {
      const handler = createTSXHandler();
      
      // Mock fs.promises.readFile
      const originalReadFile = require("fs").promises.readFile;
      require("fs").promises.readFile = jest.fn().mockResolvedValue("const content = 'test';");
      
      const result = await handler({
        path: "/project/src/component.tsx",
        namespace: "mml-build-tsx",
        suffix: "",
        pluginData: undefined,
        with: {},
      });

      expect(result).toEqual({
        contents: "const content = 'test';",
        loader: "tsx",
        resolveDir: "/project/src",
        watchFiles: ["/project/src/component.tsx"],
      });

      // Restore original
      require("fs").promises.readFile = originalReadFile;
    });
  });

  describe("createWorldHandler", () => {
    it("should return a handler that reads world files", async () => {
      const handler = createWorldHandler();
      
      // Mock fs.promises.readFile
      const originalReadFile = require("fs").promises.readFile;
      require("fs").promises.readFile = jest.fn().mockResolvedValue("export default { name: 'world' };");
      
      const result = await handler({
        path: "/project/src/world.ts",
        namespace: "mml-build-world",
        suffix: "",
        pluginData: undefined,
        with: {},
      });

      expect(result).toEqual({
        contents: "export default { name: 'world' };",
        loader: "tsx",
        resolveDir: "/project/src",
        watchFiles: ["/project/src/world.ts"],
      });

      // Restore original
      require("fs").promises.readFile = originalReadFile;
    });
  });

  describe("createHTMLHandler", () => {
    it("should return a handler that reads HTML files", async () => {
      const handler = createHTMLHandler();
      
      // Mock fs.promises.readFile
      const originalReadFile = require("fs").promises.readFile;
      require("fs").promises.readFile = jest.fn().mockResolvedValue("<html><body>Test</body></html>");
      
      const result = await handler({
        path: "/project/src/template.html",
        namespace: "mml-build-html",
        suffix: "",
        pluginData: undefined,
        with: {},
      });

      expect(result).toEqual({
        contents: "<html><body>Test</body></html>",
        loader: "text",
        resolveDir: "/project/src",
        watchFiles: ["/project/src/template.html"],
      });

      // Restore original
      require("fs").promises.readFile = originalReadFile;
    });
  });
}); 