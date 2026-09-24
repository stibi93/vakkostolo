export interface OwnResult {
  priceBucket: number | null; priceHuf: number | null; alcoholTenths: number; liking: number;
  pricePoints: number | null; alcoholPoints: number; total: number | null;
}
export interface WineResult {
  id: string; position: number; name: string; priceHuf: number; priceBucket: number; alcoholTenths: number;
  photoUpdatedAt: string | null; responseCount: number; averageLiking: number | null; own: OwnResult | null;
}
export interface LeaderboardEntry {
  id: string; nickname: string; seat: number; rank: number; points: number; answered: number; unscored: number;
}
export interface GameResults {
  scoringVersion: 1 | 2; final: boolean; revealedCount: number; maxPoints: number;
  wines: WineResult[]; leaderboard: LeaderboardEntry[];
}
export interface ResultPhotoApi { download(gameId: string, roundId: string): Promise<Blob> }
