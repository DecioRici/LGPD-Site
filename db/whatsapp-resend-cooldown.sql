-- Unlimited application usage; a new deliberate call is allowed after 60 seconds.
create index if not exists patio_whatsapp_calls_record_created_idx
  on public.patio_whatsapp_calls(record_id, created_at desc);

create or replace function public.patio_reserve_whatsapp_call(
  p_record_id text, p_phone text, p_stage_at text, p_request_id text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r jsonb; c public.patio_whatsapp_calls; k text; last_at timestamptz; wait_seconds int;
begin
  if p_request_id is null or p_request_id !~ '^[a-zA-Z0-9_-]{1,80}$' then
    return jsonb_build_object('error','Atualize a página e tente novamente.','code',400);
  end if;
  perform pg_advisory_xact_lock(716284913);
  select value into r from public.patio_board b, jsonb_array_elements(b.records)
    where b.id='main' and value->>'id'=p_record_id;
  if r is null or (r->>'cancelled')::boolean or (r->>'stage')::int not in (2,4) then
    return jsonb_build_object('error','O veículo não está aguardando chamada para a balança.','code',409);
  end if;
  if r->>'whatsapp' is distinct from p_phone or r->>'stageEnteredAt' is distinct from p_stage_at then
    return jsonb_build_object('error','O cadastro mudou. Reabra a chamada.','code',409);
  end if;
  k := 'call:' || p_request_id;
  select * into c from public.patio_whatsapp_calls where call_key=k;
  if found then
    if c.record_id<>p_record_id or c.phone<>p_phone then
      return jsonb_build_object('error','Chamada inválida. Reabra o cadastro.','code',409);
    end if;
    wait_seconds := greatest(0,ceil(extract(epoch from c.created_at+interval '60 seconds'-clock_timestamp()))::int);
    return jsonb_build_object('existing',true,'status',c.status,'messageId',c.message_id,'retryAfter',wait_seconds);
  end if;
  select max(created_at) into last_at from public.patio_whatsapp_calls where record_id=p_record_id;
  wait_seconds := greatest(0,ceil(extract(epoch from last_at+interval '60 seconds'-clock_timestamp()))::int);
  if wait_seconds>0 then
    return jsonb_build_object('error','Aguarde para chamar novamente.','code',429,'retryAfter',wait_seconds);
  end if;
  insert into public.patio_whatsapp_calls(call_key,record_id,phone) values(k,p_record_id,p_phone);
  return jsonb_build_object('key',k,'driver',r->>'driver','plate',r->>'plate','stage',(r->>'stage')::int,'retryAfter',60);
end;
$$;
revoke all on function public.patio_reserve_whatsapp_call(text,text,text,text) from public,anon,authenticated;
grant execute on function public.patio_reserve_whatsapp_call(text,text,text,text) to service_role;
