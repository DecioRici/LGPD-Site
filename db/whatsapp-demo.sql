-- Private delivery ledger. No browser access; at most 100 attempts across deployments.
create table public.patio_whatsapp_calls (
  call_key text primary key,
  record_id text not null,
  phone text not null,
  status text not null default 'reserved' check (status in ('reserved','submitted','failed','unknown')),
  message_id text,
  created_at timestamptz not null default now()
);
alter table public.patio_whatsapp_calls enable row level security;
revoke all on public.patio_whatsapp_calls from public, anon, authenticated;
grant select,insert,update on public.patio_whatsapp_calls to service_role;

create function public.patio_reserve_whatsapp(p_record_id text, p_phone text, p_stage_at text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r jsonb; c public.patio_whatsapp_calls; k text;
begin
  -- Serializes reservations, including distinct recipients and concurrent Vercel instances.
  perform pg_advisory_xact_lock(716284913);
  select value into r from public.patio_board b, jsonb_array_elements(b.records) where b.id='main' and value->>'id'=p_record_id;
  if r is null or (r->>'cancelled')::boolean or (r->>'stage')::int not in (2,4) then
    return jsonb_build_object('error','O veículo não está aguardando chamada para a balança.','code',409);
  end if;
  if r->>'whatsapp' is distinct from p_phone or r->>'stageEnteredAt' is distinct from p_stage_at then
    return jsonb_build_object('error','O cadastro mudou. Reabra a chamada.','code',409);
  end if;
  k := p_record_id || ':' || p_stage_at;
  select * into c from public.patio_whatsapp_calls where call_key=k;
  if found then
    return jsonb_build_object('existing',true,'status',c.status,'messageId',c.message_id);
  end if;
  if (select count(*) from public.patio_whatsapp_calls)>=100 then
    return jsonb_build_object('error','Limite de 100 tentativas atingido.','code',429);
  end if;
  insert into public.patio_whatsapp_calls(call_key,record_id,phone) values(k,p_record_id,p_phone);
  return jsonb_build_object('key',k,'driver',r->>'driver','plate',r->>'plate','stage',(r->>'stage')::int);
end;
$$;
revoke all on function public.patio_reserve_whatsapp(text,text,text) from public,anon,authenticated;
grant execute on function public.patio_reserve_whatsapp(text,text,text) to service_role;
