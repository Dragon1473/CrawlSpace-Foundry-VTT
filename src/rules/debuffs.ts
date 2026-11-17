/** The 27 standard debuffs from CrawlSpace `debuffs.ts`, with their mechanical hooks for Foundry. */

export type DebuffDefinition = {
  id: string
  name: string
  effect: string
  duration: string
  durationSeconds: number | null
  stackable: boolean
  /** Rolled once per round in Clean Up. */
  cleanup?: { formula: string; types: string[] }
  /** Flat penalty to all checks. */
  checkPenalty?: number
  /** Move is halved. */
  halveMove?: boolean
  /** The effect rules the condition carries (roll modes, a lost modifier), as ActiveEffect changes. */
  changes?: DebuffChange[]
}

export type DebuffChange = { key: string; type: string; value: unknown; phase: 'initial' }

const rollMode = (kind: string, value: 'advantage' | 'disadvantage'): DebuffChange => ({ key: `${kind}:All`, type: 'crawlspace.rollMode', value, phase: 'initial' })
const disadvantageOn = (...kinds: string[]) => kinds.map((kind) => rollMode(kind, 'disadvantage'))
const attacksAgainstWithAdvantage = [rollMode('incomingAttackMode', 'advantage')]

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const raw: Omit<DebuffDefinition, 'id' | 'durationSeconds' | 'stackable'>[] = [
  { name: 'Blinded', effect: 'Roll all Skill Checks that require sight with Disadvantage.', duration: 'Until the end of the next round.' },
  { name: 'Blood Trail', effect: 'You take 1d6+F at the end of each round. Stackable.', duration: 'Until cured with a bandage or a First Aid Skill Check.', cleanup: { formula: '1d6+F', types: [] } },
  { name: 'Burned', effect: 'You take 1d10+F Fire damage at the end of each round.', duration: 'Until the end of combat or 5 minutes. As an Action, a victim may perform a Dex Stat Check to extinguish the flames.', cleanup: { formula: '1d10+F', types: ['Fire'] } },
  { name: 'Drowning', effect: 'You take 1d6+F damage at the end of each round.', duration: 'Until your head is above water.', cleanup: { formula: '1d6+F', types: [] } },
  { name: 'Dying', effect: 'You are at 0% HP. Your Con Mod is how many rounds you have before you die. Subtract 1 from this countdown value at the end of each round. Additionally, each time a Dying Creature would take damage from any source, they instead subtract 1 from the countdown value.', duration: 'Until you die or heal at least 1 HP slot.' },
  { name: 'Enraged', effect: 'You are in a state of extreme uncontrolled fury. You may only perform Attack and Move Actions.', duration: 'Until the end of 2 rounds or 20 seconds.' },
  { name: 'Fatigued', effect: 'You have a -1 penalty on all Checks and your Move is halved. Stackable. Until the end of a long rest.', duration: 'Until the end of a long rest.', checkPenalty: -1, halveMove: true },
  { name: 'Held', effect: 'You are actively being held. You can’t use Move Actions or take a Step but may still twist your body to Evade. Attacks against a Held foe are made with Advantage.', duration: 'Until you are released by whatever is holding you, or you escape. Make a STR-Opposed Escape Artist Skill Check. If not physically held, it is Unopposed.', changes: attacksAgainstWithAdvantage },
  { name: 'Long-Term Major Injury', effect: 'You take a -5 penalty to all Checks.', duration: 'Until the end of a full day of rest.', checkPenalty: -5 },
  { name: 'Long-Term Minor Injury', effect: 'You take a -2 penalty to all Checks.', duration: 'Until the end of a long rest.', checkPenalty: -2 },
  { name: 'Major Injury', effect: 'You take a -5 penalty to all Checks. Gaining a Major Injury a second time changes it to a Long-Term Major Injury.', duration: 'Until the end of a long rest.', checkPenalty: -5 },
  { name: 'Minor Injury', effect: 'You take a -2 penalty to all Checks. Gaining a Minor Injury a second time changes it to a Long-Term Minor Injury.', duration: 'Until the end of a short rest.', checkPenalty: -2 },
  { name: 'Muted', effect: 'You can’t speak or cast Spells.', duration: 'Until the end of the combat or 5 minutes.' },
  { name: 'Poisoned', effect: 'You take 1d8+F Poison damage at the end of each round. Stackable.', duration: 'Until treated with an antidote.', cleanup: { formula: '1d8+F', types: ['Poison'] } },
  { name: 'Paralyzed', effect: 'You can’t take any Actions.', duration: 'Until the end of the next round.' },
  { name: 'Queasy', effect: 'If your next Action requires a roll, it’s made with Disadvantage.', duration: 'At the end of the next Action you take.', changes: disadvantageOn('attackMode', 'checkMode') },
  { name: 'Sepsis', effect: 'You’re Staggered (see below) and take 1d10+F Poison damage at the end of each round.', duration: 'As Staggered, and the damage continues until you’re healed.', cleanup: { formula: '1d10+F', types: ['Poison'] } },
  { name: 'Shit-Faced', effect: 'You make all your Checks with Disadvantage.', duration: 'Until the end of 10 minutes.', changes: disadvantageOn('attackMode', 'checkMode', 'evadeMode') },
  { name: 'Shocked', effect: 'You lose your next Action.', duration: 'Once you forfeit that Action.' },
  { name: 'Sore as Shit', effect: 'You suffer a -1 penalty to all rolls.', duration: 'Until the end of 1 hour.', checkPenalty: -1 },
  { name: 'Staggered', effect: 'The next Action you take can’t be a Move, and if it is an Attack, its Check is made with Disadvantage. You can’t take a 10ft Step with your next Action.', duration: 'At the end of the next Action you take.', changes: disadvantageOn('attackMode') },
  { name: 'Stiff Legs', effect: 'You can’t take 10ft Steps.', duration: 'Until the end of the combat or 5 minutes.' },
  { name: 'Stunned', effect: 'You gain Disadvantage on your next Check.', duration: 'Once you make a Check.', changes: disadvantageOn('attackMode', 'checkMode') },
  { name: 'Take Down', effect: 'You fall prone. While prone, all Attacks made against you are made with Advantage.', duration: 'Use your 10ft Step to stand.', changes: attacksAgainstWithAdvantage },
  { name: 'Terrified', effect: 'You can’t take Move Actions or 10ft Steps. You make all Attacks with Disadvantage.', duration: 'Until the end of the next round, or you take at least 1 HP slot damage.', changes: disadvantageOn('attackMode') },
  { name: 'The Taint', effect: 'You can’t be healed.', duration: 'Until the end of combat or 5 minutes.' },
  { name: 'Woozy', effect: 'You can’t add your Dex Mod to Attack or Evade Checks.', duration: 'Until the end of the next round.', changes: [{ key: 'dex', type: 'crawlspace.modLoss', value: 'attack,evade', phase: 'initial' }] },
]

const timedDurations: Record<string, number> = {
  Blinded: 10,
  Burned: 300,
  Enraged: 20,
  Muted: 300,
  Paralyzed: 10,
  'Shit-Faced': 600,
  'Sore as Shit': 3600,
  'Stiff Legs': 300,
  Terrified: 10,
  'The Taint': 300,
  Woozy: 10,
}

export const DEBUFFS: DebuffDefinition[] = raw.map((definition) => ({
  ...definition,
  id: slug(definition.name),
  durationSeconds: timedDurations[definition.name] ?? null,
  stackable: /Stackable\./i.test(definition.effect),
}))

export const debuffById = (id: string) => DEBUFFS.find((debuff) => debuff.id === id)
export const debuffByName = (name: string) =>
  DEBUFFS.find((debuff) => debuff.name.toLowerCase() === String(name ?? '').trim().toLowerCase())
export const debuffSlug = slug

/** The standard debuff a condition is, by its name, allowing a Rank suffix ("Poisoned (Rank 5)"). */
export const standardDebuffNamed = (name: string) =>
  debuffByName(name) ?? debuffByName(String(name ?? '').replace(/\s*\(ranks?\b[^)]*\)\s*$/i, ''))

/**
 * The standard changes an effect is missing for the standard debuffs it is (its statuses): a condition toggled
 * on before these existed, or dropped from an older compendium, gets its rules this way.
 */
export function missingStandardChanges(statuses: Iterable<string>, existing: { key: string; type: string }[] = []): DebuffChange[] {
  const has = new Set(existing.map((change) => `${change.type}|${change.key}`))
  const out: DebuffChange[] = []
  for (const id of statuses)
    for (const change of debuffById(id)?.changes ?? []) {
      const key = `${change.type}|${change.key}`
      if (has.has(key)) continue
      has.add(key)
      out.push({ ...change })
    }
  return out
}

/**
 * Compendium buffs by name and the rules that do what their text says. A Rank variant ("Astral Paw (Rank 5)")
 * is looked up by its full name first, then by its base name. Good Sleep needs the Floor, so it is only filled in
 * once the buff is on an actor.
 */
const move2: DebuffChange[] = [{ key: 'system.move.value', type: 'multiply', value: '2', phase: 'initial' }]
const specialChange = (key: string, data: Record<string, unknown>): DebuffChange => ({ key, type: 'crawlspace.special', value: JSON.stringify({ target: '', ...data }), phase: 'initial' })
const astralPaw = [specialChange('damageBonus', { target: 'Pugilism, Slice', value: 'RANK_DIE', damageTypes: [], damageScope: '', armorPiercing: false })]
const swimming = [{ key: 'checkMode:Swimming', type: 'crawlspace.rollMode', value: 'advantage', phase: 'initial' } as DebuffChange]

const NAMED_CHANGES: Record<string, DebuffChange[] | ((context: NamedContext) => DebuffChange[])> = {
  // A vehicle's or a pet's or minion's Move doubles.
  'nitrous oxide': move2,
  'twinkle toes': move2,
  // The DR of the armor carrying it still counts against Armor Piercing damage (effects/specials.ts piercingDr).
  'anti-piercing': [specialChange('antiPiercing', {})],
  'astral paw (rank 5)': astralPaw,
  'astral paw (rank 15)': astralPaw,
  'good sleep': ({ floor }) =>
    floor === undefined ? [] : ['str', 'int', 'con', 'dex', 'cha'].map((stat) => ({ key: `system.attributes.${stat}.bonus`, type: 'add', value: String(Math.floor(floor)), phase: 'initial' as const })),
  'iron skin potion': [{ key: 'system.dr.factor', type: 'multiply', value: '2', phase: 'initial' }],
  // Unseen Attackers: Advantage on its attacks, Disadvantage on attacks against it.
  invisible: [rollMode('attackMode', 'advantage'), rollMode('incomingAttackMode', 'disadvantage')],
  'replenish buff': [specialChange('manaPerRound', { value: 'INT', interval: '10 minutes' })],
  'you are full!': [specialChange('regenPerRound', { value: '2', interval: '1 hour' })],
  'water breathing (rank 10)': swimming,
  'water breathing (rank 15)': swimming,
}

type NamedContext = { floor?: number }

/** The named buff's rules the effect doesn't have yet. */
export function missingNamedChanges(name: string, existing: { key: string; type: string }[] = [], context: NamedContext = {}): DebuffChange[] {
  const full = String(name ?? '').trim().toLowerCase()
  const base = full.replace(/\s*\(.*\)\s*$/, '')
  const entry = NAMED_CHANGES[full] ?? NAMED_CHANGES[base]
  const list = typeof entry === 'function' ? entry(context) : (entry ?? [])
  const has = new Set(existing.map((change) => `${change.type}|${change.key}`))
  return list.filter((change) => !has.has(`${change.type}|${change.key}`)).map((change) => ({ ...change }))
}

/** Buffs that act once when they land: Recovery fills Health, Restore fills Mana. */
export function instantRestore(name: string): 'health' | 'mana' | null {
  const base = String(name ?? '').trim().toLowerCase()
  return base === 'recovery buff' || base === 'recovery' ? 'health' : base === 'restore buff' || base === 'restore' ? 'mana' : null
}
