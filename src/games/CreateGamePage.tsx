import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { buildCreateDraftFromGame, type CreateGameDraft } from './createGameDraft';
import { CreateGameForm } from './CreateGameForm';
import { gameErrorMessage } from './api';
import { isUuid, type GamesApi } from './model';

type QueryState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

function useCopyDraft(load: () => Promise<{ draft: CreateGameDraft; sourceTitle: string }>) {
  const [state, setState] = useState<QueryState<{ draft: CreateGameDraft; sourceTitle: string }>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    load().then((data) => { if (active) setState({ status: 'ready', data }); },
      (error: unknown) => { if (active) setState({ status: 'error', message: gameErrorMessage(error) }); });
    return () => { active = false; };
  }, [load, attempt]);
  return { state, retry: () => { setState({ status: 'loading' }); setAttempt((value) => value + 1); } };
}

function HostCreateNav() {
  return <nav className="host-subnav" aria-label="Játékmesteri navigáció">
    <Link className="button-secondary" to="/host">Saját kóstolóim</Link>
  </nav>;
}

function CopyCreateGamePage({ api, sourceId }: { api: GamesApi; sourceId: string }) {
  const load = useCallback(async () => {
    const game = await api.get(sourceId);
    return { draft: buildCreateDraftFromGame(game), sourceTitle: game.title };
  }, [api, sourceId]);
  const { state, retry } = useCopyDraft(load);

  if (state.status === 'loading') {
    return <>
      <HostCreateNav />
      <p role="status">A másolandó kóstoló betöltése…</p>
    </>;
  }
  if (state.status === 'error') {
    return <>
      <HostCreateNav />
      <p role="alert" className="auth-message">{state.message}</p>
      <div className="actions">
        <button className="button-primary" type="button" onClick={retry}>Újrapróbálás</button>
        <Link className="button-secondary" to="/host/new">Üres kóstoló</Link>
      </div>
    </>;
  }
  return <>
    <HostCreateNav />
    <p className="game-hint">A(z) „{state.data.sourceTitle}” kóstoló adatai betöltve. A címet és a borokat módosíthatod mentés előtt.
      A borfotók nem másolódnak; szükség esetén újra feltöltheted.</p>
    <CreateGameForm key={sourceId} api={api} draft={state.data.draft} />
  </>;
}

export function CreateGamePage({ api }: { api: GamesApi }) {
  const [search] = useSearchParams();
  const from = search.get('from');
  if (from && isUuid(from)) return <CopyCreateGamePage api={api} sourceId={from} />;
  return <>
    <HostCreateNav />
    <CreateGameForm api={api} />
  </>;
}
