import { centsToInput } from "@/lib/money";
import type { Service } from "@/lib/types";

export interface ServiceFormValues {
  id?: string;
  code: string;
  name: string;
  category: string;
  commercial_description: string;
  technical_scope: string;
  price: string;
  unit_label: string;
  delivery_days: string;
  inclusions: string;
  exclusions: string;
  specific_clauses: string;
  active: boolean;
}

export const emptyService: ServiceFormValues = {
  code: "", name: "", category: "outros", commercial_description: "", technical_scope: "", price: "0,00",
  unit_label: "un", delivery_days: "", inclusions: "", exclusions: "", specific_clauses: "", active: true,
};

export const toFormValues = (s: Service): ServiceFormValues => ({
  id: s.id, code: s.code, name: s.name, category: s.category, commercial_description: s.commercial_description,
  technical_scope: s.technical_scope, price: centsToInput(s.suggested_price_cents), unit_label: s.unit_label,
  delivery_days: s.delivery_days === null ? "" : String(s.delivery_days), inclusions: s.inclusions,
  exclusions: s.exclusions, specific_clauses: s.specific_clauses, active: s.active,
});
