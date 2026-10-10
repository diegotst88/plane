import Link from "next/link";
import { requireProfile, isAdmin } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

const ROLE_LABEL = { admin: "Administrador", comercial: "Comercial", leitura: "Somente leitura" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const nav = [
    { href: "/dashboard", label: "Painel" },
    { href: "/orcamentos", label: "Orçamentos" },
    { href: "/clientes", label: "Clientes" },
    { href: "/servicos", label: "Serviços" },
    ...(isAdmin(profile)
      ? [
          { href: "/modelos", label: "Modelos de texto" },
          { href: "/usuarios", label: "Usuários" },
          { href: "/integracoes", label: "Integrações" },
        ]
      : []),
  ];
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-brand-900 text-white md:fixed md:inset-y-0 md:w-60 md:flex md:flex-col">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <Link href="/dashboard" className="block">
            <span className="text-lg font-extrabold tracking-tight">
              SuperSeg <span className="text-accent-500">360</span>
            </span>
            <span className="block text-[11px] uppercase tracking-widest text-brand-100/80">Módulo Comercial</span>
          </Link>
          <form action={signOut} className="md:hidden">
            <button className="rounded border border-white/30 px-3 py-1 text-xs">Sair</button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0" aria-label="Principal">
          {nav.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-brand-100 hover:bg-white/10 hover:text-white"
            >
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 p-4 text-xs md:block">
          <p className="truncate font-semibold">{profile.full_name || profile.email}</p>
          <p className="truncate text-brand-100/80">{ROLE_LABEL[profile.role]}</p>
          <form action={signOut} className="mt-3">
            <button className="w-full rounded border border-white/30 px-3 py-1.5 hover:bg-white/10">Sair</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 md:ml-60">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
