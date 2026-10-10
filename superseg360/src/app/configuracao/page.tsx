export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold text-brand-900">Configuração pendente</h1>
      <p className="text-slate-700">
        O SuperSeg 360 ainda não está conectado ao banco de dados. Siga o passo a passo do arquivo{" "}
        <code className="rounded bg-slate-200 px-1">docs/GUIA-DO-PROPRIETARIO.md</code>: crie o projeto no Supabase, execute o
        arquivo <code className="rounded bg-slate-200 px-1">supabase/setup_completo.sql</code> e preencha o arquivo{" "}
        <code className="rounded bg-slate-200 px-1">.env.local</code> com a URL e a chave do projeto.
      </p>
      <p className="text-sm text-slate-500">Depois, reinicie o sistema.</p>
    </main>
  );
}
