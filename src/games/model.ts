import { parseQuestions, type HostQuestion } from '../questions/model';
import type { TastingSchedule } from '../schedule/model';
import type { GameStatus } from '../domain/game';

export interface WineInput { questions?: HostQuestion[]; name: string; priceHuf: number; alcoholTenths: number }
export type InitialStep = { kind: 'wine'; wine_index: number } | { kind: 'break' | 'reveal'; title: string; message: string; seconds: number; wine_indexes: number[] };
export interface CreateGameInput { title: string; roundSeconds: number; revealEvery: number; wines: WineInput[]; steps?: InitialStep[] }
export interface HostGameSummary {
  id: string; title: string; status: GameStatus; roundSeconds: number; revealEvery: number; createdAt: string;
}
export interface HostWine extends WineInput {
  position: number; roundId: string; photoUpdatedAt: string | null; photoLocked: boolean;
}
export interface HostGame extends HostGameSummary { wines: HostWine[]; schedule?: TastingSchedule }
export interface GamesApi {
  create(input: CreateGameInput, requestId: string): Promise<string>;
  list(): Promise<HostGameSummary[]>;
  remove?(id: string): Promise<void>;
  get(id: string): Promise<HostGame>;
  uploadPhoto(gameId: string, roundId: string, photo: Blob): Promise<void>;
  removePhoto(gameId: string, roundId: string): Promise<void>;
  photoUrl(gameId: string, roundId: string): Promise<string>;
}
export const gameStatusLabels: Record<GameStatus, string> = {
  draft: 'Előkészítés', lobby: 'Váró', tasting: 'Kóstolás', intermission: 'Szünet', reveal: 'Felfedés', finished: 'Befejezve',
};
export const isUuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const integerBetween = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
const length = (value: string) => Array.from(value.trim()).length;
export function validateGameInput(input: CreateGameInput): string[] {
  const errors: string[] = [];
  if (length(input.title) < 1 || length(input.title) > 100) errors.push('A kóstoló címe 1–100 karakter legyen.');
  if (input.roundSeconds !== 0 && !integerBetween(input.roundSeconds, 30, 1800)) errors.push('Válassz időkorlát nélküli kóstolást vagy 30–1800 egész másodpercet.');
  if (!integerBetween(input.revealEvery, 1, 12)) errors.push('A felfedési gyakoriság 1–12 egész tétel lehet.');
  if (input.wines.length < 1 || input.wines.length > 12) errors.push('Adj meg 1–12 bort.');
  input.wines.forEach((wine, i) => {
    try { parseQuestions(wine.questions,true); } catch (error) { errors.push(`${i+1}. tétel: ${(error as Error).message}`); }
    if (length(wine.name) < 1 || length(wine.name) > 200) errors.push(`${i+1}. tétel: a név 1–200 karakter legyen.`);
    if (!integerBetween(wine.priceHuf, 1, 1_000_000)) errors.push(`${i+1}. tétel: az ár 1–1 000 000 egész Ft lehet.`);
    if (!integerBetween(wine.alcoholTenths, 0, 250)) errors.push(`${i+1}. tétel: az alkoholfok 0–25%, legfeljebb egy tizedesjeggyel.`);
  });
  return errors;
}
export function parseAlcohol(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return /^\d+(\.\d)?$/.test(normalized) ? Math.round(Number(normalized)*10) : NaN;
}
