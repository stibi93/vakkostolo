import { maxWines } from '../domain/game';
import { parseQuestionResults } from '../questions/model';
import type { GameResults, OwnResult, ScoreQuestion, ScoreWine, WineGuesses } from './model';
import { isUuid } from '../games/model';
import { LobbyError } from '../lobby/api';
function invalid(): never { throw new LobbyError('Az eredmények válasza nem értelmezhető. Próbáld újra a frissítést.'); }
function record(v: unknown): Record<string,unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalid(); return v as Record<string,unknown>; }
function number(v: unknown, min: number, max: number, integer = true): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) return invalid(); return v;
}
function text(v: unknown, max: number): string { if (typeof v !== 'string' || !v.trim() || v.length > max) return invalid(); return v; }
function counts(value: unknown, length: number, max: number): number[] {
  if (!Array.isArray(value) || value.length !== length || value.some(item => typeof item !== 'number' || !Number.isInteger(item) || item < 0 || item > max)) return invalid();
  return value;
}
function parseGuesses(value: unknown, responseCount: number): WineGuesses {
  const row = record(value);
  const price = counts(row.price, 8, 50);
  const liking = counts(row.liking, 10, 50);
  if (!Array.isArray(row.alcohol) || row.alcohol.length > 51) return invalid();
  const alcohol = row.alcohol.map(item => {
    const point = record(item);
    return { tenths: number(point.tenths, 0, 250), count: number(point.count, 1, 50) };
  });
  if (new Set(alcohol.map(point => point.tenths)).size !== alcohol.length) return invalid();
  const alcoholTotal = alcohol.reduce((sum, point) => sum + point.count, 0);
  const likingTotal = liking.reduce((sum, count) => sum + count, 0);
  const priceTotal = price.reduce((sum, count) => sum + count, 0);
  if (alcoholTotal !== responseCount || likingTotal !== responseCount || priceTotal > responseCount) return invalid();
  return { price, alcohol, liking };
}
export function parseResults(value: unknown, role: 'host' | 'player'): GameResults {
  const r=record(value);
  const revealedCount=number(r.revealed_count,0,maxWines), maxPoints=number(r.max_points,0,maxWines * 250);
  const scoringVersion = Number(r.scoring_version);
  if (![1,2,3].includes(scoringVersion) || typeof r.scoring_version!=='number' || typeof r.final!=='boolean' ||
    !Array.isArray(r.wines) || r.wines.length!==revealedCount || !Array.isArray(r.leaderboard) || r.leaderboard.length>50) return invalid();
  const wines=r.wines.map(value=>{
    const w=record(value); if (!isUuid(w.id)) return invalid();
    let own: OwnResult | null=null;
    if (w.own!==null) {
      if(role!=='player') return invalid();
      const a=record(w.own);
      own={priceBucket:a.price_bucket===null?null:number(a.price_bucket,1,8),priceHuf:a.price_huf===null?null:number(a.price_huf,0,1000000),
        alcoholTenths:number(a.alcohol_tenths,0,250),liking:number(a.liking,1,10),pricePoints:a.price_points===null?null:number(a.price_points,0,50,false),
        alcoholPoints:number(a.alcohol_points,0,50,false),total:a.total===null?null:number(a.total,0,100)};
      if((own.priceBucket===null && own.priceHuf===null) || (own.total===null)!==(own.pricePoints===null)) return invalid();
    }
    const photoUpdatedAt=w.photo_updated_at===null?null:text(w.photo_updated_at,64);
    if(photoUpdatedAt && !Number.isFinite(Date.parse(photoUpdatedAt))) return invalid();
    const responseCount=number(w.response_count,0,50), averageLiking=w.average_liking===null?null:number(w.average_liking,1,10,false);
    if((responseCount===0)!==(averageLiking===null) || (own!==null && responseCount===0)) return invalid();
    return {...(w.questions === undefined ? {} : {questions:parseQuestionResults(w.questions,role)}),id:w.id,position:number(w.position,1,maxWines),name:text(w.name,200),priceHuf:number(w.price_huf,1,1000000),
      priceBucket:number(w.price_bucket,1,8),alcoholTenths:number(w.alcohol_tenths,0,250),photoUpdatedAt,responseCount,averageLiking,own,
      guesses:parseGuesses(w.guesses,responseCount)};
  });
  const leaderboard=r.leaderboard.map(value=>{
    const e=record(value);if(!isUuid(e.id)) return invalid();
    return {id:e.id,nickname:text(e.nickname,30),seat:number(e.seat,1,50),rank:number(e.rank,1,50),points:number(e.points,0,maxPoints),
      answered:number(e.answered,0,revealedCount),unscored:number(e.unscored,0,revealedCount)};
  });
  if(new Set(wines.map(w=>w.id)).size!==wines.length || new Set(wines.map(w=>w.position)).size!==wines.length ||
    new Set(leaderboard.map(e=>e.id)).size!==leaderboard.length || leaderboard.some(e=>e.unscored>e.answered)) return invalid();
  if (!Array.isArray(r.scorecards) || r.scorecards.length !== leaderboard.length) return invalid();
  const scorecards = r.scorecards.map((value, index) => {
    const card = record(value);
    if (card.id !== leaderboard[index].id || !Array.isArray(card.wines) || card.wines.length !== wines.length) return invalid();
    const rows = card.wines.map((item, wineIndex) => parseScoreWine(item, wines[wineIndex].id, wines[wineIndex].questions));
    const earned = rows.reduce((sum, row) => sum + (row.pricePoints ?? 0) + (row.alcoholPoints ?? 0) + row.questions.reduce((points, question) => points + question.points, 0), 0);
    if (scoringVersion === 3 && earned !== leaderboard[index].points) return invalid();
    return { id: leaderboard[index].id, wines: rows };
  });
  wines.forEach((wine, wineIndex) => {
    const rows = scorecards.map(card => card.wines[wineIndex]);
    if (rows.filter(row => row.liking !== null).length !== wine.responseCount) return invalid();
    for (const question of wine.questions ?? []) {
      const picks = rows.map(row => row.questions.find(item => item.id === question.id)?.optionId ?? null);
      if (question.options.some(option => picks.filter(id => id === option.id).length !== option.count)) return invalid();
    }
  });
  const expectedMax = scoringVersion === 3 ? wines.reduce((sum, wine) => sum + 2 + (wine.questions?.length ?? 0), 0) : revealedCount * 100;
  if (maxPoints !== expectedMax) return invalid();
  return {scoringVersion:scoringVersion as 1|2|3,final:r.final,revealedCount,maxPoints,wines,leaderboard,scorecards};
}
function parseScoreWine(value: unknown, wineId: string, questions: { id: string; options: { id: string }[] }[] | undefined): ScoreWine {
  const row = record(value);
  if (row.id !== wineId || !Array.isArray(row.questions)) return invalid();
  const rawQuestions = row.questions;
  const missing = row.price_bucket === null && row.price_huf === null && row.alcohol_tenths === null && row.liking === null;
  if (missing !== (row.price_points === null && row.alcohol_points === null)) return invalid();
  if (!missing && (row.price_bucket === null && row.price_huf === null)) return invalid();
  const expected = questions ?? [];
  if (rawQuestions.length !== expected.length) return invalid();
  const parsedQuestions: ScoreQuestion[] = expected.map((question, index) => {
    const item = record(rawQuestions[index]);
    const optionId = item.option_id === null ? null : text(item.option_id, 64);
    if (item.id !== question.id || (optionId !== null && !question.options.some(option => option.id === optionId))) return invalid();
    return { id: question.id, optionId, points: number(item.points, 0, 1) };
  });
  return {
    id: wineId,
    priceBucket: row.price_bucket === null ? null : number(row.price_bucket, 1, 8),
    priceHuf: row.price_huf === null ? null : number(row.price_huf, 0, 1000000),
    pricePoints: row.price_points === null ? null : number(row.price_points, 0, 50, false),
    alcoholTenths: row.alcohol_tenths === null ? null : number(row.alcohol_tenths, 0, 250),
    alcoholPoints: row.alcohol_points === null ? null : number(row.alcohol_points, 0, 50, false),
    liking: row.liking === null ? null : number(row.liking, 1, 10),
    questions: parsedQuestions,
  };
}
