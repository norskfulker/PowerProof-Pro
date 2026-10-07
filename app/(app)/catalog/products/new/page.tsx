import { ArrowRight, FileUp } from "lucide-react";
import { GuardedLink, LimitNotice } from "@/components/plan/plan-context";
import { PageHeader } from "@/components/pp/page-header";

const WAYS = [
  {
    href: "/catalog/products/new/upload",
    icon: FileUp,
    title: "Upload a file",
    body: "Drop in the PDF, ZIP or video. Add a name and a price. Images are optional.",
    meta: "About a minute",
    primary: true,
  },
];

export default function NewProductPage() {
  return (
    <>
      <PageHeader back={{ href: "/catalog/products", label: "Products" }} title="Add a product" description="Upload what buyers get, then name it and set a price. Importing from a link opens soon." />
      <LimitNotice kind="products" />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {WAYS.map((w) => (
          <li key={w.href} data-coach={w.primary ? "new-product" : undefined}>
            <GuardedLink
              kind="products"
              href={w.href}
              className="group flex h-full flex-col rounded-card border bg-surface p-6 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary"
            >
              <span className={w.primary ? "grid size-12 place-items-center rounded-control bg-primary text-primary-foreground" : "grid size-12 place-items-center rounded-control bg-primary-soft text-primary"}>
                <w.icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-5 text-xl">{w.title}</h2>
              <p className="mt-2 flex-1 text-muted-foreground">{w.body}</p>
              <span className="mt-5 flex items-center justify-between border-t pt-4">
                <span className="eyebrow">{w.meta}</span>
                <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </GuardedLink>
          </li>
        ))}
      </ul>
    </>
  );
}
