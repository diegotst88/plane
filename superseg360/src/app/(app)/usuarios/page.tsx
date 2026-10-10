import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CreateUserForm, UserRowEditor, type UserRow } from "@/components/user-admin";
import { Notice, PageHeader } from "@/components/ui";

export default async function UsersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id,email,full_name,role,active,max_discount_percent").order("full_name");
  const users = (data ?? []) as UserRow[];
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return (
    <>
      <PageHeader title="Usuários e permissões" subtitle="Administrador: acesso total. Comercial: cadastra clientes e orçamentos. Somente leitura: apenas consulta." />
      {hasServiceKey ? (
        <CreateUserForm />
      ) : (
        <Notice tone="info">
          Para criar usuários por aqui, configure <code>SUPABASE_SERVICE_ROLE_KEY</code> no arquivo <code>.env.local</code>. Alternativa: crie o usuário em
          Supabase &gt; Authentication &gt; Users e depois ajuste o perfil nesta tela.
        </Notice>
      )}
      <p className="mb-2 mt-6 text-xs text-slate-500">“Desc. máx.” é o maior desconto (%) que o usuário pode aplicar em um item; acima disso somente administradores.</p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50"><tr><th className="th">Usuário</th><th className="th">Perfil</th><th className="th">Desc. máx. %</th><th className="th">Situação</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => <UserRowEditor key={`${u.id}-${u.role}-${u.active}-${u.max_discount_percent}`} user={u} isSelf={u.id === me.id} />)}
          </tbody>
        </table>
      </div>
    </>
  );
}
