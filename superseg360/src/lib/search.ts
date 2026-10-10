/** Remove caracteres que alterariam a sintaxe de filtros do PostgREST (vírgula, parênteses, curingas). */
export function sanitizeSearch(q: string | undefined | null): string {
  return (q ?? "").replace(/[,()%*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
