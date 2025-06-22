export interface MMLPluginOptions {
  verbose?: boolean;
  documentPrefix?: string;
  assetPrefix?: string;
  assetDir?: string;
  outdir?: string;
  stripHtmlExtension?: boolean;
}

export interface DiscoveredEntryPoints {
  world: Set<string>;
  tsx: Set<string>;
  html: Set<string>;
}

export interface Asset {
  fileName: string; // The individual asset file name
  url: string; // The url that this asset will be imported as in the output documents
  path: string; // The path to the (built) asset on disk
}
