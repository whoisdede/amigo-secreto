-- =====================================================================
--  Amigo Secreto — schema do banco (Supabase / Postgres)
--  Como usar: Supabase > SQL Editor > New query > cole tudo > Run.
--  Pode ser executado novamente (é idempotente para funções/policies).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

-- Sessão / grupo de amigo secreto
create table if not exists public.groups (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 120),
  description      text check (char_length(description) <= 2000),
  event_at         timestamptz,
  location         text check (char_length(location) <= 300),
  location_url     text check (location_url is null or location_url ~* '^https?://'),
  min_value        numeric(10, 2) check (min_value is null or min_value >= 0),
  max_value        numeric(10, 2) check (max_value is null or max_value >= 0),
  gift_ideas       text check (char_length(gift_ideas) <= 2000),
  theme            text check (char_length(theme) <= 200),
  dress_code       text check (char_length(dress_code) <= 200),
  notes            text check (char_length(notes) <= 4000),
  rsvp_deadline    timestamptz,
  max_participants int check (max_participants is null or max_participants >= 3),
  invite_code      text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  status           text not null default 'open' check (status in ('open', 'drawn')),
  drawn_at         timestamptz,
  created_at       timestamptz not null default now(),
  constraint groups_value_range check (min_value is null or max_value is null or max_value >= min_value)
);

-- Participantes que entraram pelo link (entrar = confirmar presença)
create table if not exists public.participants (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url   text,
  joined_at    timestamptz not null default now(),
  unique (group_id, user_id)
);
create index if not exists participants_user_idx on public.participants (user_id);

-- Lista de desejos de cada participante
create table if not exists public.wishlist_items (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  group_id       uuid not null references public.groups (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 200),
  url            text check (url is null or url ~* '^https?://'),
  notes          text check (char_length(notes) <= 500),
  created_at     timestamptz not null default now()
);
create index if not exists wishlist_group_idx on public.wishlist_items (group_id);

-- Resultado do sorteio (NUNCA lido diretamente pelo app; só via funções abaixo)
create table if not exists public.assignments (
  group_id    uuid not null references public.groups (id) on delete cascade,
  giver_id    uuid not null references public.participants (id) on delete cascade,
  receiver_id uuid not null references public.participants (id) on delete cascade,
  primary key (group_id, giver_id),
  unique (group_id, receiver_id),
  check (giver_id <> receiver_id)
);

-- Mensagens anônimas. Cada conversa é identificada pelo "giver" (quem tirou).
-- from_giver = true  -> enviada por quem tirou (anônimo) para quem foi tirado
-- from_giver = false -> enviada por quem foi tirado para o seu amigo secreto
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  group_id   uuid not null references public.groups (id) on delete cascade,
  giver_id   uuid not null references public.participants (id) on delete cascade,
  from_giver boolean not null,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages (group_id, giver_id, created_at);

-- ---------------------------------------------------------------------
-- Permissões por coluna (impede, por ex., marcar o grupo como sorteado à mão)
-- ---------------------------------------------------------------------
revoke all on public.groups, public.participants, public.wishlist_items,
              public.assignments, public.messages from anon, authenticated;

grant select, delete on public.groups to authenticated;
grant insert (name, description, event_at, location, location_url, min_value, max_value,
              gift_ideas, theme, dress_code, notes, rsvp_deadline, max_participants)
  on public.groups to authenticated;
grant update (name, description, event_at, location, location_url, min_value, max_value,
              gift_ideas, theme, dress_code, notes, rsvp_deadline, max_participants)
  on public.groups to authenticated;

grant select, delete on public.participants to authenticated;
grant update (display_name) on public.participants to authenticated;

grant select, delete on public.wishlist_items to authenticated;
grant insert (participant_id, group_id, title, url, notes) on public.wishlist_items to authenticated;
grant update (title, url, notes) on public.wishlist_items to authenticated;

-- assignments e messages: nenhum acesso direto.

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from participants where group_id = gid and user_id = auth.uid())
      or exists (select 1 from groups where id = gid and owner_id = auth.uid());
$$;

create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from groups where id = gid and owner_id = auth.uid());
$$;

create or replace function public.my_participant_id(gid uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from participants where group_id = gid and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.groups         enable row level security;
alter table public.participants   enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.assignments    enable row level security;
alter table public.messages       enable row level security;

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  -- owner_id direto: necessário para "insert ... returning" (a função não enxerga a linha recém-criada)
  for select to authenticated using (owner_id = auth.uid() or public.is_group_member(id));

drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists participants_select on public.participants;
create policy participants_select on public.participants
  for select to authenticated using (public.is_group_member(group_id));

drop policy if exists participants_update on public.participants;
create policy participants_update on public.participants
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sair do grupo (ou o organizador remover alguém) só antes do sorteio
drop policy if exists participants_delete on public.participants;
create policy participants_delete on public.participants
  for delete to authenticated using (
    (user_id = auth.uid() or public.is_group_owner(group_id))
    and exists (select 1 from public.groups g where g.id = group_id and g.status = 'open')
  );

drop policy if exists wishlist_select on public.wishlist_items;
create policy wishlist_select on public.wishlist_items
  for select to authenticated using (public.is_group_member(group_id));

drop policy if exists wishlist_insert on public.wishlist_items;
create policy wishlist_insert on public.wishlist_items
  for insert to authenticated with check (
    exists (select 1 from public.participants p
            where p.id = participant_id and p.user_id = auth.uid() and p.group_id = wishlist_items.group_id)
  );

drop policy if exists wishlist_update on public.wishlist_items;
create policy wishlist_update on public.wishlist_items
  for update to authenticated using (
    exists (select 1 from public.participants p where p.id = participant_id and p.user_id = auth.uid())
  );

drop policy if exists wishlist_delete on public.wishlist_items;
create policy wishlist_delete on public.wishlist_items
  for delete to authenticated using (
    exists (select 1 from public.participants p where p.id = participant_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- RPCs (chamadas pelo app via supabase.rpc)
-- ---------------------------------------------------------------------

-- Pré-visualização do convite (funciona mesmo sem login)
create or replace function public.get_invite(code text)
returns table (
  id uuid, name text, description text, event_at timestamptz, location text,
  min_value numeric, max_value numeric, rsvp_deadline timestamptz, max_participants int,
  status text, owner_name text, participant_count bigint, is_member boolean
)
language sql stable security definer set search_path = public
as $$
  select g.id, g.name, g.description, g.event_at, g.location,
         g.min_value, g.max_value, g.rsvp_deadline, g.max_participants, g.status,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', 'Organizador'),
         (select count(*) from participants p where p.group_id = g.id),
         (auth.uid() is not null and (
            g.owner_id = auth.uid()
            or exists (select 1 from participants p where p.group_id = g.id and p.user_id = auth.uid())))
  from groups g
  left join auth.users u on u.id = g.owner_id
  where g.invite_code = code;
$$;

-- Entrar no grupo pelo código do convite (= confirmar participação)
create or replace function public.join_group(code text, p_display_name text, p_avatar_url text default null)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  g groups%rowtype;
  total int;
begin
  if auth.uid() is null then
    raise exception 'Faça login para participar.';
  end if;

  select * into g from groups where invite_code = code for update;
  if not found then
    raise exception 'Convite inválido ou expirado.';
  end if;

  if exists (select 1 from participants where group_id = g.id and user_id = auth.uid()) then
    update participants set display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
     where group_id = g.id and user_id = auth.uid();
    return g.id;
  end if;

  if g.status <> 'open' then
    raise exception 'O sorteio deste grupo já foi realizado.';
  end if;

  if g.owner_id <> auth.uid() and g.rsvp_deadline is not null and now() > g.rsvp_deadline then
    raise exception 'O prazo para confirmar participação já terminou.';
  end if;

  select count(*) into total from participants where group_id = g.id;
  if g.max_participants is not null and total >= g.max_participants then
    raise exception 'Este grupo já atingiu o número máximo de participantes.';
  end if;

  if nullif(trim(p_display_name), '') is null then
    raise exception 'Informe seu nome.';
  end if;

  insert into participants (group_id, user_id, display_name, avatar_url)
  values (g.id, auth.uid(), left(trim(p_display_name), 60), p_avatar_url);

  return g.id;
end;
$$;

-- Sorteio: feito no servidor, para que nem o organizador veja os pares.
-- Embaralha os participantes e forma um único ciclo (ninguém tira a si mesmo).
create or replace function public.draw_group(gid uuid)
returns int
language plpgsql volatile security definer set search_path = public
as $$
declare
  g groups%rowtype;
  total int;
begin
  select * into g from groups where id = gid for update;
  if not found or g.owner_id <> auth.uid() then
    raise exception 'Apenas o organizador pode realizar o sorteio.';
  end if;
  if g.status <> 'open' then
    raise exception 'O sorteio já foi realizado.';
  end if;

  select count(*) into total from participants where group_id = gid;
  if total < 3 then
    raise exception 'São necessários pelo menos 3 participantes para o sorteio.';
  end if;

  delete from assignments where group_id = gid;

  with shuffled as materialized (
    select id, row_number() over (order by random()) as rn, count(*) over () as n
    from participants
    where group_id = gid
  )
  insert into assignments (group_id, giver_id, receiver_id)
  select gid, a.id, b.id
  from shuffled a
  join shuffled b on b.rn = (a.rn % a.n) + 1;

  update groups set status = 'drawn', drawn_at = now() where id = gid;
  return total;
end;
$$;

-- Desfaz o sorteio (apaga pares e mensagens) para permitir novas entradas
create or replace function public.reset_draw(gid uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.is_group_owner(gid) then
    raise exception 'Apenas o organizador pode refazer o sorteio.';
  end if;
  delete from messages where group_id = gid;
  delete from assignments where group_id = gid;
  update groups set status = 'open', drawn_at = null where id = gid;
end;
$$;

-- Gera um novo link de convite (o antigo deixa de funcionar)
create or replace function public.regenerate_invite(gid uuid)
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  new_code text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
begin
  if not public.is_group_owner(gid) then
    raise exception 'Apenas o organizador pode gerar um novo link.';
  end if;
  update groups set invite_code = new_code where id = gid;
  return new_code;
end;
$$;

-- Quem EU tirei (somente o próprio participante enxerga)
create or replace function public.get_my_assignment(gid uuid)
returns table (receiver_id uuid, display_name text, avatar_url text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url
  from assignments a
  join participants p on p.id = a.receiver_id
  where a.group_id = gid
    and a.giver_id = public.my_participant_id(gid);
$$;

-- Mensagens das minhas duas conversas:
--   thread 'giftee' -> com a pessoa que eu tirei (eu sou anônimo)
--   thread 'santa'  -> com quem me tirou (ele é anônimo)
create or replace function public.get_chat(gid uuid)
returns table (id bigint, thread text, from_me boolean, body text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  with me as (select public.my_participant_id(gid) as pid),
  my_santa as (
    select a.giver_id from assignments a, me
    where a.group_id = gid and a.receiver_id = me.pid
  )
  select m.id, 'giftee', m.from_giver, m.body, m.created_at
    from messages m, me
   where m.group_id = gid and m.giver_id = me.pid
  union all
  select m.id, 'santa', not m.from_giver, m.body, m.created_at
    from messages m, my_santa s
   where m.group_id = gid and m.giver_id = s.giver_id
  order by created_at;
$$;

create or replace function public.send_message(gid uuid, thread text, body text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  me uuid := public.my_participant_id(gid);
  thread_giver uuid;
begin
  if me is null then
    raise exception 'Você não participa deste grupo.';
  end if;
  if nullif(trim(body), '') is null then
    raise exception 'Mensagem vazia.';
  end if;

  if thread = 'giftee' then
    select giver_id into thread_giver from assignments where group_id = gid and giver_id = me;
  elsif thread = 'santa' then
    select giver_id into thread_giver from assignments where group_id = gid and receiver_id = me;
  else
    raise exception 'Conversa inválida.';
  end if;

  if thread_giver is null then
    raise exception 'O sorteio ainda não foi realizado.';
  end if;

  insert into messages (group_id, giver_id, from_giver, body)
  values (gid, thread_giver, thread = 'giftee', left(trim(body), 1000));
end;
$$;

-- Quem pode executar cada função
revoke execute on function public.is_group_member(uuid), public.is_group_owner(uuid),
  public.my_participant_id(uuid), public.get_invite(text), public.join_group(text, text, text),
  public.draw_group(uuid), public.reset_draw(uuid), public.regenerate_invite(uuid),
  public.get_my_assignment(uuid), public.get_chat(uuid), public.send_message(uuid, text, text)
  from public, anon;

grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.is_group_member(uuid), public.is_group_owner(uuid),
  public.my_participant_id(uuid), public.join_group(text, text, text),
  public.draw_group(uuid), public.reset_draw(uuid), public.regenerate_invite(uuid),
  public.get_my_assignment(uuid), public.get_chat(uuid), public.send_message(uuid, text, text)
  to authenticated;
