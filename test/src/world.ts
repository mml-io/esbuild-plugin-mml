import type { WorldConfig } from "@mml-io/esbuild-plugin-mml";
//import duck from "mml:./a";

const name = "my-world";

export default {
  id: `${name}-1`,
  name: "my-world",
  mmlDocumentConfiguration: {
    mmlDocuments: {
      duck: {
        url: "foo",
      },
    },
  },
} satisfies WorldConfig;
