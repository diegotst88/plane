# SuperSeg 360 — Módulo Comercial (piloto)

Plataforma interna da SuperSeg Medicina e Segurança do Trabalho. Primeira entrega: **módulo comercial**
(clientes, catálogo de serviços, orçamentos versionados, proposta comercial em PDF e painel).

> Proprietário (não técnico)? Leia **[docs/GUIA-DO-PROPRIETARIO.md](docs/GUIA-DO-PROPRIETARIO.md)**.

## Stack

Next.js 15 (App Router) + TypeScript estrito · Tailwind CSS 4 · Supabase (PostgreSQL + Auth) · `@react-pdf/renderer` · Zod · Vitest.

## Como rodar

```bash
cd superseg360
cp .env.example .env.local     # preencher URL e chaves do Supabase
npm install
npm run dev                    # http://localhost:3000
```

Banco de dados: execute `supabase/setup_completo.sql` (SQL Editor do Supabase) — ou as migrações em
`supabase/migrations/` na ordem. Detalhes no guia do proprietário.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` / `build` / `start` | Execução do app |
| `npm run check` | Tipos + lint + testes |
| `npm test` | Testes (cálculo, validações, banco/RLS com PGlite, PDF) |
| `npm run sample-pdf` | Gera `sample-output/proposta-exemplo*.pdf` com dados fictícios |
| `npm run db:bundle` | Regenera `supabase/setup_completo.sql` a partir das migrações |

## Arquitetura

```
src/app/(app)/…        telas protegidas (painel, clientes, serviços, orçamentos, modelos, usuários, integrações)
src/app/login          autenticação (Supabase Auth, e-mail/senha)
src/app/api/propostas/[id]/pdf   gera o PDF sob demanda (exige sessão; respeita RLS)
src/middleware.ts      renova sessão e bloqueia rotas sem login
src/lib/schemas.ts     validação (Zod) de todos os formulários — no servidor
src/lib/quote-calc.ts  cálculo em centavos (BigInt), idêntico à coluna gerada do banco
src/lib/pdf/           documento da proposta (capa, apresentação, cliente, objeto, escopo, investimento, pagamento, cláusulas, aceite)
src/lib/integrations/  contratos e fila para integrações futuras (nenhuma ativa)
supabase/migrations/   schema, RLS, triggers, funções e seeds
scripts/local-stack/   ambiente local sem Docker (PostgreSQL + PostgREST + auth simulado) usado nos testes de ponta a ponta
```

### Segurança

- **Autenticação**: Supabase Auth; middleware redireciona para `/login`. Cadastro público deve ficar **desativado** no Supabase.
- **Autorização** (3 perfis, aplicada no banco via RLS, não só na interface): `admin` (tudo), `comercial` (clientes e orçamentos), `leitura` (consulta). Usuário inativo não enxerga nada.
- **Sem DELETE** de clientes, serviços, orçamentos, modelos e auditoria (inativação lógica).
- **Auditoria**: triggers gravam quem/quando/o quê (antes/depois) em `audit_log`; imutável para todos os perfis.
- **Orçamento enviado é imutável**: alterações só por nova versão (trigger). Descontos acima do limite do usuário são recusados pelo banco.
- **Textos jurídicos**: versionados; só valem após aprovação de administrador; texto aprovado não pode ser editado (nova versão → rascunho → aprovação). PDF com texto não aprovado sai como **MINUTA** e o envio é bloqueado. As versões usadas ficam registradas no orçamento enviado (`template_snapshot`).
- **Credenciais**: somente em `.env.local`/variáveis do servidor. A chave `service_role` é usada apenas no servidor (`server-only`) para criar usuários. Cabeçalhos de segurança em `next.config.ts`.
- **Validação**: Zod no servidor (CNPJ numérico e alfanumérico com dígito verificador, e-mail, CEP, UF, valores) + constraints no banco.

### Integrações (preparação)

Eventos de orçamento (`quote.created/enviada/aprovada/recusada`) são gravados em `integration_outbox` pelo banco.
`integration_connections` (estado por provedor) e `external_refs` (IDs externos) já existem. Os contratos estão em
`src/lib/integrations/index.ts`. Provedores previstos: Conta Azul, ClickUp, SOC, WhatsApp, E-mail, ZapSign e Agentes de IA.

## Testes

- `tests/lib.test.ts`, `tests/schemas.test.ts`, `tests/cnpj-lookup.test.ts`: regras puras.
- `tests/db/schema.test.ts`: aplica **todas as migrações** em um PostgreSQL real (PGlite) e valida RLS por perfil,
  auditoria, travas, versionamento, painel, aprovação de modelos e paridade de cálculo app × banco.
- `tests/pdf.test.ts`: gera PDFs válidos (normal e minuta).
