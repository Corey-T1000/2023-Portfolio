import mdx from "@astrojs/mdx";
import prefetch from "@astrojs/prefetch";
import tailwind from "@astrojs/tailwind";
import { defineConfig, sharpImageService } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  compressHTML: true,
  image: {
    service: sharpImageService()
  },
  integrations: [mdx(), prefetch(), tailwind()],
  experimental: {
    assets: true
  },
  output: "server",
  adapter: cloudflare()
});