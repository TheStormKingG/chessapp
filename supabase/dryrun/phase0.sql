-- Rolled-back rehearsal of 20260916_phase0_profiles_events.sql with behavioural
-- assertions (superpowers-plan-extras Rule 1). Every check raises, so an ERROR --
-- not a misread notice -- is what a wrong policy produces.
begin;
\i supabase/migrations/20260916_phase0_profiles_events.sql

-- two fake users
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@example.test','x',now(),now(),now()),
       ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@example.test','x',now(),now(),now());

do $$
declare n int; t text;
begin
  -- 1. the profile trigger fired for both users
  select count(*) into n from public.profiles
    where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
  if n <> 2 then raise exception 'profile trigger failed (expected 2 profiles, got %)', n; end if;
  raise notice 'ASSERT ok: profile trigger created both profiles';

  -- act as user 1
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  if current_user <> 'authenticated' then raise exception 'could not switch session role (current_user=%)', current_user; end if;

  insert into public.events (id, user_id, type, payload, device_day, created_at)
    values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','lesson_completed','{}','2026-09-16',now());

  -- 2. an idempotent re-send of the same id must not duplicate
  insert into public.events (id, user_id, type, payload, device_day, created_at)
    values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','lesson_completed','{}','2026-09-16',now())
    on conflict (id) do nothing;
  select count(*) into n from public.events;
  if n <> 1 then raise exception 'duplicate event id was inserted (count=%)', n; end if;
  raise notice 'ASSERT ok: duplicate event id not inserted twice';

  -- 3. user 1 cannot insert a row owned by user 2
  begin
    insert into public.events (id, user_id, type, payload, device_day, created_at)
      values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','x','{}','2026-09-16',now());
    raise exception 'RLS allowed cross-user insert';
  exception when insufficient_privilege or check_violation then
    raise notice 'ASSERT ok: cross-user insert refused';
  end;

  -- 4. user 1 cannot update an event (no update policy, no update grant)
  begin
    update public.events set type = 'tampered' where id = '10000000-0000-0000-0000-000000000001';
  exception when insufficient_privilege then null;
  end;
  select type into t from public.events where id = '10000000-0000-0000-0000-000000000001';
  if t is distinct from 'lesson_completed' then raise exception 'RLS allowed update (type=%)', t; end if;
  raise notice 'ASSERT ok: update refused, row unchanged';

  -- 5. user 1 cannot delete an event
  begin
    delete from public.events where id = '10000000-0000-0000-0000-000000000001';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.events where id = '10000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'RLS allowed delete (remaining=%)', n; end if;
  raise notice 'ASSERT ok: delete refused, row still present';

  -- 6. user 2 sees none of user 1's rows, and only its own profile
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  select count(*) into n from public.events;
  if n <> 0 then raise exception 'RLS leaked event rows across users (visible=%)', n; end if;
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'RLS leaked profile rows across users (visible=%)', n; end if;
  raise notice 'ASSERT ok: no cross-user reads of events or profiles';

  raise notice 'DRY RUN OK';
end $$;
rollback;
