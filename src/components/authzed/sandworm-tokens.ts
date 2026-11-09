// Sandworm tokens for the AuthZed case study showcase. Nothing here is
// invented: every value traces to the authzed/design repo (sandworm/), file
// noted per block. Transcribed 2026-10-11 from the fix/typography-demo-bugs
// worktree, where the ramps are the corrected ones.

export const STOPS = [
  "025", "050", "100", "150", "200", "300", "400", "500",
  "600", "700", "800", "850", "900", "950", "975",
] as const;

export type Family = "stone" | "magenta" | "sand" | "teal" | "red" | "violet" | "blue";

// sandworm/design/palette.md frontmatter `colors:` (the rendered hex form of
// projects/web/src/styles/sandworm-colors.ts). Cross-checked against the HSL
// vars in sandworm/app/globals.css: 104/105 stops match exactly, red-300
// differs by one in the green channel (#ffb3b6 vs #ffb2b6, HSL rounding).
export const PALETTE: Record<Family, string[]> = {
  stone: ["#f8f7f8", "#e9e7e9", "#dedddf", "#d2cfd3", "#c7c4ca", "#aaa5ac", "#8e8891", "#79727e", "#655d69", "#514856", "#3f3644", "#2a2130", "#1e1424", "#170d1c", "#0c050f"],
  magenta: ["#fbf4f8", "#f5e5ef", "#f0dbe9", "#e9c9de", "#e3bad6", "#d293bf", "#c270ab", "#b35199", "#a5318a", "#7e2a69", "#5d224e", "#3d1a32", "#22111d", "#180c15", "#180c15"],
  sand: ["#fef4ec", "#fef0e1", "#ffeedb", "#ffe2c2", "#ffd8ad", "#ffb370", "#de9663", "#bd7c56", "#a0674b", "#855642", "#684336", "#50332b", "#34231d", "#1e1510", "#18100c"],
  teal: ["#f1f8f6", "#ebf5f2", "#e8f2f1", "#dbebe9", "#cee3e1", "#a7cdca", "#72b1ad", "#549693", "#4a7d7b", "#3f6967", "#325250", "#283e3d", "#1b2726", "#0c1311", "#0c1311"],
  red: ["#fff5f5", "#fff0f0", "#ffebec", "#ffe0e1", "#ffd6d7", "#ffb3b6", "#f9808a", "#f0566d", "#c94559", "#a53b4a", "#81313c", "#5e262c", "#3b1b1e", "#1b0e0f", "#1b0e0f"],
  violet: ["#f8f6fe", "#ede8fd", "#e2d9fc", "#d8ccfa", "#cebef8", "#ad96f3", "#9278ed", "#7a5ce6", "#6242e0", "#502fb1", "#432583", "#2f1b50", "#1c122b", "#150c1d", "#150c1d"],
  blue: ["#f6fcfe", "#e8f8fd", "#d9f3fc", "#cceffa", "#beeaf8", "#96dcf3", "#78d0ed", "#5cc3e6", "#42b9e0", "#2f91b1", "#256c83", "#1b4350", "#12252b", "#0c181d", "#0c181d"],
};

// Ramp order: sandworm/design/palette.md § Ramp anatomy.
export const FAMILIES: Family[] = ["stone", "magenta", "sand", "teal", "red", "violet", "blue"];

// sandworm/DESIGN.md gradients.warm-hero.
export const WARM_HERO = ["sand-300", "red-400", "violet-600"] as const;
