import { DiscoveredEntryPoints } from "./types";
export declare function noop(): void;
export declare function createDocNameToOutputUrl(documentPrefix: string): (docName: string) => string;
export declare function createUrlMapping(discoveredEntryPoints: DiscoveredEntryPoints, sourceRoot: string, stripHtmlExtension?: boolean): Record<string, string>;
