import { redirect } from "next/navigation";

/** The store's pages are a panel of the store editor now */
export default async function StorePagesPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/store/${(await params).id}/design/pages/home/edit?panel=pages`);
}
