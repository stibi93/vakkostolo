import { useEffect, useState } from 'react';
import type { ResultPhotoApi, WineResult } from './model';
export function ResultPhoto({ api, gameId, wine, lift = false }: { api?: ResultPhotoApi; gameId: string; wine: WineResult; lift?: boolean }) {
  // The key on the caller remounts for a different wine/photo, so old blobs cannot flash.
  const [url,setUrl]=useState<string|null>(null), [failed,setFailed]=useState(false), [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!api || !wine.photoUpdatedAt) return;
    let active=true, objectUrl:string|undefined;
    api.download(gameId,wine.id).then(blob=>{
      if(!active) return; objectUrl=URL.createObjectURL(blob); setUrl(objectUrl);
    },()=>{if(active) setFailed(true);});
    return ()=>{active=false;if(objectUrl) URL.revokeObjectURL(objectUrl);};
  },[api,gameId,wine.id,wine.photoUpdatedAt,attempt]);
  const ready = Boolean(url && !failed);
  return <figure className={`result-photo${lift ? ' result-photo-lift' : ''}`}>
    {ready ? <>
      <img src={url!} alt={`${wine.name} – a borhoz feltöltött fotó`} width="600" height="800" onError={()=>setFailed(true)} />
      {lift && <span className="bottle-shadow" aria-hidden="true" />}
    </> : <div className="result-photo-placeholder"><span aria-hidden="true">{String(wine.position).padStart(2,'0')}</span>
        <p>{!wine.photoUpdatedAt ? 'Ehhez a borhoz nincs fotó.' : failed || !api ? 'A fotó most nem tölthető be.' : 'Fotó betöltése…'}</p>
        {failed && api && <button className="button-secondary" onClick={()=>{setFailed(false);setUrl(null);setAttempt(a=>a+1);}}>Fotó újratöltése</button>}
      </div>}
  </figure>;
}
