import type { Metadata } from "next";
import { SkipLink } from "@/components/pp/app-shell";
import { CreatorProviders } from "@/components/pp/creator-providers";
import { requireStore } from "@/lib/supabase/creator-gate";

export const metadata: Metadata = { title: { default: "Page editor", template: "%s · PowerProof" } };

/** Full-screen tools (the visual page editor) without the app's sidebar and tab bar. */
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  await requireStore();
  return (
    <CreatorProviders tracker={false}>
      <SkipLink />
      {children}
    </CreatorProviders>
  );
}
