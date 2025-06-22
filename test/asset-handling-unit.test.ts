import * as esbuild from "esbuild";
import { createAssetHandler } from "../src/asset-handling";
import { Asset } from "../src/types";

// Mock fs/promises
jest.mock("node:fs/promises");
import fsp from "node:fs/promises";
const mockFsp = fsp as jest.Mocked<typeof fsp>;

describe("asset-handling", () => {
  describe("createAssetHandler", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockFsp.mkdir.mockResolvedValue(undefined);
      mockFsp.copyFile.mockResolvedValue(undefined);
    });

    it("should handle file assets correctly", async () => {
      const sourceRoot = "/project";
      const outdir = "build";
      const assetDir = "assets";
      const assetPrefix = "/static/";
      const assets: Asset[] = [];
      const mockBuild = {
        initialOptions: {
          loader: {
            ".glb": "file" as const,
          },
        },
      } as Partial<esbuild.PluginBuild> as esbuild.PluginBuild;

      const handler = createAssetHandler(sourceRoot, outdir, assetDir, assetPrefix, assets, mockBuild);

      const result = await handler({
        path: "/project/src/model.glb",
        namespace: "file",
        suffix: "",
        pluginData: undefined,
        with: {},
      });

      expect(result).toEqual({
        contents: "/static/src_model.glb",
        loader: "text",
      });

      expect(assets).toHaveLength(1);
      expect(assets[0]).toEqual({
        fileName: "src_model.glb",
        url: "/static/src_model.glb",
        path: "build/assets/src_model.glb",
      });

      expect(mockFsp.mkdir).toHaveBeenCalledWith("build/assets", { recursive: true });
      expect(mockFsp.copyFile).toHaveBeenCalledWith("/project/src/model.glb", "build/assets/src_model.glb");
    });

    it("should return null for non-file loaders", async () => {
      const sourceRoot = "/project";
      const outdir = "build";
      const assetDir = "";
      const assetPrefix = "/";
      const assets: Asset[] = [];
      const mockBuild = {
        initialOptions: {
          loader: {
            ".ts": "tsx" as const,
          },
        },
      } as Partial<esbuild.PluginBuild> as esbuild.PluginBuild;

      const handler = createAssetHandler(sourceRoot, outdir, assetDir, assetPrefix, assets, mockBuild);

      const result = await handler({
        path: "/project/src/component.ts",
        namespace: "file",
        suffix: "",
        pluginData: undefined,
        with: {},
      });

      expect(result).toBeNull();
      expect(assets).toHaveLength(0);
      expect(mockFsp.mkdir).not.toHaveBeenCalled();
      expect(mockFsp.copyFile).not.toHaveBeenCalled();
    });

    it("should handle assets without assetDir", async () => {
      const sourceRoot = "/project";
      const outdir = "build";
      const assetDir = "";
      const assetPrefix = "https://cdn.example.com/";
      const assets: Asset[] = [];
      const mockBuild = {
        initialOptions: {
          loader: {
            ".png": "file" as const,
          },
        },
      } as Partial<esbuild.PluginBuild> as esbuild.PluginBuild;

      const handler = createAssetHandler(sourceRoot, outdir, assetDir, assetPrefix, assets, mockBuild);

      const result = await handler({
        path: "/project/images/logo.png",
        namespace: "file",
        suffix: "",
        pluginData: undefined,
        with: {},
      });

      expect(result).toEqual({
        contents: "https://cdn.example.com/images_logo.png",
        loader: "text",
      });

      expect(assets[0]).toEqual({
        fileName: "images_logo.png",
        url: "https://cdn.example.com/images_logo.png", 
        path: "build/images_logo.png",
      });
    });
  });
}); 