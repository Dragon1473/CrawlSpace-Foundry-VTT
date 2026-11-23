/**
 * Homebrew database → packs-src/<pack>/*.json (committed) → packs/<pack> (LevelDB, built).
 *
 *   npm run packs:homebrew            read the homebrew database, rewrite packs-src, compile
 *   npm run packs:homebrew -- --offline   compile the committed packs-src without a database
 *
 * Either way, the homebrew records get the builder fixes below (attack flags, damage effects, and the starting skills
 * every crawler gets), and the character builder's homebrew backgrounds (characterBuilderCatalog.ts) are written into
 * homebrew-items' Backgrounds folder, so a world without the game compendium still has backgrounds to build from.
 */
import fs from 'node:fs'
import path from 'node:path'
import { convertRow } from '../src/import/convert.ts'
import { CRAFT_CATEGORIES } from '../src/rules/crafting.ts'
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

/**
 * Fixes to homebrew records, matched to the game's versions of the same skills: every Attack skill is an attack, and
 * each unarmed damage-effect skill names its attack and adds the game's damage. ("Passive damage effect for X" text
 * reads to the importer as an effect for a skill called "Passive".)
 */
const RECORD_FIXES = {
  'Grapple Artist': { rank5DamageFormula: '1d4+STR' },
  'Hammer Palm': { isDamageEffectSkill: true, damageEffectSkills: ['Palm Fighter'], damageFormula: '1d2' },
  'Stomp Shock': { isDamageEffectSkill: true, damageEffectSkills: ['Heel Striker'] },
  'Bone Rattle': { isDamageEffectSkill: true, damageEffectSkills: ['Shoulder Charger'], damageFormula: '1d4' },
  'Ground Slam': { isDamageEffectSkill: true, damageEffectSkills: ['Grapple Artist'], damageFormula: '1d8+STR' },
}

/**
 * Skills and the spell the builder gives every crawler, with the game's numbers and our own text, for worlds without
 * the game compendium. Ids sit far above the homebrew database's; a database record of the same name wins.
 */
const STARTING_RECORDS = [
  {
    id: 900001,
    content_type: 'skill',
    name: 'Unarmed Combat',
    data: {
      stat: 'STR', checkType: 'Attack', isAttackSkill: true, damageTypes: ['Bludgeoning'], damageFormula: '1d4+STR',
      rank5DamageFormula: '2d4+STR', rank10DamageFormula: '3d4+STR', rank15DamageFormula: '5d4+STR',
      details: 'Attack against Evade with fists, feet, knees or elbows. Every human crawler starts with it.',
      rank5: 'Add 1d4 base damage.', rank10: 'Add 1d4 base damage.', rank15: 'Add 2d4 base damage.',
    },
  },
  {
    id: 900002,
    content_type: 'skill',
    name: 'Slice Attack',
    data: {
      stat: 'DEX', checkType: 'Attack', isAttackSkill: true, damageTypes: ['Slashing'], damageFormula: '1d4+STR',
      rank5DamageFormula: '2d4+STR', rank10DamageFormula: '3d4+STR', rank15DamageFormula: '5d4+STR',
      details: 'Attack against Evade with claws, teeth or whatever edge your body has. Every animal crawler starts with it.',
      rank5: 'Add 1d4 base damage.', rank10: 'Add 1d4 base damage.', rank15: 'Add 2d4 base damage.',
    },
  },
  {
    id: 900003,
    content_type: 'spell',
    name: 'Heal',
    data: {
      stat: 'INT', checkType: 'Passive', mana: '2', range: 'Self', isHealing: true, healingUnit: 'slots', healingFormula: '2',
      details: 'Restore 2 Health Bar slots to yourself.',
    },
  },
]

/** What each starter table is for, in the system's own words. */
const TABLE_USES = {
  alchemy: 'Brew potions and poisons.',
  arcanist: 'Bind a spell into an item.',
  armorer: 'Make and improve armor.',
  engineering: 'Build things with moving parts, fluids or chemicals, such as ammunition.',
  metalworking: 'Forge and improve weapons.',
  sappers: 'Make explosives, and keep their parts stable.',
  writing: 'Write spell scrolls.',
  tattoo: 'Ink magical tattoos.',
  mundane: 'A sturdy workbench for everyday building.',
}

const TABLE_ICONS = {
  alchemy: 'icons/skills/toxins/cauldron-pot-bubbles-green.webp',
  arcanist: 'icons/skills/ranged/wand-attack-beam-blue.webp',
  armorer: 'icons/skills/trades/smithing-anvil-silver-red.webp',
  engineering: 'icons/tools/hand/wrench-adjustable-toothed.webp',
  metalworking: 'icons/skills/trades/smithing-anvil-brown.webp',
  sappers: 'icons/commodities/tech/smoke-bomb-red-yellow.webp',
  writing: 'icons/tools/scribal/ink-quill-red.webp',
  tattoo: 'icons/commodities/cloth/thread-and-needle.webp',
  mundane: 'icons/tools/hand/wrench-adjustable.webp',
}

applyBuilderFixes()
await writeBuilderBackgrounds(path.join(SRC, 'homebrew-items'))
writeCraftingStarters(path.join(SRC, 'homebrew-items'))

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
  const keep = new Set()
  for (const doc of [...(folder ? [folder] : []), ...docs]) {
    const prefix = doc._key.startsWith('!folders!') ? '_folder_' : ''
    const file = `${prefix}${slug(doc.name)}_${doc._id}.json`
    keep.add(file)
    write(path.join(dir, file), doc)
  }
  for (const { file, doc } of existing) if (doc.flags?.crawlspace?.builderBackground && !keep.has(file)) fs.rmSync(path.join(dir, file))
  console.log(`homebrew-items: ${docs.length} builder backgrounds`)
}

/**
 * Crafting starters in homebrew-items/Crafting: Misc. Junk (the material most recipes use) and a tier-1 table for each
 * crafting category, replacing the ones written last time. GMs put recipes on their own items.
 */
function writeCraftingStarters(dir) {
  fs.mkdirSync(dir, { recursive: true })
  const existing = fs.readdirSync(dir).map((file) => ({ file, doc: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) }))
  const physical = { notes: '', source: { database: 'homebrew', id: null, book: '', pages: '' }, quantity: 1, equipped: false, broken: false, tags: [], rarity: '' }
  const docs = [
    {
      name: 'Misc. Junk',
      type: 'material',
      img: 'icons/environment/settlement/rubble-scrap-refuse-wood-metal.webp',
      system: { ...physical, description: '<p>A drawer\'s worth of odds and ends you can\'t bring yourself to throw away. Most mundane crafting starts here.</p>', tags: ['junk'], rarity: 'common', liquid: false, categories: [] },
    },
    ...CRAFT_CATEGORIES.map((category) => ({
      name: `${category.label} Table`,
      type: 'craftingTable',
      img: TABLE_ICONS[category.id] ?? 'icons/tools/hand/wrench-adjustable.webp',
      system: { ...physical, description: `<p>${TABLE_USES[category.id] ?? ''}</p>`, category: category.id, tier: 1, upgrades: [], autoLevel: true },
    })),
  ].map((doc) => keyify(stamp({ ...doc, effects: [], flags: { crawlspace: { craftingStarter: true } } }, version), 'items'))
  const [folder] = foldersFor(docs, 'Item', () => 'Crafting', 'homebrew-items')
  const keep = new Set()
  for (const doc of [folder, ...docs]) {
    const prefix = doc._key.startsWith('!folders!') ? '_folder_' : ''
    const file = `${prefix}${slug(doc.name)}_${doc._id}.json`
    keep.add(file)
    write(path.join(dir, file), doc)
  }
  for (const { file, doc } of existing) if (doc.flags?.crawlspace?.craftingStarter && !keep.has(file)) fs.rmSync(path.join(dir, file))
  console.log(`homebrew-items: ${docs.length} crafting starters`)
}

function applyBuilderFixes() {
  const read = (dir) => fs.readdirSync(dir).map((file) => ({ file: path.join(dir, file), doc: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) }))
  const convert = (row, folder) => {
    const doc = keyify(stamp(convertRow(row, 'homebrew').data, version), 'items')
    if (folder) doc.folder = folder
    return doc
  }
  let fixed = 0
  // The game flags its attack skills but not its attack spells, so only skills are fixed.
  for (const { file, doc } of read(path.join(SRC, 'homebrew-skills'))) {
    const record = doc.flags?.crawlspace?.data
    const match = /^homebrew-(\d+)$/.exec(String(doc.flags?.crawlspace?.sourceId ?? ''))
    if (doc.type !== 'skill' || !record || !match || doc.flags.crawlspace.builderStart) continue
    const patch = { ...(record.checkType === 'Attack' ? { isAttackSkill: true } : {}), ...(RECORD_FIXES[doc.name] ?? {}) }
    if (!Object.keys(patch).length) continue
    if (write(file, convert({ id: Number(match[1]), content_type: 'skill', name: doc.name, data: { ...record, ...patch } }, doc.folder))) fixed++
  }
  const keep = new Set()
  let added = 0
  for (const record of STARTING_RECORDS) {
    const dir = path.join(SRC, record.content_type === 'spell' ? 'homebrew-spells' : 'homebrew-skills')
    if (read(dir).some(({ doc }) => doc.name === record.name && doc.type === record.content_type && !doc.flags?.crawlspace?.builderStart)) continue
    const doc = convert({ ...record, data: { name: record.name, ...record.data } })
    doc.flags.crawlspace.builderStart = true
    const file = path.join(dir, `${slug(doc.name)}_${doc._id}.json`)
    keep.add(file)
    if (write(file, doc)) added++
  }
  for (const pack of ['homebrew-skills', 'homebrew-spells'])
    for (const { file, doc } of read(path.join(SRC, pack))) if (doc.flags?.crawlspace?.builderStart && !keep.has(file)) fs.rmSync(file)
  console.log(`Builder fixes: ${fixed} homebrew records changed, ${added} starting skills and spells written`)
}

/** Writes a pack document unless the file already holds the same thing (its _stats aside), so rebuilds don't churn. */
function write(file, doc) {
  const strip = ({ _stats, ...rest }) => JSON.stringify(rest)
  if (fs.existsSync(file) && strip(JSON.parse(fs.readFileSync(file, 'utf8'))) === strip(doc)) return false
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`)
  return true
}
