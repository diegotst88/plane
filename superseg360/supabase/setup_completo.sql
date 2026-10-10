-- ===== 0001_schema.sql =====
-- SuperSeg 360 :: Modulo Comercial :: 0001 - estrutura base
-- Executar uma unica vez em um projeto Supabase (PostgreSQL 15+).

create type public.app_role as enum ('admin', 'comercial', 'leitura');
create type public.quote_status as enum ('elaboracao', 'enviada', 'aprovada', 'recusada');
create type public.template_kind as enum ('institutional', 'contractual');
create type public.template_status as enum ('draft', 'approved', 'archived');
create type public.integration_provider as enum
  ('conta_azul', 'clickup', 'soc', 'whatsapp', 'email', 'zapsign', 'ai_agents');

create or replace function public.today_br() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Validacao de CNPJ (numerico e alfanumerico, formato valido desde jul/2026)
create or replace function public.is_valid_cnpj(c text) returns boolean
language plpgsql immutable as $$
declare
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; i int; r int;
begin
  if c is null or c !~ '^[0-9A-Z]{12}[0-9]{2}$' then return false; end if;
  if c ~ '^(.)\1{13}$' then return false; end if;
  s := 0;
  for i in 1..12 loop s := s + (ascii(substr(c, i, 1)) - 48) * w1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> (ascii(substr(c, 13, 1)) - 48) then return false; end if;
  s := 0;
  for i in 1..13 loop s := s + (ascii(substr(c, i, 1)) - 48) * w2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = (ascii(substr(c, 14, 1)) - 48);
end $$;

-- ---------------------------------------------------------------- perfis
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.app_role not null default 'leitura',
  active boolean not null default true,
  max_discount_percent numeric(5,2) not null default 5
    check (max_discount_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- O primeiro usuario criado vira administrador; os demais entram como leitura
-- ate que um administrador defina o perfil correto.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, full_name, role, max_discount_percent)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when first_user then 'admin'::public.app_role else 'leitura'::public.app_role end,
    case when first_user then 100 else 5 end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.app_current_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;
create or replace function public.app_is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;
create or replace function public.app_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_current_role() = 'admin', false)
$$;
create or replace function public.app_can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_current_role() in ('admin', 'comercial'), false)
$$;
create or replace function public.app_max_discount() returns numeric
language sql stable security definer set search_path = public as $$
  select case when role = 'admin' then 100 else max_discount_percent end
  from public.profiles where id = auth.uid() and active
$$;

-- Impede que o proprio usuario eleve seu perfil e garante ao menos um admin ativo.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (old.role = 'admin' and old.active)
     and (new.role <> 'admin' or not new.active)
     and not exists (
       select 1 from public.profiles where role = 'admin' and active and id <> old.id
     ) then
    raise exception 'É necessário manter ao menos um administrador ativo.';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- ------------------------------------------------------------ auditoria
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  user_email text,
  table_name text not null,
  record_id uuid,
  context_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_fields text[],
  old_data jsonb,
  new_data jsonb
);
create index audit_log_context_idx on public.audit_log (context_id, at desc);
create index audit_log_table_idx on public.audit_log (table_name, at desc);

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  changed text[];
  ctx text;
  uemail text;
begin
  r := coalesce(n, o);
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into changed
    from jsonb_object_keys(n) k
    where k <> 'updated_at' and (n -> k) is distinct from (o -> k);
    if changed is null then return new; end if;
  end if;
  ctx := case tg_table_name
    when 'quote_items' then r ->> 'quote_id'
    when 'client_units' then r ->> 'client_id'
    when 'client_contacts' then r ->> 'client_id'
    else r ->> 'id' end;
  select email into uemail from public.profiles where id = auth.uid();
  insert into public.audit_log
    (user_id, user_email, table_name, record_id, context_id, action, changed_fields, old_data, new_data)
  values
    (auth.uid(), uemail, tg_table_name, (r ->> 'id')::uuid, ctx::uuid, tg_op, changed, o, n);
  return coalesce(new, old);
end $$;

-- --------------------------------------------------------------- clientes
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null check (length(trim(razao_social)) >= 2),
  nome_fantasia text,
  cnpj text not null check (public.is_valid_cnpj(cnpj)),
  inscricao_estadual text,
  ie_isento boolean not null default false,
  cep text check (cep is null or cep ~ '^[0-9]{8}$'),
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  billing_cnpj text check (billing_cnpj is null or public.is_valid_cnpj(billing_cnpj)),
  billing_name text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_cnpj_key on public.clients (cnpj);
create index clients_search_idx on public.clients (lower(razao_social), lower(nome_fantasia));

create table public.client_units (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  name text not null check (length(trim(name)) >= 2),
  cnpj text check (cnpj is null or public.is_valid_cnpj(cnpj)),
  cep text check (cep is null or cep ~ '^[0-9]{8}$'),
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_units_client_idx on public.client_units (client_id);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  name text not null check (length(trim(name)) >= 2),
  role_title text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_contacts_client_idx on public.client_contacts (client_id);

-- -------------------------------------------------------------- servicos
create table public.services (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,29}$'),
  name text not null check (length(trim(name)) >= 2),
  category text not null default 'outros'
    check (category in ('programa', 'laudo', 'norma', 'ergonomia', 'treinamento', 'exame', 'outros')),
  commercial_description text not null default '',
  technical_scope text not null default '',
  suggested_price_cents bigint not null default 0 check (suggested_price_cents >= 0),
  unit_label text not null default 'un',
  delivery_days integer check (delivery_days is null or delivery_days >= 0),
  inclusions text not null default '',
  exclusions text not null default '',
  specific_clauses text not null default '',
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index services_code_key on public.services (code);

-- --------------------------------------------- modelos de texto (versionados)
create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  kind public.template_kind not null,
  title text not null,
  body text not null,
  version integer not null default 1,
  status public.template_status not null default 'draft',
  created_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, version)
);
create unique index document_templates_one_approved
  on public.document_templates (key) where status = 'approved';

-- Texto aprovado e imutavel: alteracoes exigem uma nova versao, que nasce como
-- rascunho e so passa a valer apos aprovacao de um administrador.
create or replace function public.templates_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if old.status <> 'draft' and (new.body is distinct from old.body
        or new.title is distinct from old.title or new.key is distinct from old.key
        or new.version is distinct from old.version) then
      raise exception 'Modelo aprovado não pode ser alterado. Crie uma nova versão.';
    end if;
    if new.status = 'approved' and old.status = 'draft' then
      if not public.app_is_admin() then
        raise exception 'Somente administradores podem aprovar modelos.';
      end if;
      if new.body ~* '\[(texto|minuta) provis' or new.title ~* '\(minuta provis|\[(texto|minuta) provis' then
        raise exception 'O texto ainda contém marcações provisórias ([TEXTO PROVISÓRIO] / MINUTA PROVISÓRIA). Substitua pelo texto oficial antes de aprovar.';
      end if;
      new.approved_by := auth.uid();
      new.approved_at := now();
      update public.document_templates set status = 'archived'
        where key = new.key and status = 'approved' and id <> new.id;
    elsif new.status is distinct from old.status
        and not (old.status = 'approved' and new.status = 'archived') then
      raise exception 'Transição de status inválida para o modelo.';
    end if;
  end if;
  return new;
end $$;
create trigger templates_guard before update on public.document_templates
  for each row execute function public.templates_guard();
create trigger templates_updated_at before update on public.document_templates
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- orcamentos
create sequence public.quote_number_seq start 1;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number integer not null default nextval('public.quote_number_seq'),
  version integer not null default 1 check (version >= 1),
  is_current boolean not null default true,
  parent_quote_id uuid references public.quotes (id),
  status public.quote_status not null default 'elaboracao',
  client_id uuid not null references public.clients (id),
  unit_id uuid references public.client_units (id),
  contact_id uuid references public.client_contacts (id),
  subject text not null default '',
  validity_date date not null,
  delivery_days integer check (delivery_days is null or delivery_days >= 0),
  payment_terms text not null default '',
  internal_notes text not null default '',
  subtotal_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  total_cents bigint not null default 0,
  sent_at timestamptz,
  decided_at timestamptz,
  decision_note text,
  template_snapshot jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (number, version)
);
create unique index quotes_one_current on public.quotes (number) where is_current;
create index quotes_client_idx on public.quotes (client_id);
create index quotes_status_idx on public.quotes (status, validity_date) where is_current;

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  service_id uuid references public.services (id),
  position integer not null default 0,
  code text not null,
  name text not null,
  description text not null default '',
  technical_scope text not null default '',
  inclusions text not null default '',
  exclusions text not null default '',
  specific_clauses text not null default '',
  unit_label text not null default 'un',
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  total_cents bigint generated always as (
    round(quantity * unit_price_cents * (100 - discount_percent) / 100)::bigint
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quote_items_quote_idx on public.quote_items (quote_id, position);

create or replace function public.quote_items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare qid uuid := coalesce(new.quote_id, old.quote_id); st public.quote_status;
begin
  select status into st from public.quotes where id = qid;
  if st is distinct from 'elaboracao' then
    raise exception 'Orçamento já enviado/decidido não pode ser editado. Crie uma nova versão.';
  end if;
  if tg_op <> 'DELETE' and new.discount_percent > coalesce(public.app_max_discount(), 0) then
    raise exception 'Desconto de % %% acima do limite autorizado (% %%). Solicite a um administrador.',
      new.discount_percent, coalesce(public.app_max_discount(), 0);
  end if;
  return coalesce(new, old);
end $$;
create trigger quote_items_guard before insert or update or delete on public.quote_items
  for each row execute function public.quote_items_guard();
create trigger quote_items_updated_at before update on public.quote_items
  for each row execute function public.set_updated_at();

create or replace function public.quote_recalculate() returns trigger
language plpgsql security definer set search_path = public as $$
declare qid uuid := coalesce(new.quote_id, old.quote_id);
begin
  update public.quotes q set
    subtotal_cents = coalesce(s.gross, 0),
    total_cents = coalesce(s.net, 0),
    discount_cents = coalesce(s.gross, 0) - coalesce(s.net, 0)
  from (
    select sum(round(quantity * unit_price_cents)::bigint) as gross, sum(total_cents) as net
    from public.quote_items where quote_id = qid
  ) s
  where q.id = qid;
  return null;
end $$;
create trigger quote_items_recalc after insert or update or delete on public.quote_items
  for each row execute function public.quote_recalculate();

create or replace function public.quotes_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if old.status <> 'elaboracao' and (
         new.client_id is distinct from old.client_id
      or new.unit_id is distinct from old.unit_id
      or new.contact_id is distinct from old.contact_id
      or new.subject is distinct from old.subject
      or new.validity_date is distinct from old.validity_date
      or new.delivery_days is distinct from old.delivery_days
      or new.payment_terms is distinct from old.payment_terms
      or new.number is distinct from old.number
      or new.version is distinct from old.version) then
      raise exception 'Orçamento já enviado/decidido não pode ser editado. Crie uma nova versão.';
    end if;
    if new.status is distinct from old.status and not (
         (old.status = 'elaboracao' and new.status = 'enviada')
      or (old.status = 'enviada' and new.status in ('aprovada', 'recusada'))) then
      raise exception 'Transição de status inválida: % -> %', old.status, new.status;
    end if;
    if new.status = 'enviada' and old.status = 'elaboracao' then
      if new.total_cents <= 0 then
        raise exception 'Não é possível enviar um orçamento sem itens/valor.';
      end if;
      new.sent_at := now();
    end if;
    if new.status in ('aprovada', 'recusada') and old.status = 'enviada' then
      new.decided_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger quotes_guard before update on public.quotes
  for each row execute function public.quotes_guard();
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();

-- Nova versao: copia cabecalho e itens, mantendo o mesmo numero de proposta.
create or replace function public.quote_new_version(p_quote_id uuid) returns uuid
language plpgsql security invoker set search_path = public as $$
declare src public.quotes; new_id uuid;
begin
  select * into src from public.quotes where id = p_quote_id;
  if not found then raise exception 'Orçamento não encontrado.'; end if;
  if not src.is_current then raise exception 'Somente a versão atual pode gerar nova versão.'; end if;
  if src.status = 'elaboracao' then
    raise exception 'A versão atual ainda está em elaboração; edite-a diretamente.';
  end if;
  update public.quotes set is_current = false where id = src.id;
  insert into public.quotes
    (number, version, parent_quote_id, client_id, unit_id, contact_id, subject, validity_date,
     delivery_days, payment_terms, internal_notes, created_by)
  values
    (src.number, src.version + 1, src.id, src.client_id, src.unit_id, src.contact_id, src.subject,
     greatest(src.validity_date, public.today_br() + 15), src.delivery_days, src.payment_terms,
     src.internal_notes, auth.uid())
  returning id into new_id;
  insert into public.quote_items
    (quote_id, service_id, position, code, name, description, technical_scope, inclusions,
     exclusions, specific_clauses, unit_label, quantity, unit_price_cents, discount_percent)
  select new_id, service_id, position, code, name, description, technical_scope, inclusions,
     exclusions, specific_clauses, unit_label, quantity, unit_price_cents, discount_percent
  from public.quote_items where quote_id = src.id;
  return new_id;
end $$;

-- ------------------------------------------------ preparacao p/ integracoes
-- Nenhuma integracao e executada nesta fase. Credenciais NUNCA ficam nestas
-- tabelas: guarde-as em variaveis de ambiente/Supabase Vault e referencie por nome.
create table public.integration_connections (
  provider public.integration_provider primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  secret_ref text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger integration_connections_updated_at before update on public.integration_connections
  for each row execute function public.set_updated_at();
insert into public.integration_connections (provider)
  select unnest(enum_range(null::public.integration_provider));

create table public.external_refs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  provider public.integration_provider not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, provider)
);

create table public.integration_outbox (
  id bigint generated always as identity primary key,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index integration_outbox_pending_idx on public.integration_outbox (status, created_at);

create or replace function public.quotes_outbox() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.integration_outbox (event_type, entity_type, entity_id, payload)
    values (
      case when tg_op = 'INSERT' then 'quote.created' else 'quote.' || new.status::text end,
      'quote', new.id,
      jsonb_build_object('number', new.number, 'version', new.version, 'status', new.status,
                         'client_id', new.client_id, 'total_cents', new.total_cents)
    );
  end if;
  return null;
end $$;
create trigger quotes_outbox after insert or update on public.quotes
  for each row execute function public.quotes_outbox();

-- --------------------------------------------- auditoria nas tabelas de negocio
create trigger audit_clients after insert or update or delete on public.clients
  for each row execute function public.audit_trigger();
create trigger audit_client_units after insert or update or delete on public.client_units
  for each row execute function public.audit_trigger();
create trigger audit_client_contacts after insert or update or delete on public.client_contacts
  for each row execute function public.audit_trigger();
create trigger audit_services after insert or update or delete on public.services
  for each row execute function public.audit_trigger();
create trigger audit_templates after insert or update or delete on public.document_templates
  for each row execute function public.audit_trigger();
create trigger audit_quotes after insert or update or delete on public.quotes
  for each row execute function public.audit_trigger();
create trigger audit_quote_items after insert or update or delete on public.quote_items
  for each row execute function public.audit_trigger();
create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_trigger();
create trigger audit_integrations after update on public.integration_connections
  for each row execute function public.audit_trigger();

-- ===== 0002_rls.sql =====
-- SuperSeg 360 :: Modulo Comercial :: 0002 - seguranca (RLS e privilegios)
-- Regras: somente usuarios autenticados E ativos acessam dados; "leitura" apenas
-- consulta; "comercial" cria/edita clientes e orcamentos; "admin" gerencia tudo
-- (inclusive catalogo de servicos, modelos de texto, usuarios e integracoes).
-- Nenhuma tabela permite DELETE de registros de negocio (inativacao logica).

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;
grant usage on schema public to authenticated;

grant select on public.profiles, public.audit_log, public.clients, public.client_units,
  public.client_contacts, public.services, public.document_templates, public.quotes,
  public.quote_items to authenticated;
grant update (full_name, role, active, max_discount_percent) on public.profiles to authenticated;
grant insert, update on public.clients, public.client_units, public.client_contacts,
  public.services, public.quotes to authenticated;
grant insert, update, delete on public.quote_items to authenticated;
grant insert, update on public.document_templates to authenticated;
grant select, update on public.integration_connections to authenticated;
grant select on public.external_refs, public.integration_outbox to authenticated;
grant usage on sequence public.quote_number_seq to authenticated;
grant execute on function public.app_current_role(), public.app_is_member(),
  public.app_is_admin(), public.app_can_write(), public.app_max_discount(),
  public.is_valid_cnpj(text), public.today_br(), public.quote_new_version(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;
alter table public.clients enable row level security;
alter table public.client_units enable row level security;
alter table public.client_contacts enable row level security;
alter table public.services enable row level security;
alter table public.document_templates enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.integration_connections enable row level security;
alter table public.external_refs enable row level security;
alter table public.integration_outbox enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.app_is_admin());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

-- audit_log (somente leitura; gravado exclusivamente por triggers)
create policy audit_select_admin on public.audit_log for select to authenticated
  using (public.app_is_admin());
create policy audit_select_business on public.audit_log for select to authenticated
  using (public.app_is_member()
         and table_name in ('clients', 'client_units', 'client_contacts', 'services', 'quotes', 'quote_items'));

-- clientes, unidades e contatos
create policy clients_select on public.clients for select to authenticated using (public.app_is_member());
create policy clients_insert on public.clients for insert to authenticated with check (public.app_can_write());
create policy clients_update on public.clients for update to authenticated
  using (public.app_can_write()) with check (public.app_can_write());

create policy units_select on public.client_units for select to authenticated using (public.app_is_member());
create policy units_insert on public.client_units for insert to authenticated with check (public.app_can_write());
create policy units_update on public.client_units for update to authenticated
  using (public.app_can_write()) with check (public.app_can_write());

create policy contacts_select on public.client_contacts for select to authenticated using (public.app_is_member());
create policy contacts_insert on public.client_contacts for insert to authenticated with check (public.app_can_write());
create policy contacts_update on public.client_contacts for update to authenticated
  using (public.app_can_write()) with check (public.app_can_write());

-- catalogo de servicos: precos e escopo tecnico sao gestao -> somente admin altera
create policy services_select on public.services for select to authenticated using (public.app_is_member());
create policy services_insert on public.services for insert to authenticated with check (public.app_is_admin());
create policy services_update on public.services for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

-- modelos de texto (institucionais e contratuais): somente admin
create policy templates_select on public.document_templates for select to authenticated
  using (public.app_is_member());
create policy templates_insert on public.document_templates for insert to authenticated
  with check (public.app_is_admin() and status = 'draft');
create policy templates_update on public.document_templates for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

-- orcamentos e itens
create policy quotes_select on public.quotes for select to authenticated using (public.app_is_member());
create policy quotes_insert on public.quotes for insert to authenticated
  with check (public.app_can_write() and status = 'elaboracao');
create policy quotes_update on public.quotes for update to authenticated
  using (public.app_can_write()) with check (public.app_can_write());

create policy items_select on public.quote_items for select to authenticated using (public.app_is_member());
create policy items_insert on public.quote_items for insert to authenticated with check (public.app_can_write());
create policy items_update on public.quote_items for update to authenticated
  using (public.app_can_write()) with check (public.app_can_write());
create policy items_delete on public.quote_items for delete to authenticated using (public.app_can_write());

-- integracoes (somente admin)
create policy integrations_select on public.integration_connections for select to authenticated
  using (public.app_is_admin());
create policy integrations_update on public.integration_connections for update to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy external_refs_select on public.external_refs for select to authenticated
  using (public.app_is_admin());
create policy outbox_select on public.integration_outbox for select to authenticated
  using (public.app_is_admin());

-- Painel comercial (security invoker: respeita RLS do usuario)
create or replace function public.commercial_dashboard() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'clients', (select count(*) from public.clients where active),
    'elaboracao', (select count(*) from public.quotes where is_current and status = 'elaboracao'),
    'enviadas', (select count(*) from public.quotes
                 where is_current and status = 'enviada' and validity_date >= public.today_br()),
    'aprovadas', (select count(*) from public.quotes where is_current and status = 'aprovada'),
    'recusadas', (select count(*) from public.quotes where is_current and status = 'recusada'),
    'vencidas', (select count(*) from public.quotes
                 where is_current and status = 'enviada' and validity_date < public.today_br()),
    'valor_aberto_cents', (select coalesce(sum(total_cents), 0) from public.quotes
                 where is_current and status = 'enviada' and validity_date >= public.today_br()),
    'valor_aprovado_cents', (select coalesce(sum(total_cents), 0) from public.quotes
                 where is_current and status = 'aprovada')
  )
$$;
grant execute on function public.commercial_dashboard() to authenticated;

-- ===== 0003_seed_templates.sql =====
-- SuperSeg 360 :: Módulo Comercial :: 0003 - modelos de texto iniciais
-- ATENÇÃO: todos os modelos nascem como RASCUNHO (minuta provisória). Enquanto não
-- forem revisados e aprovados por um administrador (menu Modelos), o PDF da proposta
-- sai com a marca "MINUTA - NÃO ENVIAR" e o sistema bloqueia o envio ao cliente.
-- Substitua pelos textos reais da proposta 38072 e pelas cláusulas validadas pelo jurídico.
-- Campos disponíveis: {{cliente_razao_social}} {{cliente_nome_fantasia}} {{cliente_cnpj}}
-- {{unidade_nome}} {{numero_proposta}} {{validade}} {{prazo_entrega}} {{valor_total}}
-- {{servicos_resumo}} {{condicoes_pagamento}}

insert into public.document_templates (key, kind, title, body) values
('apresentacao_superseg', 'institutional', 'Apresentação da SuperSeg',
'A SuperSeg Medicina e Segurança do Trabalho atua na gestão integrada de saúde e segurança ocupacional, apoiando empresas no cumprimento da legislação trabalhista e na proteção de seus colaboradores.

Nossa equipe multidisciplinar desenvolve programas, laudos, treinamentos e exames ocupacionais com foco em qualidade técnica, prazo e atendimento próximo.

[TEXTO PROVISÓRIO - substituir pelo texto institucional oficial da proposta 38072]'),

('objeto_proposta', 'institutional', 'Objeto da proposta',
'A presente proposta tem por objeto a prestação, pela SuperSeg Medicina e Segurança do Trabalho, dos serviços de {{servicos_resumo}} a {{cliente_razao_social}}, inscrita no CNPJ {{cliente_cnpj}}, conforme escopo técnico descrito neste documento.'),

('condicoes_pagamento', 'contractual', 'Condições de pagamento (texto de apoio)',
'O investimento total desta proposta é de {{valor_total}}. As condições de pagamento acordadas são: {{condicoes_pagamento}}.

Esta proposta é válida até {{validade}}. O prazo de entrega previsto é de {{prazo_entrega}}, contado a partir da aceitação formal e do recebimento das informações necessárias.'),

('clausulas_contratuais', 'contractual', 'Cláusulas contratuais (MINUTA PROVISÓRIA - requer revisão jurídica)',
'1. DO OBJETO - Os serviços contratados são aqueles descritos no escopo técnico desta proposta {{numero_proposta}}.

2. DAS OBRIGAÇÕES DA CONTRATADA - Executar os serviços com observância das normas regulamentadoras aplicáveis e dos prazos indicados.

3. DAS OBRIGAÇÕES DA CONTRATANTE - Fornecer, em tempo hábil, informações, documentos e acesso aos locais necessários à execução dos serviços.

4. DO PREÇO E DO PAGAMENTO - Conforme seções Investimento e Condições de Pagamento.

5. DA VIGÊNCIA E DA VALIDADE - A proposta tem a validade indicada e, aceita, vigora pelo prazo necessário à conclusão dos serviços.

6. DO FORO - Fica eleito o foro da comarca da sede da CONTRATADA.

[MINUTA PROVISÓRIA - substituir pelas cláusulas oficiais aprovadas pelo jurídico]'),

('formas_aceite', 'contractual', 'Formas de aceite',
'O aceite desta proposta poderá ser formalizado por: (a) assinatura e devolução deste documento; (b) assinatura eletrônica; ou (c) e-mail de confirmação do responsável da CONTRATANTE, citando o número {{numero_proposta}}.

[TEXTO PROVISÓRIO - confirmar formas de aceite com a diretoria]');

-- ===== 0004_functions.sql =====
-- SuperSeg 360 :: Módulo Comercial :: 0004 - gravação atômica de orçamentos
-- Cabeçalho + itens são gravados na mesma transação (tudo ou nada). SECURITY INVOKER:
-- todas as regras de RLS, travas de status e limite de desconto continuam valendo.

create or replace function public.save_quote(p_id uuid, p_header jsonb, p_items jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  qid uuid := p_id;
  cid uuid := (p_header ->> 'client_id')::uuid;
  uid_ uuid := nullif(p_header ->> 'unit_id', '')::uuid;
  contact_ uuid := nullif(p_header ->> 'contact_id', '')::uuid;
  it jsonb;
  pos integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione ao menos um serviço ao orçamento.';
  end if;
  if not exists (select 1 from public.clients where id = cid and active) then
    raise exception 'Cliente não encontrado ou inativo.';
  end if;
  if uid_ is not null and not exists (
       select 1 from public.client_units where id = uid_ and client_id = cid and active) then
    raise exception 'A unidade selecionada não pertence ao cliente.';
  end if;
  if contact_ is not null and not exists (
       select 1 from public.client_contacts where id = contact_ and client_id = cid and active) then
    raise exception 'O contato selecionado não pertence ao cliente.';
  end if;

  if qid is null then
    insert into public.quotes
      (client_id, unit_id, contact_id, subject, validity_date, delivery_days, payment_terms,
       internal_notes, created_by)
    values
      (cid, uid_, contact_, coalesce(p_header ->> 'subject', ''), (p_header ->> 'validity_date')::date,
       nullif(p_header ->> 'delivery_days', '')::integer, coalesce(p_header ->> 'payment_terms', ''),
       coalesce(p_header ->> 'internal_notes', ''), auth.uid())
    returning id into qid;
  else
    update public.quotes set
      client_id = cid, unit_id = uid_, contact_id = contact_,
      subject = coalesce(p_header ->> 'subject', ''),
      validity_date = (p_header ->> 'validity_date')::date,
      delivery_days = nullif(p_header ->> 'delivery_days', '')::integer,
      payment_terms = coalesce(p_header ->> 'payment_terms', ''),
      internal_notes = coalesce(p_header ->> 'internal_notes', '')
    where id = qid and is_current;
    if not found then
      raise exception 'Orçamento não encontrado, não é a versão atual ou sem permissão.';
    end if;
    delete from public.quote_items where quote_id = qid;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    pos := pos + 1;
    insert into public.quote_items
      (quote_id, service_id, position, code, name, description, technical_scope, inclusions,
       exclusions, specific_clauses, unit_label, quantity, unit_price_cents, discount_percent)
    values
      (qid, nullif(it ->> 'service_id', '')::uuid, pos, it ->> 'code', it ->> 'name',
       coalesce(it ->> 'description', ''), coalesce(it ->> 'technical_scope', ''),
       coalesce(it ->> 'inclusions', ''), coalesce(it ->> 'exclusions', ''),
       coalesce(it ->> 'specific_clauses', ''), coalesce(it ->> 'unit_label', 'un'),
       (it ->> 'quantity')::numeric, (it ->> 'unit_price_cents')::bigint,
       (it ->> 'discount_percent')::numeric);
  end loop;
  return qid;
end $$;

grant execute on function public.save_quote(uuid, jsonb, jsonb) to authenticated;

-- ===== 0005_seed_services.sql =====
-- SuperSeg 360 :: Módulo Comercial :: 0005 - catálogo inicial de serviços
-- Preços iniciam em R$ 0,00 de propósito: defina os valores sugeridos reais no menu
-- Serviços antes do piloto. Descrições e escopos são genéricos e devem ser revisados
-- pela equipe técnica (substituir pelos textos da proposta 38072).

insert into public.services (code, name, category, commercial_description, technical_scope, unit_label, inclusions, exclusions) values
('PGR', 'PGR - Programa de Gerenciamento de Riscos', 'programa',
 'Identificação, avaliação e controle dos riscos ocupacionais, conforme NR-01.',
 'Levantamento preliminar de perigos, caracterização das exposições, inventário de riscos, plano de ação e elaboração do documento-base do PGR. [REVISAR ESCOPO]',
 'un', E'Visita técnica\nInventário de riscos\nPlano de ação', E'Medições quantitativas especiais\nImplantação das medidas de controle'),
('PCMSO', 'PCMSO - Programa de Controle Médico de Saúde Ocupacional', 'programa',
 'Planejamento e acompanhamento da saúde dos trabalhadores, conforme NR-07.',
 'Elaboração do PCMSO com base no PGR, definição de exames por função/risco e relatório anual. [REVISAR ESCOPO]',
 'un', E'Elaboração do programa\nRelatório anual', E'Realização dos exames ocupacionais'),
('LTCAT', 'LTCAT - Laudo Técnico das Condições do Ambiente de Trabalho', 'laudo',
 'Laudo para fins previdenciários sobre agentes nocivos no ambiente de trabalho.',
 'Avaliação qualitativa/quantitativa dos agentes nocivos por função e emissão do laudo técnico. [REVISAR ESCOPO]',
 'un', E'Visita técnica\nEmissão do laudo', E'Avaliações quantitativas adicionais'),
('NR12', 'NR-12 - Segurança em Máquinas e Equipamentos', 'norma',
 'Apreciação de riscos e adequação de máquinas e equipamentos à NR-12.',
 'Inventário de máquinas, apreciação de riscos, laudo e plano de adequação. [REVISAR ESCOPO]',
 'máquina', E'Inventário\nApreciação de riscos\nLaudo', E'Execução das adequações físicas'),
('NR13', 'NR-13 - Caldeiras, Vasos de Pressão e Tubulações', 'norma',
 'Inspeção e documentação de equipamentos sujeitos à NR-13.',
 'Inspeção, elaboração de prontuário/relatórios e emissão de laudos. [REVISAR ESCOPO]',
 'equipamento', E'Inspeção\nRelatório técnico', E'Manutenção e reparos'),
('ERGO', 'Ergonomia - AEP/AET', 'ergonomia',
 'Avaliação ergonômica preliminar ou análise ergonômica do trabalho, conforme NR-17.',
 'Análise das condições de trabalho, avaliação e recomendações. [REVISAR ESCOPO]',
 'un', E'Visita técnica\nRelatório com recomendações', E'Implantação das melhorias'),
('TREIN', 'Treinamentos de SST', 'treinamento',
 'Treinamentos obrigatórios e especializados de saúde e segurança do trabalho.',
 'Realização do treinamento conforme conteúdo programático da NR aplicável, com lista de presença e certificados. [REVISAR ESCOPO]',
 'participante', E'Instrutor\nMaterial didático\nCertificados', E'Deslocamento fora da região'),
('EXAMES', 'Exames ocupacionais', 'exame',
 'Exames clínicos e complementares: admissional, periódico, mudança de função, retorno ao trabalho e demissional.',
 'Realização de exames conforme PCMSO e emissão do ASO. [REVISAR ESCOPO]',
 'exame', E'Consulta médica ocupacional\nEmissão do ASO', E'Exames complementares não previstos'),
('OUTROS', 'Outros serviços', 'outros',
 'Serviço personalizado - descrever no escopo do orçamento.', '', 'un', '', '');
