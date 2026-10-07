"use client";

import Link from "next/link";
import { ComingSoon } from "@/components/pp/coming-soon";
import { PageHeader } from "@/components/pp/page-header";
import { Button } from "@/components/ui/button";

export default function ImagesPage() {
  return (
    <>
      <title>AI images · PowerProof</title>
      <PageHeader title="AI images" description="Describe what you want and get images for covers, banners and posts." />
      <ComingSoon
        title="The AI image maker opens soon."
        body="It needs an image service connected first. Meanwhile, upload your own images to the media library."
        action={<Button asChild variant="secondary"><Link href="/catalog/media">Open your media library</Link></Button>}
      />
    </>
  );
}
