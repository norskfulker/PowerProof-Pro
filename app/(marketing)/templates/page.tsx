import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/cta-band";
import { TemplatesGallery } from "@/components/marketing/templates-gallery";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  return (
    <>
      <section className="gutter mx-auto max-w-[1200px] pt-12 md:pt-16">
        <p className="eyebrow">Templates</p>
        <h1 className="mt-3 max-w-3xl text-[2.5rem] sm:text-5xl">Pages that sell, without a designer on call.</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Every template is fast on a phone, works with your colours and has the buy button wired. Or paste your own HTML.
        </p>
      </section>
      <section className="gutter mx-auto mt-10 max-w-[1200px]">
        <TemplatesGallery />
      </section>
      <CtaBand title="Pick one. Change everything." body="Templates are a starting point. Every word and colour is yours to edit." />
    </>
  );
}
