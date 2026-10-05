import type { PageBlock, PageTemplate } from "./types";

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

/** Starting blocks for each template. */
export const TEMPLATE_BLOCKS: Record<PageTemplate, Omit<PageBlock, "id">[]> = {
  launch: [
    { type: "hero", heading: "Your headline goes here", body: "One sentence on who it's for and what changes for them." },
    { type: "features", heading: "What's inside", body: "First thing\nSecond thing\nThird thing" },
    { type: "testimonial", heading: "“Short quote from a happy buyer.”", body: "Name, what they do" },
    { type: "faq", heading: "Questions", body: "How do I get it?|Right after paying, on screen and by email.\nCan I get a refund?|Yes, within 7 days." },
    { type: "buy", heading: "Get it now", body: "Instant download." },
  ],
  minimal: [
    { type: "hero", heading: "Say it in one line.", body: "And one more for the details." },
    { type: "buy", heading: "Buy", body: "Instant download." },
  ],
  bundle: [
    { type: "hero", heading: "Everything, one price.", body: "All my kits in one bundle." },
    { type: "features", heading: "In the bundle", body: "Kit one\nKit two\nKit three" },
    { type: "buy", heading: "Get the bundle", body: "Save 40% versus buying separately." },
  ],
  creator: [
    { type: "hero", heading: "Hi, I'm [your name].", body: "I make things for people who make things." },
    { type: "text", heading: "About me", body: "Two or three lines about you." },
    { type: "buy", heading: "My products", body: "Pick one." },
  ],
  waitlist: [
    { type: "hero", heading: "Coming soon.", body: "Pre-order now and get it first." },
    { type: "buy", heading: "Pre-order", body: "You're charged today, it lands on launch day." },
  ],
  blank: [{ type: "text", heading: "Start here", body: "Add blocks from the left." }],
};
