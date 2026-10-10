import Link from "next/link";

export default function AccessDenied() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold text-brand-900">Acesso negado</h1>
      <p className="text-slate-600">Seu perfil não tem permissão para acessar esta área.</p>
      <Link href="/dashboard" className="btn-primary">Voltar ao painel</Link>
    </main>
  );
}
