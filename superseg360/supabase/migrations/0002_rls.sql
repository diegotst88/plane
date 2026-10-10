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
