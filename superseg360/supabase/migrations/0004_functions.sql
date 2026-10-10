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
