-- Ensure chat realtime remains enabled even when an existing project was
-- created before the original realtime migration was applied.
do $$
begin
  if not exists (
    select 1
      from pg_publication_rel pr
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
     where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
       and n.nspname = 'public'
       and c.relname = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end
$$;

-- Include complete rows in future message change payloads. INSERT events work
-- without this, while it also keeps the channel ready for edits and deletes.
alter table public.messages replica identity full;
