import type { ClientInput } from "@/lib/schemas";

export type Contact = NonNullable<ClientInput["contacts"]>[number];
export type Unit = NonNullable<ClientInput["units"]>[number];

export interface ClientFormValues {
  id?: string;
  active?: boolean;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  ie_isento: boolean;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  billing_cnpj: string;
  billing_name: string;
  notes: string;
  contacts: Contact[];
  units: Unit[];
}

export const emptyClient: ClientFormValues = {
  razao_social: "", nome_fantasia: "", cnpj: "", inscricao_estadual: "", ie_isento: false, cep: "",
  logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", billing_cnpj: "",
  billing_name: "", notes: "", contacts: [], units: [],
};
