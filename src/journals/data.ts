/** The neighborhood, borough and higher region (city, province, country, floor) journal page types' data, built from the field lists in model.ts. */
import { BOROUGH_SECTIONS, NEIGHBORHOOD_SECTIONS, QUARTER_SECTIONS, REGION_SECTIONS, type Section } from './model'

const f = () => foundry.data.fields
const text = () => new (f().StringField)({ required: true, blank: true, initial: '' })
const count = () => new (f().NumberField)({ required: true, nullable: false, integer: true, min: 1, initial: 1 })

const linkSchema = () => new (f().SchemaField)({ id: text(), uuid: text(), name: text(), notes: text(), quantity: count(), weight: count() })
const noteSchema = () => new (f().SchemaField)({ id: text(), name: text(), description: text(), roll: text() })

function fieldsOf(sections: Section[]) {
  const schema: Record<string, any> = {}
  for (const section of sections)
    for (const field of section.fields)
      schema[field.key] = field.type === 'links' ? new (f().ArrayField)(linkSchema()) : field.type === 'notes' ? new (f().ArrayField)(noteSchema()) : text()
  return schema
}

const bossSchema = () => new (f().SchemaField)({ uuid: text(), name: text(), notes: text(), quarter: text() })

/** A quarter of a neighborhood. Its mob table, generic battlemap and zone (on the atlas map) are kept by uuid or id. */
const quarterSchema = () => new (f().SchemaField)({ id: text(), ...fieldsOf(QUARTER_SECTIONS), mobTable: text(), battlemap: new (f().SchemaField)({ uuid: text(), name: text() }), zone: text() })

export class NeighborhoodPageData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    return {
      ...fieldsOf(NEIGHBORHOOD_SECTIONS),
      bossBattle: text(),
      boss: bossSchema(),
      quarters: new (f().ArrayField)(quarterSchema()),
      /** The scene this neighborhood is the map of: an atlas map (CrawlSpace Atlas), or one made from `mapImage`. */
      scene: new (f().SchemaField)({ uuid: text(), name: text() }),
      /** A plain image used as the map (journals/maps.ts). */
      mapImage: text(),
    }
  }
}

export class BoroughPageData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    return {
      ...fieldsOf(BOROUGH_SECTIONS),
      boss: bossSchema(),
      /** Neighborhood journals (or their pages), in order. */
      neighborhoods: new (f().ArrayField)(linkSchema()),
      /** The compiled Borough Field Guide journal and the item that gives it out. */
      fieldGuide: text(),
      fieldGuideItem: text(),
      /** A plain image used as the map, and the scene made from it (journals/maps.ts). */
      mapImage: text(),
      scene: new (f().SchemaField)({ uuid: text(), name: text() }),
    }
  }
}

/** A city, province, country or floor: the regions it holds, in order (CrawlSpace Atlas lays out their maps). */
export class RegionPageData extends foundry.abstract.TypeDataModel {
  [key: string]: any
  static defineSchema() {
    return {
      ...fieldsOf(REGION_SECTIONS),
      members: new (f().ArrayField)(linkSchema()),
      /** A plain image used as the map, and the scene made from it (journals/maps.ts). */
      mapImage: text(),
      scene: new (f().SchemaField)({ uuid: text(), name: text() }),
    }
  }
}
