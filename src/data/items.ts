import { rankCap } from '../effects/rank-cap'
import { GEAR_SLOTS } from '../config'
import { rankDie, splitRankDice } from '../rules/core'
import { stepsToTiers, tierValue } from '../rules/rank-values.ts'

const f = () => foundry.data.fields
const text = (initial = '') => new (f().StringField)({ required: true, blank: true, initial })
const html = () => new (f().HTMLField)({ required: true, blank: true })
const integer = (initial = 0, options: Record<string, unknown> = {}) =>
  new (f().NumberField)({ required: true, nullable: false, integer: true, initial, ...options })
const optionalNumber = () => new (f().NumberField)({ required: false, nullable: true, integer: true, initial: null })
const stringList = () => new (f().ArrayField)(new (f().StringField)({ blank: false }))

/** Where an entry came from in CrawlSpace (game or homebrew database), for re-imports and links. */
const sourceSchema = () =>
  new (f().SchemaField)({
    database: text(),
    id: optionalNumber(),
    book: text(),
    pages: text(),
  })

const common = () => ({ description: html(), notes: text(), source: sourceSchema() })

const damageSchema = () =>
  new (f().SchemaField)({
    formula: text(),
    types: stringList(),
    armorPiercing: new (f().BooleanField)(),
    magic: new (f().BooleanField)(),
    /** Hits an area (areaDamageHalf halves it for some targets). */
    area: new (f().BooleanField)(),
  })

/** A heal: slots restored, with formulas that replace it from Rank 5, 10 and 15 (healing.ts). */
const healingSchema = () =>
  new (f().SchemaField)({
    formula: text(),
    rank5: text(),
    rank10: text(),
    rank15: text(),
  })

/** RANK and RANK_DIE filled in for one Rank; floor and stat tokens wait for the roll. */
export const withRank = (formula: string, rank: number) =>
  String(formula ?? '')
    .replace(/\bRANK_DIE\b/gi, `(${rankDie(rank)})`)
    .replace(/\bRANK\b/gi, String(rank))

/** Shared by skills and spells: ranks, rank upgrades and their damage formulas. */
const rankedSchema = () => {
  const fields = f()
  return {
    ...common(),
    stat: text('DEX'),
    rank: new fields.SchemaField({
      value: integer(0, { min: 0 }),
      override: optionalNumber(),
      modOverride: optionalNumber(),
    }),
    checkType: text('Unopposed'),
    cooldown: text(),
    marked: new fields.BooleanField(),
    isAttack: new fields.BooleanField(),
    isUnarmed: new fields.BooleanField(),
    /** Which actions table a hotlisted spell (or skill) shows in; blank: both when its text mentions Interrupt. */
    actionKind: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'action', 'interrupt', 'both'] }),
    damage: damageSchema(),
    healing: healingSchema(),
    upgrades: new fields.SchemaField({
      rank5: text(),
      rank10: text(),
      rank15: text(),
      rank5Damage: text(),
      rank10Damage: text(),
      rank15Damage: text(),
      /** Cooldowns that replace the item's from Rank 5, 10 and 15 (a cooldown that shortens as the Rank rises). */
      rank5Cooldown: text(),
      rank10Cooldown: text(),
      rank15Cooldown: text(),
    }),
    /** Area templates by Rank tier (abilityTemplates.ts); empty uses the published ones for the name. */
    areas: new fields.ObjectField(),
  }
}

/** Effective rank and damage at that rank; the actor's rank bonuses come from ActiveEffects. */
function prepareRanked(model: any, kind: 'skill' | 'spell') {
  const actor = model.parent?.actor
  const name = String(model.parent?.name ?? '').trim().toLowerCase()
  const bonuses = actor?.system?.bonuses
  const baseBonus = Number(bonuses?.[kind === 'skill' ? 'baseSkillRanks' : 'baseSpellRanks']?.[name]) || 0
  const bonus = Number(bonuses?.[kind === 'skill' ? 'skillRanks' : 'spellRanks']?.[name]) || 0
  model.rank.cap = rankCap(actor, model.parent?.name ?? '')
  model.rank.base = Math.floor(Math.min(model.rank.cap, model.rank.value + baseBonus))
  model.rank.total = Math.max(0, Math.floor(Math.min(model.rank.cap, model.rank.override ?? model.rank.base + bonus)))
  model.rank.mod = Math.floor(model.rank.modOverride ?? (actor?.system?.statMod?.(model.stat) ?? 0))
  const rank = model.rank.total
  const up = model.upgrades ?? {}
  const upgraded = tierValue(rank, { base: model.damage.formula, rank5: up.rank5Damage, rank10: up.rank10Damage, rank15: up.rank15Damage })
  // The formula as written for this Rank tier (a multiplying damage effect reads its multiplier from it).
  model.damage.tier = upgraded
  model.damage.atRank = withRank(upgraded, rank)
  const split = splitRankDice(upgraded, rank)
  model.damage.baseAtRank = withRank(split.base, rank)
  model.damage.rankDice = split.dice
  const heal = model.healing ?? {}
  const healing = (rank >= 15 && heal.rank15) || (rank >= 10 && heal.rank10) || (rank >= 5 && heal.rank5) || heal.formula || ''
  model.healing.atRank = withRank(String(healing).trim(), rank)
  model.checkBonus = rank + model.rank.mod
  // The cooldown at this Rank: a Rank upgrade's, else the item's.
  model.cooldownAtRank = tierValue(rank, { base: model.cooldown, rank5: up.rank5Cooldown, rank10: up.rank10Cooldown, rank15: up.rank15Cooldown })
  // An Attack check is an attack, flagged or not (compendium attack spells and skills often aren't), so its rolls
  // carry damage and hotlisted attack spells join the Attacks table.
  if (String(model.checkType ?? '').trim().toLowerCase() === 'attack') model.isAttack = true
}

export class SkillData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      ...rankedSchema(),
      /**
       * A damage effect skill (damageEffectSkills.ts): an optional toggle on attacks made with the skills it names,
       * adding its damage at its Rank, and its Rank to the attack roll or a roll mode. Null/blank use the defaults
       * (Aiming: its Rank, keep lower). `damageMode` says how it changes the damage (rules/damage-effects.ts): add its
       * damage (blank), or multiply the base dice (Powerful Strike) or the total (Choke Out); a multiplier is written
       * in the skill's damage formula and its Rank upgrades' damage. A `condition` (the target's health at or below
       * `value`%, replaced from Rank 5, 10 and 15 by `rank5`… like the upgrades) ticks it on its own when met and makes
       * it unavailable when not.
       */
      damageEffect: new fields.SchemaField({
        enabled: new fields.BooleanField(),
        skills: stringList(),
        addRank: new fields.BooleanField({ required: false, nullable: true, initial: null }),
        mode: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'normal', 'advantage', 'disadvantage'] }),
        damageMode: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'add', 'multiplyDice', 'multiplyTotal'] }),
        condition: new fields.SchemaField({
          type: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'targetHealthAtMost'] }),
          value: text(),
          rank5: text(),
          rank10: text(),
          rank15: text(),
        }),
      }),
    }
  }
  /**
   * 0.9.8.43 kept a multiplier and threshold apart, as step text ("1: 2, 10: 4"): the multiplier moves into the damage
   * formula and its Rank upgrades, the threshold into the condition's Rank tiers.
   */
  static migrateData(source: any) {
    const effect = source?.damageEffect
    if (effect && 'multiplier' in effect) {
      const multiplier = String(effect.multiplier ?? '').trim()
      if (multiplier && ['multiplyDice', 'multiplyTotal'].includes(effect.damageMode)) {
        const tiers = stepsToTiers(multiplier) ?? { base: multiplier, rank5: '', rank10: '', rank15: '' }
        source.damage = { ...(source.damage ?? {}), formula: tiers.base }
        source.upgrades = { ...(source.upgrades ?? {}), rank5Damage: tiers.rank5, rank10Damage: tiers.rank10, rank15Damage: tiers.rank15 }
      }
      delete effect.multiplier
    }
    const steps = stepsToTiers(effect?.condition?.value)
    if (steps) effect.condition = { ...effect.condition, value: steps.base, rank5: steps.rank5, rank10: steps.rank10, rank15: steps.rank15 }
    return super.migrateData(source)
  }
  prepareDerivedData() {
    prepareRanked(this, 'skill')
  }
  /** Re-run by the owning actor once its ActiveEffects (rank bonuses) have applied. */
  prepareActorData() {
    prepareRanked(this, 'skill')
  }
}

export class SpellData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      ...rankedSchema(),
      stat: text('INT'),
      mana: text(),
      range: text(),
      duration: text(),
      cooldownUntil: optionalNumber(),
      killingBlowStacking: new fields.BooleanField(),
      killingBlowStacks: integer(0, { min: 0 }),
      killingBlowAt: optionalNumber(),
      killingBlowGameClock: optionalNumber(),
      killingBlowFloor: text(),
      usage: new fields.StringField({ required: true, initial: 'learned', choices: ['learned', 'inherent', 'scroll', 'tome'] }),
    }
  }
  prepareActorData() {
    prepareRanked(this, 'spell')
  }
  prepareDerivedData() {
    prepareRanked(this, 'spell')
    const cost = Number(String(this.mana).replace(/[^\d.-]/g, ''))
    this.manaCost = Number.isFinite(cost) ? Math.floor(cost) : 0
  }
}

/** Fields every physical item has. */
const physical = () => {
  const fields = f()
  return {
    ...common(),
    quantity: integer(1, { min: 0 }),
    equipped: new fields.BooleanField(),
    /** Broken gear: a broken shield can't Shield Block. The Repair skill (or the sheet) mends it. */
    broken: new fields.BooleanField(),
    tags: stringList(),
    /** Crafting reads it for the GM-approval rule (rules/crafting.ts RARITIES); blank is unrated. */
    rarity: text(),
    /** Gold value of one unit (homebrew). Only the GM sees it unless shown to players (rules/item-value.ts). */
    goldValue: integer(0, { min: 0 }),
  }
}

export class WeaponData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      ...physical(),
      weaponType: new fields.StringField({ required: true, initial: 'melee', choices: ['melee', 'ranged', 'thrown', 'ammunition', 'other'] }),
      hands: text(),
      twoHanded: new fields.BooleanField(),
      /** The hand it is held in while equipped (rules/hands.ts). */
      hand: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'main', 'off'] }),
      /** Name of the skill used to attack with this weapon. */
      skill: text(),
      ammunition: text(),
      damage: damageSchema(),
      armorDr: integer(0),
    }
  }
}

export class EquipmentData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      ...physical(),
      slot: new fields.StringField({ required: true, initial: 'torso', choices: Object.keys(GEAR_SLOTS) }),
      armorDr: integer(0),
      isShield: new fields.BooleanField(),
      /** A shield is held in the off hand (rules/hands.ts). */
      hand: new fields.StringField({ required: true, blank: true, initial: '', choices: ['', 'main', 'off'] }),
      /** DR a shield has lost to failed Shield Blocks; Repair restores it. */
      drLost: integer(0, { min: 0 }),
    }
  }
}

export class ConsumableData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      ...physical(),
      consumableType: text('other'),
      skill: text(),
      damage: damageSchema(),
      healing: new fields.SchemaField({ formula: text(), slots: new fields.BooleanField({ initial: true }) }),
      manaRestore: text(),
    }
  }
}

export class TattooData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    return { ...physical(), equipped: new (f().BooleanField)({ initial: true }), location: text() }
  }
}

export class LootData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    return { ...physical() }
  }
}

export class LootBoxData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      ...common(),
      quantity: integer(1, { min: 0 }),
      tier: text('Bronze'),
      boxType: text(),
      contents: text(),
      sealed: new fields.BooleanField({ initial: true }),
      /** Sealed contents (sealedLootBoxes.ts): gold and CrawlSpace inventory items, given out when opened. Empty boxes roll at opening. */
      loot: new fields.ObjectField({ required: false, nullable: true, initial: null }),
    }
  }
}

/** Racial, class and other abilities. Mechanics live on the item's ActiveEffects. */
export class AbilityData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      ...common(),
      category: new fields.StringField({ required: true, initial: 'other', choices: ['racial', 'class', 'other'] }),
      cooldown: text(),
    }
  }
}

/** Something a benefit or detriment names (build-links.ts): an item, effect or actor by UUID, or a damage type. */
const linkSchema = () =>
  new (f().SchemaField)({
    kind: new (f().StringField)({ required: true, initial: 'skill', choices: ['skill', 'spell', 'item', 'effect', 'actor', 'damage'] }),
    name: text(),
    uuid: text(),
    ref: text(),
  })

/** A benefit or detriment bought with build points (raceClassRules.ts createBuildEntry). */
const benefitSchema = () =>
  new (f().SchemaField)({
    templateId: text(),
    name: text(),
    tier: text(),
    count: integer(1, { min: 0 }),
    target: text(),
    description: text(),
    links: new (f().ArrayField)(linkSchema()),
  })

/** Bonus ranks in a skill or spell: `ref` is its CrawlSpace record ("game-40"), `uuid` a Foundry item dropped on the build. */
const rankBonusSchema = () =>
  new (f().SchemaField)({
    name: text(),
    ref: text(),
    uuid: text(),
    ranks: integer(1, { min: 0 }),
    training: new (f().StringField)({ required: true, initial: 'standard', choices: ['standard', 'passive', 'unusual', 'unusualPassive'] }),
    notes: text(),
  })

/**
 * The race and class point-buy build (RaceClassEditor.tsx, raceClassRules.ts). Stat, skill, spell and DR bonuses
 * become the item's "Build" ActiveEffect; benefits and detriments are described for the GM.
 */
const buildSchema = () => {
  const fields = f()
  return {
    statBonuses: new fields.SchemaField(Object.fromEntries(['str', 'int', 'con', 'dex', 'cha'].map((stat) => [stat, integer(0)]))),
    drBonus: integer(0),
    skillBonuses: new fields.ArrayField(rankBonusSchema()),
    spellBonuses: new fields.ArrayField(rankBonusSchema()),
    benefits: new fields.ArrayField(benefitSchema()),
    detriments: new fields.ArrayField(benefitSchema()),
    skillDetriments: new fields.ArrayField(
      new fields.SchemaField({ name: text(), ref: text(), uuid: text(), currentRank: optionalNumber(), penalty: integer(0, { min: 0 }), notes: text() }),
    ),
    statSkillDetriments: new fields.ArrayField(
      new fields.SchemaField({
        stat: new fields.StringField({ required: true, initial: 'str', choices: ['str', 'int', 'con', 'dex', 'cha'] }),
        penalty: integer(1, { min: 0 }),
        notes: text(),
      }),
    ),
    tags: text(),
  }
}

/** Fields whose change rebuilds the "Build" effect. */
export const BUILD_EFFECT_FIELDS = ['statBonuses', 'drBonus', 'skillBonuses', 'spellBonuses', 'benefits', 'detriments']

export class RaceData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    return {
      ...common(),
      ...buildSchema(),
      origin: new (f().StringField)({ required: true, blank: true, initial: 'Earth' }),
      size: text(),
      sizeName: text(),
      /** Earth races: the skill their Hobby Potion grants 3 ranks in. */
      hobbySkill: text(),
      /** Alien races: how representing the race can earn popularity. */
      popularity: text(),
    }
  }
}

export class ClassData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    return {
      ...common(),
      ...buildSchema(),
      earthClass: new (f().BooleanField)(),
      classTypes: text(),
      prerequisites: text(),
    }
  }
}

export class BackgroundData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      ...common(),
      stage: new fields.StringField({ required: true, initial: 'childhood', choices: ['childhood', 'adolescence', 'career', 'hobby'] }),
      /** Human or animal crawlers (the builder's species). */
      species: new fields.StringField({ required: true, initial: 'human', choices: ['human', 'animal'] }),
      /** The three skills a crawler picks two of in the character builder. */
      skills: new fields.ArrayField(new fields.StringField({ required: true, blank: true }), { initial: ['', '', ''] }),
    }
  }
}

/** What using an action does beyond posting it (actions-config.ts runAction). */
export const ACTION_BEHAVIORS = ['', 'check', 'evade', 'hotlist', 'hotlistHealing', 'move'] as const

/** A common combat action or interrupt (the Actions packs), dropped onto a crawler's actions tables. */
export class ActionData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      ...common(),
      kind: new fields.StringField({ required: true, initial: 'action', choices: ['action', 'interrupt'] }),
      behavior: new fields.StringField({ required: true, blank: true, initial: '', choices: [...ACTION_BEHAVIORS] }),
      /** Skills the check uses, comma separated, in order of preference (Look for Clues: Perception, Investigation). */
      skills: text(),
      /** Rolled when used (Intervene: 1d6). */
      formula: text(),
    }
  }
}

export class AchievementData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    return { ...common(), reward: text(), contents: text() }
  }
}

export class TrapData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    return { ...common(), trapType: text(), damage: damageSchema() }
  }
}

/** A crafting ingredient (Misc. Junk, monster parts, ores…). Liquids can't be salvaged from a failed craft. */
export class MaterialData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return { ...physical(), liquid: new fields.BooleanField(), categories: stringList() }
  }
}

/** A crafting table: its category, tier (its bonus to crafting checks) and named upgrades. */
export class CraftingTableData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      ...physical(),
      category: text('alchemy'),
      tier: integer(1, { min: 1, max: 10 }),
      upgrades: stringList(),
      /** It levels up by one each time its owner reaches a new floor (crafting.ts). */
      autoLevel: new fields.BooleanField({ initial: true }),
    }
  }
}

/**
 * A gear set (homebrew, rules/gear-sets.ts): its pieces, by name. Its ActiveEffects are the set bonuses, each needing
 * the number of pieces in its `crawlspace.setPieces` flag; a crawler with that many pieces equipped gets it.
 */
export class GearSetData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      ...common(),
      members: new fields.ArrayField(new fields.SchemaField({ name: text(), uuid: text(), img: text() })),
    }
  }
}

export const EQUIPPABLE_TYPES = new Set(['weapon', 'equipment', 'tattoo'])
