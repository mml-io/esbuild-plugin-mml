import type { MMLWorldConfig } from "@mml-io/esbuild-plugin-mml";
import a from "mml:./a";

const name = "my-world";

export default {
  mmlDocuments: {
    duck: {
      url: a,
    },
  },
} satisfies MMLWorldConfig;
