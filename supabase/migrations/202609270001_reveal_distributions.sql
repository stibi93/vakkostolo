begin;
-- Aggregate guess counts for already revealed wines. No nicknames or participant ids.
alter function public.get_game_results(uuid) set schema private;
alter function private.get_game_results(uuid) rename to pre_distribution_results;
revoke all on function private.pre_distribution_results(uuid) from public,anon,authenticated;

create function public.get_game_results(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; wines jsonb;
begin
  result := private.pre_distribution_results(p_game_id);
  select coalesce(jsonb_agg(item order by (item->>'position')::int), '[]'::jsonb) into wines
  from (
    select w || jsonb_build_object(
      'guesses', jsonb_build_object(
        'price', (
          select coalesce(jsonb_agg(coalesce(c.cnt, 0) order by b.bucket), '[]'::jsonb)
          from generate_series(1, 8) as b(bucket)
          left join (
            select r.price_bucket, count(*)::int as cnt from public.ratings r
            where r.round_id = (w->>'id')::uuid and r.price_bucket between 1 and 8
            group by r.price_bucket
          ) c on c.price_bucket = b.bucket
        ),
        'alcohol', (
          select coalesce(jsonb_agg(jsonb_build_object('tenths', a.alcohol_tenths, 'count', a.cnt) order by a.alcohol_tenths), '[]'::jsonb)
          from (
            select r.alcohol_tenths, count(*)::int as cnt from public.ratings r
            where r.round_id = (w->>'id')::uuid group by r.alcohol_tenths
          ) a
        ),
        'liking', (
          select coalesce(jsonb_agg(coalesce(c.cnt, 0) order by b.value), '[]'::jsonb)
          from generate_series(1, 10) as b(value)
          left join (
            select r.liking, count(*)::int as cnt from public.ratings r
            where r.round_id = (w->>'id')::uuid and r.liking between 1 and 10
            group by r.liking
          ) c on c.liking = b.value
        )
      ),
      'questions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', q->>'id', 'prompt', q->>'prompt', 'correctOptionId', q->>'correctOptionId', 'ownOptionId', q->'ownOptionId',
          'options', (
            select coalesce(jsonb_agg(jsonb_build_object('id', opt.value->>'id', 'label', opt.value->>'label', 'count', (
              select count(*)::int from public.ratings r
              join private.question_answers qa on qa.rating_id = r.id
              where r.round_id = (w->>'id')::uuid and qa.answers->>(q->>'id') = opt.value->>'id'
            )) order by opt.ordinality), '[]'::jsonb)
            from jsonb_array_elements(q->'options') with ordinality as opt(value, ordinality)
          )
        ))
        from jsonb_array_elements(coalesce(w->'questions', '[]'::jsonb)) q
      ), '[]'::jsonb)
    ) as item
    from jsonb_array_elements(result->'wines') w
  ) enriched;
  return jsonb_set(result, '{wines}', wines);
end;
$$;
revoke all on function public.get_game_results(uuid) from public,anon,authenticated;
grant execute on function public.get_game_results(uuid) to authenticated;
commit;
