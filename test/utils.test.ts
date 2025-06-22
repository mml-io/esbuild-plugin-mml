import { createDocNameToOutputUrl, createUrlMapping } from "../src/utils";

describe("utils", () => {
  describe("createDocNameToOutputUrl", () => {
    it("should create a function that prefixes document names", () => {
      const docNameToOutputUrl = createDocNameToOutputUrl("ws:///");
      expect(docNameToOutputUrl("test.html")).toBe("ws:///test.html");
    });

    it("should work with different prefixes", () => {
      const docNameToOutputUrl = createDocNameToOutputUrl("https://example.com/");
      expect(docNameToOutputUrl("document.html")).toBe("https://example.com/document.html");
    });
  });

  describe("createUrlMapping", () => {
    it("should create URL mappings for discovered entry points", () => {
      const discoveredEntryPoints = {
        tsx: new Set(["/project/src/component.tsx", "/project/components/widget.tsx"]),
        html: new Set(["/project/pages/index.html", "/project/docs/readme.html"]),
        world: new Set<string>(),
      };
      const sourceRoot = "/project";

      const mapping = createUrlMapping(discoveredEntryPoints, sourceRoot);

      expect(mapping).toEqual({
        "src/component.tsx": "src-component.html",
        "components/widget.tsx": "components-widget.html",
        "pages/index.html": "pages-index.html",
        "docs/readme.html": "docs-readme.html",
      });
    });

    it("should handle empty discovered entry points", () => {
      const discoveredEntryPoints = {
        tsx: new Set<string>(),
        html: new Set<string>(),
        world: new Set<string>(),
      };
      const sourceRoot = "/project";

      const mapping = createUrlMapping(discoveredEntryPoints, sourceRoot);

      expect(mapping).toEqual({});
    });

    it("should handle complex paths correctly", () => {
      const discoveredEntryPoints = {
        tsx: new Set(["/project/src/components/ui/Button.tsx"]),
        html: new Set(["/project/public/pages/contact.html"]),
        world: new Set<string>(),
      };
      const sourceRoot = "/project";

      const mapping = createUrlMapping(discoveredEntryPoints, sourceRoot);

      expect(mapping).toEqual({
        "src/components/ui/Button.tsx": "src-components-ui-Button.html",
        "public/pages/contact.html": "public-pages-contact.html",
      });
    });
  });
}); 