/**
 * Race, class, background and deity on the character tab: a button beside each field opens the compendiums that
 * hold them (official and homebrew), opened at the right folder; dropping one onto the sheet fills the field.
 * A race or class also brings its benefits and detriments as abilities.
 */
import { damageResponsesFromText } from '../rules/build-text'
import { effectPropertiesToActiveEffects } from '../effects/mapping'
import { findCompendiumEntry } from '../import/fill-damage'
import { databaseRows } from '../loot/database'
import { builderBackgroundOptions } from '../crawlspace-shared/shared/characterBuilder'
import type { BuilderStage } from '../crawlspace-shared/shared/characterBuilderCatalog'

const { DialogV2 } = foundry.applications.api

type BuildKind = 'race' | 'class' | 'background' | 'deity'

const SOURCES: Record<BuildKind, { packs: string[]; type: string; folders: (stage?: string) => string[] }> = {
  race: { packs: ['crawlspace-content.races-classes', 'crawlspace.homebrew-items'], type: 'race', folders: () => ['Races', 'Race'] },
  class: { packs: ['crawlspace-content.races-classes', 'crawlspace.homebrew-items'], type: 'class', folders: () => ['Classes', 'Class'] },
  background: {
    packs: ['crawlspace-content.backgrounds', 'crawlspace.homebrew-items'],
    type: 'background',
    folders: (stage) => [stage ? stage.charAt(0).toUpperCase() + stage.slice(1) : '', 'Backgrounds'].filter(Boolean),
  },
  deity: { packs: ['crawlspace-content.lore'], type: 'JournalEntry', folders: () => ['Deity', 'Deities'] },
}

/** Open every pack that holds this kind of entry, with only its folder expanded. */
export async function openBuildPacks(kind: BuildKind, stage?: string) {
  const source = SOURCES[kind]
  const wanted = source.folders(stage).map((name) => name.toLowerCase())
  const opened: Promise<unknown>[] = []
  for (const id of source.packs) {
    const pack = game.packs.get(id)
    if (!pack) continue
    if (pack.documentName === 'JournalEntry' && !(pack.folders ?? []).some((folder: any) => wanted.includes(String(folder.name).toLowerCase()))) continue
    if (pack.documentName === 'Item') {
      const index = await pack.getIndex({ fields: ['system.stage'] })
      const has = index.some((entry: any) => entry.type === source.type && (!stage || kind !== 'background' || entry.system?.stage === stage))
      if (!has) continue
    }
    for (const folder of pack.folders ?? []) {
      if (wanted.includes(String(folder.name).toLowerCase())) game.folders._expanded[folder.uuid] = true
      else delete game.folders._expanded[folder.uuid]
    }
    opened.push(pack.render(true))
  }
  if (!opened.length) ui.notifications.warn(game.i18n.format('CRAWLSPACE.Warn.NoBuildContent', { kind: game.i18n.localize(`CRAWLSPACE.Build.Kind${kind}`) }))
  return Promise.all(opened)
}

/** Abilities a race or class gives: one per benefit and detriment. */
export function buildAbilities(item: any) {
  const category = item.type === 'race' ? 'racial' : 'class'
  const entries = [
    ...(item.system.benefits ?? []).map((entry: any) => ({ entry, detriment: false })),
    ...(item.system.detriments ?? []).map((entry: any) => ({ entry, detriment: true })),
  ]
  return entries
    .filter(({ entry }) => String(entry.name ?? '').trim())
    .map(({ entry, detriment }) => {
      const target = String(entry.target ?? '').trim()
      const links = (entry.links ?? []).map((link: any) => link.name).filter(Boolean)
      const text = [entry.description, target && `${game.i18n.localize('CRAWLSPACE.Build.Target')}: ${target}`, links.length && links.join(', ')].filter(Boolean)
      // Damage responses written in the text (Immunity to Poison) become the ability's effect.
      const responses = damageResponsesFromText(`${entry.name} ${entry.description ?? ''}`)
      const effects = responses.length ? effectPropertiesToActiveEffects(responses, { name: entry.name.trim(), img: item.img, transfer: true }).effects : []
      return {
        name: entry.name.trim(),
        type: 'ability',
        img: item.img,
        effects,
        system: {
          category,
          description: text.map((line: string) => `<p>${foundry.utils.escapeHTML(String(line))}</p>`).join(''),
          notes: detriment ? game.i18n.localize('CRAWLSPACE.Build.Detriment') : '',
        },
        flags: { crawlspace: { grantedBy: item.name, detriment } },
      }
    })
}

/**
 * The skills and spells a race or class grants ranks in (its Build effect adds the ranks) that the crawler doesn't
 * have yet, from the compendium (official first) or as a blank entry when no compendium has it.
 */
async function grantedSkills(actor: any, item: any) {
  const out: any[] = []
  for (const [key, type] of [['skillBonuses', 'skill'], ['spellBonuses', 'spell']] as const)
    for (const bonus of item.system[key] ?? []) {
      const name = String(bonus.name ?? '').trim()
      if (!name || actor.items.some((owned: any) => owned.type === type && owned.name.toLowerCase() === name.toLowerCase())) continue
      if (out.some((entry) => entry.type === type && entry.name.toLowerCase() === name.toLowerCase())) continue
      const source = (bonus.uuid ? await fromUuid(bonus.uuid) : null) ?? (await findCompendiumEntry(type, name))
      const data: any = source ? game.items.fromCompendium(source) : { name, type, system: {} }
      // The race or class's ranks come from its Build effect, on top of a base of 0.
      foundry.utils.setProperty(data, 'system.rank.value', 0)
      foundry.utils.setProperty(data, 'flags.crawlspace.grantedBy', item.name)
      out.push(data)
    }
  return out
}

/**
 * A race or class dropped from a compendium or the sidebar: it replaces the crawler's current one (and the
 * abilities that came with it), fills the field, and adds its abilities.
 */
export async function applyBuildItem(actor: any, item: any) {
  const field = item.type === 'race' ? 'system.details.race' : 'system.details.className'
  const current = actor.items.filter((owned: any) => owned.type === item.type)
  if (current.length) {
    const ok = await DialogV2.confirm({
      window: { title: game.i18n.localize(`TYPES.Item.${item.type}`) },
      content: `<p>${game.i18n.format('CRAWLSPACE.Build.Replace', { old: current.map((owned: any) => foundry.utils.escapeHTML(owned.name)).join(', '), new: foundry.utils.escapeHTML(item.name) })}</p>`,
      rejectClose: false,
    })
    if (!ok) return null
    const names = new Set(current.map((owned: any) => owned.name))
    // Its abilities go, and so do the skills and spells it gave that were never ranked up.
    const granted = actor.items.filter(
      (owned: any) =>
        names.has(owned.flags?.crawlspace?.grantedBy) &&
        (owned.type === 'ability' || (['skill', 'spell'].includes(owned.type) && !(Number(owned._source.system?.rank?.value) > 0))),
    )
    await actor.deleteEmbeddedDocuments('Item', [...current, ...granted].map((owned: any) => owned.id))
  }
  const data = game.items.fromCompendium(item)
  const owned = new Set(actor.items.filter((entry: any) => entry.type === 'ability').map((entry: any) => entry.name.toLowerCase()))
  const abilities = buildAbilities(item).filter((ability) => !owned.has(ability.name.toLowerCase()))
  const skills = await grantedSkills(actor, item)
  const created = await actor.createEmbeddedDocuments('Item', [data, ...abilities, ...skills])
  await actor.update({ [field]: item.name })
  ui.notifications.info(game.i18n.format('CRAWLSPACE.Build.Added', { name: item.name, count: abilities.length, skills: skills.length }))
  return created
}

/** The rank a background's skills start at, by stage (Childhood/Youth 1, Adolescence/Training 1, Hobby/Quirk 2, Career/Adult 3). */
const STAGE_RANKS: Record<string, number> = { childhood: 1, adolescence: 1, career: 3, hobby: 2 }

const escape = (text: unknown) => foundry.utils.escapeHTML(String(text ?? ''))

/** Ask which two of a background's skills the crawler takes. Skills they already know can't be picked. Null when cancelled. */
async function chooseBackgroundSkills(actor: any, name: string, skills: string[], rank: number): Promise<string[] | null> {
  const known = new Set(actor.items.filter((owned: any) => owned.type === 'skill').map((owned: any) => owned.name.toLowerCase()))
  const need = Math.min(2, skills.filter((skill) => !known.has(skill.toLowerCase())).length)
  if (!need) return []
  const boxes = skills
    .map((skill, index) => {
      const has = known.has(skill.toLowerCase())
      return `<label class="checkbox"><input type="checkbox" name="skill${index}" value="${escape(skill)}" ${has ? 'disabled' : ''}> ${escape(skill)}${has ? ` <small>(${game.i18n.localize('CRAWLSPACE.Build.AlreadyKnown')})</small>` : ''}</label>`
    })
    .join('')
  const picked = await DialogV2.prompt({
    window: { title: game.i18n.format('CRAWLSPACE.Build.BackgroundSkillsTitle', { name }) },
    content: `<p>${game.i18n.format('CRAWLSPACE.Build.ChooseBackgroundSkills', { count: need, rank })}</p><div class="background-skill-choices">${boxes}</div>`,
    ok: {
      label: game.i18n.localize('CRAWLSPACE.Build.TakeSkills'),
      callback: (_event: Event, button: any) => [...button.form.querySelectorAll('input[type=checkbox]:checked')].map((input: any) => input.value),
    },
    // Exactly the needed number of skills: the rest lock once they're picked, and OK waits for them.
    render: (_event: Event, dialog: any) => {
      const root = dialog.element as HTMLElement
      const inputs = [...root.querySelectorAll<HTMLInputElement>('input[type=checkbox]')]
      const ok = root.querySelector<HTMLButtonElement>('button[data-action="ok"]')
      const sync = () => {
        const count = inputs.filter((input) => input.checked).length
        for (const input of inputs) if (!input.checked) input.disabled = count >= need || known.has(input.value.toLowerCase())
        if (ok) ok.disabled = count !== need
      }
      for (const input of inputs) input.addEventListener('change', sync)
      sync()
    },
    rejectClose: false,
  })
  return Array.isArray(picked) ? picked : null
}

/**
 * A background dropped on the crawler (or picked from the search button): choose two of its three skills, which
 * start at the stage's rank. It replaces the crawler's background for that stage, and the skills that one gave
 * which were never ranked up.
 */
export async function applyBackground(actor: any, item: any) {
  const stage = item.system?.stage ?? 'childhood'
  const rank = STAGE_RANKS[stage] ?? 1
  const skills = [...new Set<string>((item.system?.skills ?? []).map((skill: unknown) => String(skill ?? '').trim()).filter(Boolean))]
  const picked = await chooseBackgroundSkills(actor, item.name, skills, rank)
  if (!picked) return null
  const old = actor.items.filter((owned: any) => owned.type === 'background' && owned.system.stage === stage)
  const oldSkills = actor.items.filter(
    (owned: any) =>
      owned.type === 'skill' &&
      owned.flags?.crawlspace?.backgroundStage === stage &&
      Number(owned._source.system?.rank?.value) === Number(owned.flags?.crawlspace?.backgroundRank),
  )
  if (old.length || oldSkills.length) await actor.deleteEmbeddedDocuments('Item', [...old, ...oldSkills].map((owned: any) => owned.id))
  const granted: any[] = []
  for (const name of picked) {
    const source = await findCompendiumEntry('skill', name)
    const data: any = source ? game.items.fromCompendium(source) : { name, type: 'skill', system: {} }
    foundry.utils.setProperty(data, 'system.rank.value', rank)
    foundry.utils.mergeObject(data, { flags: { crawlspace: { grantedBy: item.name, backgroundStage: stage, backgroundRank: rank } } })
    granted.push(data)
  }
  const data = item instanceof foundry.abstract.Document ? game.items.fromCompendium(item) : foundry.utils.deepClone(item)
  const created = await actor.createEmbeddedDocuments('Item', [data, ...granted])
  await actor.update({ [`system.background.${stage}`]: item.name })
  if (granted.length) ui.notifications.info(game.i18n.format('CRAWLSPACE.Build.BackgroundAdded', { name: item.name, skills: picked.join(', '), rank }))
  return created
}

/**
 * The search button beside a background field: every background for that stage, the book's built-in ones plus
 * any in the world or a compendium (custom ones included), human and animal. Picking one applies it.
 */
export async function pickBackground(actor: any, stage: string) {
  const rows = (await databaseRows()) as any[]
  const groups = (['human', 'animal'] as const).map((species) => ({
    species,
    options: builderBackgroundOptions(rows, species, stage as BuilderStage),
  }))
  const choices = groups.flatMap(({ species, options }) => options.map((option) => ({ ...option, species })))
  if (!choices.length) return ui.notifications.warn(game.i18n.format('CRAWLSPACE.Warn.NoBuildContent', { kind: game.i18n.localize('CRAWLSPACE.Build.Kindbackground') }))
  const label = (species: string) => game.i18n.localize(`CRAWLSPACE.Builder.${species === 'animal' ? 'Animal' : 'Human'}`)
  const select = groups
    .filter(({ options }) => options.length)
    .map(({ species, options }) => {
      const items = options
        .map((option) => {
          const index = choices.findIndex((choice) => choice.species === species && choice.name === option.name)
          const tag = option.homebrew ? ` (${game.i18n.localize('CRAWLSPACE.Builder.Homebrew')})` : ''
          return `<option value="${index}">${escape(option.name)}${escape(tag)} — ${escape(option.skills.join(', '))}</option>`
        })
        .join('')
      return `<optgroup label="${escape(label(species))}">${items}</optgroup>`
    })
    .join('')
  const index = await DialogV2.prompt({
    window: { title: game.i18n.localize('CRAWLSPACE.Builder.ChooseBackground') },
    content: `<select name="background" style="width: 100%">${select}</select>`,
    ok: { label: game.i18n.localize('CRAWLSPACE.Build.UseBackground'), callback: (_event: Event, button: any) => Number(button.form.elements.background.value) },
    rejectClose: false,
  })
  const choice = typeof index === 'number' ? choices[index] : null
  if (!choice) return null
  // A world or compendium background is used as it is; a built-in one becomes a new background item.
  const row = rows.find((entry) => entry.content_type === `background_${stage}` && entry.name === choice.name && entry.data?.species === choice.species)
  const item = (row?.uuid ? await fromUuid(row.uuid) : null) ?? {
    name: choice.name,
    type: 'background',
    system: { stage, species: choice.species, skills: [...choice.skills] },
  }
  return applyBackground(actor, item)
}
