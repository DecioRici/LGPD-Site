-- Execute uma vez no SQL Editor do seu projeto Supabase.
-- Reexecutar este arquivo preserva a base já existente.
create table if not exists public.patio_board (
    id text primary key check (id = 'main'),
    revision bigint not null default 0 check (revision >= 0),
    records jsonb not null default '[]'::jsonb check (jsonb_typeof(records) = 'array'),
    history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
    last_mutation_id text,
    updated_at timestamptz not null default now()
);

alter table public.patio_board enable row level security;
revoke all on public.patio_board from anon, authenticated;
grant select, update on public.patio_board to service_role;

insert into public.patio_board (id) values ('main') on conflict (id) do nothing;

-- Only a hash of the Vercel backend token is stored here.
create table if not exists public.patio_backend_keys (
    id text primary key check (id = 'vercel'),
    token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$')
);
alter table public.patio_backend_keys enable row level security;
revoke all on public.patio_backend_keys from public, anon, authenticated;
grant select on public.patio_backend_keys to service_role;
