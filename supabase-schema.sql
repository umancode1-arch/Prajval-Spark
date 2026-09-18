-- Run this in Supabase SQL editor to set up your tables

create table bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_paise int not null, -- store in paise: 199 rupees = 19900
  created_at timestamp default now()
);

create table tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_free boolean default false,
  bundle_id uuid references bundles(id),
  duration_minutes int default 60,
  created_at timestamp default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references tests(id) on delete cascade,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('a','b','c','d')),
  marks int default 1,
  order_index int default 0
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  bundle_id uuid references bundles(id),
  razorpay_order_id text,
  razorpay_payment_id text,
  status text default 'pending', -- pending | success | failed
  created_at timestamp default now()
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  test_id uuid references tests(id),
  answers jsonb,
  score int,
  total_marks int,
  submitted_at timestamp default now()
);

-- Row Level Security (turn on and add policies before going live)
alter table purchases enable row level security;
alter table attempts enable row level security;

create policy "Users see own purchases" on purchases
  for select using (auth.uid() = user_id);

create policy "Users see own attempts" on attempts
  for select using (auth.uid() = user_id);

create policy "Users insert own attempts" on attempts
  for insert with check (auth.uid() = user_id);
