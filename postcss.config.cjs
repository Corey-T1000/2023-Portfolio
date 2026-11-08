// Tailwind 3 via PostCSS. @astrojs/tailwind caps at Astro 5, so the
// integration is gone; this is the same plugin pair it injected.
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
