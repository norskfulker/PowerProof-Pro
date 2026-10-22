/**
 * Each ready-made page's colours: the gradient its first section starts on, and the mesh its
 * thumbnail is drawn with in the Add page dialog. Deep, natural pairs (forest, ember, ocean, berry,
 * night) so white text on them stays readable (every `from`/`to` is at least 4.5:1 against white,
 * checked in template-art.test.ts).
 */
export interface TemplateArt {
  /** First section: linear gradient, white text */
  from: string;
  to: string;
  angle: number;
  /** Thumbnail: soft glows layered over the gradient */
  glow: [string, string];
}

export const TEMPLATE_ART: Record<string, TemplateArt> = {
  launch: { from: "#0b5c45", to: "#0d6e73", angle: 135, glow: ["#7ee8c0", "#ffd27a"] },
  sale: { from: "#9a3412", to: "#b45309", angle: 120, glow: ["#ffd27a", "#ff9a7a"] },
  bio: { from: "#0c4a6e", to: "#0f766e", angle: 150, glow: ["#8fd3ff", "#b7f0d2"] },
  lead: { from: "#831843", to: "#9a3412", angle: 135, glow: ["#ffb199", "#ffd27a"] },
  squeeze: { from: "#111827", to: "#1f3b37", angle: 160, glow: ["#7ee8c0", "#8fd3ff"] },
  booking: { from: "#115e59", to: "#1e40af", angle: 135, glow: ["#8fd3ff", "#d4f27a"] },
  clickthrough: { from: "#7c2d12", to: "#a16207", angle: 125, glow: ["#ffcf66", "#ffb199"] },
  blank: { from: "#1f2937", to: "#374151", angle: 135, glow: ["#c3cbd3", "#e5e7eb"] },
};

export const artFor = (template: string): TemplateArt => TEMPLATE_ART[template] ?? TEMPLATE_ART.blank;

/** The CSS background for a template's thumbnail: two glows over its gradient */
export function thumbnailBackground(template: string): string {
  const a = artFor(template);
  return [
    `radial-gradient(60% 70% at 85% 10%, ${a.glow[0]}cc 0%, transparent 60%)`,
    `radial-gradient(55% 65% at 10% 100%, ${a.glow[1]}aa 0%, transparent 60%)`,
    `linear-gradient(${a.angle}deg, ${a.from}, ${a.to})`,
  ].join(", ");
}
