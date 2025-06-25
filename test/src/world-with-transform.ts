
      import type { MMLWorldConfig } from "@mml-io/esbuild-plugin-mml";
      
      export default {
        name: "my-world",
        mmlDocumentsConfiguration: {
          mmlDocuments: {
            "test-document": {
              url: "test-document.html",
              position: { x: 1, y: 2, z: 3 },
              rotation: { x: 0, y: 90, z: 0 },
              scale: { x: 2, y: 2, z: 2 }
            }
          }
        }
      } satisfies MMLWorldConfig;
    