import { parseQuestionResults } from '../questions/model';
import type { GameResults, OwnResult } from './model';
import { isUuid } from '../games/model';
import { LobbyError } from '../lobby/api';
function invalid(): never { throw new LobbyError('Az eredmények válasza nem értelmezhető. Próbáld újra a frissítést.'); }
function record(v: unknown): Record<string,unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalid(); return v as Record<string,unknown>; }
function number(v: unknown, min: number, max: number, integer = true): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) return invalid(); return v;
}
function text(v: unknown, max: number): string { if (typeof v !== 'string' || !v.trim() || v.length > max) return invalid(); return v; }
export function parseResults(value: unknown, role: 'host' | 'player'): GameResults {
  const r=record(value);
  const revealedCount=number(r.revealed_count,0,12), maxPoints=number(r.max_points,0,1200);
  if (maxPoints!==revealedCount*100 || ![1,2].includes(Number(r.scoring_version)) || typeof r.scoring_version!=='number' || typeof r.final!=='boolean' ||
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
    return {...(w.questions === undefined ? {} : {questions:parseQuestionResults(w.questions,role)}),id:w.id,position:number(w.position,1,12),name:text(w.name,200),priceHuf:number(w.price_huf,1,1000000),
      priceBucket:number(w.price_bucket,1,8),alcoholTenths:number(w.alcohol_tenths,0,250),photoUpdatedAt,responseCount,averageLiking,own};
  });
  const leaderboard=r.leaderboard.map(value=>{
    const e=record(value);if(!isUuid(e.id)) return invalid();
    return {id:e.id,nickname:text(e.nickname,30),seat:number(e.seat,1,50),rank:number(e.rank,1,50),points:number(e.points,0,maxPoints),
      answered:number(e.answered,0,revealedCount),unscored:number(e.unscored,0,revealedCount)};
  });
  if(new Set(wines.map(w=>w.id)).size!==wines.length || new Set(wines.map(w=>w.position)).size!==wines.length ||
    new Set(leaderboard.map(e=>e.id)).size!==leaderboard.length || leaderboard.some(e=>e.unscored>e.answered)) return invalid();
  return {scoringVersion:r.scoring_version as 1|2,final:r.final,revealedCount,maxPoints,wines,leaderboard};
}
