import { useState } from 'react';
import { WinePhoto } from '../ui/WinePhoto';
import { demoWines } from './data';
import type { useDemoPhotos } from './useDemoPhotos';

export function DemoPhotoEditor({ photos, messages, select, reset }: ReturnType<typeof useDemoPhotos>) {
  const [open, setOpen] = useState(false);
  return <details className="demo-photo-editor" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Mintaborok képei</summary>
    {open && <>
      <p id="photo-help" className="small-note">Helyi képcsere: a fotó a felfedett bornál is megjelenik. Nem töltjük fel, frissítéskor elvész. JPEG, PNG vagy WebP, legfeljebb 8 MB.</p>
      {demoWines.map((wine, index) => <div className="demo-photo-row" key={index}>
        <WinePhoto src={photos[index].src} alt={`${wine.name} – ${photos[index].custom ? 'saját kép' : 'AI-mintafotó'}`} number={String(index + 1).padStart(2, '0')} />
        <div><h4>{wine.name}</h4>
          <div className="upload-control"><label htmlFor={`wine-photo-${index}`}>Kép kiválasztása<span className="sr-only"> · {index + 1}. tétel</span></label>
            <input id={`wine-photo-${index}`} type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={`photo-help photo-message-${index}`} onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void select(index, file);
            }} />
          </div>
          <div className="photo-actions"><button type="button" className="button-secondary" disabled={!photos[index].src} onClick={() => reset(index, true)}>Kép törlése<span className="sr-only"> · {index + 1}. tétel</span></button>
            <button type="button" className="button-secondary" onClick={() => reset(index, false)}>Mintakép<span className="sr-only"> · {index + 1}. tétel</span></button></div>
          <p className="small-note" id={`photo-message-${index}`} aria-live="polite">{messages[index] || 'AI-val készített mintafotó.'}</p>
        </div>
      </div>)}
    </>}
  </details>;
}
