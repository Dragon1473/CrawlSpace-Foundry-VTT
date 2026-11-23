import { modLostFor, mobEvadeAfterLoss, mobToHitAfterLoss, type LossKind } from '../rules/mod-loss'
import { migrateMaster } from '../rules/follower-master'
import { KILL_KINDS, migrateKills } from '../rules/crawler-marks'
import { BOSS_TIERS, DAMAGE_TYPES, HEALTH_MAX, HEALTH_SLOTS, STAT_KEYS, statKeyFromCode, type StatKey } from '../config'
import { abilityScoreModifier, mobDerived, mobToHit, resolveFormulaTokens, safeArithmetic, type DamageResponse } from '../rules/core'
import { debuffById } from '../rules/debuffs'
import { DEITY_LEVELS, MOB_KINDS, isDeity, mobBaseStat, mobLevel, rebasedStats } from '../rules/mob-kinds'

const f = () => foundry.data.fields
const optionalNumber = (options: Record<string, unknown> = {}) =>
  new (f().NumberField)({ required: false, nullable: true, initial: null, ...options })
const integer = (initial = 0, options: Record<string, unknown> = {}) =>
  new (f().NumberField)({ required: true, nullable: false, integer: true, initial, ...options })
const text = (initial = '') => new (f().StringField)({ required: true, blank: true, initial })
const html = () => new (f().HTMLField)({ required: true, blank: true })
const stringSet = () => new (f().SetField)(new (f().StringField)({ required: true, blank: false }))

/** Per-stat storage: `value` is the unenhanced score; bonus fields are reset each prepare and filled by effects. */
function attributeSchema() {
  return new (f().SchemaField)(
    Object.fromEntries(
      STAT_KEYS.map((key) => [
        key,
        new (f().SchemaField)({
          value: optionalNumber({ integer: true }),
          override: optionalNumber({ integer: true }),
          modOverride: optionalNumber({ integer: true }),
        }),
      ]),
    ),
  )
}

function traitsSchema() {
  return new (f().SchemaField)({
    resistances: stringSet(),
    vulnerabilities: stringSet(),
    immunities: stringSet(),
    conditionImmunities: stringSet(),
  })
}

/** Shared derived-data helpers for every actor type. */
abstract class CrawlActorData extends foundry.abstract.TypeDataModel {
  [key: string]: any

  /** Clear everything effects add to before the "initial" ActiveEffect phase runs. */
  prepareBaseData() {
    for (const key of STAT_KEYS) {
      const attribute = this.attributes[key]
      attribute.bonus = 0
      attribute.modBonus = 0
      attribute.percentBonus = 0
      attribute.modLost = false
      attribute.modLostFor = []
    }
    this.bonuses = { skillRanks: {}, spellRanks: {}, baseSkillRanks: {}, baseSpellRanks: {}, healthSlots: {} }
    this.rollModes = []
    this.specials = []
    this.triggers = []
    this.mana ??= {}
    this.mana.bonus = 0
    this.dr ??= {}
    this.dr.bonus = 0
    // Iron Skin doubles DR (rules/debuffs.ts): a multiplier on the worked-out total, not on a GM's override.
    this.dr.factor = 1
    this.evade ??= {}
    this.evade.bonus = 0
    this.move ??= {}
    this.move.bonus = 0
    this.step ??= {}
    this.step.bonus = 0
    this.actions = { extra: 0 }
    this.hotlist ??= {}
    this.hotlist.bonus = 0
  }

  /** Stat totals and modifiers, honoring CrawlSpace's overrides. */
  protected prepareAttributes() {
    for (const key of STAT_KEYS) {
      const attribute = this.attributes[key]
      const hasBase = attribute.value !== null && attribute.value !== undefined
      attribute.total =
        attribute.override ?? (hasBase ? attribute.value + attribute.bonus + attribute.percentBonus : null)
      if (attribute.total !== null) attribute.total = Math.floor(attribute.total)
      const baseMod =
        attribute.modOverride ?? (attribute.total === null ? 0 : abilityScoreModifier(attribute.total))
      // fullMod keeps the modifier a Modifier Loss took away, so a mob's published numbers can drop by it.
      attribute.fullMod = Math.floor(baseMod + attribute.modBonus)
      attribute.mod = attribute.modLost ? 0 : attribute.fullMod
    }
  }

  statMod(key: StatKey | string): number {
    const stat = statKeyFromCode(String(key))
    return stat ? Number(this.attributes[stat]?.mod) || 0 : 0
  }

  /** A stat's modifier for one kind of roll: 0 when a Modifier Loss (Woozy) takes it away for that kind. */
  statModFor(key: StatKey | string, kind: LossKind): number {
    const stat = statKeyFromCode(String(key))
    return stat && !modLostFor(this.attributes[stat], kind) ? Number(this.attributes[stat]?.mod) || 0 : 0
  }

  /** Damage responses from traits, in the shape the damage rules expect. */
  get damageResponses(): DamageResponse[] {
    const out: DamageResponse[] = []
    for (const type of this.traits.resistances) out.push({ damageType: type, response: 'Resistance' })
    for (const type of this.traits.vulnerabilities) out.push({ damageType: type, response: 'Vulnerability' })
    for (const type of this.traits.immunities) out.push({ damageType: type, response: 'Immunity' })
    return out
  }

  /** Sum the flat check penalties of active debuffs (Fatigued, injuries, Sore as Shit). */
  protected checkPenaltyFromStatuses(statuses: Set<string>, stacksFor: (id: string) => number) {
    let penalty = 0
    for (const id of statuses) {
      const debuff = debuffById(id)
      if (debuff?.checkPenalty) penalty += debuff.checkPenalty * Math.max(1, debuff.stackable ? stacksFor(id) : 1)
    }
    return penalty
  }
}

/** A row in the crawler's Attacks table: links a weapon/skill/spell and can override its numbers. */
const crawlerAttackSchema = () => {
  const fields = f()
  return new fields.SchemaField({
    id: new fields.StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() }),
    name: text('Attack'),
    img: text(),
    /** Weapon, skill, spell or consumable on this actor that the attack uses. */
    sourceId: text(),
    /** Skill whose Rank and stat give the to-hit bonus (defaults to the weapon's skill). */
    skillId: text(),
    ammunitionId: text(),
    hitBonus: integer(0),
    /** Replaces the source's damage formula when set. */
    damage: text(),
    damageBonus: text(),
    damageTypes: new fields.ArrayField(new fields.StringField({ blank: false })),
    armorPiercing: new fields.BooleanField(),
    magic: new fields.BooleanField(),
    ranged: new fields.BooleanField(),
    area: new fields.BooleanField(),
    notes: text(),
  })
}

/** A row in the Actions or Interrupt Actions table. */
const sheetActionSchema = () => {
  const fields = f()
  return new fields.SchemaField({
    id: new fields.StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() }),
    kind: new fields.StringField({ required: true, initial: 'action', choices: ['action', 'interrupt'] }),
    name: text('Action'),
    img: text(),
    sourceId: text(),
    skillId: text(),
    formula: text(),
    notes: text(),
    /** From an Actions pack entry: what using it does, and the skills its check prefers. */
    behavior: text(),
    skills: text(),
  })
}

export class CrawlerData extends CrawlActorData {
  /** One boss count before boss tiers became neighborhood bosses (rules/crawler-marks.ts). */
  static migrateData(source: any) {
    if (source.kills) source.kills = migrateKills(source.kills)
    return super.migrateData(source)
  }
  

  static defineSchema() {
    const fields = f()
    return {
      attributes: attributeSchema(),
      health: new fields.SchemaField({
        value: integer(HEALTH_MAX, { min: 0, max: HEALTH_MAX }),
        /** Per-slot threshold overrides keyed by slot number 1–10. */
        overrides: new fields.TypedObjectField(new fields.NumberField({ integer: true, nullable: true })),
        dyingCountdown: optionalNumber({ integer: true }),
      }),
      shield: new fields.SchemaField({
        slots: new fields.ArrayField(new fields.BooleanField()),
      }),
      mana: new fields.SchemaField({ value: integer(0, { min: 0 }), override: optionalNumber({ integer: true }) }),
      dr: new fields.SchemaField({
        armor: integer(0),
        buff: integer(0),
        override: optionalNumber({ integer: true }),
      }),
      evade: new fields.SchemaField({ buff: integer(0), override: optionalNumber({ integer: true }) }),
      move: new fields.SchemaField({ override: optionalNumber({ integer: true }) }),
      step: new fields.SchemaField({ override: optionalNumber({ integer: true }) }),
      details: new fields.SchemaField({
        level: integer(1, { min: 0 }),
        floor: integer(1, { min: 0 }),
        crawlerNumber: text(),
        gender: text(),
        size: text(),
        race: text(),
        className: text(),
        deity: text(),
        sponsors: new fields.ArrayField(new fields.StringField({ blank: true }), { initial: ['', '', ''] }),
        aiFavor: new fields.NumberField({ initial: 0, required: true, nullable: false }),
        popularity: new fields.NumberField({ initial: 0, required: true, nullable: false }),
        gold: integer(0, { min: 0 }),
      }),
      background: new fields.SchemaField({
        childhood: text(),
        adolescence: text(),
        career: text(),
        hobby: text(),
      }),
      journal: new fields.SchemaField({
        pastTrauma: html(),
        looseEnds: html(),
        regrets: html(),
      }),
      importantKills: new fields.ArrayField(new fields.StringField({ blank: true })),
      /** The marks by the crawler's name: crawlers, leaderboard crawlers and bosses killed (rules/crawler-marks.ts). */
      kills: new fields.SchemaField(Object.fromEntries(KILL_KINDS.map((kind) => [kind.key, integer(0, { min: 0 })]))),
      clubs: new fields.ArrayField(new fields.StringField({ blank: true })),
      hotlist: new fields.SchemaField({ items: new fields.ArrayField(new fields.StringField({ blank: true })) }),
      attacks: new fields.ArrayField(crawlerAttackSchema()),
      sheetActions: new fields.ArrayField(sheetActionSchema()),
      /** DR an equipped shield has lost to damage; current Shield DR = max − lost. */
      shieldDr: new fields.SchemaField({ lost: integer(0, { min: 0 }) }),
      upkeep: new fields.SchemaField({
        pendingStatPoints: integer(0, { min: 0 }),
        allocatedThroughLevel: integer(1, { min: 0 }),
        lastSafeRoomLevel: integer(0, { min: 0 }),
      }),
      traits: traitsSchema(),
      biography: html(),
      /** Shown when someone Shift-hovers the token (rules/flavor.ts). */
      flavor: text(),
      notes: html(),
    }
  }

  prepareDerivedData() {
    this.prepareAttributes()
    const actor = this.parent
    const items = actor?.items ?? []

    // Max mana = enhanced INT + mana bonuses (vttTokenResources.ts).
    const int = this.attributes.int.total
    this.mana.max = Math.floor(this.mana.override ?? (int === null ? 0 : int + this.mana.bonus))
    this.mana.pct = this.mana.max > 0 ? Math.clamp((this.mana.value / this.mana.max) * 100, 0, 100) : 0

    // DR = armor (base + equipped armor DR) + current Shield DR + DR buffs (App.tsx automaticDrTotal).
    // Each shield keeps its own lost DR (drLost); `shieldDr.lost` is older data, moved onto the shield on ready.
    let equippedArmor = 0
    let shieldMax = 0
    let shieldLeft = 0
    for (const item of items) {
      // Broken armor and shields give no DR until repaired.
      if (item.type !== 'equipment' || !item.system?.equipped || item.system.broken) continue
      const dr = Number(item.system.armorDr) || 0
      if (item.system.isShield) {
        shieldMax += dr
        shieldLeft += Math.max(0, dr - (Number(item.system.drLost) || 0))
      } else equippedArmor += dr
    }
    this.shieldDr.max = shieldMax
    this.shieldDr.value = Math.clamp(shieldLeft - this.shieldDr.lost, 0, shieldMax)
    this.dr.armorTotal = Math.floor(this.dr.armor + equippedArmor)
    this.dr.total = Math.floor(this.dr.override ?? (this.dr.armorTotal + this.shieldDr.value + this.dr.buff + this.dr.bonus) * (Number(this.dr.factor) || 1))

    // Evade = DEX mod + Evade buffs.
    const hasDex = this.attributes.dex.total !== null || this.attributes.dex.modOverride !== null
    this.evade.total = Math.floor(this.evade.override ?? (hasDex ? this.statModFor('dex', 'evade') : 0) + this.evade.buff + this.evade.bonus)

    // Move = (20 + bonuses) × halving effects; Step = 10 + bonuses.
    const statuses: Set<string> = actor?.statuses ?? new Set()
    const halved = [...statuses].some((id) => debuffById(id)?.halveMove)
    this.move.total = Math.floor(this.move.override ?? (20 + this.move.bonus) * (halved ? 0.5 : 1))
    this.step.total = Math.floor(this.step.override ?? 10 + this.step.bonus)

    // Health slots: slot N (N = 10 down to 1, worth N×10%) is CON mod + slot health bonuses.
    const conMod = this.attributes.con.mod
    this.health.slots = Array.from({ length: HEALTH_SLOTS }, (_, index) => {
      const slot = HEALTH_SLOTS - index
      const override = this.health.overrides?.[String(slot)]
      const threshold = Math.floor(override ?? conMod + (Number(this.bonuses.healthSlots[String(slot)]) || 0))
      const percentage = slot * 10
      return { slot, percentage, threshold, filled: this.health.value > percentage }
    })
    this.health.pct = Math.clamp(this.health.value - 10, 0, 100)
    this.health.filledSlots = Math.max(0, Math.floor((this.health.value - 10) / 10))
    // Token bar: health as filled slots out of 10.
    this.healthBar = { value: this.health.filledSlots, max: HEALTH_SLOTS }
    this.shield.value = conMod
    this.shield.remaining = this.shield.slots.filter(Boolean).length

    this.checkPenalty = this.checkPenaltyFromStatuses(statuses, (id) => actor?.debuffStacks?.(id) ?? 1)
    this.hotlist.capacity = Math.max(0, 10 + Math.floor(this.hotlist.bonus))
    // Two actions a round, plus Extra Actions effects (encounterActions.ts), at most 20 extra.
    this.actions.total = 2 + Math.max(0, Math.min(20, Math.floor(Number(this.actions.extra) || 0)))
    this.isDying = statuses.has('dying')
  }

  getRollData() {
    const data: Record<string, unknown> = { floor: this.details.floor, F: this.details.floor }
    for (const key of STAT_KEYS) {
      data[key] = this.attributes[key].total ?? 0
      data[`${key}Mod`] = this.attributes[key].mod
    }
    data.level = this.details.level
    data.evade = this.evade.total
    data.dr = this.dr.total
    return data
  }
}

const mobAttackSchema = () => {
  const fields = f()
  return new fields.SchemaField({
    id: new fields.StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() }),
    name: text('Attack'),
    stat: text('STR'),
    damage: text(),
    damageTypes: new fields.ArrayField(new fields.StringField({ blank: false })),
    range: text(),
    publishedToHit: text(),
    aoeType: text(),
    areaFeet: text(),
    armorPiercing: new fields.BooleanField(),
    magic: new fields.BooleanField(),
    ranged: new fields.BooleanField(),
    failedDebuff: text(),
    notes: text(),
  })
}

/** Mobs, bosses and the stat blocks of hostile NPCs. */
export class MobData extends CrawlActorData {
  /** The crawler link used to live on `companion.master` (pets) and `minion.caster` (minions). */
  static migrateData(source: any) {
    migrateMaster(source)
    return super.migrateData(source)
  }

  static defineSchema() {
    const fields = f()
    return {
      /** Feral gods (level 150) and gods (level 250) are deities: boss-like, and a spinning star on the minimap. */
      kind: new fields.StringField({ required: true, initial: 'mob', choices: [...MOB_KINDS] }),
      /** A GM-run crawler kept on the mob sheet: it joins parties like a crawler (rules/party.ts isCrawler). */
      crawler: new fields.BooleanField({ initial: false }),
      /** An Elite acts once per crawler, like a boss; its token shows as an Elite once the GM reveals it. */
      elite: new fields.BooleanField({ initial: false }),
      /** Not a crawler and not one of the dungeon's residents (hunters, tourists): purple on the minimap. */
      outsider: new fields.BooleanField({ initial: false }),
      bossTier: new fields.StringField({ required: true, initial: 'Neighborhood', choices: Object.keys(BOSS_TIERS) }),
      level: integer(1, { min: 0 }),
      floor: integer(1, { min: 0 }),
      size: text(),
      type: text(),
      tags: text(),
      attributes: attributeSchema(),
      dr: new fields.SchemaField({ armor: integer(0) }),
      /** Published values may reference the floor, e.g. `16+F`. */
      evade: new fields.SchemaField({ published: text() }),
      move: new fields.SchemaField({ value: integer(20) }),
      surprise: text(),
      healthSlotsOverride: optionalNumber({ integer: true }),
      healthPerSlotOverride: optionalNumber({ integer: true }),
      abilities: new fields.ArrayField(new fields.SchemaField({ name: text(), description: text() })),
      /** UUID of the crawler it follows (a pet, mount, hired or raised minion); that crawler's players own it. */
      master: new fields.StringField({ required: true, blank: true }),
      /** Raised by a spell (minions.ts): a mob fighting for its master until it dies again or the spell ends. */
      minion: new fields.SchemaField({
        temporary: new fields.BooleanField(),
        /** Name of the raising condition, for the sheet and chat. */
        condition: text(),
      }),
      /** Health slots lost so far. */
      slotsLost: integer(0, { min: 0 }),
      attacks: new fields.ArrayField(mobAttackSchema()),
      traits: traitsSchema(),
      /** Shown when someone Shift-hovers the token (rules/flavor.ts). */
      flavor: text(),
      description: html(),
      notes: html(),
    }
  }

  /** A new mob with no stats starts each one at its kind's base: 1, or 5 for bosses and deities. */
  async _preCreate(data: any, options: any, user: any) {
    if ((await super._preCreate(data, options, user)) === false) return false
    const attributes = data.system?.attributes ?? {}
    const blank = STAT_KEYS.every((key) => {
      const stat = attributes[key] ?? {}
      return (stat.value ?? null) === null && (stat.override ?? null) === null && (stat.modOverride ?? null) === null
    })
    if (blank && this.parent?.type !== 'companion') {
      const base = mobBaseStat(data.system?.kind ?? this.kind)
      this.updateSource({ attributes: Object.fromEntries(STAT_KEYS.map((key) => [key, { value: base }])) })
    }
    if (isDeity(this.kind)) this.updateSource({ level: DEITY_LEVELS[this.kind] })
  }

  /** Becoming a deity sets its level; stats still at the old kind's base move to the new kind's base. */
  async _preUpdate(changes: any, options: any, user: any) {
    if ((await super._preUpdate(changes, options, user)) === false) return false
    const kind = changes.system?.kind
    if (kind === undefined || kind === this.kind || this.parent?.type === 'companion') return
    if (isDeity(kind)) foundry.utils.setProperty(changes, 'system.level', DEITY_LEVELS[kind])
    const current = Object.fromEntries(STAT_KEYS.map((key) => [key, changes.system?.attributes?.[key]?.value ?? this._source.attributes[key]?.value]))
    const rebased = rebasedStats(this.kind, kind, current)
    if (rebased) for (const [key, value] of Object.entries(rebased)) foundry.utils.setProperty(changes, `system.attributes.${key}.value`, value)
  }

  prepareDerivedData() {
    // A deity is always its kind's level.
    this.level = mobLevel(this.kind, this.level)
    this.prepareAttributes()
    const tier = BOSS_TIERS[this.bossTier as keyof typeof BOSS_TIERS] ?? BOSS_TIERS.Neighborhood
    const published = (value: string) => (value ? safeArithmetic(resolveFormulaTokens(value, { floor: this.floor })) : null)
    const derived = mobDerived({
      kind: this.kind,
      level: this.level,
      floor: this.floor,
      bossTier: tier,
      conMod: this.attributes.con.mod,
      dexMod: this.attributes.dex.mod,
      intMod: this.attributes.int.mod,
      publishedEvade: published(this.evade.published),
      publishedSurprise: published(this.surprise),
      publishedHealthSlots: this.healthSlotsOverride,
    })
    this.health = {
      max: derived.healthSlots,
      value: Math.max(0, derived.healthSlots - this.slotsLost),
      perSlot: this.healthPerSlotOverride ?? derived.healthPerSlot,
    }
    this.healthBar = { value: this.health.value, max: this.health.max }
    // Woozy and other Modifier Losses come off a mob's Evade and to-hit, published or not (rules/mod-loss.ts).
    const dex = this.attributes.dex
    const evade = mobEvadeAfterLoss({ evade: derived.evade, published: !!this.evade.published, fullMod: dex.fullMod, lostAll: !!dex.modLost, lostEvade: modLostFor(dex, 'evade') })
    this.evade.total = Math.floor(evade + this.evade.bonus)
    this.dr.total = Math.floor((this.dr.armor + this.dr.bonus) * (Number(this.dr.factor) || 1))
    this.move.total = Math.floor(this.move.value + this.move.bonus)
    this.surpriseTotal = derived.surprise
    this.statPoints = derived.statPoints
    this.baseStat = derived.baseStat
    const statuses: Set<string> = this.parent?.statuses ?? new Set()
    this.checkPenalty = this.checkPenaltyFromStatuses(statuses, (id) => this.parent?.debuffStacks?.(id) ?? 1)
    for (const attack of this.attacks) {
      const stat = this.attributes[statKeyFromCode(attack.stat || 'STR') ?? 'str']
      const published = !!String(attack.publishedToHit ?? '').trim()
      attack.toHit = mobToHitAfterLoss({
        toHit: mobToHit(attack.publishedToHit, this.statMod(attack.stat || 'STR'), this.floor),
        published,
        fullMod: stat?.fullMod ?? 0,
        lostAll: !!stat?.modLost,
        lostAttack: modLostFor(stat, 'attack'),
      })
    }
  }

  getRollData() {
    const data: Record<string, unknown> = { floor: this.floor, F: this.floor, level: this.level }
    for (const key of STAT_KEYS) {
      data[key] = this.attributes[key].total ?? 0
      data[`${key}Mod`] = this.attributes[key].mod
    }
    return data
  }
}

/**
 * A crawler's minion that isn't a raised mob: hired, summoned or otherwise its own creature. It uses the mob
 * sheet and follows the crawler in `master`. (Raised mobs stay mobs; see minions.ts.)
 */
export class MinionData extends MobData {}

/**
 * Pets, mounts and vehicles (mobRules.ts getMobDerived, CompanionFields.tsx). A creature sheet with 10 Health
 * slots: a pet's slots hold its CON modifier, a mount's or vehicle's its size (1–8). Evade is a set number,
 * not 10 + DEX. It belongs to a crawler, whose players own it.
 */
export class CompanionData extends MobData {
  static defineSchema() {
    const fields = f()
    return {
      ...super.defineSchema(),
      kind: new fields.StringField({ required: true, initial: 'pet', choices: ['pet', 'mount', 'vehicle'] }),
      size: text('4'),
      companion: new fields.SchemaField({
        occupants: text(),
        accessories: html(),
      }),
    }
  }

  prepareDerivedData() {
    super.prepareDerivedData()
    const whole = (value: unknown) => (Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0)
    const perSlot = this.kind === 'pet' ? this.attributes.con.mod : Math.min(8, Math.max(1, whole(this.size) || 4))
    const max = this.healthSlotsOverride ?? 10
    this.health = { max, value: Math.max(0, max - this.slotsLost), perSlot: this.healthPerSlotOverride ?? perSlot }
    this.healthBar = { value: this.health.value, max: this.health.max }
    this.evade.total = Math.floor(whole(this.evade.published) + this.evade.bonus)
  }
}

/** NPCs: a person first, with an optional linked Mob for their stat block. */
export class NpcData extends CrawlActorData {
  static defineSchema() {
    const fields = f()
    return {
      job: text(),
      race: text(),
      floor: integer(1, { min: 0 }),
      attributes: attributeSchema(),
      traits: traitsSchema(),
      /** An important NPC: a star instead of a dot on the minimap. */
      important: new fields.BooleanField({ initial: false }),
      /** UUID of a Mob actor whose stat block this NPC fights with. */
      statBlock: new fields.StringField({ required: true, blank: true }),
      /** Shown when someone Shift-hovers the token (rules/flavor.ts). */
      flavor: text(),
      description: html(),
      notes: html(),
    }
  }

  prepareDerivedData() {
    this.prepareAttributes()
    this.checkPenalty = 0
  }
}

export const DAMAGE_TYPE_CHOICES = Object.fromEntries(DAMAGE_TYPES.map((type) => [type, type]))
