create type public.purchase_status as enum ('approved', 'pending', 'denied');
create type public.purchase_currency as enum ('star', 'crown');
create type public.purchase_kind as enum ('cosmetic', 'privilege');

create table public.shop_purchases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  class_id uuid,
  item_key text not null,
  item_name text not null,
  kind purchase_kind not null,
  currency purchase_currency not null,
  cost integer not null check (cost > 0),
  status purchase_status not null default 'approved',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

alter table public.shop_purchases enable row level security;

create policy "Students view own purchases"
  on public.shop_purchases for select
  to authenticated
  using (auth.uid() = student_id);

create policy "Students create own purchases"
  on public.shop_purchases for insert
  to authenticated
  with check (auth.uid() = student_id);

create policy "Teachers view purchases for their class students"
  on public.shop_purchases for select
  to authenticated
  using (
    class_id is not null
    and public.is_class_teacher(class_id, auth.uid())
  );

create policy "Teachers resolve purchases for their classes"
  on public.shop_purchases for update
  to authenticated
  using (class_id is not null and public.is_class_teacher(class_id, auth.uid()))
  with check (class_id is not null and public.is_class_teacher(class_id, auth.uid()));

-- Deduct coins on purchase + notify teacher for privileges
create or replace function public.handle_shop_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _balance int;
  _teacher uuid;
  _student_name text;
begin
  insert into public.student_coins (student_id) values (new.student_id)
  on conflict (student_id) do nothing;

  if new.currency = 'star' then
    select star_coins into _balance from public.student_coins where student_id = new.student_id for update;
  else
    select crown_coins into _balance from public.student_coins where student_id = new.student_id for update;
  end if;

  if _balance < new.cost then
    raise exception 'Insufficient coins';
  end if;

  if new.currency = 'star' then
    update public.student_coins set star_coins = star_coins - new.cost, updated_at = now()
      where student_id = new.student_id;
  else
    update public.student_coins set crown_coins = crown_coins - new.cost, updated_at = now()
      where student_id = new.student_id;
  end if;

  if new.kind = 'privilege' and new.class_id is not null then
    select teacher_id into _teacher from public.classes where id = new.class_id;
    select coalesce(nullif(full_name, ''), 'A student') into _student_name
      from public.profiles where id = new.student_id;
    if _teacher is not null then
      insert into public.notifications (user_id, type, message, link)
      values (
        _teacher,
        'privilege_request',
        _student_name || ' requested "' || new.item_name || '"',
        '/teacher'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_shop_purchase_created on public.shop_purchases;
create trigger on_shop_purchase_created
before insert on public.shop_purchases
for each row execute function public.handle_shop_purchase();

-- Refund on denial
create or replace function public.handle_shop_purchase_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'denied' and old.status = 'pending' then
    if new.currency = 'star' then
      update public.student_coins set star_coins = star_coins + new.cost, updated_at = now()
        where student_id = new.student_id;
    else
      update public.student_coins set crown_coins = crown_coins + new.cost, updated_at = now()
        where student_id = new.student_id;
    end if;
    new.resolved_at = now();
    new.resolved_by = auth.uid();
    -- notify student
    insert into public.notifications (user_id, type, message, link)
    values (new.student_id, 'privilege_denied', 'Your "' || new.item_name || '" request was denied (refunded)', '/student');
  elsif new.status = 'approved' and old.status = 'pending' then
    new.resolved_at = now();
    new.resolved_by = auth.uid();
    insert into public.notifications (user_id, type, message, link)
    values (new.student_id, 'privilege_approved', 'Your "' || new.item_name || '" request was approved', '/student');
  end if;
  return new;
end;
$$;

drop trigger if exists on_shop_purchase_updated on public.shop_purchases;
create trigger on_shop_purchase_updated
before update on public.shop_purchases
for each row execute function public.handle_shop_purchase_resolution();
