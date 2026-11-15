/** The neighborhood and borough journal page types' data, built from the field lists in model.ts. */
import { BOROUGH_SECTIONS, NEIGHBORHOOD_SECTIONS, QUARTER_SECTIONS, type Section } from './model'

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
      /** The atlas scene this neighborhood is the map of (CrawlSpace Atlas). */
      scene: new (f().SchemaField)({ uuid: text(), name: text() }),
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
    }
  }
}
