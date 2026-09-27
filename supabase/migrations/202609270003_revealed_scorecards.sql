begin;
-- After a wine is revealed, every member sees each player's guess and category points for that wine only.
alter function public.get_game_results(uuid) set schema private;
alter function private.get_game_results(uuid) rename to pre_scorecard_results;
revoke all on function private.pre_scorecard_results(uuid) from public,anon,authenticated;

create function public.get_game_results(p_game_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  result jsonb; version integer; cards jsonb := '[]'::jsonb; card_wines jsonb; person jsonb; wine jsonb;
  v_rating uuid; v_bucket smallint; v_price integer; v_alcohol smallint; v_liking smallint;
  v_price_points numeric; v_alcohol_points numeric; v_answers jsonb; v_questions jsonb;
begin
  result := private.pre_scorecard_results(p_game_id);
  if coalesce((result->>'revealed_count')::int, 0) = 0 then
    return result || jsonb_build_object('scorecards', '[]'::jsonb);
  end if;
  version := (result->>'scoring_version')::int;
  for person in select value from jsonb_array_elements(result->'leaderboard') loop
    card_wines := '[]'::jsonb;
    for wine in select value from jsonb_array_elements(result->'wines') loop
      v_rating := null; v_bucket := null; v_price := null; v_alcohol := null; v_liking := null;
      v_price_points := null; v_alcohol_points := null; v_answers := null;
      select r.id, r.price_bucket, r.price_huf, r.alcohol_tenths, r.liking
        into v_rating, v_bucket, v_price, v_alcohol, v_liking
      from public.ratings r
      where r.game_id = p_game_id and r.round_id = (wine->>'id')::uuid and r.participant_id = (person->>'id')::uuid;
      if v_rating is not null then
        select p.price_points, p.alcohol_points into v_price_points, v_alcohol_points
        from private.rating_points(version, (wine->>'price_huf')::int, (wine->>'alcohol_tenths')::int, v_bucket, v_price, v_alcohol) p;
        select qa.answers into v_answers from private.question_answers qa where qa.rating_id = v_rating;
      end if;
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q->>'id',
        'option_id', case when picked and picked_id in (select o->>'id' from jsonb_array_elements(coalesce(q->'options', '[]'::jsonb)) o) then picked_id else null end,
        'points', case when version = 3 and picked and picked_id = q->>'correctOptionId' then 1 else 0 end
      ) order by ord), '[]'::jsonb) into v_questions
      from jsonb_array_elements(coalesce(wine->'questions', '[]'::jsonb)) with ordinality as t(q, ord)
      cross join lateral (
        select coalesce(v_answers, '{}'::jsonb) ? (q->>'id') as picked, v_answers->>(q->>'id') as picked_id
      ) pick;
      card_wines := card_wines || jsonb_build_array(jsonb_build_object(
        'id', wine->>'id', 'price_bucket', v_bucket, 'price_huf', v_price, 'price_points', v_price_points,
        'alcohol_tenths', v_alcohol, 'alcohol_points', v_alcohol_points, 'liking', v_liking, 'questions', v_questions));
    end loop;
    cards := cards || jsonb_build_array(jsonb_build_object('id', person->>'id', 'wines', card_wines));
  end loop;
  return result || jsonb_build_object('scorecards', cards);
end;
$$;
revoke all on function public.get_game_results(uuid) from public,anon,authenticated;
grant execute on function public.get_game_results(uuid) to authenticated;
commit;
