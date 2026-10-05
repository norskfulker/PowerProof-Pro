import type { CoverSpec, CurrencyCode, ProductKind, TaxCode, TrafficSource } from "../types";

/** Raw product seeds: realistic things Indian creators sell. Prices in INR major units. */
export const PRODUCT_SEEDS: {
  title: string;
  kind: ProductKind;
  price: number;
  compareAt?: number;
  status: "published" | "draft" | "archived";
  description: string;
  cover: Omit<CoverSpec, "title">;
  files: [string, number, string][];
  taxCode: string;
  weight: number;
}[] = [
  {
    title: "Second Brain for Founders",
    kind: "notion",
    price: 1499,
    compareAt: 2499,
    status: "published",
    description:
      "A Notion workspace that holds your goals, projects, notes and weekly reviews in one place. Duplicate it, fill it in, stop losing ideas in WhatsApp chats with yourself.",
    cover: { template: "split", subtitle: "Notion kit", bg: "#0F3D33", fg: "#F5F6F4", accent: "#C9A24F" },
    files: [["second-brain-setup-guide.pdf", 2_400_000, "application/pdf"], ["notion-template-link.txt", 1_200, "text/plain"]],
    taxCode: "998433",
    weight: 9,
  },
  {
    title: "Monsoon Moods: 12 Lightroom Presets",
    kind: "preset",
    price: 799,
    status: "published",
    description:
      "Twelve presets built on rainy Mumbai streets. Moody greens, warm skin tones, no orange-teal cliché. Works on Lightroom mobile and desktop.",
    cover: { template: "frame", subtitle: "Lightroom presets", bg: "#1D5C7A", fg: "#F5F6F4", accent: "#C9A24F" },
    files: [["monsoon-moods.zip", 18_600_000, "application/zip"], ["install-guide.pdf", 900_000, "application/pdf"]],
    taxCode: "998434",
    weight: 8,
  },
  {
    title: "The Freelance Pricing Playbook",
    kind: "ebook",
    price: 599,
    status: "published",
    description:
      "How to quote in rupees and dollars without underselling yourself. Scripts, rate cards and the email you send when a client says it's too much.",
    cover: { template: "block", subtitle: "Ebook · 84 pages", bg: "#C9A24F", fg: "#0C1F1B", accent: "#0F3D33" },
    files: [["freelance-pricing-playbook.pdf", 5_100_000, "application/pdf"], ["rate-card.xlsx", 64_000, "application/vnd.ms-excel"]],
    taxCode: "998431",
    weight: 10,
  },
  {
    title: "60 Instagram Carousel Templates",
    kind: "template",
    price: 999,
    compareAt: 1499,
    status: "published",
    description:
      "Sixty Canva carousels for coaches and educators. Swap your colours once, every slide follows. Hooks and caption prompts included.",
    cover: { template: "grid", subtitle: "Canva templates", bg: "#F5F6F4", fg: "#0C1F1B", accent: "#C9A24F" },
    files: [["canva-links.pdf", 400_000, "application/pdf"]],
    taxCode: "998433",
    weight: 7,
  },
  {
    title: "UPSC Modern History Mind Maps",
    kind: "ebook",
    price: 349,
    status: "published",
    description:
      "120 hand-drawn mind maps from 1757 to 1947. Made by a two-time interview candidate. Print them or keep them on your tablet.",
    cover: { template: "stack", subtitle: "Study notes", bg: "#0C1F1B", fg: "#F5F6F4", accent: "#C9A24F" },
    files: [["modern-history-mind-maps.pdf", 32_000_000, "application/pdf"]],
    taxCode: "998431",
    weight: 9,
  },
  {
    title: "Notion Wedding Planner",
    kind: "notion",
    price: 699,
    status: "published",
    description:
      "Guest lists, vendor calls, budgets and the seven functions you forgot you agreed to. Shareable with family, without the 200-message group.",
    cover: { template: "badge", subtitle: "Notion kit", bg: "#F6EFDF", fg: "#0C1F1B", accent: "#A9823A" },
    files: [["wedding-planner-guide.pdf", 1_800_000, "application/pdf"]],
    taxCode: "998433",
    weight: 5,
  },
  {
    title: "Fintech Dashboard UI Kit",
    kind: "template",
    price: 2499,
    status: "published",
    description:
      "A Figma kit with 140 components and 24 screens for payments and banking apps. Auto layout, variables, light theme ready.",
    cover: { template: "split", subtitle: "Figma UI kit", bg: "#E3ECE8", fg: "#0F3D33", accent: "#0F3D33" },
    files: [["fintech-ui-kit.fig", 46_000_000, "application/octet-stream"], ["license.pdf", 120_000, "application/pdf"]],
    taxCode: "998434",
    weight: 4,
  },
  {
    title: "Sunday Meal Prep: 40 Indian Recipes",
    kind: "ebook",
    price: 299,
    status: "published",
    description:
      "Cook for two hours on Sunday, eat well till Thursday. Vegetarian-first, with shopping lists for a regular kirana run.",
    cover: { template: "frame", subtitle: "Ebook · Recipes", bg: "#B7791F", fg: "#F5F6F4", accent: "#0C1F1B" },
    files: [["sunday-meal-prep.pdf", 12_400_000, "application/pdf"]],
    taxCode: "998431",
    weight: 6,
  },
  {
    title: "Lo-fi Chai Beats Sample Pack",
    kind: "audio",
    price: 1199,
    status: "published",
    description:
      "180 royalty-free loops, one-shots and tanpura drones recorded in Pune. WAV, 24-bit. Clear for YouTube and Reels.",
    cover: { template: "block", subtitle: "Sample pack", bg: "#0F3D33", fg: "#C9A24F", accent: "#F5F6F4" },
    files: [["lofi-chai-beats.zip", 412_000_000, "application/zip"]],
    taxCode: "998434",
    weight: 4,
  },
  {
    title: "Resume Templates That Get Read",
    kind: "template",
    price: 249,
    status: "published",
    description:
      "Five one-page resumes that pass ATS checks and still look like a human made them. Google Docs and Word.",
    cover: { template: "badge", subtitle: "Templates", bg: "#FFFFFF", fg: "#0C1F1B", accent: "#0F3D33" },
    files: [["resume-templates.zip", 3_200_000, "application/zip"]],
    taxCode: "998433",
    weight: 8,
  },
  {
    title: "Couples Budget Tracker (Google Sheets)",
    kind: "template",
    price: 399,
    status: "draft",
    description:
      "One sheet for two people and their joint goals. Splits rent, EMIs and the Goa trip fund without awkward conversations.",
    cover: { template: "grid", subtitle: "Google Sheets", bg: "#1F7A4D", fg: "#F5F6F4", accent: "#C9A24F" },
    files: [["budget-tracker-link.pdf", 210_000, "application/pdf"]],
    taxCode: "998433",
    weight: 0,
  },
  {
    title: "Start Your Newsletter in 7 Days",
    kind: "course",
    price: 2999,
    status: "archived",
    description:
      "A seven-lesson video course on picking a niche, writing the first five issues and getting your first 500 readers.",
    cover: { template: "stack", subtitle: "Video course", bg: "#C9A24F", fg: "#0C1F1B", accent: "#0F3D33" },
    files: [["course-access.pdf", 150_000, "application/pdf"]],
    taxCode: "999293",
    weight: 1,
  },
];

export const CUSTOMER_SEEDS: [string, string, string, CurrencyCode][] = [
  ["Priya Sharma", "India", "IN", "INR"],
  ["Rahul Verma", "India", "IN", "INR"],
  ["Sneha Iyer", "India", "IN", "INR"],
  ["Arjun Mehta", "India", "IN", "INR"],
  ["Kavya Nair", "India", "IN", "INR"],
  ["Rohan Gupta", "India", "IN", "INR"],
  ["Ishita Banerjee", "India", "IN", "INR"],
  ["Vikram Singh", "India", "IN", "INR"],
  ["Ananya Reddy", "India", "IN", "INR"],
  ["Aditya Kulkarni", "India", "IN", "INR"],
  ["Meera Pillai", "India", "IN", "INR"],
  ["Siddharth Joshi", "India", "IN", "INR"],
  ["Pooja Desai", "India", "IN", "INR"],
  ["Emily Carter", "United States", "US", "USD"],
  ["Jordan Lee", "United States", "US", "USD"],
  ["Neha Kapoor", "United States", "US", "USD"],
  ["Oliver Brown", "United Kingdom", "GB", "GBP"],
  ["Aisha Khan", "United Kingdom", "GB", "GBP"],
  ["Fatima Al Mansoori", "United Arab Emirates", "AE", "AED"],
  ["Sameer Qureshi", "United Arab Emirates", "AE", "AED"],
  ["Wei Lin Tan", "Singapore", "SG", "SGD"],
  ["Lucas Martin", "Canada", "CA", "CAD"],
  ["Chloe Wilson", "Australia", "AU", "AUD"],
  ["Lena Fischer", "Germany", "DE", "EUR"],
  ["Tanvi Shah", "India", "IN", "INR"],
];

export const SOURCE_WEIGHTS: [TrafficSource, number][] = [
  ["instagram", 46],
  ["direct", 22],
  ["google", 16],
  ["youtube", 10],
  ["twitter", 4],
  ["newsletter", 2],
];

export const TAX_CODES: TaxCode[] = [
  { code: "998431", kind: "SAC", description: "Online text-based information (ebooks, guides)", rate: 18 },
  { code: "998433", kind: "SAC", description: "Other online content (templates, kits)", rate: 18, isDefault: true },
  { code: "998434", kind: "SAC", description: "Software and digital downloads", rate: 18 },
  { code: "999293", kind: "SAC", description: "Commercial training and coaching", rate: 18 },
  { code: "998439", kind: "SAC", description: "Other online content not elsewhere listed", rate: 18 },
];
