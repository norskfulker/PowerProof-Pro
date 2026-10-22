import { redirect } from "next/navigation";

/** Products now come in from a link on the Products page */
export default function ImportStorePage() {
  redirect("/catalog/products?link=1");
}
