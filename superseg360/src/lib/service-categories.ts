export const SERVICE_CATEGORIES = [
  { value: "programa", label: "Programas (PGR, PCMSO)" },
  { value: "laudo", label: "Laudos (LTCAT, laudos técnicos)" },
  { value: "norma", label: "Adequações a NRs (NR-12, NR-13...)" },
  { value: "ergonomia", label: "Ergonomia" },
  { value: "treinamento", label: "Treinamentos" },
  { value: "exame", label: "Exames ocupacionais" },
  { value: "outros", label: "Outros serviços" },
] as const;

export const categoryLabel = (v: string) => SERVICE_CATEGORIES.find((c) => c.value === v)?.label ?? v;
