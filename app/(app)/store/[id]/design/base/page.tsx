import { redirect } from "next/navigation";

/** The store's look and home page are edited in the store editor, on the home page. */
export default async function BaseDesignPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/store/${(await params).id}/design/pages/home/edit`);
}
