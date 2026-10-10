import { formatCep } from "@/lib/cnpj";

export interface AddressParts {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export function formatAddress(a: AddressParts): string {
  const street = [a.logradouro, a.numero].filter(Boolean).join(", ");
  const city = [a.cidade, a.uf].filter(Boolean).join("/");
  return [street, a.complemento, a.bairro, city, a.cep ? `CEP ${formatCep(a.cep)}` : null]
    .filter(Boolean)
    .join(", ");
}
