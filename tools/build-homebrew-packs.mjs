/**
 * Homebrew database → packs-src/<pack>/*.json (committed) → packs/<pack> (LevelDB, built).
 *
 *   npm run packs:homebrew            read the homebrew database, rewrite packs-src, compile
 *   npm run packs:homebrew -- --offline   compile the committed packs-src without a database
 *
 * Either way, the character builder's homebrew backgrounds (characterBuilderCatalog.ts) are written into
 * homebrew-items' Backgrounds folder, so a world without the game compendium still has backgrounds to build from.
 */
import fs from 'node:fs'
import path from 'node:path'
import { convertRow } from '../src/import/convert.ts'
import { ROOT, ITEM_TYPE_LABELS, assertPacksClosed, compile, foldersFor, keyify, loadCrawlSpaceEnv, readContent, slug, stamp, writeSource } from './lib.mjs'

const PACKS = ['homebrew-skills', 'homebrew-spells', 'homebrew-items']
const SRC = path.join(ROOT, 'packs-src')
const OUT = path.join(ROOT, 'packs')
assertPacksClosed(OUT)
const offline = process.argv.includes('--offline')
// Homebrew rows that stay out of the shipped packs: test entries, and content not written by the system's author.
const LEFT_OUT = new Set(['38', '39', '40', '47', '67', '1156'])
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'system.json'), 'utf8')).version

if (!offline) {
  loadCrawlSpaceEnv()
  const rows = await readContent(process.env.HOMEBREW_DATABASE_URL)
  const byPack = Object.fromEntries(PACKS.map((pack) => [pack, []]))
  const skipped = {}
  for (const row of rows) {
    if (LEFT_OUT.has(String(row.id))) continue
    const converted = convertRow(row, 'homebrew')
    // The system ships homebrew skills, spells and items only; other homebrew (mobs, quests...) stays out.
    if (!converted || converted.documentName !== 'Item') {
      skipped[row.content_type] = (skipped[row.content_type] ?? 0) + 1
      continue
    }
    const pack = converted.pack === 'skills' ? 'homebrew-skills' : converted.pack === 'spells' ? 'homebrew-spells' : 'homebrew-items'
    byPack[pack].push(keyify(stamp(converted.data, version), 'items'))
  }
  for (const pack of PACKS) {
    const docs = byPack[pack]
    const folders = pack === 'homebrew-items' ? foldersFor(docs, 'Item', (doc) => ITEM_TYPE_LABELS[doc.type], pack) : []
    writeSource(path.join(SRC, pack), [...folders, ...docs])
    console.log(`${pack}: ${docs.length} documents`)
  }
  if (Object.keys(skipped).length) console.log('Not shipped (not items):', skipped)
}

await writeBuilderBackgrounds(path.join(SRC, 'homebrew-items'))

for (const pack of PACKS) {
  const src = path.join(SRC, pack)
  if (!fs.existsSync(src)) {
    console.warn(`No source for ${pack}; run without --offline first.`)
    continue
  }
  await compile(src, path.join(OUT, pack))
}
console.log(`Compiled ${PACKS.length} packs into ${path.relative(ROOT, OUT)}/`)

/**
 * The builder's homebrew backgrounds as background items in homebrew-items/Backgrounds, replacing the ones written
 * last time. A background the homebrew database already has (same name and species) is left to the database.
 */
async function writeBuilderBackgrounds(dir) {
  // The catalog is the app's code, whose imports have no file extensions, so esbuild bundles it first.
  const { build } = await import('esbuild')
  const entry = path.join(ROOT, 'src', 'crawlspace-shared', 'shared', 'characterBuilderCatalog.ts')
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' })
  const { homebrewBackgrounds } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
  fs.mkdirSync(dir, { recursive: true })
  const existing = fs.readdirSync(dir).map((file) => ({ file, doc: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) }))
  for (const { file, doc } of existing) if (doc.flags?.crawlspace?.builderBackground) fs.rmSync(path.join(dir, file))
  const fromDatabase = new Set(existing.filter(({ doc }) => doc.type === 'background' && !doc.flags?.crawlspace?.builderBackground).map(({ doc }) => `${doc.system?.species}:${doc.name}`))
  const docs = homebrewBackgrounds
    .filter((background) => !fromDatabase.has(`${background.species}:${background.name}`))
    .map((background) =>
      keyify(
        stamp(
          {
            name: background.name,
            type: 'background',
            img: 'icons/svg/house.svg',
            system: { description: '', notes: '', source: { database: 'homebrew', id: null, book: '', pages: '' }, stage: background.stage, species: background.species, skills: background.skills },
            effects: [],
            flags: { crawlspace: { builderBackground: true } },
          },
          version,
        ),
        'items',
      ),
    )
  const [folder] = foldersFor(docs, 'Item', () => ITEM_TYPE_LABELS.background, 'homebrew-items')
  for (const doc of [...(folder ? [folder] : []), ...docs]) {
    const prefix = doc._key.startsWith('!folders!') ? '_folder_' : ''
    fs.writeFileSync(path.join(dir, `${prefix}${slug(doc.name)}_${doc._id}.json`), `${JSON.stringify(doc, null, 2)}
`)
  }
  console.log(`homebrew-items: ${docs.length} builder backgrounds`)
}
