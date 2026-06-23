import mdx from "@astrojs/mdx";
import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";

// Astro 5: prefetch is built-in (the @astrojs/prefetch integration is gone),
// and sharp is the default image service (no explicit service config needed).
export default defineConfig({
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
  },
  integrations: [mdx(), tailwind()],
});
