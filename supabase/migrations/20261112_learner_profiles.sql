-- Additive migration: onboarding answers used for Next Best Action and roadmap.
-- Reversible: drop table public.learner_profiles;
create table if not exists public.learner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text not null check (goal in ('job','upskill','agency','sell','explore')),
  experience text not null check (experience in ('new','some','experienced')),
  focus text not null check (focus in ('seo_aeo','amazon','python_ml','sales','all')),
  weekly_minutes integer not null check (weekly_minutes between 15 and 2400),
  onboarded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.learner_profiles enable row level security;
revoke all on public.learner_profiles from anon, authenticated;
grant select, insert, update, delete on public.learner_profiles to authenticated;
create policy learner_profiles_select_own on public.learner_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy learner_profiles_insert_own on public.learner_profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy learner_profiles_update_own on public.learner_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy learner_profiles_delete_own on public.learner_profiles for delete to authenticated using (user_id = (select auth.uid()));
