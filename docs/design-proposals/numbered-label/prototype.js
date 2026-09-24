/* global document, history, window, location, Image, URL, matchMedia */
// This standalone design study stores only local sample state; it is not a game client.
const screens = ['home', 'tasting', 'reveal', 'photos'];
const samples = [
  { name: 'Dűlőjáró', variety: 'Furmint', year: 2024, price: 4900, alcohol: 12.5 },
  { name: 'Esti kert', variety: 'Kékfrankos', year: 2023, price: 6500, alcohol: 13.5 },
  { name: 'Nyári tétel', variety: 'Rosé', year: 2024, price: 3800, alcohol: 12 },
].map((sample, i) => ({ ...sample, number: String(i + 1).padStart(2, '0'), image: `assets/sample-wine-0${i + 1}.png`, custom: false, revision: 0 }));
const byId = id => document.getElementById(id);
const format = value => new Intl.NumberFormat('hu-HU').format(value);
let currentScreen = 'home';
let selectedWine = 0;
let savedGuess = null;

function renderImage(img, sample) {
  const figure = img.closest('figure');
  const fallback = figure.querySelector('.photo-fallback');
  img.onload = null;
  img.onerror = null;
  img.removeAttribute('src');
  img.hidden = true;
  img.alt = '';
  fallback.hidden = false;
  fallback.textContent = 'Ehhez a borhoz nincs kép.';
  if (!sample?.image) return;
  fallback.textContent = 'Kép betöltése…';
  img.alt = `${sample.name} ${sample.variety} – ${sample.custom ? 'kiválasztott kép' : 'AI-mintafotó'}`;
  img.onload = () => { img.hidden = false; fallback.hidden = true; };
  img.onerror = () => { img.hidden = true; fallback.hidden = false; fallback.textContent = 'A kép nem tölthető be.'; };
  img.src = sample.image;
}
function renderReveal() {
  const sample = samples[selectedWine];
  document.querySelectorAll('[data-wine]').forEach(el => el.setAttribute('aria-pressed', String(Number(el.dataset.wine) === selectedWine)));
  byId('reveal-number').textContent = sample.number;
  byId('reveal-name').replaceChildren(document.createTextNode(sample.name), document.createElement('br'), document.createTextNode(sample.variety));
  byId('reveal-vintage').textContent = `${sample.year} · Kitalált mintabor`;
  byId('photo-origin').textContent = sample.image ? (sample.custom ? 'Saját kép · helyi előnézet.' : 'AI-val készített mintafotó.') : 'Kép nélkül is megjeleníthető.';
  byId('actual-price').textContent = format(sample.price) + ' Ft';
  byId('actual-alcohol').textContent = format(sample.alcohol) + '%';
  const guess = selectedWine === 0 ? (savedGuess ?? { price: 4500, alcohol: 13.5, liking: 7 }) : null;
  byId('result-price').textContent = guess ? format(guess.price) + ' Ft' : '—';
  byId('result-alcohol').textContent = guess ? format(guess.alcohol) + '%' : '—';
  byId('result-liking').textContent = guess ? guess.liking : '—';
  byId('result-intro').textContent = guess ? (savedGuess ? 'A mintalapon rögzített értékeid a példaadatok mellett.' : 'Minta a két érték összehasonlítására.') : 'Ehhez a mintaborhoz még nem adtál meg tippet.';
  renderImage(byId('reveal-photo'), sample);
}
function syncImages() {
  // Do not fetch or mount sample photos on the home/tasting screens.
  document.querySelectorAll('.wine-photo img').forEach(img => renderImage(img, null));
  if (currentScreen === 'reveal') renderReveal();
  if (currentScreen === 'photos') samples.forEach((sample, i) => renderImage(byId(`photo-${i}`), sample));
}
function show(name, focus = false) {
  if (!screens.includes(name)) name = 'home';
  currentScreen = name;
  screens.forEach(id => { byId(id).hidden = id !== name; });
  document.querySelectorAll('nav button').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.screen === name)));
  history.replaceState(null, '', '#' + name);
  syncImages();
  if (focus) {
    document.querySelector('#' + name + ' [tabindex="-1"]').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
document.querySelectorAll('[data-screen]').forEach(el => el.addEventListener('click', event => { event.preventDefault(); show(el.dataset.screen, true); }));
const liking = byId('liking');
liking.addEventListener('input', () => { byId('liking-value').innerHTML = liking.value + ' <small>/ 10</small>'; });
byId('rating-form').addEventListener('input', () => { byId('saved').textContent = 'Módosítottad a mintatippet; újra rögzítheted.'; });
byId('rating-form').addEventListener('submit', event => {
  event.preventDefault();
  savedGuess = { price: Number(byId('price').value), alcohol: Number(byId('alcohol').value), liking: Number(liking.value) };
  selectedWine = 0;
  byId('saved').textContent = 'Mintatipp rögzítve ezen a lapon. A Felfedés nézetben összehasonlíthatod.';
});

samples.forEach((sample, i) => {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.dataset.wine = i;
  tab.textContent = `${sample.number} · ${sample.variety}`;
  tab.setAttribute('aria-pressed', String(i === selectedWine));
  tab.addEventListener('click', () => { selectedWine = i; renderReveal(); });
  document.querySelector('.photo-tabs').append(tab);
  const article = document.createElement('article');
  article.className = 'editor-card';
  // All interpolated sample strings are hardcoded above; uploaded filenames never become markup.
  article.innerHTML = `<figure class="wine-photo"><span class="photo-fallback">Ehhez a borhoz nincs kép.</span><span class="photo-number">${sample.number}</span><img id="photo-${i}" hidden alt=""></figure><div class="editor-details"><p class="eyebrow">${sample.name}</p><h2>${sample.variety} ${sample.year}</h2><div class="upload-control"><label for="file-${i}">Kép kiválasztása</label><input id="file-${i}" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help photo-status-${i}"></div><div class="editor-actions"><button type="button" class="secondary" id="remove-${i}">Kép törlése</button><button type="button" class="secondary" id="restore-${i}">Mintakép</button></div><p class="message" role="status" id="photo-status-${i}">AI-val készített mintafotó.</p></div>`;
  byId('photo-editors').append(article);
  const status = byId(`photo-status-${i}`);
  function setStatus(text, error = false) { status.textContent = text; status.classList.toggle('image-error', error); }
  function changeImage(url, custom) {
    if (sample.custom && sample.image) URL.revokeObjectURL(sample.image);
    sample.image = url;
    sample.custom = custom;
    byId(`remove-${i}`).disabled = !url;
    if (currentScreen === 'photos') renderImage(byId(`photo-${i}`), sample);
    if (currentScreen === 'reveal' && selectedWine === i) renderReveal();
  }
  byId(`file-${i}`).addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const revision = ++sample.revision;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setStatus('JPEG, PNG vagy WebP képet válassz.', true); return; }
    if (file.size > 8 * 1024 * 1024) { setStatus('A kép túl nagy. Legfeljebb 8 MB-os fájlt válassz.', true); return; }
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.src = url;
    setStatus('Kép ellenőrzése…');
    try {
      await probe.decode();
      if (revision !== sample.revision) { URL.revokeObjectURL(url); return; }
      if (probe.naturalWidth * probe.naturalHeight > 40000000) { URL.revokeObjectURL(url); setStatus('Legfeljebb 40 megapixeles képet válassz.', true); return; }
      changeImage(url, true);
      setStatus('Saját kép beillesztve. A felfedésnél is ezt látod.');
    } catch {
      URL.revokeObjectURL(url);
      if (revision === sample.revision) setStatus('A kép nem olvasható. Válassz másik fájlt.', true);
    }
  });
  byId(`remove-${i}`).addEventListener('click', () => { sample.revision++; changeImage(null, false); setStatus('Kép törölve. A bor kép nélkül jelenik meg.'); });
  byId(`restore-${i}`).addEventListener('click', () => { sample.revision++; changeImage(`assets/sample-wine-${sample.number}.png`, false); setStatus('Mintakép visszaállítva.'); });
});
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const motionButton = document.querySelector('.motion-toggle');
let motionPaused = false;
function syncMotion() {
  const paused = motionPaused || motionPreference.matches;
  document.querySelector('.label-stage').classList.toggle('motion-paused', paused);
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.disabled = motionPreference.matches;
  motionButton.textContent = motionPreference.matches ? 'Mozgás kikapcsolva' : paused ? 'Háttérmozgás indítása' : 'Háttérmozgás szüneteltetése';
}
motionButton.addEventListener('click', () => { motionPaused = !motionPaused; syncMotion(); });
motionPreference.addEventListener('change', syncMotion);
syncMotion();
show(location.hash.slice(1));
