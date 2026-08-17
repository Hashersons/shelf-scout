-- ShelfHunt list organization + secure user profiles
alter table wanted_items add column if not exists media_type text not null default 'book';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table profiles enable row level security;
alter table wanted_items enable row level security;

create policy "profiles own row" on profiles for select using (auth.uid() = id);
create policy "profiles own update" on profiles for update using (auth.uid() = id);

create policy "wanted own select" on wanted_items for select using (auth.uid() = user_id);
create policy "wanted own insert" on wanted_items for insert with check (auth.uid() = user_id);
create policy "wanted own update" on wanted_items for update using (auth.uid() = user_id);
create policy "wanted own delete" on wanted_items for delete using (auth.uid() = user_id);
