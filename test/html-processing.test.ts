import * as esbuild from "esbuild";
import { mml } from "../src";
import fsp from "node:fs/promises";
import path from "node:path";
import { waitForDispose, walk } from "./test-helpers";

describe("HTML Processing", () => {
  const testOutdir = "test/generated/html-processing";

  beforeEach(async () => {
    await fsp.rm(testOutdir, { recursive: true, force: true });
  });

  it("should handle HTML files as entry points", async () => {
    const outdir = path.join(testOutdir, "html-entry-points");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    const config = {
      outdir,
      entryPoints: ["mml:test/src/c/d.html"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        assetDir: "assets",
      })],
    };

    const result = await esbuild.build(config);

    // Check for build errors and fail the test if any exist
    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });

  it("should handle mml: imports of HTML files", async () => {
    const outdir = path.join(testOutdir, "mml-html-imports");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    // Create a test file that imports an HTML file using mml: prefix
    const testFile = path.join("test/src", "html-importer.ts");
    await fsp.writeFile(testFile, `
      import htmlContent from "mml:./c/d.html";
      
      export default function() {
        return htmlContent;
      }
    `);

    try {
      const config = {
        outdir,
        entryPoints: [`mml:test/src/html-importer.ts`],
        loader: {
          ".glb": "file" as const,
        },
        plugins: [mml({
          assetDir: "assets",
        })],
      };

      const result = await esbuild.build(config);

      // Check for build errors
      if (result.errors.length > 0) {
        throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
      }

      await waitForDispose();

      // Verify the output files exist
      const manifestPath = path.join(outdir, "manifest.json");
      const manifestExists = await fsp.access(manifestPath).then(() => true).catch(() => false);
      expect(manifestExists).toBe(true);

      for await (const { path, content } of walk(outdir)) {
        expect(content).toMatchSnapshot(path);
      }
    } finally {
      // Clean up the test file
      await fsp.rm(testFile, { force: true });
    }
  });

  it("should process the existing c/d.html file", async () => {
    const outdir = path.join(testOutdir, "subdirectory-html");
    await fsp.rm(outdir, { recursive: true, force: true });
    
    const config = {
      outdir,
      entryPoints: ["mml:test/src/c/d.html"],
      loader: {
        ".glb": "file" as const,
      },
      plugins: [mml({
        assetDir: "assets",
      })],
    };

    const result = await esbuild.build(config);

    // Check for build errors and fail the test if any exist
    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });

  it("should handle HTML files with various content types", async () => {
    const outdir = path.join(testOutdir, "content-structures");
    
    // Create test HTML files with different structures
    await fsp.mkdir(path.join(testOutdir, "html-test"), { recursive: true });
    
    const simpleHtml = `<!DOCTYPE html><html><head><title>Simple</title></head><body><h1>Hello</h1></body></html>`;
    const complexHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Complex HTML</title>
        </head>
        <body>
          <header>
            <nav>
              <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About</a></li>
              </ul>
            </nav>
          </header>
          <main>
            <section id="content">
              <article>
                <h1>Article Title</h1>
                <p>Some content here.</p>
              </article>
            </section>
          </main>
          <footer>
            <p>&copy; 2023 Test</p>
          </footer>
        </body>
      </html>
    `;
    
    await fsp.writeFile(path.join(testOutdir, "html-test", "simple.html"), simpleHtml);
    await fsp.writeFile(path.join(testOutdir, "html-test", "complex.html"), complexHtml);
    
    const config = {
      outdir,
      entryPoints: [
        `mml:${testOutdir}/html-test/simple.html`,
        `mml:${testOutdir}/html-test/complex.html`
      ],
      plugins: [mml()],
    };

    const result = await esbuild.build(config);

    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Check that both HTML files were processed
    const manifestPath = path.join(outdir, "manifest.json");
    const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf-8"));
    
    expect(Object.keys(manifest.documentNameToPath)).toHaveLength(2);
    expect(Object.keys(manifest.documentNameToPath)).toContain("test-generated-html-processing-html-test-simple.html");
    expect(Object.keys(manifest.documentNameToPath)).toContain("test-generated-html-processing-html-test-complex.html");

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });

  it("should handle HTML files with embedded scripts and styles", async () => {
    const outdir = path.join(testOutdir, "embedded-content");
    
    // Create HTML with embedded scripts and styles
    await fsp.mkdir(path.join(testOutdir, "embedded-test"), { recursive: true });
    
    const embeddedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Embedded Content</title>
          <style>
            body { background-color: #f0f0f0; }
            .container { max-width: 800px; margin: 0 auto; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 id="title">Dynamic Title</h1>
            <p>This page has embedded JavaScript and CSS.</p>
            <button onclick="changeTitle()">Change Title</button>
          </div>
          
          <script>
            function changeTitle() {
              document.getElementById('title').textContent = 'Title Changed!';
            }
            
            // Initialize the page
            document.addEventListener('DOMContentLoaded', function() {
              console.log('Page loaded with embedded scripts');
            });
          </script>
        </body>
      </html>
    `;
    
    await fsp.writeFile(path.join(testOutdir, "embedded-test", "embedded.html"), embeddedHtml);
    
    const config = {
      outdir,
      entryPoints: [`mml:${testOutdir}/embedded-test/embedded.html`],
      plugins: [mml()],
    };

    const result = await esbuild.build(config);

    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Verify the HTML file was processed and the content is preserved
    const outputHtml = path.join(outdir, "test-generated-html-processing-embedded-test-embedded.html");
    const content = await fsp.readFile(outputHtml, "utf-8");
    
    expect(content).toContain("<style>");
    expect(content).toContain("background-color: #f0f0f0");
    expect(content).toContain("<script>");
    expect(content).toContain("function changeTitle()");

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });

  it("should handle complex HTML structures and nested elements", async () => {
    const outdir = path.join(testOutdir, "complex-structures");
    
    // Create HTML with deeply nested and complex structures
    await fsp.mkdir(path.join(testOutdir, "complex-test"), { recursive: true });
    
    const complexStructureHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Complex Structure</title>
        </head>
        <body>
          <div class="wrapper">
            <header class="main-header">
              <nav class="navigation">
                <ul class="nav-list">
                  <li class="nav-item">
                    <a href="#section1" class="nav-link">
                      <span class="link-text">Section 1</span>
                      <span class="link-icon">→</span>
                    </a>
                    <ul class="sub-nav">
                      <li><a href="#subsection1">Sub 1</a></li>
                      <li><a href="#subsection2">Sub 2</a></li>
                    </ul>
                  </li>
                </ul>
              </nav>
            </header>
            
            <main class="content">
              <section id="section1" class="content-section">
                <article class="article">
                  <header class="article-header">
                    <h1 class="article-title">Complex Article</h1>
                    <div class="article-meta">
                      <time datetime="2023-01-01">January 1, 2023</time>
                      <address class="author">
                        <a rel="author" href="/author">John Doe</a>
                      </address>
                    </div>
                  </header>
                  
                  <div class="article-content">
                    <p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
                    <blockquote cite="https://example.com">
                      <p>This is a quoted paragraph.</p>
                      <footer>
                        — <cite>Famous Author</cite>
                      </footer>
                    </blockquote>
                    
                    <figure class="image-figure">
                      <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzMzMzMyIvPjwvc3ZnPg==" alt="Test image" />
                      <figcaption>This is a test image caption</figcaption>
                    </figure>
                    
                    <details class="expandable-content">
                      <summary>Click to expand</summary>
                      <div class="hidden-content">
                        <p>This content was hidden.</p>
                        <ul>
                          <li>Item 1</li>
                          <li>Item 2</li>
                        </ul>
                      </div>
                    </details>
                  </div>
                </article>
              </section>
            </main>
            
            <aside class="sidebar">
              <section class="widget">
                <h3>Related Links</h3>
                <nav class="widget-nav">
                  <ul>
                    <li><a href="#related1">Related 1</a></li>
                    <li><a href="#related2">Related 2</a></li>
                  </ul>
                </nav>
              </section>
            </aside>
            
            <footer class="main-footer">
              <div class="footer-content">
                <p>&copy; 2023 Complex Structure Test</p>
              </div>
            </footer>
          </div>
        </body>
      </html>
    `;
    
    await fsp.writeFile(path.join(testOutdir, "complex-test", "complex.html"), complexStructureHtml);
    
    const config = {
      outdir,
      entryPoints: [`mml:${testOutdir}/complex-test/complex.html`],
      plugins: [mml()],
    };

    const result = await esbuild.build(config);

    if (result.errors.length > 0) {
      throw new Error(`Build failed with errors: ${result.errors.map(e => e.text).join(', ')}`);
    }

    await waitForDispose();

    // Verify the complex HTML structure was preserved
    const outputHtml = path.join(outdir, "test-generated-html-processing-complex-test-complex.html");
    const content = await fsp.readFile(outputHtml, "utf-8");
    
    expect(content).toContain('<nav class="navigation">');
    expect(content).toContain('<ul class="sub-nav">');
    expect(content).toContain('<article class="article">');
    expect(content).toContain('<figure class="image-figure">');
    expect(content).toContain('<details class="expandable-content">');
    expect(content).toContain('<aside class="sidebar">');

    for await (const { path, content } of walk(outdir)) {
      expect(content).toMatchSnapshot(path);
    }
  });
}); 