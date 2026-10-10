import { signIn } from "./actions";
import { safeNext } from "@/lib/auth";
import { Notice } from "@/components/ui";

const ERRORS: Record<string, string> = {
  credenciais: "E-mail ou senha incorretos.",
  campos: "Informe e-mail e senha.",
  inativo: "Seu acesso está desativado. Procure o administrador.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const { erro, next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-accent-600 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-extrabold text-brand-900">
          SuperSeg <span className="text-accent-600">360</span>
        </h1>
        <p className="mb-6 mt-1 text-sm text-slate-600">Acesso restrito a colaboradores.</p>
        {erro && ERRORS[erro] && <Notice tone="error">{ERRORS[erro]}</Notice>}
        <form action={signIn} className="space-y-4">
          <input type="hidden" name="next" value={safeNext(next)} />
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="username" required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
          </div>
          <button className="btn-primary w-full">Entrar</button>
        </form>
      </div>
    </main>
  );
}
