begin;

create extension if not exists pgtap with schema extensions;

select plan(37);

create schema if not exists test;

create or replace function test.authenticate_as(_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', _user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end;
$$;

create or replace function test.clear_auth()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end;
$$;

create or replace function test.throws(_sql text)
returns boolean
language plpgsql
as $$
begin
  execute _sql;
  return false;
exception when others then
  return true;
end;
$$;

create or replace function test.affected_rows(_sql text)
returns integer
language plpgsql
as $$
declare
  _count integer;
begin
  execute _sql;
  get diagnostics _count = row_count;
  return _count;
end;
$$;

grant usage on schema test to authenticated;
grant execute on all functions in schema test to authenticated;

select public.write_security_audit(
  'test_can_write_audit',
  'security_audit_log',
  null,
  null,
  '{}'::jsonb
);

insert into public.teacher_invites (code_hash, invited_email, expires_at)
values (
  public.teacher_invite_hash('valid-teacher-invite'),
  'teacher@example.test',
  now() + interval '7 days'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'teacher@example.test',
    'test-password',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Teacher One","role":"teacher","teacher_invite_code":"valid-teacher-invite"}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'student-one@example.test',
    'test-password',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Student One","role":"student"}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'student-two@example.test',
    'test-password',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Student Two","role":"student"}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'fake-teacher@example.test',
    'test-password',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Fake Teacher","role":"teacher"}'::jsonb,
    now(),
    now()
  );

insert into public.classes (id, teacher_id, name, subject, join_code)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Security Math',
  'Math',
  'SECTST'
);

insert into public.class_members (class_id, student_id)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002'
);

insert into public.assignments (id, class_id, teacher_id, title, description, unit_tag, due_date)
values (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'RLS Assignment',
  'Answer the prompt',
  'rls',
  now() + interval '1 day'
);

insert into public.assignment_questions (
  id,
  assignment_id,
  position,
  question_type,
  prompt,
  max_score
)
values (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  0,
  'short_answer',
  'Explain RLS',
  10
);

update public.student_coins
set star_coins = 100,
    crown_coins = 100,
    streak_freezes = 0
where student_id = '10000000-0000-0000-0000-000000000002';

select is(
  (select role::text from public.user_roles where user_id = '10000000-0000-0000-0000-000000000001'),
  'teacher',
  'valid invite creates a teacher role'
);

select is(
  (select role::text from public.user_roles where user_id = '10000000-0000-0000-0000-000000000004'),
  'student',
  'teacher signup without invite is downgraded to student'
);

select ok(
  exists (
    select 1
    from public.teacher_invites
    where used_by = '10000000-0000-0000-0000-000000000001'
      and used_at is not null
  ),
  'teacher invite is marked used'
);

select test.authenticate_as('10000000-0000-0000-0000-000000000002');

select ok(
  not exists (
    select 1
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000003'
  ),
  'student cannot read unrelated student profile'
);

select ok(
  exists (
    select 1
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000001'
  ),
  'student can read teacher profile for joined class'
);

select ok(
  test.throws(
    $$select public.save_assignment_progress(
      '30000000-0000-0000-0000-000000000001'::uuid,
      jsonb_build_array(jsonb_build_object('question_id', '00000000-0000-0000-0000-000000000000', 'text_response', 'bad'))
    )$$
  ),
  'student cannot save answer for a mismatched question'
);

select lives_ok(
  $$select public.save_assignment_progress(
    '30000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_array(jsonb_build_object('question_id', '40000000-0000-0000-0000-000000000001', 'text_response', 'RLS limits rows by user'))
  )$$,
  'student saves assignment progress through RPC'
);

select is(
  (
    select status::text
    from public.assignment_status_records
    where assignment_id = '30000000-0000-0000-0000-000000000001'
      and student_id = '10000000-0000-0000-0000-000000000002'
  ),
  'in_progress',
  'saving progress marks assignment in progress'
);

select is(
  test.affected_rows(
    $$update public.assignment_answers
      set text_response = 'direct update'
      where assignment_id = '30000000-0000-0000-0000-000000000001'
        and student_id = '10000000-0000-0000-0000-000000000002'$$
  ),
  0,
  'direct student assignment answer update is blocked'
);

select is(
  test.affected_rows(
    $$update public.assignment_status_records
      set status = 'not_started'
      where assignment_id = '30000000-0000-0000-0000-000000000001'
        and student_id = '10000000-0000-0000-0000-000000000002'$$
  ),
  0,
  'direct student assignment status update is blocked'
);

select lives_ok(
  $$select public.set_assignment_status(
    '30000000-0000-0000-0000-000000000001'::uuid,
    'not_started'::public.assignment_status
  )$$,
  'student updates assignment status through RPC'
);

select is(
  (
    select status::text
    from public.assignment_status_records
    where assignment_id = '30000000-0000-0000-0000-000000000001'
      and student_id = '10000000-0000-0000-0000-000000000002'
  ),
  'not_started',
  'status RPC persists allowed student status'
);

select ok(
  test.throws(
    $$insert into public.submissions (assignment_id, student_id, link_url)
      values (
        '30000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000002',
        'https://example.test/direct'
      )$$
  ),
  'direct student submission insert is blocked'
);

select lives_ok(
  $$select public.submit_assignment(
    '30000000-0000-0000-0000-000000000001'::uuid,
    '[]'::jsonb,
    null,
    null
  )$$,
  'student submits existing answer content through RPC'
);

select is(
  (
    select status::text
    from public.assignment_status_records
    where assignment_id = '30000000-0000-0000-0000-000000000001'
      and student_id = '10000000-0000-0000-0000-000000000002'
  ),
  'submitted',
  'submit RPC marks assignment submitted'
);

select ok(
  exists (
    select 1
    from public.security_audit_log
    where action = 'assignment_submitted'
      and subject_user_id = '10000000-0000-0000-0000-000000000002'
  ),
  'submit RPC writes audit log'
);

select ok(
  test.throws(
    $$select public.save_assignment_progress(
      '30000000-0000-0000-0000-000000000001'::uuid,
      jsonb_build_array(jsonb_build_object('question_id', '40000000-0000-0000-0000-000000000001', 'text_response', 'changed'))
    )$$
  ),
  'student cannot change answers after submission'
);

select ok(
  test.throws(
    $$select public.grade_assignment_submission(
      '30000000-0000-0000-0000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000002'::uuid,
      '[]'::jsonb,
      9,
      'student attempted grade'
    )$$
  ),
  'student cannot grade assignment through RPC'
);

select test.clear_auth();

update public.student_coins
set star_coins = 100,
    crown_coins = 100
where student_id = '10000000-0000-0000-0000-000000000002';

select test.authenticate_as('10000000-0000-0000-0000-000000000002');

select ok(
  test.throws(
    $$insert into public.shop_purchases (
        student_id,
        item_key,
        item_name,
        kind,
        currency,
        cost
      )
      values (
        '10000000-0000-0000-0000-000000000002',
        'hat_wizard',
        'Forged Hat',
        'cosmetic',
        'star',
        1
      )$$
  ),
  'direct shop purchase insert is blocked'
);

select lives_ok(
  $$select public.create_shop_purchase(null, 'hat_wizard')$$,
  'student creates cosmetic purchase through RPC'
);

select is(
  (
    select star_coins
    from public.student_coins
    where student_id = '10000000-0000-0000-0000-000000000002'
  ),
  90,
  'canonical cosmetic purchase deducts canonical star cost'
);

select lives_ok(
  $$select public.create_shop_purchase('20000000-0000-0000-0000-000000000001'::uuid, 'seat_swap')$$,
  'student creates privilege purchase through RPC'
);

select is(
  (
    select status::text
    from public.shop_purchases
    where student_id = '10000000-0000-0000-0000-000000000002'
      and item_key = 'seat_swap'
    order by created_at desc
    limit 1
  ),
  'pending',
  'privilege purchase is pending for teacher resolution'
);

select test.authenticate_as('10000000-0000-0000-0000-000000000003');

select ok(
  test.throws(
    $$select public.save_assignment_progress(
      '30000000-0000-0000-0000-000000000001'::uuid,
      '[]'::jsonb
    )$$
  ),
  'non-member cannot save assignment progress'
);

select ok(
  test.throws(
    $$select public.resolve_shop_purchase(
      (
        select id
        from public.shop_purchases
        where item_key = 'seat_swap'
        order by created_at desc
        limit 1
      ),
      'approved'::public.purchase_status
    )$$
  ),
  'non-teacher cannot resolve privilege purchase'
);

select test.authenticate_as('10000000-0000-0000-0000-000000000001');

select ok(
  exists (
    select 1
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000002'
  ),
  'teacher can read enrolled student profile'
);

select lives_ok(
  $$select public.grade_assignment_submission(
    '30000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    jsonb_build_array(jsonb_build_object(
      'answer_id',
      (
        select id
        from public.assignment_answers
        where question_id = '40000000-0000-0000-0000-000000000001'
          and student_id = '10000000-0000-0000-0000-000000000002'
      ),
      'score',
      8,
      'feedback',
      'Good'
    )),
    8,
    'Solid'
  )$$,
  'teacher grades through server-owned RPC'
);

select is(
  (
    select overall_score
    from public.assignment_grades
    where assignment_id = '30000000-0000-0000-0000-000000000001'
      and student_id = '10000000-0000-0000-0000-000000000002'
  ),
  8,
  'grade RPC persists overall score'
);

select lives_ok(
  $$select public.resolve_shop_purchase(
    (
      select id
      from public.shop_purchases
      where item_key = 'seat_swap'
      order by created_at desc
      limit 1
    ),
    'denied'::public.purchase_status
  )$$,
  'teacher resolves privilege purchase through RPC'
);

select ok(
  exists (
    select 1
    from public.security_audit_log
    where action = 'shop_purchase_denied'
      and subject_user_id = '10000000-0000-0000-0000-000000000002'
  ),
  'privilege resolution writes audit log'
);

select lives_ok(
  $$insert into public.message_groups (id, class_id, teacher_id, name)
    values (
      '60000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'RLS Group'
    )$$,
  'teacher creates group for own class'
);

select lives_ok(
  $$insert into public.message_group_members (group_id, user_id)
    values
      ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
      ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')$$,
  'teacher adds self and enrolled student to group'
);

select ok(
  test.throws(
    $$insert into public.message_group_members (group_id, user_id)
      values (
        '60000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000003'
      )$$
  ),
  'teacher cannot add non-class user to group'
);

select lives_ok(
  $$insert into public.messages (id, class_id, sender_id, recipient_id, body)
    values (
      '70000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      'Teacher message'
    )$$,
  'teacher sends direct message to enrolled student'
);

select test.authenticate_as('10000000-0000-0000-0000-000000000002');

select ok(
  test.throws(
    $$update public.messages
      set body = 'tampered', read_at = now()
      where id = '70000000-0000-0000-0000-000000000001'$$
  ),
  'recipient cannot change received message body'
);

select lives_ok(
  $$update public.messages
    set read_at = now()
    where id = '70000000-0000-0000-0000-000000000001'$$,
  'recipient can still mark message read'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.check_edge_rate_limit(text, integer, integer)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute edge rate-limit function directly'
);

select * from finish();

rollback;
