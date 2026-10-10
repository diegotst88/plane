import { requireAdmin } from "@/lib/auth";
import { ServiceForm } from "@/components/service-form";
import { emptyService } from "@/lib/service-form";
import { BackLink, PageHeader } from "@/components/ui";

export default async function NewServicePage() {
  await requireAdmin();
  return (
    <>
      <BackLink href="/servicos">Serviços</BackLink>
      <PageHeader title="Novo serviço" />
      <ServiceForm initial={emptyService} />
    </>
  );
}
