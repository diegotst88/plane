"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbErrorMessage, fail, type ActionResult } from "@/lib/action";

const roleEnum = z.enum(["admin", "comercial", "leitura"]);

const createSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome").max(150),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido")),
  password: z
    .string()
    .min(10, "A senha temporária deve ter ao menos 10 caracteres")
    .regex(/[A-Za-z]/, "A senha deve conter letras")
    .regex(/\d/, "A senha deve conter números"),
  role: roleEnum,
});

export async function createUser(input: z.input<typeof createSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail("Chave de serviço não configurada. Crie o usuário em Supabase > Authentication > Users.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });
  if (error || !data.user) {
    return fail(error?.message.includes("already") ? "Já existe um usuário com este e-mail." : "Não foi possível criar o usuário.");
  }
  const supabase = await createClient();
  const { error: upd } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role, full_name: parsed.data.full_name, max_discount_percent: parsed.data.role === "admin" ? 100 : 5 })
    .eq("id", data.user.id);
  if (upd) return fail(`Usuário criado, mas o perfil não foi ajustado: ${dbErrorMessage(upd)}`);
  revalidatePath("/usuarios");
  return { ok: true };
}

const updateSchema = z.object({
  id: z.uuid(),
  role: roleEnum,
  active: z.boolean(),
  max_discount_percent: z.number().min(0).max(100),
});

export async function updateUser(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(fields).eq("id", id);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/usuarios");
  return { ok: true };
}
