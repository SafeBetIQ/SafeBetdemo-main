export const DEMO_EMAIL_DOMAIN = '@demo.safebetiq.com';

export const SA_PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Limpopo', 'Mpumalanga', 'North West', 'Free State', 'Northern Cape',
];

const FIRST_NAMES = [
  'Sipho', 'Thabo', 'Ayanda', 'Nomvula', 'Kagiso', 'Lerato', 'Bongani', 'Zanele',
  'Mpho', 'Nompumelelo', 'Siyanda', 'Palesa', 'Lwazi', 'Thandeka', 'Nhlanhla',
  'Dineo', 'Kabelo', 'Ntombi', 'Sibusiso', 'Refilwe',
];
const LAST_NAMES = [
  'Dlamini', 'Nkosi', 'Khumalo', 'Mokoena', 'Ndlovu', 'Mahlangu',
  'Sithole', 'Mthembu', 'Zulu', 'Molefe', 'Shabalala', 'Naidoo',
  'Patel', 'Van der Merwe', 'Botha', 'Smith',
];

export const GAME_TYPES = ['slots', 'roulette', 'blackjack', 'poker', 'baccarat', 'live_dealer'];

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export function daysAgoRandom(minDays: number, maxDays: number): string {
  return daysAgo(randomInt(minDays, maxDays));
}

export function randomName(): { first: string; last: string; email: string } {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const suffix = randomInt(100, 9999);
  const email = `${first.toLowerCase()}.${last.toLowerCase().replace(/\s/g, '')}.${suffix}${DEMO_EMAIL_DOMAIN}`;
  return { first, last, email };
}

export function log(msg: string) {
  process.stdout.write(`  ${msg}\n`);
}

export function logSection(title: string) {
  process.stdout.write(`\n━━ ${title} ━━\n`);
}

export function logOk(msg: string) {
  process.stdout.write(`  ✓ ${msg}\n`);
}

export function logErr(msg: string) {
  process.stdout.write(`  ✗ ${msg}\n`);
}
