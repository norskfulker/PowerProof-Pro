import { ComingSoon } from "@/components/pp/coming-soon";
import { PageHeader } from "@/components/pp/page-header";

export default function Page() {
  return (
    <>
      <title>Stores · PowerProof admin</title>
      <PageHeader title="Stores" description="Every store on the platform." />
      <ComingSoon title="Not connected yet." body="The founder console reads the same database as the creator app. It opens once its server-side checks (admin role, audit trail) are in place." />
    </>
  );
}
