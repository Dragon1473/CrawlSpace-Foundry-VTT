/**
 * Crawler population and the Top Ten leaderboard (not homebrew; the `leaderboardTools` world setting turns them off).
 * The GM keeps both: how many crawlers are left on each floor, announced as the floor changes, and who is on the
 * leaderboard with their bounties. Both can be filled from the books ("canon prefill") and then edited freely.
 * Pure module: apps/leaderboard.ts is the window.
 *
 * Sources: population per floor from the community "crawler population estimator" (dungeon-crawler-king on GitHub),
 * canon where the books give a count and estimated between them; leaderboards as transcribed on the Dungeon Crawler
 * Carl wiki (fandom, CC-BY-SA), names as the books' leaderboard shows them.
 */

export type LeaderRow = { name: string; race: string; className: string; level: string; bounty: string; actorUuid?: string }
export type Leaderboard = { label: string; rows: LeaderRow[]; visible: boolean }
export type Population = Record<string, number>

export const LEADERBOARD_SIZE = 10

/** Crawlers alive as each floor opens (floor 1 is the day of the Collapse). */
export const CANON_POPULATION: Population = {
  1: 9_750_000,
  2: 1_292_526,
  3: 700_000,
  4: 389_441,
  5: 178_887,
  6: 85_223,
  7: 38_532,
  8: 38_532,
  9: 32_429,
  10: 5_501,
  11: 23,
  12: 13,
}

const row = (name: string, race: string, className: string, level: string, bounty: string): LeaderRow => ({ name, race, className, level, bounty })
const lucia = (level: string, bounty: string, className = 'Black Inquisitor General') => row('Lucia Mar', 'Lajabless', className, level, bounty)
const hekla = (level: string, bounty: string) => row('Hekla', 'Amazonian', 'Shieldmaiden', level, bounty)
const prepotente = (level: string, bounty: string, className = 'Forsaken Aerialist') => row('Prepotente', 'Caprid', className, level, bounty)
const florin = (level: string, bounty: string) => row('Florin', 'Crocodilian', 'Shotgun Messenger', level, bounty)
const miriam = (level: string, bounty: string, race = 'Human') => row('Miriam Dom', race, 'Shepherd', level, bounty)
const carl = (level: string, bounty: string, className = 'Compensated Anarchist') => row('Carl', 'Primal', className, level, bounty)
const donut = (level: string, bounty: string) => row('Donut', 'Cat', 'Former Child Actor', level, bounty)
const ifechi = (level: string, bounty: string) => row('Ifechi', 'Human', 'Physicker', level, bounty)
const elle = (level: string, bounty: string, className = 'Blizzardmancer', name = 'Elle McGib') => row(name, 'Frost Maiden', className, level, bounty)
const quan = (level: string, bounty: string, className = 'Imperial Security Trooper') => row('Quan Ch', 'Half Elf', className, level, bounty)
const popovs = (level: string, bounty: string, className = 'Illusionist & Bogatyr') => row('Dmitri Popov & Maxim Popov', 'Nodling', className, level, bounty)
const bogdon = (level: string, bounty: string) => row('Bogdon Ro', 'Human', 'Legatus', level, bounty)
const eva = (level: string, bounty: string) => row('Eva Sigrid', 'Half Nagini, Half-Orc', 'Nimblefoot Enforcer', level, bounty)
const katia = (level: string, bounty: string) => row('Katia Grim', 'Doppelgänger', 'Monster Truck Driver', level, bounty)

/** The books' leaderboards, oldest first, by floor. */
export const CANON_LEADERBOARDS: { id: string; floor: number; label: string; rows: LeaderRow[] }[] = [
  {
    id: 'f4-leaked',
    floor: 4,
    label: 'Floor 4: leaked copy',
    rows: [lucia('29', '1,000,000'), hekla('28', '500,000'), prepotente('27', '400,000'), florin('24', '300,000'), miriam('27', '200,000'), carl('27', '100,000'), donut('26', '100,000'), ifechi('18', '100,000'), row('Li Jun', 'Human', 'Street Monk', '25', '100,000'), elle('13', '100,000')],
  },
  {
    id: 'f4-debut',
    floor: 4,
    label: 'Floor 4: debut',
    rows: [lucia('30', '1,000,000'), hekla('28', '500,000'), prepotente('27', '400,000'), florin('24', '300,000'), miriam('27', '200,000'), carl('27', '100,000'), donut('26', '100,000'), ifechi('18', '100,000'), row('Li Jun', 'Human', 'Street Monk', '25', '100,000'), elle('17', '100,000')],
  },
  {
    id: 'f4-later',
    floor: 4,
    label: 'Floor 4: later',
    rows: [lucia('?', '1,000,000'), hekla('?', '500,000'), prepotente('?', '400,000'), florin('?', '300,000'), miriam('?', '200,000'), carl('?', '100,000'), donut('?', '100,000'), elle('?', '100,000'), ifechi('?', '100,000'), quan('?', '100,000')],
  },
  {
    id: 'f4-end',
    floor: 4,
    label: 'Floor 4: 2 days 17 hours to collapse',
    rows: [lucia('35', '1,000,000'), prepotente('34', '500,000'), carl('34', '400,000'), donut('32', '300,000'), quan('38', '200,000'), florin('32', '100,000'), miriam('30', '100,000'), katia('37', '100,000'), popovs('30', '100,000'), ifechi('29', '100,000')],
  },
  {
    id: 'f5-start',
    floor: 5,
    label: 'Floor 5: 14 days to collapse',
    rows: [lucia('38', '1,000,000 (x2)'), carl('41', '500,000 (x2)'), prepotente('35', '400,000 (x2)'), donut('33', '300,000 (x2)'), quan('43', '200,000 (x2)'), popovs('33', '100,000 (x2)'), miriam('31', '100,000 (x2)'), elle('33', '100,000'), bogdon('31', '100,000'), florin('33', '100,000 (x2)')],
  },
  {
    id: 'f5-middle',
    floor: 5,
    label: 'Floor 5: 10 days 6 hours to collapse',
    rows: [lucia('41', '1,000,000 (x2)'), carl('44', '500,000 (x2)'), prepotente('38', '400,000 (x2)'), donut('36', '300,000 (x2)'), popovs('37', '200,000 (x2)'), miriam('34', '100,000 (x2)'), quan('45', '100,000 (x2)'), elle('35', '100,000'), bogdon('35', '100,000'), row('Chirag Ali', 'Human', 'Sacred Paladin', '35', '100,000')],
  },
  {
    id: 'f5-end',
    floor: 5,
    label: 'Floor 5: 1 hour to collapse',
    rows: [carl('47', '1,000,000 (x2)'), lucia('48', '500,000 (x2)'), prepotente('55', '400,000 (x2)'), donut('39', '300,000 (x2)'), popovs('43', '200,000 (x2)'), miriam('52', '100,000 (x2)'), elle('47', '100,000'), bogdon('35', '100,000'), eva('40', '100,000'), quan('48', '100,000 (x2)')],
  },
  {
    id: 'f6',
    floor: 6,
    label: 'Floor 6: 15 days 23 hours to collapse',
    rows: [carl('54', '1,000,000 (x3)', 'Agent Provocateur'), lucia('48', '500,000 (x3)'), prepotente('55', '400,000 (x3)', 'Profane Vitiate'), donut('41', '300,000 (x3)'), popovs('44', '200,000 (x3)', 'Visionary & Bogatyr'), miriam('52', '100,000 (x3)', 'Vampire'), elle('47', '100,000 (x2)', 'Tundra Princess'), bogdon('44', '100,000 (x2)'), eva('40', '100,000 (x2)'), quan('48', '100,000 (x3)', 'Sergeant-at-Arms')],
  },
  {
    id: 'f8',
    floor: 8,
    label: 'Floor 8',
    rows: [prepotente('', '1,000,000 (x4)', 'Profane Vitiate'), donut('', '500,000 (x4)'), carl('', '400,000 (x4)', 'Agent Provocateur'), lucia('', '300,000 (x4)'), elle('', '200,000 (x3)', 'Tundra Princess', 'Elle McGibbons'), katia('', '100,000'), florin('', '100,000'), row('Osvaldo', 'Curupira', 'Ranger', '', '100,000'), row('Li Na', 'Changbi Demon', 'Slave Driver', '', '100,000'), row('Burcu', 'Porsuk', 'Swashbuckler', '', '100,000')],
  },
]

export const emptyRow = (): LeaderRow => ({ name: '', race: '', className: '', level: '', bounty: '' })

/** A stored leaderboard, cleaned: up to ten rows of text, a label, and whether players can see it. */
export function cleanLeaderboard(value: unknown): Leaderboard {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Leaderboard>
  const text = (entry: unknown) => String(entry ?? '').slice(0, 200)
  const rows = (Array.isArray(raw.rows) ? raw.rows : []).slice(0, LEADERBOARD_SIZE).map((entry: any) => ({
    name: text(entry?.name),
    race: text(entry?.race),
    className: text(entry?.className),
    level: text(entry?.level),
    bounty: text(entry?.bounty),
    ...(entry?.actorUuid ? { actorUuid: text(entry.actorUuid) } : {}),
  }))
  return { label: text(raw.label), rows, visible: !!raw.visible }
}

/** A canon leaderboard as an editable copy. */
export function canonLeaderboard(id: string): Leaderboard | null {
  const canon = CANON_LEADERBOARDS.find((entry) => entry.id === id)
  return canon ? { label: canon.label, rows: canon.rows.map((entry) => ({ ...entry })), visible: false } : null
}

/** Stored population counts, cleaned: whole numbers of zero or more, by floor 1-99. */
export function cleanPopulation(value: unknown): Population {
  const out: Population = {}
  for (const [floor, count] of Object.entries(value && typeof value === 'object' ? value : {})) {
    const f = Math.floor(Number(floor))
    const n = Math.floor(Number(count))
    if (f >= 1 && f <= 99 && Number.isFinite(n) && n >= 0) out[f] = n
  }
  return out
}

/** The count for a floor: its own entry, else the latest earlier floor's, else null. */
export function populationOn(population: Population, floor: number): number | null {
  for (let f = Math.floor(floor); f >= 1; f--) if (population[f] != null) return population[f]
  return null
}

/** How many crawlers fell since the previous floor (null when either is unknown). */
export function populationLoss(population: Population, floor: number): { lost: number; percent: number } | null {
  const now = population[floor]
  const before = populationOn(population, floor - 1)
  if (now == null || before == null || before <= 0) return null
  const lost = Math.max(0, before - now)
  return { lost, percent: Math.floor((lost * 100) / before) }
}
