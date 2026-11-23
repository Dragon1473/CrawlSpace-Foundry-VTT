/**
 * The Earth hobby roll tables (homebrew): homebrew-hobby-tables, from src/rules/hobby-lists.ts →
 * packs-src/homebrew-hobby-tables/*.json (committed) → packs/homebrew-hobby-tables (LevelDB).
 *
 *   npm run packs:hobbies
 *
 * A drawn hobby's chat card gets a "Make skill" button that opens the Skill Creator (apps/skill-creator.ts), which
 * knows these tables by their `crawlspace.hobbies` flag.
 */
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, compile, keyify, stamp, writeSource } from './lib.mjs'
import { stableId } from '../src/import/convert.ts'
import { EARTH_HOBBIES, THOUSAND_HOBBIES } from '../src/rules/hobby-lists.ts'

const PACK = 'homebrew-hobby-tables'
const SRC = path.join(ROOT, 'packs-src', PACK)
const OUT = path.join(ROOT, 'packs', PACK)
if (fs.existsSync(OUT)) {
  try {
    fs.renameSync(OUT, `${OUT}.closed-check`)
    fs.renameSync(`${OUT}.closed-check`, OUT)
  } catch {
    throw new Error(`Foundry has ${PACK} open. Close the world using it and run this again. Nothing was changed.`)
  }
}
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'system.json'), 'utf8')).version
const img = 'icons/sundries/gaming/dice-runed-brown.webp'

const table = (name, description, rows) =>
  keyify(
    stamp(
      {
        _id: stableId(`${PACK}/${name}`),
        name,
        img,
        description,
        formula: `1d${rows.length}`,
        replacement: true,
        displayRoll: true,
        results: rows.map(([hobby, detail], index) => ({
          _id: stableId(`${PACK}/${name}/${index}`),
          type: 'text',
          name: hobby,
          img,
          description: detail ?? '',
          range: [index + 1, index + 1],
          weight: 1,
          flags: { crawlspace: { hobby } },
        })),
        flags: { crawlspace: { hobbies: true } },
      },
      version,
    ),
    'tables',
  )

const tables = [
  table(
    'Earth Hobbies (80)',
    '<p>Eighty odd Earth hobbies with a line each, from the community "Earth Hobbies" sheet (four d20 tables; this table rolls them as one d80). Draw one, then use <strong>Make skill</strong> on the chat card to build the hobby skill with the Skill Creator.</p>',
    EARTH_HOBBIES,
  ),
  table(
    '1000 Hobbies',
    '<p>A thousand Earth hobbies, collected by Chorus of Sanctuary (pointmongo.com roll tables). Draw one, then use <strong>Make skill</strong> on the chat card to build the hobby skill with the Skill Creator.</p>',
    THOUSAND_HOBBIES.map((name) => [name, '']),
  ),
]

writeSource(SRC, tables)
await compile(SRC, OUT)
console.log(`${PACK}: ${tables.length} tables (${EARTH_HOBBIES.length} + ${THOUSAND_HOBBIES.length} hobbies)`)
