import { redirect } from "next/navigation";

/** Reviews moved into the store editor, beside the pages that show them */
export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/store/${(await params).id}/design/pages/home/edit?panel=reviews`);
}
