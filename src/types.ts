export interface MMLPluginOptions {
  verbose?: boolean;
  // A prefix to apply to all ids (assets, documents, and worlds) - e.g. if document name was "my-document" and globalNamePrefix was "my-prefix", the document id would be "my-prefix-my-document"
  // This is applied before the documentPrefix, assetPrefix, and assetDir. It allows "namespacing" of ids to avoid conflicts with other projects.
  globalNamePrefix?: string;
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
