/**
 * Damage effect skills (damageEffectSkills.ts) and which items get an automatic attack row. A damage effect skill
 * names the attack skills it modifies; on those attacks it is an optional toggle (off until ticked) that adds its
 * damage at its Rank, and can add its Rank to the attack roll or set the roll's mode (Aiming: both, keep lower).
 * Pure, so tests can import it.
 */
import { doubleDice, resolveFormulaTokens } from './core.ts'
import { rankNumber, tierValue } from './rank-values.ts'

export type RollModeName = 'normal' | 'advantage' | 'disadvantage'

const normalize = (name: unknown) => String(name ?? '').trim().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').toLowerCase()

/** Unarmed attack skills by name (characterSheetRules.ts unarmedAttackSkillNames). */
const UNARMED_SKILLS = new Set([
  'backclaw',
  'bite',
  'sliceattack',
  'footsoldier',
  'nogginnocker',
  'pugilism',
  'unarmedcombat',
  'wrasslin',
  'rakingtalons',
  'palmfighter',
  'heelstriker',
  'shouldercharger',
  'grappleartist',
])

/**
 * An attack that needs no weapon: an attack spell, or an unarmed skill (flagged, or named like one). Any other
 * attack skill is a weapon skill and is only used through a weapon.
 */
export function usableAlone(item: { type: string; name: string; system: any }) {
  if (item.type === 'spell') return true
  return !!item.system?.isUnarmed || UNARMED_SKILLS.has(String(item.name ?? '').toLowerCase().replace(/[^a-z]/g, ''))
}

/**
 * Items that get an automatic attack row. A weapon needs to be equipped, unbroken and linked to a skill (named in its
 * details, or matched by its own name); it then stands in for that skill. A weapon skill never has a row of its own, only unarmed skills and
 * attack spells do (spells once they are on the hotlist). Broken items never attack.
 */
export function automaticAttackItems<T extends { id: string; type: string; name: string; system: any }>(
  items: T[],
  skillOf: (item: T) => { id: string } | null,
  /** Hotlisted item ids: an attack spell needs to be on the hotlist (when given). */
  hotlisted?: Set<string>,
) {
  // Linked by name in its details, or to the skill its own name matches (weaponSkill: an "Axe" with the Axe skill).
  const weapons = items.filter(
    (item) => item.type === 'weapon' && item.system.equipped && !item.system.broken && (String(item.system.skill ?? '').trim() || skillOf(item)),
  )
  const replaced = new Set(weapons.map((weapon) => skillOf(weapon)?.id).filter(Boolean))
  return items.filter((item) => {
    if (item.system.broken) return false
    if (item.type === 'weapon') return weapons.includes(item)
    if (item.type === 'consumable') return item.system.consumableType === 'explosives'
    if (item.type === 'spell' && hotlisted && !hotlisted.has(item.id)) return false
    if (item.type === 'skill' || item.type === 'spell') return !!item.system.isAttack && usableAlone(item) && !replaced.has(item.id)
    return false
  })
}

/** Join formula parts with +, dropping empty parts and a part's own leading + ("+1d2" from a Rank upgrade). */
export const joinFormula = (...parts: (string | undefined | null)[]) =>
  parts
    .map((part) => String(part ?? '').trim().replace(/^\+\s*/, ''))
    .filter(Boolean)
    .join('+')
    .replace(/\+\s*-/g, '-')

/** Explicit settings win; Aiming supplies its established defaults (its Rank on the roll, keep lower). */
export function damageEffectSettings(skill: { name: string; addRank?: boolean | null; mode?: string | null }) {
  const aiming = /^(aim|aiming)$/.test(normalize(skill.name))
  const mode = ['normal', 'advantage', 'disadvantage'].includes(String(skill.mode)) ? (skill.mode as RollModeName) : aiming ? 'disadvantage' : 'normal'
  return { addRank: skill.addRank ?? aiming, mode }
}

export type DamageMode = 'add' | 'multiplyDice' | 'multiplyTotal'
export const DAMAGE_MODES: DamageMode[] = ['add', 'multiplyDice', 'multiplyTotal']
/** Conditions a damage effect can have; more can join (each needs a check in conditionCheck and a label). */
export const CONDITION_TYPES = ['targetHealthAtMost'] as const
export type ConditionType = (typeof CONDITION_TYPES)[number]

export const damageModeOf = (mode: unknown): DamageMode => (DAMAGE_MODES.includes(mode as DamageMode) ? (mode as DamageMode) : 'add')

export type DamageEffectSkill = {
  name: string
  /** The item's id, so a ticked effect's cooldown can start. */
  id?: string
  rank: number
  effect: {
    enabled: boolean
    skills: string[]
    addRank?: boolean | null
    mode?: string | null
    damageMode?: string | null
    condition?: { type?: string | null; value?: string | null; rank5?: string | null; rank10?: string | null; rank15?: string | null } | null
  }
  /**
   * Damage at the skill's Rank: the part a Critical Hit doubles, and its Rank dice (added once); `tier`, the formula as
   * written for its Rank tier, is a multiplying effect's multiplier.
   */
  damage: { base: string; dice: string; tier?: string }
  /** Time left on the skill's running cooldown: it can't be ticked until then. */
  cooldown?: string | null
}

/** An attack's target, for conditions: its health as a percentage of its Health Bar (null when it has none). */
export type EffectTarget = { name: string; health: number | null }

/** A reason or note for the roll dialog: a lang key under CRAWLSPACE.DamageEffect and its data. */
export type EffectNote = { key: string; data?: Record<string, unknown> }

/** A target's health as a whole percentage of its Health Bar: a crawler's health, a mob's slots left of its slots. */
export function healthPercent(system: any): number | null {
  const pct = Number(system?.health?.pct)
  if (Number.isFinite(pct) && system?.health?.pct !== undefined && system?.health?.pct !== null) return Math.floor(pct)
  const value = Number(system?.healthBar?.value ?? system?.health?.value)
  const max = Number(system?.healthBar?.max ?? system?.health?.max)
  return Number.isFinite(value) && max > 0 ? Math.floor((value / max) * 100) : null
}

/**
 * Is a damage effect's condition met for these targets? Every target has to meet it (with none targeted it isn't).
 * No condition: always met, with no note.
 */
export function conditionCheck(condition: DamageEffectSkill['effect']['condition'], rank: number, targets: EffectTarget[]): { met: boolean; note?: EffectNote } {
  const type = String(condition?.type ?? '')
  if (type === 'targetHealthAtMost') {
    const threshold = rankNumber(tierValue(rank, { base: condition?.value, rank5: condition?.rank5, rank10: condition?.rank10, rank15: condition?.rank15 }), rank, 0)
    if (!targets.length) return { met: false, note: { key: 'Condition.NoTarget', data: { threshold } } }
    const above = targets.find((target) => target.health === null || target.health > threshold)
    if (above) return { met: false, note: { key: 'Condition.HealthAbove', data: { name: above.name, health: above.health ?? '?', threshold } } }
    return { met: true, note: { key: 'Condition.HealthMet', data: { threshold } } }
  }
  return { met: true }
}

/**
 * The base dice multiplied, the rest added after: "1d6+STR+2" ×3 is "(1d6)*3+STR+2" (Powerful Strike). Terms are split
 * at the top level only, so a parenthesized group with dice counts as dice.
 */
export function multiplyDice(formula: string, multiplier: number) {
  const source = String(formula ?? '').trim()
  if (!source || multiplier === 1) return source
  const terms: { sign: string; text: string }[] = []
  let depth = 0
  let current = ''
  let sign = '+'
  for (const char of source) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (depth === 0 && (char === '+' || char === '-')) {
      if (current.trim()) {
        terms.push({ sign, text: current.trim() })
        sign = char
      } else if (char === '-') sign = sign === '-' ? '+' : '-'
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) terms.push({ sign, text: current.trim() })
  const isDice = (text: string) => /\d*d\d+/i.test(text)
  const dice = terms.filter((term) => isDice(term.text))
  if (!dice.length) return source
  const rest = terms.filter((term) => !isDice(term.text))
  const join = (list: typeof terms) => list.map((term, index) => (index === 0 && term.sign === '+' ? term.text : `${term.sign}${term.text}`)).join('')
  const grouped = `(${join(dice)})*${multiplier}`
  return rest.length ? `${grouped}${rest.map((term) => `${term.sign}${term.text}`).join('')}` : grouped
}

/**
 * The formula a damage roll rolls (rolls.ts rollDamage): a Critical Hit doubles the base dice, but not the Rank dice or
 * effect bonuses (added once); an Amazing Hit adds the Floor. A ticked damage effect can multiply the base and Rank
 * dice before modifiers and buffs are added (Powerful Strike), or the whole of it (Choke Out). Blank: nothing to roll.
 */
export function damageRollFormula(
  damage: { formula?: string; rankDice?: string; undoubled?: string; diceMultiplier?: number; totalMultiplier?: number },
  options: { floor: number; tier?: 'normal' | 'amazing' | 'critical' },
) {
  const floor = options.floor
  let formula = resolveFormulaTokens(damage.formula ?? '', { floor })
  const rankDice = resolveFormulaTokens(damage.rankDice ?? '', { floor })
  const once = resolveFormulaTokens(damage.undoubled ?? '', { floor })
  if (!formula && !once && !rankDice) return ''
  if (options.tier === 'critical' && formula) formula = doubleDice(formula)
  formula = joinFormula(formula, rankDice)
  const diceTimes = Math.floor(Number(damage.diceMultiplier ?? 1))
  if (diceTimes !== 1 && Number.isFinite(diceTimes)) formula = multiplyDice(formula, diceTimes)
  formula = joinFormula(formula, once)
  if (options.tier === 'amazing' && floor) formula = `${formula}+${floor}`
  const totalTimes = Math.floor(Number(damage.totalMultiplier ?? 1))
  if (totalTimes !== 1 && Number.isFinite(totalTimes)) formula = `(${formula})*${totalTimes}`
  return formula
}

/** A multiplying damage effect skill's multiplier at its Rank (its damage formula for that Rank tier); null otherwise. */
export function effectMultiplier(system: any): number | null {
  if (!system?.damageEffect?.enabled || damageModeOf(system.damageEffect.damageMode) === 'add') return null
  return Math.max(0, rankNumber(system.damage?.tier ?? system.damage?.formula, Number(system.rank?.total) || 0, 1))
}

/** The attack roll toggles for an attack made with `attackSkill` at these targets. */
export function linkedDamageEffects(skills: DamageEffectSkill[], attackSkill: string, targets: EffectTarget[] = []) {
  const target = normalize(attackSkill)
  if (!target) return []
  return skills.flatMap((skill) => {
    if (!skill.effect.enabled || !skill.effect.skills.some((name) => normalize(name) === target)) return []
    if (!(skill.rank > 0)) return []
    const settings = damageEffectSettings({ name: skill.name, addRank: skill.effect.addRank, mode: skill.effect.mode })
    const damageMode = damageModeOf(skill.effect.damageMode)
    const multiplier = damageMode === 'add' ? 1 : Math.max(0, rankNumber(skill.damage.tier, skill.rank, 1))
    // A multiplying effect changes the damage; it adds none of its own.
    const damage = damageMode === 'add' ? String(skill.damage.base ?? '').trim() : ''
    const undoubled = damageMode === 'add' ? String(skill.damage.dice ?? '').trim() : ''
    const condition = conditionCheck(skill.effect.condition, skill.rank, targets)
    const unavailable: EffectNote | undefined = skill.cooldown ? { key: 'OnCooldown', data: { remaining: skill.cooldown } } : condition.met ? undefined : condition.note
    // An effect the dice can't do is still offered: it is applied by hand. One whose condition is met starts ticked.
    return [
      {
        label: skill.name,
        ...(skill.id ? { itemId: skill.id } : {}),
        value: settings.addRank ? skill.rank : 0,
        enabled: !unavailable && !!skill.effect.condition?.type && condition.met,
        ...(unavailable ? { unavailable } : {}),
        ...(condition.met && condition.note ? { conditionNote: condition.note } : {}),
        rollMode: settings.mode === 'normal' ? undefined : settings.mode,
        damage,
        undoubled,
        ...(damageMode === 'multiplyDice' ? { diceMultiplier: multiplier } : {}),
        ...(damageMode === 'multiplyTotal' ? { totalMultiplier: multiplier } : {}),
        skillRank: skill.rank,
      },
    ]
  })
}

/** Ticked effects constrain the roll: keep-lower wins, then keep-higher (damageEffectSkills.ts effectRollMode). */
export function toggledRollMode(mode: RollModeName, ticked: { rollMode?: RollModeName }[]): RollModeName {
  if (ticked.some((modifier) => modifier.rollMode === 'disadvantage')) return 'disadvantage'
  if (mode !== 'disadvantage' && ticked.some((modifier) => modifier.rollMode === 'advantage')) return 'advantage'
  return mode
}

/**
 * Advancement after an attack: with a damage effect ticked, only one of the skills used (the attack skill or a
 * damage effect skill) is marked. Marking an already marked skill gains nothing, so when only one is unmarked it
 * is marked without asking; when several are, the player chooses.
 */
export function advancementPick<T extends { id: string; marked: boolean }>(attack: T[], effects: T[]): { mark: T[]; choose: T[] } {
  if (!effects.length) return { mark: attack.filter((entry) => !entry.marked), choose: [] }
  const seen = new Set<string>()
  const unmarked = [...attack, ...effects].filter((entry) => !entry.marked && !seen.has(entry.id) && seen.add(entry.id))
  return unmarked.length === 1 ? { mark: unmarked, choose: [] } : { mark: [], choose: unmarked }
}

const plain = (html: unknown) =>
  String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

/**
 * A published skill names what it modifies in its first line ("Pugilism or Wrasslin' Damage Effect, Passive"), and
 * its extra damage in its text ("You deal +1d2 base damage", "+1d8 base damage + Str"). Null when it isn't one.
 */
export function damageEffectFromText(details: unknown): { skills: string[]; damage: string } | null {
  const text = plain(details)
  const header = /^(.+?)\s+Damage Effect\b/i.exec(text)
  if (!header || header[1].length > 120) return null
  const skills = header[1]
    .split(/\s*,\s*|\s+or\s+|\s+and\s+/i)
    .map((name) => name.replace(/^(or|and)\s+/i, '').trim())
    .filter(Boolean)
  // Only a list of skill names counts ("Choose the Iron Punch Damage Effect" in an attack skill's text doesn't).
  if (!skills.every((name) => /^[A-Z][\w'-]*(?: [A-Z][\w'-]*)*$/.test(name))) return null
  const bonus = /\+\s*(\d+d\d+)\s+base damage(?:\s*\+\s*(Str|Dex|Con|Int|Cha)\b)?/i.exec(text)
  const damage = bonus ? joinFormula(bonus[1], bonus[2] ? bonus[2].toUpperCase() : '') : ''
  return skills.length ? { skills, damage } : null
}

/** A skill whose text opens with "Ranged Attack" (the skills Aiming modifies). */
export const isRangedAttackText = (details: unknown) => /^Ranged Attack\b/i.test(plain(details))
