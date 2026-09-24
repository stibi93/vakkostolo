export const winePhotoBucket = 'wine-photos';
export const winePhotoPath = (gameId: string, roundId: string) => `${gameId}/${roundId}.jpg`;

const maxInputBytes = 30 * 1024 * 1024;
const maxPixels = 50_000_000;
const maxEdge = 1600;
export const maxWinePhotoBytes = 2 * 1024 * 1024;

export class WinePhotoError extends Error {}

export function fitWithin(width: number, height: number, max = maxEdge) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Re-encodes in the browser: bounded size, JPEG only, and no EXIF (location) metadata leaves the device. */
export async function prepareWinePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new WinePhotoError('Képfájlt válassz (például JPEG, PNG vagy WebP).');
  if (file.size > maxInputBytes) throw new WinePhotoError('Legfeljebb 30 MB-os képet válassz.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new WinePhotoError('A kép nem olvasható. Válassz JPEG, PNG vagy WebP fájlt.'); }
  try {
    if (bitmap.width * bitmap.height > maxPixels) throw new WinePhotoError('Legfeljebb 50 megapixeles képet válassz.');
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new WinePhotoError('A böngésző nem tudta feldolgozni a képet.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    for (const quality of [0.85, 0.72, 0.6]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= maxWinePhotoBytes) return blob;
    }
    throw new WinePhotoError('A képet nem sikerült 2 MB alá tömöríteni. Válassz másik képet.');
  } finally {
    bitmap.close();
  }
}
