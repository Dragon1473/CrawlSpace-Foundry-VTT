/**
 * How neighborhood and borough pages read in a journal (the app's adventure preview). Linked documents become
 * @UUID links, which Foundry turns into content links that open and drag (onto the canvas, or the Atlas editor).
 */
import { NEIGHBORHOOD_SECTIONS, QUARTER_SECTIONS, paragraphs, type Field, type LinkEntry, type Section } from './model'

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const label = (name: string) => name.replace(/[{}\]]/g, '')
export const uuidLink = (uuid: string, name: string) => (uuid ? `@UUID[${uuid}]{${label(name || 'Untitled')}}` : escapeHtml(name || 'Untitled'))

function linkList(entries: LinkEntry[], field: Extract<Field, { type: 'links' }>) {
  if (!entries?.length) return ''
  const items = entries
    .map((entry) => {
      const extra = [field.quantity && entry.quantity > 1 ? `×${entry.quantity}` : '', field.weight && entry.weight > 1 ? `weight ${entry.weight}` : ''].filter(Boolean).join(' · ')
      return `<li>${uuidLink(entry.uuid, entry.name)}${extra ? ` <span class="journal-extra">${extra}</span>` : ''}${entry.notes ? `<div class="journal-entry-notes">${paragraphs(entry.notes)}</div>` : ''}</li>`
    })
    .join('')
  return `${title(field.label)}<ul class="journal-view-list">${items}</ul>`
}

function noteList(entries: any[], field: Extract<Field, { type: 'notes' }>) {
  if (!entries?.length) return ''
  const items = entries.map((entry) => `<li><strong>${entry.roll ? `${escapeHtml(entry.roll)}: ` : ''}${escapeHtml(entry.name || 'Untitled')}</strong>${paragraphs(entry.description)}</li>`).join('')
  return `${title(field.label)}<ul class="journal-view-list">${items}</ul>`
}

/** The section being drawn: a list under its section's own name needs no second heading. */
let sectionLabel = ''
const title = (label: string) => (label === sectionLabel ? '' : `<h4>${escapeHtml(label)}</h4>`)

/** A section's filled fields, or nothing when it is empty. */
function sectionView(data: any, section: Section, heading: string, skip: string[] = []) {
  sectionLabel = section.label
  const body = section.fields
    .filter((field) => !skip.includes(field.key))
    .map((field) => {
      const value = data?.[field.key]
      if (field.type === 'links') return linkList(value, field)
      if (field.type === 'notes') return noteList(value, field)
      if (field.type === 'text') return String(value ?? '').trim() ? `<p><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(value)}</p>` : ''
      if (!String(value ?? '').trim()) return ''
      // A single prose field under its section's own name needs no second heading.
      return section.fields.length === 1 || field.label === section.label ? paragraphs(value) : `<h4>${escapeHtml(field.label)}</h4>${paragraphs(value)}`
    })
    .join('')
  sectionLabel = ''
  return body ? `<section class="journal-view-section"><${heading}>${escapeHtml(section.label)}</${heading}>${body}</section>` : ''
}

export type QuarterExtras = { table?: string; battlemap?: { uuid: string; name: string } | null; zone?: string; boss?: boolean; bossLink?: string }

export function quarterView(quarter: any, extras: QuarterExtras = {}) {
  const about = QUARTER_SECTIONS[0]
  const sections = QUARTER_SECTIONS.slice(1).map((section) => sectionView(quarter, section, 'h3')).join('')
  const facts = [
    extras.bossLink ? `<p class="journal-boss-here"><i class="fa-solid fa-skull"></i> ${extras.bossLink}</p>` : '',
    extras.table ? `<p><a class="journal-roll-mobs" data-table="${escapeHtml(extras.table)}"><i class="fa-solid fa-dice-d20"></i> Roll a mob</a> · ${uuidLink(extras.table, 'Mob table')}</p>` : '',
    extras.battlemap ? `<p><i class="fa-solid fa-map"></i> Battlemap: ${uuidLink(extras.battlemap.uuid, extras.battlemap.name)}</p>` : '',
    extras.zone ? `<p><i class="fa-solid fa-map-location-dot"></i> Zone: ${escapeHtml(extras.zone)}</p>` : '',
  ].join('')
  return `<section class="journal-quarter" data-quarter="${escapeHtml(quarter.id)}">
    <h2>${escapeHtml(quarter.name || 'Unnamed quarter')}</h2>
    ${paragraphs(quarter.description)}${String(quarter.environment ?? '').trim() ? `<h3>${escapeHtml(about.fields[2].label)}</h3>${paragraphs(quarter.environment)}` : ''}
    ${facts}${sections}
  </section>`
}

/** The whole neighborhood: its own sections, the boss, then each quarter. */
export function neighborhoodView(system: any, quarterExtras: (quarter: any) => QuarterExtras = () => ({})) {
  const boss = system.boss?.uuid || system.boss?.name
  const bossQuarter = system.quarters?.find((quarter: any) => quarter.id === system.boss?.quarter)
  const bossBlock =
    boss || String(system.bossBattle ?? '').trim()
      ? `<section class="journal-view-section"><h2>Neighborhood Boss</h2>${boss ? `<p><strong>${uuidLink(system.boss.uuid, system.boss.name)}</strong>${bossQuarter ? ` (${escapeHtml(bossQuarter.name)})` : ''}</p>` : ''}${paragraphs(system.boss?.notes)}${String(system.bossBattle ?? '').trim() ? `<h4>Boss Battle</h4>${paragraphs(system.bossBattle)}` : ''}</section>`
      : ''
  const [summary, ...rest] = NEIGHBORHOOD_SECTIONS
  const quarters = (system.quarters ?? []).map((quarter: any) => quarterView(quarter, quarterExtras(quarter))).join('')
  const body = [
    sectionView(system, summary, 'h2'),
    bossBlock,
    ...rest.map((section) => sectionView(system, section, 'h2')),
    quarters ? `<section class="journal-view-section"><h2>Quarters</h2>${quarters}</section>` : '',
  ].join('')
  return body || '<p class="hint">This neighborhood is empty. Edit the page to fill it in.</p>'
}

export function boroughView(system: any, fieldGuide?: { journal: string; item: string }) {
  const boss = system.boss?.uuid || system.boss?.name ? `<section class="journal-view-section"><h2>Borough Boss</h2><p><strong>${uuidLink(system.boss.uuid, system.boss.name)}</strong></p>${paragraphs(system.boss.notes)}</section>` : ''
  const hoods = (system.neighborhoods ?? []) as LinkEntry[]
  const list = hoods.length ? `<section class="journal-view-section"><h2>Neighborhoods</h2><ul class="journal-view-list">${hoods.map((hood) => `<li>${uuidLink(hood.uuid, hood.name)}${hood.notes ? paragraphs(hood.notes) : ''}</li>`).join('')}</ul></section>` : ''
  const guide = fieldGuide?.journal ? `<section class="journal-view-section"><h2>Field Guide</h2><p>${uuidLink(fieldGuide.journal, 'Borough Field Guide')}${fieldGuide.item ? ` · ${uuidLink(fieldGuide.item, 'Field Guide item')}` : ''}</p></section>` : ''
  return `${paragraphs(system.summary)}${boss}${list}${guide}` || '<p class="hint">This borough is empty. Edit the page to fill it in.</p>'
}
