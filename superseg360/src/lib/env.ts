export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

export const company = {
  name: () => process.env.COMPANY_NAME || "SuperSeg Medicina e Segurança do Trabalho",
  cnpj: () => process.env.COMPANY_CNPJ || "",
  phone: () => process.env.COMPANY_PHONE || "",
  email: () => process.env.COMPANY_EMAIL || "",
  site: () => process.env.COMPANY_SITE || "",
};
