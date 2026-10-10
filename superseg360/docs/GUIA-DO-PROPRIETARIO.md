# Guia do proprietário — SuperSeg 360 (Módulo Comercial)

Você não precisa escrever código. Este guia tem **duas partes**: (A) colocar o sistema no ar e (B) o que você precisa decidir/validar.

## A. Colocar o sistema no ar (uma vez)

### A1. Criar o banco de dados (Supabase) — ~10 minutos

1. Acesse https://supabase.com, crie uma conta e clique em **New project**. Nome: `superseg360`. Região: **South America (São Paulo)**. Guarde a senha do banco em um cofre de senhas.
2. Quando o projeto ficar pronto, abra **SQL Editor → New query**, cole **todo** o conteúdo do arquivo `superseg360/supabase/setup_completo.sql` e clique em **Run**. Deve aparecer “Success”. (Rode apenas uma vez.)
3. **Muito importante (segurança):** vá em **Authentication → Sign In / Providers → Email** e **desative “Allow new users to sign up”** (cadastro público). Mantenha “Confirm email” como preferir. Em **Authentication → Policies/Passwords**, exija senha com mínimo de 10 caracteres.
4. Vá em **Project Settings → API** e copie: **Project URL**, **anon public key** e **service_role key** (esta última é secreta: nunca envie por e-mail/WhatsApp).

### A2. Criar o seu usuário administrador

1. **Authentication → Users → Add user → Create new user**: informe seu e-mail e uma senha forte e marque **Auto Confirm User**.
2. O **primeiro usuário criado vira Administrador automaticamente**. Os próximos entram como “Somente leitura” até você ajustar em **Usuários** dentro do sistema (ou crie-os direto pelo menu Usuários).

### A3. Rodar o sistema

**Opção 1 — no computador (para testar):** peça ao responsável técnico (ou ao agente) para executar:

```
cd superseg360
cp .env.example .env.local      # e preencher as 3 chaves copiadas no passo A1.4
npm install
npm run dev                     # abrir http://localhost:3000
```

**Opção 2 — publicar na internet (para o piloto de terça-feira):** recomendamos a **Vercel** (https://vercel.com): importe o repositório do GitHub, defina **Root Directory = `superseg360`**, cadastre as variáveis de ambiente do arquivo `.env.example` (as 3 chaves do Supabase + dados da empresa) e clique em **Deploy**. Depois, no Supabase, em **Authentication → URL Configuration**, informe o endereço público do sistema.

## B. Decisões e validações que dependem de você

Antes de usar com cliente real:

1. **Textos da proposta (menu “Modelos de texto”)** — hoje são **minutas provisórias**. Substitua pelos textos reais da proposta 38072 (apresentação, objeto, condições, cláusulas, formas de aceite). As cláusulas devem ser **validadas pelo jurídico** e só então aprovadas (botão “Aprovar este texto”). **Enquanto houver texto não aprovado, o PDF sai com a marca “MINUTA – NÃO ENVIAR” e o sistema bloqueia “Marcar como enviada”.**
2. **Preços do catálogo** — os serviços foram cadastrados com **R$ 0,00**. Defina preço, prazo e escopo reais em **Serviços**.
3. **Logotipo** — copie o arquivo do logotipo para `superseg360/public/logo.png` (fundo transparente, PNG). Ele aparece na capa do PDF. Também informe CNPJ, telefone, e-mail e site da SuperSeg no `.env.local` (`COMPANY_*`).
4. **Regras de desconto** — padrão: comercial até **5% por item**; acima disso somente administrador. Ajuste por usuário em **Usuários**.
5. **Quem altera o catálogo?** — padrão: somente administrador altera serviços/preços. Comercial apenas usa.
6. **Quem enxerga o quê?** — hoje todos os usuários ativos veem todos os clientes e propostas (equipe comercial pequena). Se quiser “cada vendedor vê só as suas”, é uma mudança simples de regra no banco.
7. **Texto/layout do PDF** — confira o PDF de exemplo (`npm run sample-pdf` → `sample-output/`). O arquivo da proposta 38072 **não estava disponível ao agente**; o layout seguiu o padrão descrito (capa, seções 1 a 8, azul/verde/branco). Envie o PDF para ajustarmos fielmente.

## C. Conferência obrigatória de cada proposta antes de enviar

Veja `docs/CHECKLIST-CONFERENCIA-PROPOSTA.md`. O sistema exige confirmação explícita em “Marcar como enviada”, trava o orçamento e registra data, usuário e as versões dos textos usados.

## D. Backup e continuidade

- O Supabase faz backups diários nos planos pagos (Pro). Para o piloto, exporte periodicamente (**Database → Backups**) ou considere o plano Pro antes de operar com dados reais.
- Nada é apagado pelo sistema: clientes/serviços são “inativados”, orçamentos antigos viram “versões anteriores”.
