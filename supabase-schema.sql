-- Run this script in the Supabase SQL editor to set up or upgrade the app.

create table if not exists bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_paise int not null,
  created_at timestamptz default now()
);

create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_free boolean not null default false,
  bundle_id uuid references bundles(id),
  duration_minutes int not null default 60,
  level text not null default 'Graduate',
  created_at timestamptz default now()
);

alter table tests add column if not exists level text not null default 'Graduate';

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references tests(id) on delete cascade,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('a','b','c','d')),
  marks int not null default 1,
  order_index int not null default 0,
  section text not null default 'General Awareness',
  explanation text not null default ''
);

alter table questions add column if not exists section text not null default 'General Awareness';
alter table questions add column if not exists explanation text not null default '';

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  bundle_id uuid references bundles(id),
  razorpay_order_id text,
  razorpay_payment_id text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  test_id uuid references tests(id),
  answers jsonb,
  score int,
  total_marks int,
  submitted_at timestamptz default now()
);

create table if not exists exam_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists student_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_user_id uuid references auth.users(id) on delete cascade,
  room text not null check (room in ('community', 'expert')),
  body text not null check (char_length(body) between 1 and 4000),
  is_expert boolean not null default false,
  created_at timestamptz not null default now()
);

alter table student_messages
  add column if not exists thread_user_id uuid references auth.users(id) on delete cascade;

update student_messages
set thread_user_id = user_id
where room = 'expert' and thread_user_id is null and is_expert = false;

create index if not exists student_messages_room_created_idx on student_messages(room, thread_user_id, created_at);
create index if not exists attempts_user_submitted_idx on attempts(user_id, submitted_at desc);

create or replace function public.is_exam_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.exam_admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_exam_admin() from public;
grant execute on function public.is_exam_admin() to authenticated;

alter table purchases enable row level security;
alter table attempts enable row level security;
alter table tests enable row level security;
alter table questions enable row level security;
alter table exam_admins enable row level security;
alter table student_messages enable row level security;

drop policy if exists "Users see own purchases" on purchases;
create policy "Users see own purchases" on purchases
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users see own attempts" on attempts;
create policy "Users see own attempts" on attempts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users insert own attempts" on attempts;
create policy "Users insert own attempts" on attempts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Admins manage tests" on tests;
create policy "Admins manage tests" on tests
  for all to authenticated using (public.is_exam_admin())
  with check (public.is_exam_admin());

drop policy if exists "Users read free or purchased tests" on tests;
drop policy if exists "Public read test catalog" on tests;
create policy "Public read test catalog" on tests
  for select to anon, authenticated using (true);

drop policy if exists "Admins manage questions" on questions;
create policy "Admins manage questions" on questions
  for all to authenticated using (public.is_exam_admin())
  with check (public.is_exam_admin());

drop policy if exists "Users read questions for available tests" on questions;
create policy "Users read questions for available tests" on questions
  for select to authenticated using (
    exists (
      select 1 from tests
      where tests.id = questions.test_id
        and (
          tests.is_free
          or exists (
            select 1 from purchases
            where purchases.user_id = auth.uid()
              and purchases.bundle_id = tests.bundle_id
              and purchases.status = 'success'
          )
        )
    )
  );

drop policy if exists "Admins read admin roster" on exam_admins;
create policy "Admins read admin roster" on exam_admins
  for select to authenticated using (auth.uid() = user_id or public.is_exam_admin());

drop policy if exists "Signed-in users read chat" on student_messages;
create policy "Signed-in users read chat" on student_messages
  for select to authenticated using (
    room = 'community'
    or (room = 'expert' and (thread_user_id = auth.uid() or public.is_exam_admin()))
  );

drop policy if exists "Users post their own messages" on student_messages;
create policy "Users post their own messages" on student_messages
  for insert to authenticated with check (
    auth.uid() = user_id
    and is_expert = false
    and (
      (room = 'community' and thread_user_id is null)
      or (room = 'expert' and thread_user_id = auth.uid())
    )
  );

drop policy if exists "Admins answer as experts" on student_messages;
create policy "Admins answer as experts" on student_messages
  for insert to authenticated with check (
    auth.uid() = user_id
    and public.is_exam_admin()
    and is_expert = true
    and room = 'expert'
    and thread_user_id is not null
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'student_messages'
     ) then
    alter publication supabase_realtime add table public.student_messages;
  end if;
end
$$;

-- Provision an administrator manually from the SQL editor after that user signs in:
-- insert into public.exam_admins (user_id)
-- select id from auth.users where email = 'admin@example.com';
