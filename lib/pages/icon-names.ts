/**
 * The names in the icon library (components/pp/icon-library.tsx draws them), as plain data so the
 * server and the AI page builder can use the list too.
 */
export const ICON_GROUPS: { label: string; names: string[] }[] = [
  { label: "Shopping and money", names: ["ShoppingBag", "ShoppingCart", "ShoppingCartSimple", "Basket", "Storefront", "Tag", "Receipt", "CreditCard", "Wallet", "Money", "CurrencyInr", "CurrencyDollar", "Coins", "Percent", "SealPercent", "Gift", "Package", "Archive", "Barcode", "QrCode", "Ticket", "Handbag"] },
  { label: "Delivery and time", names: ["Truck", "Airplane", "Rocket", "DownloadSimple", "Download", "CloudArrowDown", "Lightning", "Timer", "Clock", "Hourglass", "CalendarCheck", "MapPin", "Globe", "GlobeHemisphereEast", "House", "Buildings"] },
  { label: "Trust and quality", names: ["ShieldCheck", "Shield", "LockKey", "Lock", "Seal", "SealCheck", "CheckCircle", "Check", "Checks", "Certificate", "Medal", "Trophy", "Crown", "Star", "StarFour", "Sparkle", "ThumbsUp", "HandHeart", "Handshake", "Fingerprint", "Key"] },
  { label: "Help and contact", names: ["ArrowCounterClockwise", "ArrowsClockwise", "Headset", "ChatCircle", "ChatCircleDots", "ChatsCircle", "Envelope", "EnvelopeSimple", "Phone", "WhatsappLogo", "Question", "Info", "Lifebuoy", "Wrench", "Gear"] },
  { label: "Learning and media", names: ["BookOpen", "Book", "Books", "Notebook", "FileText", "FilePdf", "Files", "Folder", "Video", "VideoCamera", "PlayCircle", "FilmStrip", "MusicNote", "Headphones", "Microphone", "Camera", "Image", "Images", "Palette", "PaintBrush", "PencilSimple", "Pen", "Code", "Desktop", "DeviceMobile", "Laptop", "GameController", "Brain", "GraduationCap", "Student", "Lightbulb", "Target", "ChartLineUp", "ChartBar", "PresentationChart", "Infinity"] },
  { label: "People", names: ["User", "Users", "UsersThree", "UserCircle", "Smiley", "SmileyWink", "Heart", "HeartStraight", "Baby", "PawPrint", "Person", "PersonSimpleRun", "Barbell"] },
  { label: "Nature", names: ["Leaf", "Plant", "Tree", "Flower", "Sun", "Moon", "Cloud", "Drop", "Fire", "Snowflake", "Mountains", "Waves", "Recycle"] },
  { label: "Food and drink", names: ["Coffee", "Cookie", "Pizza", "Hamburger", "Wine", "Carrot", "ForkKnife"] },
  { label: "Shapes and arrows", names: ["ArrowRight", "ArrowUpRight", "ArrowDown", "CaretRight", "Plus", "Minus", "X", "Circle", "Square", "Triangle", "Hexagon", "Diamond"] },
];

/** Every icon name, for checking and for the AI */
export const ICON_NAMES: string[] = ICON_GROUPS.flatMap((g) => g.names);

/** Names used before the icon library, mapped onto it */
export const LEGACY_ICONS: Record<string, string> = { download: "DownloadSimple", shield: "ShieldCheck", refund: "ArrowCounterClockwise", star: "Star", zap: "Lightning", heart: "Heart", globe: "Globe", check: "Check" };
