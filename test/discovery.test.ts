import { doDiscoveryBuild } from "../src/discovery";

// Mock esbuild
jest.mock("esbuild");
import * as esbuild from "esbuild";
const mockEsbuild = esbuild as jest.Mocked<typeof esbuild>;

describe("discovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("doDiscoveryBuild", () => {
    it("should return discovered entry points", async () => {
      const esbuildOptions = {
        entryPoints: ["src/index.ts"],
        outdir: "build",
      };

      // Mock esbuild.build to return a successful result with no errors
      mockEsbuild.build.mockResolvedValue({
        errors: [],
        warnings: [],
      } as any);

      const result = await doDiscoveryBuild(esbuildOptions);

      expect(result).toEqual({
        world: expect.any(Set),
        tsx: expect.any(Set),
        html: expect.any(Set),
      });

      expect(mockEsbuild.build).toHaveBeenCalledWith(
        expect.objectContaining({
          ...esbuildOptions,
          bundle: true,
          write: false,
          metafile: true,
          plugins: expect.any(Array),
        })
      );
    });

    it("should handle build errors gracefully", async () => {
      const esbuildOptions = {
        entryPoints: ["src/index.ts"],
        outdir: "build",
      };

      // Mock esbuild.build to return errors
      mockEsbuild.build.mockResolvedValue({
        errors: [{ text: "Module not found" }],
        warnings: [],
      } as any);

      const result = await doDiscoveryBuild(esbuildOptions);

      // Should still return the structure even with errors
      expect(result).toEqual({
        world: expect.any(Set),
        tsx: expect.any(Set),
        html: expect.any(Set),
      });
    });
  });
}); 