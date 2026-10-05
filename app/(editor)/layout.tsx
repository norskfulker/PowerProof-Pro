import type { Metadata } from "next";
import { SkipLink } from "@/components/pp/app-shell";

export const metadata: Metadata = { title: { default: "Page editor", template: "%s · PowerProof" } };

/** Full-screen tools (the visual page editor) without the app's sidebar and tab bar. */
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      {children}
    </>
  );
}
