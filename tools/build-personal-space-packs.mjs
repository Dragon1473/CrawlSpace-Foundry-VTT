/**
 * The Personal Space compendiums (homebrew): upgrades, space levels, attachments, guild services and coupons
 * (homebrew-personal-space) and their roll tables (homebrew-space-tables). Written from tools/personal-space-catalog.mjs
 * → packs-src/<pack>/*.json (committed) → packs/<pack> (LevelDB).
 *
 *   npm run packs:space
 *
 * The crafting tables the tables roll are the tier-1 tables already in homebrew-items (Crafting folder).
 */
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, compile, foldersFor, keyify, stamp, writeSource } from './lib.mjs'
import { stableId } from '../src/import/convert.ts'
import { CATALOG, TABLES } from './personal-space-catalog.mjs'

const SRC = path.join(ROOT, 'packs-src')
const OUT = path.join(ROOT, 'packs')
const ITEMS = 'homebrew-personal-space'
const ROLLS = 'homebrew-space-tables'
// Only these two packs are rebuilt, so only they must be closed (Foundry may have the others open).
for (const name of [ITEMS, ROLLS]) {
  const dir = path.join(OUT, name)
  if (!fs.existsSync(dir)) continue
  try {
    fs.renameSync(dir, `${dir}.closed-check`)
    fs.renameSync(`${dir}.closed-check`, dir)
  } catch {
    throw new Error(`Foundry has ${name} open. Close the world using it and run this again. Nothing was changed.`)
  }
}
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'system.json'), 'utf8')).version

/** An upgrade's Advantage on named checks: an effect the crawler gets while in the space (actors/personal-space.ts). */
const advantageEffect = (entry) => ({
  name: `${entry.name}: Advantage`,
  img: entry.img,
  type: 'base',
  transfer: false,
  disabled: false,
  description: '',
  system: { changes: [{ key: `checkMode:${entry.advantage}`, type: 'crawlspace.rollMode', value: 'advantage', phase: 'initial' }], conditionType: 'buff' },
  flags: {},
})

const items = CATALOG.map((entry) => {
  const doc = {
    _id: stableId(`${ITEMS}/${entry.ref}`),
    name: entry.name,
    type: 'spaceUpgrade',
    img: entry.img,
    system: entry.system,
    effects: entry.advantage ? [advantageEffect(entry)] : [],
    flags: { crawlspace: { catalogRef: entry.ref } },
    _folderLabel: entry.folder,
  }
  return keyify(stamp(doc, version), 'items')
})
const itemFolders = foldersFor(items, 'Item', (doc) => doc._folderLabel, ITEMS)
for (const doc of items) delete doc._folderLabel
const byRef = new Map(CATALOG.map((entry, index) => [entry.ref, items[index]]))

// The tier-1 crafting tables in homebrew-items, by name.
const homebrewItems = path.join(SRC, 'homebrew-items')
const craftingTables = new Map(
  fs.readdirSync(homebrewItems)
    .map((file) => JSON.parse(fs.readFileSync(path.join(homebrewItems, file), 'utf8')))
    .filter((doc) => doc.type === 'craftingTable')
    .map((doc) => [doc.name, doc]),
)

const tableIds = new Map(TABLES.map(([name]) => [name, stableId(`${ROLLS}/${name}`)]))

function result(low, high, target) {
  const range = [low, high]
  const weight = high - low + 1
  if (typeof target === 'string') {
    const doc = byRef.get(target)
    if (!doc) throw new Error(`Unknown catalog entry ${target}`)
    return { type: 'document', name: doc.name, img: doc.img, documentUuid: `Compendium.crawlspace.${ITEMS}.Item.${doc._id}`, description: doc.system.summary, range, weight }
  }
  if (target.item) {
    const doc = craftingTables.get(target.item)
    if (!doc) throw new Error(`No crafting table named ${target.item} in homebrew-items`)
    return { type: 'document', name: doc.name, img: doc.img, documentUuid: `Compendium.crawlspace.homebrew-items.Item.${doc._id}`, description: '', range, weight }
  }
  if (target.table) {
    return { type: 'document', name: target.table, img: 'icons/svg/d20-grey.svg', documentUuid: `Compendium.crawlspace.${ROLLS}.RollTable.${tableIds.get(target.table)}`, description: '', range, weight }
  }
  return { type: 'text', name: target.text, img: 'icons/svg/d20-grey.svg', description: target.text, range, weight }
}

const tables = TABLES.map(([name, formula, rows]) =>
  keyify(
    stamp(
      {
        _id: tableIds.get(name),
        name,
        img: 'icons/svg/d20-grey.svg',
        description: '<p>Homebrew Personal Space reward table.</p>',
        formula,
        replacement: true,
        displayRoll: true,
        results: rows.map(([low, high, target]) => result(low, high, target)),
        flags: {},
      },
      version,
    ),
    'tables',
  ),
)

writeSource(path.join(SRC, ITEMS), [...itemFolders, ...items])
writeSource(path.join(SRC, ROLLS), tables)
await compile(path.join(SRC, ITEMS), path.join(OUT, ITEMS))
await compile(path.join(SRC, ROLLS), path.join(OUT, ROLLS))
console.log(`${ITEMS}: ${items.length} upgrades in ${itemFolders.length} folders; ${ROLLS}: ${tables.length} tables`)
