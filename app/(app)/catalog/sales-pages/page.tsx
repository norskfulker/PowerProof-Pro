import { redirect } from "next/navigation";

/** Sales pages are now the visual pages in Store › Design › Pages. */
export default function SalesPagesRedirect() {
  redirect("/store/current/design/pages/home/edit?panel=pages");
}
