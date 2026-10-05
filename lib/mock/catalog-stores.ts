import type { CoverTemplate, FontPairId, HeroStyle, PaletteId, ProductKind } from "../types";

/** [title, kind, priceINR, compareAtINR|0, cover template, subtitle, file name, MB, description] */
export type ProductRow = [string, ProductKind, number, number, CoverTemplate, string, string, number, string];

export interface StoreSeed {
  id: string;
  slug: string;
  name: string;
  owner: string;
  email: string;
  city: string;
  tagline: string;
  logoText: string;
  palette: PaletteId;
  fonts: FontPairId;
  heroStyle: HeroStyle;
  colors: { bg: string; fg: string; accent: string }[];
  products: ProductRow[];
  /** [name, description, product indexes] */
  collections: [string, string, number[]][];
  hero: { headline: string; subtext: string; cta: string };
  story: string;
  tone: "warm" | "literary" | "crisp";
}

export const EXTRA_ANANYA_PRODUCTS: ProductRow[] = [
  ["Golden Hour Presets (8 pack)", "preset", 699, 999, "frame", "Lightroom presets", "golden-hour.zip", 14, "Eight warm presets for that last hour of light. Built for skin tones that aren't from a stock photo."],
  ["Wedding Film Look Presets", "preset", 1299, 0, "split", "Lightroom presets", "wedding-film.zip", 22, "Soft film grain and gentle contrast for long wedding days and mixed indoor light."],
  ["Notion Habit Tracker", "notion", 299, 0, "badge", "Notion kit", "habit-tracker-guide.pdf", 1, "Tick off habits, see streaks, skip the guilt. One page, works on your phone."],
];

export const INKWELL: StoreSeed = {
  id: "store_inkwell",
  slug: "inkwell",
  name: "Inkwell Ebooks",
  owner: "Rohan Desai",
  email: "rohan@inkwell.example",
  city: "Pune",
  tagline: "Short, useful books for people who'd rather be doing than reading.",
  logoText: "IE",
  palette: "midnight",
  fonts: "editorial",
  heroStyle: "centered",
  colors: [
    { bg: "#1E2A4A", fg: "#F4F5F8", accent: "#D08C3A" },
    { bg: "#F4F5F8", fg: "#1E2A4A", accent: "#D08C3A" },
    { bg: "#D08C3A", fg: "#1E2A4A", accent: "#F4F5F8" },
    { bg: "#2F3E63", fg: "#F4F5F8", accent: "#E8B66B" },
  ],
  products: [
    ["The Quiet Freelancer", "ebook", 449, 699, "block", "Ebook · 120 pages", "quiet-freelancer.pdf", 6, "How to get steady clients without shouting on LinkedIn every day. Real scripts, real numbers."],
    ["Money for Your Twenties", "ebook", 349, 0, "stack", "Ebook · 96 pages", "money-twenties.pdf", 4, "SIPs, emergency funds and the EMI trap, explained like a friend would over chai."],
    ["Write Every Day", "ebook", 299, 0, "frame", "Ebook · 64 pages", "write-every-day.pdf", 3, "A 30-day plan for people who keep starting and stopping. Ten minutes a day."],
    ["The Interview Playbook", "ebook", 499, 799, "split", "Ebook · 140 pages", "interview-playbook.pdf", 7, "Questions Indian product companies actually ask, and answers that don't sound rehearsed."],
    ["Cooking for One", "ebook", 249, 0, "badge", "Ebook · Recipes", "cooking-for-one.pdf", 18, "Forty recipes sized for one person and one pan. Hostel-friendly."],
    ["Learn SQL in a Weekend", "ebook", 599, 0, "grid", "Ebook · Exercises", "sql-weekend.zip", 12, "Two days, 120 exercises, one real dataset of Indian railway timings."],
    ["Startup Hiring Handbook", "ebook", 899, 1299, "block", "Ebook · 180 pages", "hiring-handbook.pdf", 9, "Your first ten hires: job posts, take-homes, offers and the awkward bits."],
    ["Mindful Mornings", "ebook", 199, 0, "frame", "Ebook · 48 pages", "mindful-mornings.pdf", 2, "Twelve short routines that don't need an app, a mat or a 5 a.m. alarm."],
    ["The Product Manager's Notes", "ebook", 699, 0, "split", "Ebook · 160 pages", "pm-notes.pdf", 8, "Specs, roadmaps and saying no, from eight years of shipping in Bengaluru."],
    ["Travel India on ₹2,000 a Day", "ebook", 399, 0, "stack", "Guide · 22 routes", "budget-travel.pdf", 15, "Routes, hostels and train hacks for 22 trips that don't wreck your savings."],
    ["Copywriting That Sells", "ebook", 549, 0, "badge", "Ebook · Swipe file", "copywriting.pdf", 5, "Headlines, emails and product pages, with before-and-after rewrites."],
    ["UPSC Essay Toolkit", "ebook", 349, 0, "grid", "Study guide", "essay-toolkit.pdf", 6, "Frameworks and 60 model essays with examiner-style comments."],
    ["The Calm Investor", "ebook", 649, 0, "block", "Ebook · 130 pages", "calm-investor.pdf", 6, "Index funds, asset allocation and how to stop checking your portfolio at lunch."],
    ["Kids' Bedtime Stories Vol. 1", "ebook", 199, 0, "frame", "Illustrated ebook", "bedtime-stories.pdf", 28, "Twelve short stories set in Indian towns, with pictures. Five minutes each."],
    ["Public Speaking Without Panic", "ebook", 449, 0, "split", "Ebook · 88 pages", "public-speaking.pdf", 4, "For people whose hands shake. Practical drills, not pep talks."],
  ],
  collections: [
    ["Career", "Jobs, interviews and freelance work.", [0, 3, 6, 8]],
    ["Money", "Saving, investing and spending on purpose.", [1, 12, 9]],
    ["Writing", "Write more, write better, write to sell.", [2, 10, 11]],
    ["Learning", "Skills you can pick up in a weekend.", [5, 11, 14]],
    ["Life", "Food, mornings and getting out of town.", [4, 7, 9]],
    ["For kids", "Stories for small people.", [13]],
  ],
  hero: { headline: "Short books. Big shortcuts.", subtext: "Practical ebooks by people who've done the thing. Read one this weekend.", cta: "Browse the shelf" },
  story: "I spent a decade in product teams and kept writing the same advice into Slack. So I put it in books, short enough to finish on a flight from Pune to Delhi.",
  tone: "literary",
};

export const GRIDGRAIN: StoreSeed = {
  id: "store_gridgrain",
  slug: "gridgrain",
  name: "Grid & Grain Studio",
  owner: "Tara Menon",
  email: "tara@gridgrain.example",
  city: "Bengaluru",
  tagline: "Design templates that look expensive and take an afternoon.",
  logoText: "GG",
  palette: "graphite",
  fonts: "clean",
  heroStyle: "full",
  colors: [
    { bg: "#1F1F1F", fg: "#F5F5F4", accent: "#E8613F" },
    { bg: "#F5F5F4", fg: "#1F1F1F", accent: "#E8613F" },
    { bg: "#E8613F", fg: "#1F1F1F", accent: "#F5F5F4" },
    { bg: "#3A3A38", fg: "#F5F5F4", accent: "#F0A58F" },
  ],
  products: [
    ["Pitch Deck Kit", "template", 1499, 2499, "grid", "Figma + Keynote", "pitch-deck-kit.zip", 48, "32 slides that investors have actually seen funded. Swap the logo, keep the story."],
    ["Brand Identity Starter", "template", 1999, 0, "split", "Figma kit", "brand-starter.fig", 36, "Logo grid, type scale, colour system and a 20-page brand book you can fill in."],
    ["Instagram Grid Templates", "template", 799, 0, "grid", "Canva · 90 posts", "ig-grid-links.pdf", 1, "Ninety posts that tile into a clean grid. Change one colour, the whole feed follows."],
    ["Resume Pack: Designers", "template", 399, 0, "frame", "Figma + Docs", "designer-resumes.zip", 6, "Six layouts that show taste without hiding the facts."],
    ["Wedding Invite Suite", "template", 1199, 0, "stack", "Canva + print", "wedding-invites.zip", 22, "Save the date, invite, menu and thank-you cards in four Indian scripts."],
    ["SaaS Landing Page Kit", "template", 2499, 3499, "split", "Figma · Framer", "saas-landing.fig", 54, "Hero, pricing, FAQ and 40 sections, with a free Framer remix link."],
    ["Restaurant Menu Templates", "template", 699, 0, "badge", "Canva + print", "menus.zip", 18, "Dine-in, takeaway and QR menus. Prints well at the corner shop."],
    ["YouTube Thumbnail Pack", "template", 599, 0, "block", "Photoshop + Canva", "thumbnails.zip", 64, "120 thumbnails that are readable at phone size. Faces, arrows and taste."],
    ["Notion Portfolio", "notion", 499, 0, "frame", "Notion site", "notion-portfolio.pdf", 1, "A portfolio site in Notion with case study pages. Publish in ten minutes."],
    ["Annual Report Template", "template", 1799, 0, "grid", "InDesign + Figma", "annual-report.zip", 72, "Charts, spreads and a cover that NGOs and startups can both use."],
    ["Icon Set: India Everyday", "template", 899, 0, "badge", "SVG · 300 icons", "india-icons.zip", 9, "Autos, chai, dabbas and 297 more. Outline and filled, 24px grid."],
    ["Social Ads Template Kit", "template", 999, 0, "stack", "Figma · 60 ads", "social-ads.fig", 30, "Feed, story and carousel sizes for Meta and LinkedIn."],
    ["Course Workbook Template", "template", 699, 0, "block", "Canva · 40 pages", "workbook-links.pdf", 1, "Worksheets, checklists and a cover for your course or cohort."],
    ["Packaging Dielines Pack", "template", 1299, 0, "frame", "Illustrator", "dielines.zip", 15, "Twenty boxes, pouches and sleeves, print-ready with bleed."],
    ["Email Newsletter Templates", "template", 599, 0, "split", "Figma + HTML", "newsletter-templates.zip", 4, "Ten newsletters that look good in Gmail dark mode. Really."],
  ],
  collections: [
    ["Startups", "Decks, landing pages and reports.", [0, 5, 9]],
    ["Branding", "Identity systems and packaging.", [1, 13, 10]],
    ["Social", "Posts, ads and thumbnails.", [2, 7, 11]],
    ["Print", "Invites, menus and dielines.", [4, 6, 13]],
    ["Careers", "Resumes and portfolios.", [3, 8]],
    ["Creators", "Workbooks and newsletters.", [12, 14, 7]],
  ],
  hero: { headline: "Look like you hired a studio.", subtext: "Templates for founders, makers and small brands. Pick one, change the words, ship it today.", cta: "Shop templates" },
  story: "We're two designers who got tired of rebuilding the same pitch deck for every friend's startup. Everything here is something we've used for real clients.",
  tone: "crisp",
};

/** Six collections for Ananya's store (indexes into her 15 products). */
export const ANANYA_COLLECTIONS: [string, string, number[]][] = [
  ["Notion kits", "Workspaces you duplicate and fill in.", [0, 5, 14]],
  ["Lightroom presets", "Looks for real light and real skin.", [1, 12, 13]],
  ["Playbooks", "Short guides for freelancers and founders.", [2, 4, 7]],
  ["Design templates", "Canva and Figma, ready to edit.", [3, 6, 9]],
  ["Career kit", "Resumes and pricing for freelancers.", [9, 2]],
  ["Audio", "Loops and samples.", [8]],
];
