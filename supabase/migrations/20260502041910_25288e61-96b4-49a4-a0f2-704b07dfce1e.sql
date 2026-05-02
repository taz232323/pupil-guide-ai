-- Enable scheduling extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Coin transaction history
create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  amount integer not null,
  currency text not null default 'star',
  reason text not null,
  assignment_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_coin_tx_student_created
  on public.coin_transactions(student_id, created_at desc);

create index if not exists idx_coin_tx_assignment
  on public.coin_transactions(assignment_id);

alter table public.coin_transactions enable row level security;

create policy "Students view own transactions"
  on public.coin_transactions for select
  to authenticated
  using (auth.uid() = student_id);

create policy "Teachers view transactions for class students"
  on public.coin_transactions for select
  to authenticated
  using (
    exists (
      select 1 from public.class_members cm
      join public.classes c on c.id = cm.class_id
      where cm.student_id = coin_transactions.student_id
        and c.teacher_id = auth.uid()
    )
  );
-- No insert/update/delete policies: only the edge function (service role) writes.