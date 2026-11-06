create type public.lead_stage as enum ('novo', 'qualificado', 'proposta', 'ganho', 'perdido');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  company text not null default '' check (char_length(company) <= 100),
  email text not null default '' check (char_length(email) <= 254),
  stage public.lead_stage not null default 'novo',
  value_cents integer not null default 0 check (value_cents between 0 and 1000000000),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  foreign key (lead_id, owner_id) references public.leads(id, owner_id) on delete cascade
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid not null,
  amount_cents integer not null check (amount_cents between 1 and 1000000000),
  rate_bps integer not null check (rate_bps between 0 and 10000),
  closed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (lead_id),
  foreign key (lead_id, owner_id) references public.leads(id, owner_id)
);

create table public.commissions (
  deal_id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents between 0 and 1000000000),
  foreign key (deal_id, owner_id) references public.deals(id, owner_id) on delete cascade
);

create index leads_owner_idx on public.leads(owner_id);
create index tasks_owner_lead_idx on public.tasks(owner_id, lead_id);
create index deals_owner_idx on public.deals(owner_id);
create index commissions_owner_idx on public.commissions(owner_id);

alter table public.leads enable row level security;
alter table public.tasks enable row level security;
alter table public.deals enable row level security;
alter table public.commissions enable row level security;

create policy owner_leads on public.leads for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy owner_tasks on public.tasks for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy read_deals on public.deals for select to authenticated using (owner_id = (select auth.uid()));
create policy insert_deals on public.deals for insert to authenticated with check (owner_id = (select auth.uid()));
create policy read_commissions on public.commissions for select to authenticated using (owner_id = (select auth.uid()));

revoke all on public.leads, public.tasks, public.deals, public.commissions from anon, authenticated;
grant select, insert on public.leads, public.tasks, public.deals to authenticated;
grant update (name, company, email, stage, value_cents) on public.leads to authenticated;
grant update (title, done, due_date) on public.tasks to authenticated;
grant delete on public.tasks to authenticated;
grant select on public.commissions to authenticated;

-- The trigger writes the immutable commission snapshot in the same transaction as the sale.
create function public.record_commission() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.commissions(deal_id, owner_id, amount_cents)
  values (new.id, new.owner_id, ((new.amount_cents::bigint * new.rate_bps + 5000) / 10000)::integer);
  update public.leads set stage = 'ganho' where id = new.lead_id and owner_id = new.owner_id;
  return new;
end;
$$;
revoke all on function public.record_commission() from public, anon, authenticated;
create trigger deal_commission after insert on public.deals
  for each row execute function public.record_commission();

-- No shared credentials: demo records are created only inside the current user's account.
create function public.seed_demo() returns void
language plpgsql security invoker set search_path = '' as $$
declare
  lead_one uuid;
  lead_two uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(auth.uid()::text));
  if exists (select 1 from public.leads where owner_id = auth.uid()) then
    raise exception 'A demonstração requer um pipeline vazio.';
  end if;
  insert into public.leads(name, company, email, stage, value_cents) values
    ('Marina Exemplo', 'Estúdio Aurora (fictício)', 'marina@example.com', 'novo', 350000) returning id into lead_one;
  insert into public.leads(name, company, email, stage, value_cents) values
    ('Caio Modelo', 'Oficina Horizonte (fictícia)', 'caio@example.com', 'qualificado', 720000),
    ('Lia Demonstração', 'Papelaria Sol (fictícia)', 'lia@example.com', 'proposta', 480000),
    ('Rui Exemplo', 'Jardim Norte (fictício)', 'rui@example.com', 'perdido', 210000);
  insert into public.leads(name, company, email, stage, value_cents) values
    ('Bia Modelo', 'Casa Brisa (fictícia)', 'bia@example.com', 'ganho', 600000) returning id into lead_two;
  insert into public.tasks(lead_id, title, due_date) values
    (lead_one, 'Agendar conversa inicial', current_date + 1),
    (lead_one, 'Preparar escopo de exemplo', current_date + 2);
  insert into public.deals(lead_id, amount_cents, rate_bps) values (lead_two, 600000, 500);
end;
$$;
revoke all on function public.seed_demo() from public, anon;
grant execute on function public.seed_demo() to authenticated;
