import { processWorldFile } from "../src/world-processing";
import fsp from "node:fs/promises";

// Mock esbuild
jest.mock("esbuild");
import * as esbuild from "esbuild";
const mockEsbuild = esbuild as jest.Mocked<typeof esbuild>;

describe("world-processing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any test files
    try {
      await fsp.rm("build", { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("processWorldFile", () => {
    it("should call esbuild with correct configuration", async () => {
      const absolutePath = "/project/src/world.ts";
      const jsPath = "build/world.js";
      const sourceRoot = "/project";
      const entryPointToOutputUrl = { "components/scene.tsx": "components-scene.html" };
      const documentPrefix = "ws:///";
      const outdir = "build";
      const mockLog = jest.fn();

      mockEsbuild.build.mockResolvedValue({
        errors: [],
        warnings: [],
        outputFiles: [{ text: "module.exports = { type: 'world' };" }],
      } as any);

      // Let file system operations happen for real

      await processWorldFile(
        absolutePath,
        jsPath,
        sourceRoot,
        entryPointToOutputUrl,
        documentPrefix,
        outdir,
        mockLog,
      );

      expect(mockEsbuild.build).toHaveBeenCalledWith(
        expect.objectContaining({
          entryPoints: [absolutePath],
          bundle: true,
          format: "cjs",
          platform: "node",
          target: "node16",
          write: false,
        }),
      );
    });

    it("should handle build errors gracefully", async () => {
      const absolutePath = "/project/src/world.ts";
      const jsPath = "build/world.js";
      const sourceRoot = "/project";
      const entryPointToOutputUrl = {};
      const documentPrefix = "ws:///";
      const outdir = "build";
      const mockLog = jest.fn();

      mockEsbuild.build.mockResolvedValue({
        errors: [{ text: "Build failed" }],
        warnings: [],
      } as any);

      await expect(
        processWorldFile(
          absolutePath,
          jsPath,
          sourceRoot,
          entryPointToOutputUrl,
          documentPrefix,
          outdir,
          mockLog,
        ),
      ).rejects.toThrow("World file build failed: Build failed");
    });
  });
}); 