import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/pp/logo";
import { Controls } from "./_controls";
import { Foundations } from "./_foundations";
import { Overlays } from "./_overlays";
import { ProductComponents } from "./_product";

export const metadata: Metadata = { title: "Design system" };

const TOC = [
  ["colors", "Colour"],
  ["type", "Type"],
  ["shape", "Shape"],
  ["buttons", "Buttons"],
  ["inputs", "Inputs"],
  ["tabs", "Tabs"],
  ["pills", "Pills"],
  ["feedback", "Feedback"],
  ["brand", "Logo"],
  ["numbers", "Money"],
  ["states", "States"],
  ["cards", "Cards"],
  ["steps", "Steps"],
  ["templates", "Templates"],
  ["charts", "Charts"],
  ["table", "Table"],
  ["editors", "Editors"],
];

export default function DesignPage() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="gutter mx-auto flex h-16 max-w-[1280px] items-center gap-4">
          <Logo />
          <span className="eyebrow">Design system</span>
          <Link href="/" className="ml-auto text-sm font-medium underline-offset-4 hover:underline">Back to site</Link>
        </div>
      </header>
      <div className="gutter mx-auto grid max-w-[1280px] gap-10 py-10 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="sticky top-24 flex flex-col gap-0.5">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-control px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main">
          <p className="eyebrow">PowerProof · v1</p>
          <h1 className="mt-2 text-4xl md:text-5xl">The kit.</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Tokens, components and states. If a screen needs something that isn&apos;t here, add it here first.
          </p>
          <div className="mt-12">
            <Foundations />
            <Controls />
            <Overlays />
            <ProductComponents />
          </div>
        </main>
      </div>
    </div>
  );
}
