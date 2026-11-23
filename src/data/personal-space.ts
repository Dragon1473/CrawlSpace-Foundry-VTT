/**
 * Data models for Personal Spaces (rules/personal-space.ts): the `personalSpace` actor and its `spaceUpgrade` items.
 * Its crafting tables are ordinary `craftingTable` items (data/items.ts), their owner in `flags.crawlspace.spaceOwner`.
 */
import { MEMBER_ROLES, UPGRADE_KINDS } from '../rules/personal-space'

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
      level: integer(1, { min: 1, max: 5 }),
      /** Crawlers who use the space. Owners brought a space of their own into it (conjoined); members and guests didn't. */
      members: new fields.ArrayField(
        new fields.SchemaField({
          uuid: new fields.StringField({ required: true, blank: false }),
          role: new fields.StringField({ required: true, initial: 'owner', choices: [...MEMBER_ROLES] }),
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
      training: new fields.SchemaField({ hours: integer(0, { min: 0 }) }),
    }
  }
}
