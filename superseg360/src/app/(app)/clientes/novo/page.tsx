import { requireWriter } from "@/lib/auth";
import { ClientForm, emptyClient } from "@/components/client-form";
import { BackLink, PageHeader } from "@/components/ui";

export default async function NewClientPage() {
  await requireWriter();
  return (
    <>
      <BackLink href="/clientes">Clientes</BackLink>
      <PageHeader title="Nova empresa" subtitle="Informe o CNPJ e use “Buscar” para preencher os dados públicos automaticamente." />
      <ClientForm initial={emptyClient} />
    </>
  );
}
