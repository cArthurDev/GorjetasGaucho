-- Execute uma vez no SQL Editor do seu projeto Supabase.
create table if not exists public.chat_calls (
  id uuid primary key default gen_random_uuid(),
  usuario text not null check (char_length(usuario) between 1 and 60),
  call text not null check (char_length(call) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists chat_calls_created_at_idx on public.chat_calls (created_at desc);
