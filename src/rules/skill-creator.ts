import { CONDITION_TYPES, damageModeOf, type ConditionType, type DamageMode } from './damage-effects.ts'
/**
 * The Skill Creator (homebrew, the `skillCreator` world setting): a homebrew skill built the way the "Homebrew Skill
 * Flow Chart" by diffendice & Dungeon Anarchists walks it. Attack or utility; for an attack its range, weapon or
 * unarmed, DEX or STR, damage type, passive, damage die and whether a stat adds; for utility its stat, passive, range
 * and targets; then optional limitations and a cooldown, a balance check, and rank upgrades at 5, 10 and 15. Skills are
 * grouped by what they are for ("what do you want to do?") so a GM can compare, and maybe reflavor an existing skill
 * instead. Pure module: apps/skill-creator.ts is the window.
 */

export const CREDIT_URL = 'https://youtu.be/YBPPANDlgYw'

/** "What do you want to do?": the chart's groups and the core skills in each (names only). */
export const INTENTS: { id: string; skills: string[] }[] = [
  { id: 'fight', skills: [] },
  { id: 'explode', skills: ['Bomb Surgeon', 'Explosives Handling', 'Goblin Explosives', 'Incendiary Device Handling'] },
  { id: 'craft', skills: ['Alchemy', 'Backfire', 'Calligraphy', 'Cooking', 'Engineering', 'Fabricate', 'Gear Head', 'Infusion', 'Repair', 'Salvage', 'Scutelliphily', 'Tattoo Artistry', 'Trap Engineer'] },
  { id: 'avoid', skills: ['Balance', 'Cat-Like Reflexes', 'Dodge'] },
  { id: 'find', skills: ['Acute Ears', 'Cartography', 'Detect Trap', 'Dumpster Diving', 'Find Crawler', 'Find Trap', 'Investigation', 'Pathfinder', 'Streetwise', 'Tracking'] },
  { id: 'confuse', skills: ['Deception', 'Intimidate', 'Taunt'] },
  { id: 'please', skills: ['Animal Handling', 'Diplomacy', 'Good First Impression', 'Leadership', 'Negotiation', 'Performance', 'Persuasion'] },
  { id: 'heal', skills: ['First Aid', 'Regeneration'] },
  { id: 'move', skills: ['Chopper Pilot', 'Climbing', 'Driving', 'Jumping', 'Light on Your Feet', 'Riding', 'Running', 'Swimming', 'Throwing'] },
  { id: 'sneak', skills: ['Ambush', 'Hide in Shadows', 'Lockpicking', 'Sleight of Hand', 'Stealth'] },
  { id: 'think', skills: ['Arcane', 'Basic Science', 'Detect Lies', 'Determine Value', 'Escape Plan', 'Investigation', 'Lore', 'Religion', 'Tactics'] },
  { id: 'survive', skills: ['Catcher', 'Cockroach', 'Endurance', 'Iron Stomach', 'Regeneration', 'Shield Block', 'Survival'] },
  { id: 'other', skills: ['Aiming', 'Attack of Opportunity', 'Cesta Punta', 'Character Actor', 'Double Tap', 'Ropework', 'Zone of Control'] },
]

export const DAMAGE_TYPES = ['Acid', 'Bludgeoning', 'Electric', 'Fire', 'Force', 'Holy', 'Ice', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Slashing', 'Sonic']
export const DICE = [4, 6, 8, 10, 12] as const
export const STATS = ['STR', 'INT', 'CON', 'DEX', 'CHA'] as const
export const TARGETS = ['self', 'allies', 'enemies', 'pets', 'npcs', 'hud'] as const
export const COOLDOWNS = ['none', 'round', 'scene', 'hours', 'day', 'days', 'floor'] as const
export type Cooldown = (typeof COOLDOWNS)[number]

export type SkillAnswers = {
  name: string
  intent: string
  kind: 'attack' | 'utility'
  /** Attack: melee or ranged. Utility: whether it works at range. */
  ranged: boolean
  unarmed: boolean
  stat: string
  damageType: string
  passive: boolean
  die: number
  addStat: boolean
  targets: string[]
  limitations: string
  cooldown: Cooldown
  cooldownAmount: number
  description: string
  rank5: string
  rank10: string
  rank15: string
  /** A hobby skill (from the hobby tables) remembers its hobby. */
  hobby?: string
  /**
   * A damage effect skill (rules/damage-effects.ts): it changes attacks made with `effectSkills` (comma list), adding
   * its damage or multiplying the base dice or the total by `effectMultiplier`, ticked by hand or when its condition
   * is met. Multiplier and threshold can scale with Rank (rules/rank-values.ts).
   */
  effect: boolean
  effectSkills: string
  effectMode: DamageMode
  effectMultiplier: string
  effectCondition: '' | ConditionType
  effectThreshold: string
}

export function defaultAnswers(): SkillAnswers {
  return {
    name: '', intent: 'other', kind: 'utility', ranged: false, unarmed: false, stat: 'DEX', damageType: 'Bludgeoning', passive: false, die: 6, addStat: true, targets: ['self'], limitations: '', cooldown: 'none', cooldownAmount: 1, description: '', rank5: '', rank10: '', rank15: '',
    effect: false, effectSkills: '', effectMode: 'add', effectMultiplier: '', effectCondition: '', effectThreshold: '',
  }
}

/** The damage effect settings of a skill from the Creator (data/items.ts damageEffect). */
export function damageEffectData(answers: Pick<SkillAnswers, 'effect' | 'effectSkills' | 'effectMode' | 'effectMultiplier' | 'effectCondition' | 'effectThreshold'>) {
  const mode = damageModeOf(answers.effectMode)
  const condition = CONDITION_TYPES.includes(answers.effectCondition as ConditionType) ? answers.effectCondition : ''
  return {
    enabled: !!answers.effect,
    skills: String(answers.effectSkills ?? '').split(',').map((name) => name.trim()).filter(Boolean),
    addRank: null,
    mode: '',
    damageMode: mode === 'add' ? '' : mode,
    multiplier: mode === 'add' ? '' : String(answers.effectMultiplier ?? '').trim(),
    condition: { type: condition, value: condition ? String(answers.effectThreshold ?? '').trim() : '' },
  }
}

const clampDie = (die: unknown) => (DICE.includes(Number(die) as any) ? Number(die) : 6)
const whole = (value: unknown) => Math.max(1, Math.floor(Number(value)) || 1)

/** The cooldown as duration text the system reads (rules/time.ts): times count down, the rest end on an event. */
export function cooldownText(cooldown: Cooldown, amount = 1): string {
  const n = whole(amount)
  switch (cooldown) {
    case 'round':
      return n === 1 ? '1 round' : `${n} rounds`
    case 'scene':
      return 'Until end of combat'
    case 'hours':
      return n === 1 ? '1 hour' : `${n} hours`
    case 'day':
      return '1 day'
    case 'days':
      return n === 1 ? '1 day' : `${n} days`
    case 'floor':
      return 'Until you leave this floor'
    default:
      return ''
  }
}

/** An attack's damage at Rank 1 and after each upgrade: one more die at Rank 5, 10 and 15 (like the core weapon skills). */
export function damageFormulas(answers: Pick<SkillAnswers, 'die' | 'addStat' | 'stat'>) {
  const die = clampDie(answers.die)
  const stat = answers.addStat ? `+${answers.stat === 'STR' ? 'STR' : 'DEX'}` : ''
  return [1, 2, 3, 4].map((count) => `${count}d${die}${stat}`)
}

/** The check a skill rolls: an attack, a passive, opposed against enemies, else unopposed. */
export function checkTypeFor(answers: Pick<SkillAnswers, 'kind' | 'passive' | 'targets'>) {
  if (answers.kind === 'attack') return 'Attack'
  if (answers.passive) return 'Passive'
  return answers.targets.includes('enemies') ? 'Opposed' : 'Unopposed'
}

/** Soft warnings from the chart's "consider balance" steps (lang keys under CRAWLSPACE.SkillCreator.Balance). */
export function balanceHints(answers: SkillAnswers): string[] {
  const hints: string[] = []
  if (!answers.name.trim()) hints.push('NoName')
  if (answers.kind === 'attack') {
    if (clampDie(answers.die) >= 10 && answers.cooldown === 'none') hints.push('BigDie')
    if (answers.passive) hints.push('PassiveAttack')
    if (answers.unarmed && answers.ranged) hints.push('UnarmedRanged')
  } else if (!answers.targets.length) hints.push('NoTarget')
  if (!answers.rank5.trim() || !answers.rank10.trim() || !answers.rank15.trim()) hints.push('Upgrades')
  if (answers.cooldown === 'none' && !answers.limitations.trim() && answers.kind === 'utility' && !answers.passive && answers.targets.includes('enemies')) hints.push('Unlimited')
  if (answers.effect && !answers.effectSkills.trim()) hints.push('EffectNoSkills')
  if (answers.effect && answers.effectMode !== 'add' && !answers.effectCondition && answers.cooldown === 'none') hints.push('EffectUnlimited')
  return hints
}

const esc = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
const paragraphs = (text: string) => text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).map((part) => `<p>${esc(part).replace(/\n/g, '<br>')}</p>`)

/** Item data for the skill. `labels` gives the words for range and targets (localized by the caller). */
export function skillItemData(input: SkillAnswers, labels: { range: string; targets: string; limitations: string; note: string }) {
  const answers = { ...defaultAnswers(), ...input }
  const attack = answers.kind === 'attack'
  const [base, r5, r10, r15] = damageFormulas(answers)
  const die = clampDie(answers.die)
  const upgrade = (text: string) => text.trim() || (attack ? `Add 1d${die} base damage.` : '')
  const details = [
    ...paragraphs(answers.description),
    `<p><strong>${esc(labels.range)}</strong></p>`,
    ...(attack ? [] : [`<p>${esc(labels.targets)}</p>`]),
    ...(answers.limitations.trim() ? [`<p><strong>${esc(labels.limitations)}</strong> ${esc(answers.limitations.trim())}</p>`] : []),
  ]
  return {
    name: answers.name.trim() || 'New Skill',
    type: 'skill',
    img: attack ? (answers.unarmed ? 'icons/skills/melee/unarmed-punch-fist.webp' : answers.ranged ? 'icons/weapons/bows/shortbow-recurve.webp' : 'icons/skills/melee/blade-tip-orange.webp') : 'icons/sundries/books/book-red-exclamation.webp',
    system: {
      description: details.join(''),
      notes: labels.note,
      stat: attack ? (answers.stat === 'STR' ? 'STR' : 'DEX') : STATS.includes(answers.stat as any) ? answers.stat : 'INT',
      checkType: checkTypeFor(answers),
      cooldown: cooldownText(answers.cooldown, answers.cooldownAmount),
      isAttack: attack,
      isUnarmed: attack && answers.unarmed,
      damage: { formula: attack ? base : '', types: attack ? [answers.damageType] : [], armorPiercing: false, magic: false, area: false },
      upgrades: { rank5: upgrade(answers.rank5), rank10: upgrade(answers.rank10), rank15: upgrade(answers.rank15), rank5Damage: attack ? r5 : '', rank10Damage: attack ? r10 : '', rank15Damage: attack ? r15 : '' },
      ...(answers.effect ? { damageEffect: damageEffectData(answers) } : {}),
      source: { database: 'homebrew', id: null, book: '', pages: '' },
    },
    flags: { crawlspace: { skillCreator: true, intent: answers.intent, ...(answers.hobby ? { hobby: answers.hobby } : {}) } },
  }
}

/** The intent a skill name belongs to on the chart, if it is a core skill there. */
export const intentOf = (name: string) => INTENTS.find((intent) => intent.skills.some((skill) => skill.toLowerCase() === name.trim().toLowerCase()))?.id ?? null

export type CompareSkill = { name: string; uuid: string; intent?: string | null }

/**
 * The Skill Creator's compare box: every skill once by name (a world copy over a compendium one), the ones for this
 * purpose first (the chart's core skills, or skills the Creator tagged with it), then the rest by name.
 */
export function compareChoices(skills: CompareSkill[], intent: string): CompareSkill[] {
  const byName = new Map<string, CompareSkill>()
  for (const skill of skills) {
    const key = skill.name.trim().toLowerCase()
    const had = byName.get(key)
    if (!key || (had && (had.uuid.startsWith('Item.') || !skill.uuid.startsWith('Item.')))) continue
    byName.set(key, { ...skill, intent: had?.intent ?? skill.intent })
  }
  const core = new Set((INTENTS.find((entry) => entry.id === intent)?.skills ?? []).map((name) => name.toLowerCase()))
  const first = (skill: CompareSkill) => (core.has(skill.name.trim().toLowerCase()) || skill.intent === intent ? 0 : 1)
  return [...byName.values()].sort((a, b) => first(a) - first(b) || a.name.localeCompare(b.name))
}

/** A hobby's skill: a utility skill named for the hobby, described by its table line. */
export function hobbyAnswers(hobby: string, description = ''): SkillAnswers {
  return { ...defaultAnswers(), name: hobby, intent: 'other', kind: 'utility', stat: 'INT', targets: ['self'], description, hobby }
}
