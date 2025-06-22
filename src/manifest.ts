export interface MMLBuildManifest {
  // List of paths to world JSON files
  worlds: string[];
  // Map of documents by name to manifest-relative path on disk
  documentNameToPath: Record<string, string>;
  // Map of assets by name to manifest-relative path on disk
  assetNameToPath: Record<string, string>;
  // URL prefix for documents
  documentPrefix: string;
  // URL prefix for assets
  assetPrefix: string;
}

export function makeMMLBuildManifest(
  worlds: string[],
  documentNameToPath: Record<string, string>,
  assetNameToPath: Record<string, string>,
  documentPrefix: string,
  assetPrefix: string,
): MMLBuildManifest {
  return {
    worlds,
    documentNameToPath,
    assetNameToPath,
    documentPrefix,
    assetPrefix,
  };
}
