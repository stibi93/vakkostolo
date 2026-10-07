import type { QuestionResult } from '../questions/model';
export interface OwnResult {
  priceBucket: number | null; priceHuf: number | null; alcoholTenths: number; liking: number;
  pricePoints: number | null; alcoholPoints: number; total: number | null;
}
export interface GuessCount { tenths: number; count: number }
export interface WineGuesses { price: number[]; alcohol: GuessCount[]; liking: number[] }
export interface WineResult {
  questions?: QuestionResult[];
  id: string; position: number; name: string; priceHuf: number; priceBucket: number; alcoholTenths: number;
  photoUpdatedAt: string | null; responseCount: number; averageLiking: number | null; own: OwnResult | null;
  guesses: WineGuesses;
}
export interface LeaderboardEntry {
  id: string; nickname: string; seat: number; rank: number; points: number; answered: number; unscored: number;
}
export interface ScoreQuestion { id: string; optionId: string | null; points: number }
export interface ScoreWine {
  id: string; priceBucket: number | null; priceHuf: number | null; pricePoints: number | null;
  alcoholTenths: number | null; alcoholPoints: number | null; liking: number | null; questions: ScoreQuestion[];
}
export interface Scorecard { id: string; wines: ScoreWine[] }
export interface GameResults {
  scoringVersion: 1 | 2 | 3 | 4; final: boolean; revealedCount: number; maxPoints: number;
  wines: WineResult[]; leaderboard: LeaderboardEntry[]; scorecards: Scorecard[];
}
export interface ResultPhotoApi { download(gameId: string, roundId: string): Promise<Blob> }
