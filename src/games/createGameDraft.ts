import type { HostQuestion } from '../questions/model';
import type { HostGame } from './model';

export type SourceWinePhoto = { gameId: string; roundId: string };

export type CreateWineDraft = {
  kind: 'wine';
  id: string;
  name: string;
  price: string;
  alcohol: string;
  questions: HostQuestion[];
  sourcePhoto: SourceWinePhoto | null;
};

export type CreateCardDraft = {
  kind: 'break' | 'reveal';
  id: string;
  title: string;
  message: string;
  seconds: number;
  targets: string[];
};

export type CreateEntryDraft = CreateWineDraft | CreateCardDraft;

export type CreateGameDraft = {
  title: string;
  timed: boolean;
  seconds: string;
  entries: CreateEntryDraft[];
};

function formatAlcohol(tenths: number): string {
  const whole = Math.floor(tenths / 10);
  const fraction = tenths % 10;
  return fraction === 0 ? String(whole) : `${whole},${fraction}`;
}

function copyTitle(title: string): string {
  const suffix = ' – másolat';
  const trimmed = title.trim();
  if (trimmed.length + suffix.length <= 100) return trimmed + suffix;
  return `${trimmed.slice(0, 100 - suffix.length).trimEnd()}${suffix}`;
}

function cloneQuestions(questions: HostQuestion[] | undefined): HostQuestion[] {
  if (!questions?.length) return [];
  return questions.map((question) => ({
    ...question,
    options: question.options.map((option) => ({ ...option })),
  }));
}

function sourcePhoto(game: HostGame, roundId: string, updatedAt: string | null): SourceWinePhoto | null {
  return updatedAt ? { gameId: game.id, roundId } : null;
}

/** Maps a saved host game into create-form state. Wine photos keep a source reference until save copies them. */
export function buildCreateDraftFromGame(game: HostGame): CreateGameDraft {
  const wineByPosition = new Map(game.wines.map((wine) => [wine.position, wine]));
  const roundIdToLocalId = new Map<string, string>();
  const localIdForRound = (roundId: string) => {
    const existing = roundIdToLocalId.get(roundId);
    if (existing) return existing;
    const id = crypto.randomUUID();
    roundIdToLocalId.set(roundId, id);
    return id;
  };

  const entries: CreateEntryDraft[] = [];
  const steps = game.schedule?.steps;

  if (steps?.length) {
    for (const step of steps) {
      if (step.kind === 'wine') {
        const stored = step.round_position ? wineByPosition.get(step.round_position) : undefined;
        if (!stored) continue;
        entries.push({
          kind: 'wine',
          id: localIdForRound(stored.roundId),
          name: stored.name,
          price: String(step.price_huf ?? stored.priceHuf),
          alcohol: formatAlcohol(step.alcohol_tenths ?? stored.alcoholTenths),
          questions: cloneQuestions(step.questions),
          sourcePhoto: sourcePhoto(game, stored.roundId, stored.photoUpdatedAt),
        });
      } else if (step.kind === 'break') {
        entries.push({
          kind: 'break',
          id: crypto.randomUUID(),
          title: step.title,
          message: step.message,
          seconds: step.seconds,
          targets: [],
        });
      } else {
        entries.push({
          kind: 'reveal',
          id: crypto.randomUUID(),
          title: step.title,
          message: step.message,
          seconds: 0,
          targets: (step.reveal_round_ids ?? [])
            .map((roundId) => roundIdToLocalId.get(roundId))
            .filter((id): id is string => !!id),
        });
      }
    }
  }

  if (!entries.length) {
    for (const wine of game.wines) {
      entries.push({
        kind: 'wine',
        id: crypto.randomUUID(),
        name: wine.name,
        price: String(wine.priceHuf),
        alcohol: formatAlcohol(wine.alcoholTenths),
        questions: cloneQuestions(wine.questions),
        sourcePhoto: sourcePhoto(game, wine.roundId, wine.photoUpdatedAt),
      });
    }
  }

  return {
    title: copyTitle(game.title),
    timed: game.roundSeconds !== 0,
    seconds: game.roundSeconds === 0 ? '120' : String(game.roundSeconds),
    entries: entries.length ? entries : [{
      kind: 'wine',
      id: crypto.randomUUID(),
      name: '',
      price: '',
      alcohol: '',
      questions: [],
      sourcePhoto: null,
    }],
  };
}
