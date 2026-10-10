import { redirect } from "next/navigation";

/** Questions moved into the store editor, beside the pages that show them */
export default async function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/store/${(await params).id}/design/pages/home/edit?panel=questions`);
}
