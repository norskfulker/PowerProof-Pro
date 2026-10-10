import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StartLink } from "./start-link";

export function CtaBand({
  title = "Your store is three minutes away.",
  body = "First month free. No card needed to start.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="gutter mx-auto mt-24 max-w-[1200px]">
      <div className="flex flex-col items-start gap-6 rounded-dialog bg-primary px-6 py-12 text-primary-foreground md:flex-row md:items-center md:justify-between md:px-12">
        <div>
          <h2 className="text-3xl md:text-4xl">{title}</h2>
          <p className="mt-2 text-primary-foreground/90">{body}</p>
        </div>
        <Button asChild size="lg" variant="brass">
          <StartLink signedIn={<>Go to dashboard <ArrowRight /></>}>
            Start free <ArrowRight />
          </StartLink>
        </Button>
      </div>
    </section>
  );
}
