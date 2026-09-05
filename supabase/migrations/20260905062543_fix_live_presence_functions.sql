alter function public.set_live_presence(uuid,boolean) security definer;
alter function public.set_raised_hand(uuid,boolean) security definer;

-- These narrowly scoped functions retain explicit auth.uid() and eligibility checks;
-- SECURITY DEFINER is required so callers cannot mutate presenter/media flags directly.
revoke all on function public.set_live_presence(uuid,boolean) from public,anon;
revoke all on function public.set_raised_hand(uuid,boolean) from public,anon;
grant execute on function public.set_live_presence(uuid,boolean) to authenticated;
grant execute on function public.set_raised_hand(uuid,boolean) to authenticated;
