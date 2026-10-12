import { paragraphs, parseInline } from "@/lib/pages/rich-text";

/** A blog post's text as buyers read it: paragraphs with **bold**, _italic_ and links. No HTML, ever. */
export function BlogBody({ body }: { body: string }) {
  const paras = paragraphs(body);
  if (!paras.length) return null;
  return (
    <div className="flex flex-col gap-5 text-lg leading-relaxed">
      {paras.map((para, i) => (
        <p key={i} className="whitespace-pre-line [overflow-wrap:anywhere]">
          {parseInline(para).map((t, j) =>
            t.kind === "bold" ? (
              <strong key={j} className="font-semibold">{t.text}</strong>
            ) : t.kind === "italic" ? (
              <em key={j}>{t.text}</em>
            ) : t.kind === "link" ? (
              <a key={j} href={t.href} className="font-medium text-primary underline underline-offset-4">{t.text}</a>
            ) : (
              <span key={j}>{t.text}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}
