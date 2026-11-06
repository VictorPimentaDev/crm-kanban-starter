-- Run as the local database administrator with psql -v ON_ERROR_STOP=1 -f this-file.
-- All fixtures are rolled back; no shared password or session token is needed.
begin;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'rls-one@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'rls-two@example.com');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.leads (id, name, value_cents) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Lead de teste', 10005),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Lead sem venda', 0);
insert into public.tasks (lead_id, title) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Tarefa de teste');
insert into public.deals (id, lead_id, amount_cents, rate_bps) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 10005, 1000);

do $$ begin
  assert (select amount_cents = 1001 from public.commissions where deal_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
    'Commission must round half up in cents';
  assert (select stage = 'ganho' from public.leads where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    'Recording a sale must mark the lead won';
  begin
    update public.deals set amount_cents = 1;
    assert false, 'Sales must be immutable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.commissions set amount_cents = 0;
    assert false, 'Commissions must be immutable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.deals (lead_id, amount_cents, rate_bps)
      values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100, 500);
    assert false, 'Duplicate sale must be rejected';
  exception when unique_violation then null;
  end;
  begin
    insert into public.deals (lead_id, amount_cents, rate_bps)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 100, 10001);
    assert false, 'Commission above 100% must be rejected';
  exception when check_violation then null;
  end;
  assert (select stage = 'novo' from public.leads where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    'Failed sale must not change lead state';
end $$;

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$ declare affected integer;
begin
  assert (select count(*) = 0 from public.leads), 'Foreign leads are visible';
  assert (select count(*) = 0 from public.tasks), 'Foreign tasks are visible';
  assert (select count(*) = 0 from public.deals), 'Foreign sales are visible';
  assert (select count(*) = 0 from public.commissions), 'Foreign commissions are visible';
  update public.leads set stage = 'perdido' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics affected = row_count;
  assert affected = 0, 'Foreign lead can be changed';
  begin
    insert into public.leads (name, owner_id)
      values ('Outro dono', '11111111-1111-4111-8111-111111111111');
    assert false, 'Forged owner must be rejected';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.tasks (lead_id, title)
      values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Vínculo indevido');
    assert false, 'Cross-owner task must be rejected';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.deals (lead_id, amount_cents, rate_bps)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 100, 500);
    assert false, 'Cross-owner sale must be rejected';
  exception when foreign_key_violation then null;
  end;
  perform public.seed_demo();
  assert (select count(*) = 5 from public.leads), 'Demo must seed only the current user';
  assert (select count(*) = 2 from public.tasks), 'Demo tasks missing';
  assert (select count(*) = 1 from public.deals), 'Demo sale missing';
  assert (select amount_cents = 30000 from public.commissions), 'Demo commission incorrect';
  begin
    perform public.seed_demo();
    assert false, 'Repeated demo must fail without duplicate data';
  exception when raise_exception then null;
  end;
  assert (select count(*) = 5 from public.leads), 'Failed seed changed existing data';
end $$;

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$ begin
  assert (select count(*) = 2 from public.leads), 'Other user demo leaked';
  assert (select stage = 'ganho' from public.leads where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    'Cross-user update altered lead';
end $$;

set local role anon;
do $$ begin
  begin
    perform * from public.leads;
    assert false, 'Anonymous reads must be rejected';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.seed_demo();
    assert false, 'Anonymous demo must be rejected';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
select 'ownership, commission rounding, immutability and demo isolation: OK' as result;
