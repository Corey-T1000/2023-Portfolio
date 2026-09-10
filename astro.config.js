import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

// Astro 7: prefetch and sharp are built in. Tailwind 3 runs through
// postcss.config.cjs (@astrojs/tailwind does not support Astro 6+).
// compressHTML stays `true` to keep the pre-v7 whitespace behaviour
// (the v7 default changed to "jsx").
export default defineConfig({
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
  },
  integrations: [mdx()],
});
