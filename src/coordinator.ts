import * as esbuild from "esbuild";
import { makeResultProcessor } from "./results";
import { worldContext } from "./world";
import { documentContext } from "./documents";

export interface CoordinatorOptions {
  verbose: boolean;
  options: esbuild.BuildOptions;
  worlds: string[];
  documents: string[];
  assetDir: string;
  processor: ReturnType<typeof makeResultProcessor>;
  build: esbuild.PluginBuild["esbuild"];
}

function subsetOf<T>(set: Set<T>, subset: Set<T>): boolean {
  return Array.from(subset).every((v) => set.has(v));
}

function union<T>(s1: Set<T>, s2: Set<T>): Set<T> {
  const result = new Set<T>();
  s1.forEach((v) => result.add(v));
  s2.forEach((v) => result.add(v));
  return result;
}

export class Coordinator {
  private running = false;
  private building = true;
  private documents: Set<string>;
  private discoveredDocuments = new Set<string>();
  private docsCtx?: esbuild.BuildContext;
  private worldCtx?: esbuild.BuildContext;

  constructor(private options: CoordinatorOptions) {
    this.documents = new Set(options.documents);
  }

  public async start() {
    this.worldCtx = await worldContext({
      ...this.options,
      onEnd: (result, discoveredDocuments, importStubs) => {
        discoveredDocuments.forEach((d) => this.discoveredDocuments.add(d));
        this.options.processor.pushResult("world", result, importStubs);
      },
    });

    void this.worldCtx.watch();

    this.running = true;
    await this.tick(true);
  }

  async tick(firstTick = false) {
    if (firstTick || !subsetOf(this.documents, this.discoveredDocuments)) {
      this.documents = union(this.documents, this.discoveredDocuments);
      this.discoveredDocuments.clear();

      const oldDocsCtx = this.docsCtx;

      this.docsCtx = await documentContext({
        ...this.options,
        documents: Array.from(this.documents),
        onDiscoveredDocuments: (discoveredDocuments) => {
          discoveredDocuments.forEach((d) => this.discoveredDocuments.add(d));
        },
        onEnd: async (result, importStubs) => {
          this.options.processor.pushResult("document", result, importStubs);
          await this.options.processor.process();
          this.building = false;
        },
      });

      void this.docsCtx.watch();

      await oldDocsCtx?.dispose();
    }
    setImmediate(() => {
      if (this.running) void this.tick();
    });
  }

  async finish(): Promise<void> {
    while (this.building) {
      await new Promise(setImmediate);
    }
    await Promise.all([this.docsCtx?.dispose(), this.worldCtx?.dispose()]);
    this.running = false;
  }
}
