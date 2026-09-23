-- Execute uma vez no SQL Editor do seu projeto Supabase.
create table if not exists public.chat_calls (
  id uuid primary key default gen_random_uuid(),
  usuario text not null check (char_length(usuario) between 1 and 60),
  call text not null check (char_length(call) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists chat_calls_created_at_idx on public.chat_calls (created_at desc);

-- A API atual usa a chave pública do projeto; permita a leitura e a criação
-- de calls. Não há UPDATE ou DELETE liberados.
alter table public.chat_calls enable row level security;

drop policy if exists "chat_calls_public_select" on public.chat_calls;
create policy "chat_calls_public_select"
on public.chat_calls
for select
to anon
using (true);

drop policy if exists "chat_calls_public_insert" on public.chat_calls;
create policy "chat_calls_public_insert"
on public.chat_calls
for insert
to anon
with check (true);

drop policy if exists "chat_calls_public_delete" on public.chat_calls;
create policy "chat_calls_public_delete"
on public.chat_calls
for delete
to anon
using (true);
