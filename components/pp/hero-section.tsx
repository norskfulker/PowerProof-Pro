import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HeroContent, HeroStyle, ProductImage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductImageView } from "./product-cover";

function Collage({ images, className }: { images: ProductImage[]; className?: string }) {
  if (images.length === 0) return null;
  if (images.length === 1) return <ProductImageView image={images[0]} size="lg" className={cn("rounded-card", className)} />;
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <ProductImageView image={images[0]} size="md" className="col-span-2 rounded-card" />
      {images.slice(1, 3).map((img) => (
        <ProductImageView key={img.id} image={img} size="sm" className="rounded-card" />
      ))}
    </div>
  );
}

/** Store hero in three layouts. One main button. */
export function HeroSection({
  hero,
  style,
  images,
  href,
}: {
  hero: HeroContent;
  style: HeroStyle;
  images: ProductImage[];
  href: string;
}) {
  const cta = (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild size="lg" variant={style === "full" ? "brass" : "primary"}>
        <Link href={href}>
          {hero.ctaLabel} <ArrowRight aria-hidden />
        </Link>
      </Button>
      {hero.videoUrl && (
        <Button asChild size="lg" variant="secondary">
          <a href={hero.videoUrl} target="_blank" rel="noreferrer">
            <PlayCircle aria-hidden /> Watch the intro
          </a>
        </Button>
      )}
    </div>
  );

  if (style === "full") {
    return (
      <section aria-label="Introduction" className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 grid grid-cols-3 gap-2 opacity-35" aria-hidden>
          {images.slice(0, 3).map((img) => (
            <ProductImageView key={img.id} image={img} size="md" className="h-full rounded-none" />
          ))}
        </div>
        <div className="absolute inset-0 bg-primary/70" aria-hidden />
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-start gap-5 px-4 py-20 md:px-6 md:py-28">
          <h1 className="max-w-3xl text-[2.5rem] leading-[1.05] md:text-6xl">{hero.headline}</h1>
          <p className="max-w-xl text-lg text-primary-foreground/85">{hero.subtext}</p>
          {cta}
        </div>
      </section>
    );
  }

  if (style === "centered") {
    return (
      <section aria-label="Introduction" className="mx-auto max-w-[1200px] px-4 pt-12 pb-6 text-center md:px-6 md:pt-20">
        <h1 className="mx-auto max-w-3xl text-[2.5rem] leading-[1.05] md:text-6xl">{hero.headline}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{hero.subtext}</p>
        <div className="mt-7 flex justify-center">{cta}</div>
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-3 gap-3">
          {images.slice(0, 3).map((img) => (
            <ProductImageView key={img.id} image={img} size="md" className="rounded-card" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Introduction" className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 px-4 pt-10 pb-6 md:grid-cols-2 md:px-6 md:pt-16">
      <div className="flex flex-col items-start gap-5">
        <h1 className="text-[2.5rem] leading-[1.05] md:text-[3.5rem]">{hero.headline}</h1>
        <p className="max-w-lg text-lg text-muted-foreground">{hero.subtext}</p>
        {cta}
      </div>
      <Collage images={images} />
    </section>
  );
}
