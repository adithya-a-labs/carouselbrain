create extension if not exists "uuid-ossp";

-- Profiles (mirrors auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  created_at timestamptz default now() not null,
  extraction_count integer default 0 not null
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Extractions (core table)
create table public.extractions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  source_type text not null default 'upload',
  image_urls text[] not null default '{}',
  raw_ocr_text text,
  output jsonb not null default '{}',
  content_hash text unique,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index extractions_user_id_idx on public.extractions (user_id);
create index extractions_content_hash_idx on public.extractions (content_hash);
create index extractions_created_at_idx on public.extractions (created_at desc);
alter table public.extractions enable row level security;
create policy "Users can view own extractions" on public.extractions for select using (auth.uid() = user_id);
create policy "Users can insert own extractions" on public.extractions for insert with check (auth.uid() = user_id);
create policy "Users can update own extractions" on public.extractions for update using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.extractions
  for each row execute procedure public.handle_updated_at();
