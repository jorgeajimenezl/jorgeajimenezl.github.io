import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

import preact from "@astrojs/preact";

export default defineConfig({
  site: "https://jorgeajimenezl.dev",
  integrations: [mdx(), sitemap(), tailwind(), preact()],
});
