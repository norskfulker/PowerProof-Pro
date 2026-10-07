import { redirect } from "next/navigation";

/** Old download links go to the order lookup page. */
export default function LegacyDownloadPage() {
  redirect("/lookup");
}
