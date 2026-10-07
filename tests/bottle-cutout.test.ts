import { expect, it } from 'vitest';
import { removeBackdrop } from '../src/results/bottleCutout';

// 9×9 photo: white backdrop, a dark 3×5 bottle in the middle with a white label pixel inside it.
function photo(backdrop: [number, number, number]) {
  const width = 9, height = 9, data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const x = pixel % width, y = Math.floor(pixel / width);
    const bottle = x >= 3 && x <= 5 && y >= 2 && y <= 6;
    const colour = x === 4 && y === 4 ? [255, 255, 255] : bottle ? [40, 20, 30] : backdrop;
    data.set([...colour, 255], pixel * 4);
  }
  return { data, width, height, alpha: (x: number, y: number) => data[(y * width + x) * 4 + 3] };
}

it('a peremhez kapcsolódó világos hátteret átlátszóvá teszi, az üveget és a címkét megtartja', () => {
  const image = photo([250, 248, 252]);
  expect(removeBackdrop(image.data, image.width, image.height)).toBe(true);
  expect(image.alpha(0, 0)).toBe(0);
  expect(image.alpha(8, 4)).toBe(0);
  expect(image.alpha(3, 2)).toBe(255);
  expect(image.alpha(4, 4)).toBe(255);
});
it('sötét vagy tarka háttérnél nem nyúl a képhez', () => {
  const dark = photo([30, 30, 30]);
  expect(removeBackdrop(dark.data, dark.width, dark.height)).toBe(false);
  expect(dark.alpha(0, 0)).toBe(255);
  const busy = photo([250, 250, 250]);
  for (let x = 0; x < 9; x += 2) for (const y of [0, 8]) busy.data.set([120, 60, 20], (y * 9 + x) * 4);
  for (let y = 0; y < 9; y += 2) for (const x of [0, 8]) busy.data.set([120, 60, 20], (y * 9 + x) * 4);
  expect(removeBackdrop(busy.data, busy.width, busy.height)).toBe(false);
});
