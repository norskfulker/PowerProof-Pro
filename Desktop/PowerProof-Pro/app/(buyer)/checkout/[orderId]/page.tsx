import { redirect } from "next/navigation";

/** Checkout happens in a panel on the store, not on a page of its own. Old links go to order lookup. */
export default function Page() {
  redirect("/lookup");
}
