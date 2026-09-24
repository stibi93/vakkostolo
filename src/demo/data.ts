import type { WineTruth } from '../domain/game';

// Fictional fixtures. These must never become a source of live blind-tasting data.
export const demoWines: readonly WineTruth[] = [
  { name: 'Dűlőjáró · Furmint 2024', priceHuf: 4900, alcoholTenths: 125 },
  { name: 'Esti kert · Kékfrankos 2023', priceHuf: 6500, alcoholTenths: 135 },
  { name: 'Aranyóra · Olaszrizling 2024', priceHuf: 3800, alcoholTenths: 120 },
];
