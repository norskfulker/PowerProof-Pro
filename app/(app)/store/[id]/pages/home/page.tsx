import { redirect } from "next/navigation";

/** Editing the home page happens on Design › Base design: click a section in the preview. */
export default async function StoreHomePage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/store/${(await params).id}/design/base`);
}
