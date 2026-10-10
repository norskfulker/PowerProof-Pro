import { redirect } from "next/navigation";

/** The home page is edited in the store editor. */
export default async function StoreHomePage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/store/${(await params).id}/design/pages/home/edit`);
}
