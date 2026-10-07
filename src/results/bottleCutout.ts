const tolerance = 24;
const shadowTolerance = 10;
const minShadow = 0.55;
const minLight = 200;
const minBorderShare = 0.6;

const distance = (data: Uint8ClampedArray, pixel: number, ref: number[]) =>
  Math.max(Math.abs(data[pixel * 4] - ref[0]), Math.abs(data[pixel * 4 + 1] - ref[1]), Math.abs(data[pixel * 4 + 2] - ref[2]));

/** The backdrop colour itself, or a cast shadow on it: the same hue, only darker. */
function isBackdrop(data: Uint8ClampedArray, pixel: number, ref: number[]) {
  if (distance(data, pixel, ref) <= tolerance) return true;
  const shade = (data[pixel * 4] + data[pixel * 4 + 1] + data[pixel * 4 + 2]) / (ref[0] + ref[1] + ref[2]);
  return shade >= minShadow && shade <= 1 && distance(data, pixel, ref.map(channel => channel * shade)) <= shadowTolerance;
}

/**
 * Makes a plain light backdrop and its cast shadows transparent in place (RGBA pixels). Only the backdrop connected to
 * the edge is removed, so a white label inside the bottle stays. Returns false and leaves the pixels untouched for a
 * busy or dark scene.
 */
export function removeBackdrop(data: Uint8ClampedArray, width: number, height: number): boolean {
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  const median = (channel: number) => border.map(pixel => data[pixel * 4 + channel]).sort((a, b) => a - b)[border.length >> 1];
  const ref = [median(0), median(1), median(2)];
  if (Math.min(...ref) < minLight) return false;
  const seeds = border.filter(pixel => distance(data, pixel, ref) <= tolerance);
  if (seeds.length < border.length * minBorderShare) return false;

  const neighbours = (pixel: number) => {
    const x = pixel % width;
    return [x > 0 ? pixel - 1 : -1, x < width - 1 ? pixel + 1 : -1, pixel - width, pixel + width].filter(next => next >= 0 && next < width * height);
  };
  const backdrop = new Uint8Array(width * height);
  const stack = seeds;
  for (const pixel of stack) backdrop[pixel] = 1;
  while (stack.length) {
    for (const next of neighbours(stack.pop()!)) {
      if (backdrop[next] || !isBackdrop(data, next, ref)) continue;
      backdrop[next] = 1;
      stack.push(next);
    }
  }
  // A two-pixel ring around the bottle mixes glass and backdrop. Estimate its opacity and take the backdrop colour
  // back out, so no light halo is left around the bottle.
  let ring: number[] = [];
  for (let pixel = 0; pixel < backdrop.length; pixel++) if (!backdrop[pixel] && neighbours(pixel).some(next => backdrop[next])) ring.push(pixel);
  for (let depth = 0; depth < 2; depth++) {
    const next: number[] = [];
    for (const pixel of ring) {
      backdrop[pixel] = 2;
      const alpha = Math.min(1, (distance(data, pixel, ref) - tolerance) / (2 * tolerance));
      if (alpha <= 0 || alpha >= 1) continue;
      for (let channel = 0; channel < 3; channel++) data[pixel * 4 + channel] = (data[pixel * 4 + channel] - (1 - alpha) * ref[channel]) / alpha;
      data[pixel * 4 + 3] = Math.round(255 * alpha);
    }
    for (const pixel of ring) for (const near of neighbours(pixel)) if (!backdrop[near]) { backdrop[near] = 3; next.push(near); }
    ring = next;
  }
  for (let pixel = 0; pixel < backdrop.length; pixel++) if (backdrop[pixel] === 1) data[pixel * 4 + 3] = 0;
  return true;
}

/** PNG with a transparent backdrop, or the original photo when there is no plain backdrop to remove. */
export async function cutoutBottle(photo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return photo;
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
    if (!removeBackdrop(image.data, image.width, image.height)) return photo;
    context.putImageData(image, 0, 0);
    return await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob ?? photo), 'image/png'));
  } finally {
    bitmap.close();
  }
}
