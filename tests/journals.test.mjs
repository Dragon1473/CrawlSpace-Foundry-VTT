import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QUARTER_SECTIONS, fieldGuideName, fieldGuidePages, linkEntry, moveEntry, neighborhoodMapName, newQuarter, setPath, tableMobs, tableResults } from '../src/journals/model.ts'

test('a new quarter has every field the Add Quarter window offers, empty', () => {
  const quarter = newQuarter({ name: 'The Gut Market' })
  for (const section of QUARTER_SECTIONS)
    for (const field of section.fields) {
      if (field.key === 'name') continue
      assert.deepEqual(quarter[field.key], field.type === 'links' || field.type === 'notes' ? [] : '', field.key)
    }
  assert.equal(quarter.name, 'The Gut Market')
  assert.deepEqual(quarter.battlemap, { uuid: '', name: '' })
  assert.ok(quarter.id)
})

test('setPath edits nested lists without touching the original', () => {
  const data = { quarters: [newQuarter({ name: 'A' }), newQuarter({ name: 'B' })] }
  const next = setPath(data, 'quarters.1.mobs', [linkEntry({ name: 'Goblin' })])
  assert.equal(next.quarters[1].mobs[0].name, 'Goblin')
  assert.ok(Array.isArray(next.quarters))
  assert.deepEqual(data.quarters[1].mobs, [])
  assert.equal(setPath(next, 'quarters.1.mobs.0.notes', 'sneaky').quarters[1].mobs[0].notes, 'sneaky')
})

test('moveEntry moves within the list and ignores moves off either end', () => {
  assert.deepEqual(moveEntry([1, 2, 3], 0, 1), [2, 1, 3])
  assert.deepEqual(moveEntry([1, 2, 3], 2, 1), [1, 2, 3])
  assert.deepEqual(moveEntry([1, 2, 3], 0, -1), [1, 2, 3])
})

test('the mob table leaves out bosses and the neighborhood boss, and weights become ranges', () => {
  const mobs = [linkEntry({ uuid: 'Actor.goblin', name: 'Goblin', weight: 3 }), linkEntry({ uuid: 'Actor.boss', name: 'Big Boss' }), linkEntry({ uuid: 'Actor.hood', name: 'Hood Boss' }), linkEntry({ name: 'Rat swarm', weight: 2 })]
  const kept = tableMobs(mobs, 'Actor.hood', (uuid) => uuid === 'Actor.boss')
  assert.deepEqual(kept.map((mob) => mob.name), ['Goblin', 'Rat swarm'])
  const results = tableResults(kept)
  assert.deepEqual(results.map((result) => result.range), [[1, 3], [4, 5]])
  assert.equal(results[0].type, 'document')
  assert.equal(results[0].documentUuid, 'Actor.goblin')
  assert.equal(results[1].type, 'text')
})

test('item names follow "Borough Field Guide; Name" and "Neighborhood Map; Name"', () => {
  assert.equal(fieldGuideName('The Hollows'), 'Borough Field Guide; The Hollows')
  assert.equal(neighborhoodMapName('Gut Row'), 'Neighborhood Map; Gut Row')
})

test('the field guide has the borough, its boss, then each neighborhood followed by its quarters', () => {
  const entry = (name, uuid = '') => ({ uuid, name, description: '<p>desc</p>', notes: '' })
  const pages = fieldGuidePages({
    name: 'The Hollows',
    summary: 'A damp borough.\n\nWatch your step.',
    boss: entry('Queen Rot', 'Actor.q'),
    neighborhoods: [
      {
        name: 'Gut Row',
        summary: 'Markets.',
        overview: '',
        environment: 'Wet stone.',
        npcs: [entry('Mordecai', 'Actor.m')],
        traps: [],
        mobs: [entry('Goblin', 'Actor.g')],
        boss: entry('Butcher', 'Actor.b'),
        bossQuarter: 'The Gut Market',
        quarters: [{ name: 'The Gut Market', description: 'Stalls.', environment: '', npcs: [], traps: [entry('Pit')], mobs: [entry('Goblin', 'Actor.g')], bosses: [entry('Butcher', 'Actor.b')] }],
      },
    ],
  })
  assert.deepEqual(pages.map((page) => page.name), ['The Hollows', 'Boss: Queen Rot', 'Gut Row', 'Gut Row: The Gut Market'])
  assert.match(pages[0].content, /<p>A damp borough\.<\/p><p>Watch your step\.<\/p>/)
  assert.match(pages[2].content, /@UUID\[Actor\.b\]\{Butcher\}/)
  assert.match(pages[2].content, /The Gut Market/)
  assert.match(pages[3].content, /<h3>Traps<\/h3><ul><li><strong>Pit<\/strong>/)
  assert.match(pages[3].content, /<h3>Bosses<\/h3>/)
  assert.equal(pages[3].level, 2)
})
