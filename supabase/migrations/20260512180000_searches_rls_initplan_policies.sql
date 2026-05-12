-- Performance: avoid per-row re-init of auth.uid() in RLS (auth_rls_initplan).
-- Scoped to public.searches only.

drop policy if exists "Users can view own searches" on public.searches;
drop policy if exists "Users can insert own searches" on public.searches;

create policy "Users can view own searches"
  on public.searches for select
  using ((select auth.uid()) = owner_id);

create policy "Users can insert own searches"
  on public.searches for insert
  with check ((select auth.uid()) = owner_id);
