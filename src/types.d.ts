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
    fileName: string;
    url: string;
    path: string;
}
