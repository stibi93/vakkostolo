import { useEffect, useRef, useState } from 'react';

export interface DemoPhoto { src: string | null; custom: boolean }
const initialPhotos = (): DemoPhoto[] => [1, 2, 3].map(index => ({ src: `/demo/sample-wine-0${index}.png`, custom: false }));

/** Local demo only. No upload or persistence; live wine assets need private storage. */
export function useDemoPhotos() {
  const [photos, setPhotos] = useState(initialPhotos);
  const [messages, setMessages] = useState(['', '', '']);
  const pending = useRef([0, 0, 0]);
  const urls = useRef(new Map<number, string>());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const activeUrls = urls.current;
    const revisions = pending.current;
    return () => {
      mounted.current = false;
      revisions.forEach((_, index) => revisions[index]++);
      activeUrls.forEach(url => URL.revokeObjectURL(url));
      activeUrls.clear();
    };
  }, []);

  function message(index: number, value: string) {
    setMessages(previous => previous.map((text, i) => i === index ? value : text));
  }
  function change(index: number, photo: DemoPhoto) {
    const previous = urls.current.get(index);
    if (previous) URL.revokeObjectURL(previous);
    urls.current.delete(index);
    if (photo.custom && photo.src) urls.current.set(index, photo.src);
    setPhotos(previousPhotos => previousPhotos.map((value, i) => i === index ? photo : value));
  }
  async function select(index: number, file: File) {
    const revision = ++pending.current[index];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      message(index, 'JPEG, PNG vagy WebP képet válassz.'); return;
    }
    if (file.size > 8 * 1024 * 1024) {
      message(index, 'Legfeljebb 8 MB-os képet válassz.'); return;
    }
    const src = URL.createObjectURL(file);
    const probe = new Image();
    probe.src = src;
    message(index, 'Kép ellenőrzése…');
    try {
      await probe.decode();
      if (!mounted.current || pending.current[index] !== revision) { URL.revokeObjectURL(src); return; }
      if (probe.naturalWidth * probe.naturalHeight > 40_000_000) {
        URL.revokeObjectURL(src); message(index, 'Legfeljebb 40 megapixeles képet válassz.'); return;
      }
      change(index, { src, custom: true });
      message(index, 'A kép beillesztve a demóba. Frissítéskor elvész.');
    } catch {
      URL.revokeObjectURL(src);
      if (mounted.current && pending.current[index] === revision) message(index, 'A kép nem olvasható. Válassz másik fájlt.');
    }
  }
  function reset(index: number, remove: boolean) {
    pending.current[index]++;
    change(index, remove ? { src: null, custom: false } : initialPhotos()[index]);
    message(index, remove ? 'Kép törölve a demóból.' : 'Mintakép visszaállítva.');
  }
  return { photos, messages, select, reset };
}
