import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { PageHeader } from "@/components/pp/page-header";
import { EMAILS } from "@/components/emails/email-registry";

export default function EmailsIndexPage() {
  return (
    <>
      <PageHeader title="Emails" description="Every email PowerProof sends, rendered with React Email from your store's live mock data." />
      <ul className="grid gap-4 sm:grid-cols-2">
        {EMAILS.map((e) => (
          <li key={e.slug}>
            <Link href={`/emails/${e.slug}`} className="group flex h-full flex-col gap-3 rounded-card border bg-surface p-6 hover:border-primary">
              <span className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-control bg-primary-soft text-primary"><Mail className="size-5" aria-hidden /></span>
                <span className="eyebrow">To {e.to.toLowerCase()}</span>
              </span>
              <h2 className="text-xl">{e.name}</h2>
              <p className="flex-1 text-muted-foreground">{e.description}</p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Preview <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
