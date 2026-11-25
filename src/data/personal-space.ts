/**
 * Data models for Personal Spaces (rules/personal-space.ts): the `personalSpace` actor and its `spaceUpgrade` items.
 * Its crafting tables are ordinary `craftingTable` items (data/items.ts), their owner in `flags.crawlspace.spaceOwner`.
 */
import { MEMBER_ROLES, TRAINING_SKILLS, UPGRADE_KINDS, USE_KINDS, conjoinedLevel, normalizeMembers, ownerLevels } from '../rules/personal-space'

const f = () => foundry.data.fields
const text = (initial = '') => new (f().StringField)({ required: true, blank: true, initial })
const html = () => new (f().HTMLField)({ required: true, blank: true })
const integer = (initial = 0, options: Record<string, unknown> = {}) =>
  new (f().NumberField)({ required: true, nullable: false, integer: true, initial, ...options })

export class PersonalSpaceData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      /** The space's own Level. Conjoined spaces work theirs out from their owners' levels (see prepareDerivedData). */
      level: integer(1, { min: 1, max: 5 }),
      /** The GM keeps the Level set by hand even when the space is conjoined. */
      levelLocked: new fields.BooleanField({ initial: false }),
      /** Crawlers who use the space. Owners brought a space of their own into it (conjoined); members and guests didn't. */
      members: new fields.ArrayField(
        new fields.SchemaField({
          uuid: new fields.StringField({ required: true, blank: false }),
          role: new fields.StringField({ required: true, initial: 'owner', choices: [...MEMBER_ROLES] }),
          /** An owner's: the Level of the space they brought when it was conjoined (0: not recorded). */
          spaceLevel: integer(0, { min: 0, max: 5 }),
        }),
      ),
      /** Scene the GM uses for the space's interior (optional; presence is the crawler's own toggle). */
      scene: text(),
      description: html(),
      notes: html(),
      /** Text carried over from the character sheet's old Personal Space fields. */
      legacy: new fields.SchemaField({ tier: text(), size: text() }),
    }
  }

  /** While two or more owners' spaces are conjoined, the Level comes from theirs (unless the GM locked it). */
  prepareDerivedData() {
    const joined = conjoinedLevel(ownerLevels(normalizeMembers(this.members)))
    this.conjoinedLevel = joined
    if (joined !== null && !this.levelLocked) this.level = joined
  }
}

export class SpaceUpgradeData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    const fields = f()
    return {
      description: html(),
      notes: text(),
      kind: new fields.StringField({ required: true, initial: 'upgrade', choices: [...UPGRADE_KINDS] }),
      category: text(),
      /** Upgrade Tier 1-4; 0 for none (features, coupons, guild services). */
      tier: integer(1, { min: 0, max: 4 }),
      floor: integer(4, { min: 0 }),
      price: integer(0, { min: 0 }),
      status: new fields.StringField({ required: true, initial: 'homebrew', choices: ['canon', 'homebrew'] }),
      footprint: text(),
      /** A space-level entry raises the space to this level when installed. */
      spaceLevel: integer(0, { min: 0, max: 5 }),
      /** The crawler (UUID) who owns it; it leaves with them. Blank: it belongs to the space. */
      owner: text(),
      installed: new fields.BooleanField({ initial: true }),
      /** An attachment's crafting table (item id in the same space); its name joins that table's upgrades. */
      attachedTo: text(),
      /** A one-line note of what the upgrade does, shown on the space's sheet. */
      summary: text(),
      rest: new fields.SchemaField({
        longRestHours: new fields.NumberField({ required: false, nullable: true, integer: true, initial: null, min: 0, max: 8 }),
        goodSleepHours: integer(0, { min: 0 }),
        shortRestSlots: integer(0, { min: 0 }),
      }),
      /** A training room: once a day per crawler (the Train action), `hours` grinding hours in each of up to `slots` skills it allows. */
      training: new fields.SchemaField({
        hours: integer(0, { min: 0 }),
        skills: new fields.StringField({ required: true, initial: 'any', choices: [...TRAINING_SKILLS] }),
        /** The highest skill Rank it trains (0: any). */
        maxRank: integer(0, { min: 0 }),
        slots: integer(1, { min: 1, max: 12 }),
        /** For `skills: 'named'`: the skills it trains, comma separated. */
        names: text(),
      }),
      /** A once-a-day amenity (the Use button): a meal (a stat bonus, extra Short Rest slots) or a wash (Advantage). */
      use: new fields.SchemaField({
        kind: new fields.StringField({ required: true, blank: true, initial: '', choices: [...USE_KINDS] }),
        statBonus: integer(0, { min: 0 }),
        restSlots: integer(0, { min: 0 }),
        hours: integer(0, { min: 0 }),
        /** Checks a wash gives Advantage on, comma separated. */
        advantage: text(),
      }),
      /** What it does to crafting in the space (rules/personal-space.ts craftOf). */
      craft: new fields.SchemaField({
        speed: integer(0, { min: 0, max: 90 }),
        batchHalf: new fields.BooleanField({ initial: false }),
        tierBoost: integer(0, { min: 0, max: 9 }),
        reroll: text(),
      }),
    }
  }
}
