"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser } from "@/app/(app)/usuarios/actions";
import { Notice } from "@/components/ui";
import type { AppRole } from "@/lib/types";

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  active: boolean;
  max_discount_percent: number;
}

export function UserRowEditor({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(user);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(user);
  return (
    <tr className="align-top">
      <td className="td"><p className="font-medium">{user.full_name || "-"}</p><p className="text-xs text-slate-500">{user.email}</p>{isSelf && <p className="text-xs text-brand-600">(você)</p>}</td>
      <td className="td">
        <select className="field" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as AppRole })}>
          <option value="admin">Administrador</option>
          <option value="comercial">Comercial</option>
          <option value="leitura">Somente leitura</option>
        </select>
      </td>
      <td className="td w-28">
        <input className="field text-right" inputMode="decimal" value={v.role === "admin" ? 100 : v.max_discount_percent}
          disabled={v.role === "admin"} onChange={(e) => setV({ ...v, max_discount_percent: Number(e.target.value.replace(",", ".")) || 0 })} aria-label="Desconto máximo (%)" />
      </td>
      <td className="td"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Ativo</label></td>
      <td className="td">
        <button className="btn-secondary" disabled={!dirty || pending} onClick={() => start(async () => {
          const r = await updateUser({ id: v.id, role: v.role, active: v.active, max_discount_percent: v.max_discount_percent });
          setMsg(r.ok ? { tone: "success", text: "Salvo." } : { tone: "error", text: r.error ?? "Erro." });
          if (r.ok) router.refresh();
        })}>Salvar</button>
        {msg && <p className={`mt-1 text-xs ${msg.tone === "error" ? "text-red-600" : "text-accent-600"}`}>{msg.text}</p>}
      </td>
    </tr>
  );
}

export function CreateUserForm() {
  const router = useRouter();
  const [v, setV] = useState({ full_name: "", email: "", password: "", role: "comercial" as AppRole });
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card grid gap-3 md:grid-cols-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createUser(v);
          setMsg(r.ok ? { tone: "success", text: "Usuário criado. Informe a senha temporária ao colaborador." } : { tone: "error", text: r.error ?? "Erro." });
          if (r.ok) {
            setV({ full_name: "", email: "", password: "", role: "comercial" });
            router.refresh();
          }
        });
      }}
    >
      <div className="md:col-span-5">{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}</div>
      <div><label className="label">Nome</label><input className="field" required value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></div>
      <div><label className="label">E-mail</label><input className="field" type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
      <div><label className="label">Senha temporária</label><input className="field" type="text" autoComplete="off" required minLength={10} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></div>
      <div>
        <label className="label">Perfil</label>
        <select className="field" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as AppRole })}>
          <option value="comercial">Comercial</option>
          <option value="leitura">Somente leitura</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <div className="flex items-end"><button className="btn-primary w-full" disabled={pending}>{pending ? "Criando…" : "Criar usuário"}</button></div>
    </form>
  );
}
