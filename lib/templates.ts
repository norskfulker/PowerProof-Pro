import type { PageTemplate } from "./types";

export interface TemplateMeta {
  id: PageTemplate;
  name: string;
  description: string;
  bestFor: string;
  /** Wireframe rows for the thumbnail: h = heading, t = text, b = button, i = image, g = grid */
  wire: ("h" | "t" | "b" | "i" | "g" | "q")[];
  popular?: boolean;
}

export const TEMPLATES: TemplateMeta[] = [
  { id: "launch", name: "Launch", description: "Hero, what's inside, a quote, FAQ and a buy button.", bestFor: "Ebooks and kits", wire: ["h", "t", "b", "g", "q", "b"], popular: true },
  { id: "minimal", name: "Minimal", description: "One line, one image, one button. Fast on any phone.", bestFor: "Presets and packs", wire: ["i", "h", "t", "b"] },
  { id: "bundle", name: "Bundle", description: "Several products, one price, with savings shown.", bestFor: "Bundles", wire: ["h", "g", "t", "b"] },
  { id: "creator", name: "Creator", description: "A short bio up top, all your products below.", bestFor: "Link in bio", wire: ["i", "h", "t", "g"], popular: true },
  { id: "waitlist", name: "Pre-order", description: "Take money now, deliver on launch day.", bestFor: "Upcoming launches", wire: ["h", "t", "b"] },
  { id: "blank", name: "Blank", description: "Start from nothing, or paste your own HTML.", bestFor: "Full control", wire: ["t"] },
];

export function templateMeta(id: PageTemplate): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
