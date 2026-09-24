import { useState } from 'react';
import type { GameStatus } from '../domain/game';
import { QrCode } from './QrCode';
import { inviteErrorMessage } from './api';
import { inviteUrl, publicAppOrigin, readStoredInvite, storeInvite } from './model';
import type { Invite, InvitesApi } from './model';
import './invites.css';

export function InvitePanel({ api, gameId, status, onStatusChange }: {
  api: InvitesApi; gameId: string; status: GameStatus; onStatusChange: (status: GameStatus) => void;
}) {
  const [invite, setInvite] = useState<Invite | null>(() => readStoredInvite(window.localStorage, gameId));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (status === 'finished') return null;

  async function issue() {
    setPending(true);
    setMessage(null);
    setCopied(false);
    try {
      const issued = await api.issue(gameId);
      storeInvite(window.localStorage, gameId, issued);
      setInvite(issued);
      onStatusChange(issued.status);
    } catch (error) {
      setMessage(inviteErrorMessage(error));
    } finally {
      setPending(false);
    }
  }
  const url = invite ? inviteUrl(publicAppOrigin(), invite.token) : null;
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setMessage('A link nem másolható automatikusan. Jelöld ki, és másold ki kézzel.');
    }
  }

  return <section className="invite-panel" aria-labelledby="invite-title">
    <h3 id="invite-title">Meghívó és váró</h3>
    {status === 'draft' ? <>
      <p>A váró megnyitása után a játékosok QR-kóddal vagy linkkel, egy becenévvel léphetnek be.
        A borok adatai továbbra is csak neked láthatók.</p>
      <button className="button-primary" disabled={pending} onClick={() => void issue()}>
        {pending ? 'A váró megnyitása…' : 'Váró megnyitása'}</button>
    </> : url && invite ? <>
      <QrCode value={url} label="QR-kód a kóstolóba való belépéshez" />
      <p>Olvassátok be a telefon kamerájával, vagy küldd el a linket.</p>
      <p className="invite-link"><code>{url}</code></p>
      <div className="actions">
        <a className="button-primary" href={`/present/${gameId}`} target="_blank" rel="noopener">
          Kivetítő nézet</a>
        <button className="button-secondary" onClick={() => void copy()}>{copied ? 'Link kimásolva' : 'Link másolása'}</button>
        <button className="button-secondary" disabled={pending} onClick={() => void issue()}>
          {pending ? 'Új meghívó készítése…' : 'Új meghívó'}</button>
      </div>
      <p className="game-hint">A kivetítő nézet új lapon nyílik: csak a kóstoló címét, a QR-kódot és a belépett
        beceneveket mutatja, a borok adatait nem. Húzd át a lapot a projektor képernyőjére.</p>
      <p className="game-hint">Érvényes eddig: {new Date(invite.expiresAt).toLocaleString('hu-HU',
        { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. Új meghívónál a régi link és
        QR-kód érvényét veszti; aki már belépett, bent marad.</p>
    </> : <>
      <p>A meghívó ebben a böngészőben nem érhető el. Biztonsági okból a szerver sem tudja újra megmutatni.</p>
      <button className="button-primary" disabled={pending} onClick={() => void issue()}>
        {pending ? 'Új meghívó készítése…' : 'Új meghívó készítése'}</button>
      <p className="game-hint">A régi link és QR-kód ezzel érvényét veszti; aki már belépett, bent marad.</p>
    </>}
    {message && <p role="alert" className="auth-message">{message}</p>}
  </section>;
}
