import { redirect } from "next/navigation";

export default async function DesignIndex({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/store/${(await params).id}/design/base`);
}
