import * as path from "path";
import { DiscoveredEntryPoints } from "./types";

export function createDocNameToOutputUrl(documentPrefix: string) {
  return (docName: string) => documentPrefix + docName;
}

export function createUrlMapping(
  discoveredEntryPoints: DiscoveredEntryPoints,
  sourceRoot: string,
  stripHtmlExtension = false,
  globalNamePrefix = "",
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const allEntryPoints = [
    ...discoveredEntryPoints.tsx,
    ...discoveredEntryPoints.html,
  ];

  for (const entryPoint of allEntryPoints) {
    const relativePath = path.relative(sourceRoot, entryPoint);
    let outputUrl = relativePath
      .replace(/[/\\]/g, "-")
      .replace(/\.(tsx?|html)$/, ".html");

    if (stripHtmlExtension) {
      outputUrl = outputUrl.replace(/\.html$/, "");
    }

    // Apply globalNamePrefix to the document name if provided
    if (globalNamePrefix) {
      outputUrl = globalNamePrefix + "-" + outputUrl;
    }

    mapping[relativePath] = outputUrl;
  }

  return mapping;
}
