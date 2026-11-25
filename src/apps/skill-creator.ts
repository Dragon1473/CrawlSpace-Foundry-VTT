/**
 * The Skill Creator window (homebrew, the `skillCreator` world setting; rules/skill-creator.ts has the rules). It
 * follows the "Homebrew Skill Flow Chart" by diffendice & Dungeon Anarchists, shows the skills already made for the
 * same purpose in a compare box that autocompletes from every skill (reflavor instead?), and creates the skill in the world (GM) or on a crawler. Its "Roll a hobby" button,
 * and the "Make skill" button on a drawn hobby-table card, start a hobby skill from the Earth hobby tables.
 * Opened from the Items directory, a hobby card, or game.crawlspace.skillCreator.open().
 */
import { stableId } from '../import/convert'
import { EARTH_HOBBIES, THOUSAND_HOBBIES } from '../rules/hobby-lists'
import { CONDITION_TYPES, DAMAGE_MODES } from '../rules/damage-effects'
import {
  balanceHints,
  compareChoices,
  COOLDOWNS,
  CREDIT_URL,
  DAMAGE_TYPES,
  defaultAnswers,
  DICE,
  hobbyAnswers,
  INTENTS,
  skillItemData,
  STATS,
  TARGETS,
  type CompareSkill,
  type SkillAnswers,
} from '../rules/skill-creator'

const { DialogV2 } = foundry.applications.api
const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.SkillCreator.${key}`, data) : game.i18n.localize(`CRAWLSPACE.SkillCreator.${key}`))
const esc = (text: unknown) => foundry.utils.escapeHTML(String(text ?? ''))

export const skillCreatorOn = () => game.settings.get('crawlspace', 'skillCreator') !== false

const HOBBY_PACK = 'homebrew-hobby-tables'
const HOBBY_TABLES = ['Earth Hobbies (80)', '1000 Hobbies']
const hobbyTableIds = () => new Set(HOBBY_TABLES.map((name) => stableId(`${HOBBY_PACK}/${name}`)))

/** A random hobby from both lists (the 80 with a line, then the thousand by name). */
export function randomHobby(): { name: string; description: string } {
  const all = EARTH_HOBBIES.length + THOUSAND_HOBBIES.length
  const pick = Math.floor(Math.random() * all)
  if (pick < EARTH_HOBBIES.length) return { name: EARTH_HOBBIES[pick][0], description: EARTH_HOBBIES[pick][1] }
  return { name: THOUSAND_HOBBIES[pick - EARTH_HOBBIES.length], description: '' }
}

/** Every skill in the world and the Item compendiums, with the purpose the Creator tagged it with. */
async function allSkills(): Promise<CompareSkill[]> {
  const skills: CompareSkill[] = []
  for (const pack of game.packs) {
    if (pack.documentName !== 'Item') continue
    for (const entry of await pack.getIndex({ fields: ['flags.crawlspace.intent'] })) if (entry.type === 'skill') skills.push({ name: entry.name, uuid: entry.uuid, intent: entry.flags?.crawlspace?.intent })
  }
  for (const item of game.items) if (item.type === 'skill') skills.push({ name: item.name, uuid: item.uuid, intent: item.getFlag('crawlspace', 'intent') })
  return skills
}

function form(answers: SkillAnswers) {
  const option = (value: string | number, label: string, selected: boolean) => `<option value="${esc(value)}" ${selected ? 'selected' : ''}>${esc(label)}</option>`
  const intents = INTENTS.map((intent) => option(intent.id, t(`Intent.${intent.id}`), intent.id === answers.intent)).join('')
  const types = DAMAGE_TYPES.map((type) => option(type, type, type === answers.damageType)).join('')
  const dice = DICE.map((die) => option(die, `d${die}`, die === answers.die)).join('')
  const stats = STATS.map((stat) => option(stat, stat, stat === answers.stat)).join('')
  const cooldowns = COOLDOWNS.map((cooldown) => option(cooldown, t(`Cooldown.${cooldown}`), cooldown === answers.cooldown)).join('')
  const targets = TARGETS.map((target) => `<label class="checkbox"><input type="checkbox" name="targets" value="${target}" ${answers.targets.includes(target) ? 'checked' : ''}> ${esc(t(`Target.${target}`))}</label>`).join('')
  const check = (name: string, on: boolean, label: string) => `<label class="checkbox"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}> ${esc(label)}</label>`
  const de = (key: string) => game.i18n.localize(`CRAWLSPACE.DamageEffect.${key}`)
  const effectModes = DAMAGE_MODES.map((mode) => option(mode, de(`DamageModes.${mode}`), mode === answers.effectMode)).join('')
  const conditions = ['', ...CONDITION_TYPES].map((type) => option(type, de(`Conditions.${type || 'none'}`), type === answers.effectCondition)).join('')
  return `<div class="crawl-skill-creator" data-kind="${answers.kind}" data-effect="${answers.effect ? 'on' : ''}" data-effect-mode="${answers.effectMode}" data-effect-condition="${answers.effectCondition}">
    <p class="hint">${esc(t('Hint'))}</p>
    <div class="form-group"><label>${esc(t('Name'))}</label><div class="form-fields"><input type="text" name="name" value="${esc(answers.name)}"><button type="button" data-action-hobby title="${esc(t('RollHobbyHint'))}"><i class="fa-solid fa-dice"></i> ${esc(t('RollHobby'))}</button></div></div>
    <input type="hidden" name="hobby" value="${esc(answers.hobby ?? '')}">
    <fieldset><legend>${esc(t('Step.Want'))}</legend>
      <div class="form-group"><label>${esc(t('IntentLabel'))}</label><select name="intent">${intents}</select></div>
      <div class="form-group"><label>${esc(t('CompareLabel'))}</label><div class="form-fields"><input type="text" class="crawl-skill-compare" list="crawl-skill-compare-list" placeholder="${esc(t('ComparePlaceholder'))}" autocomplete="off"><a class="crawl-skill-compare-open" hidden data-tooltip="${esc(t('CompareOpen'))}"><i class="fa-solid fa-book-open"></i></a></div></div>
      <datalist id="crawl-skill-compare-list"></datalist>
      <p class="crawl-skill-compare-hint hint"></p>
    </fieldset>
    <fieldset><legend>${esc(t('Step.Kind'))}</legend>
      <div class="form-group"><label class="checkbox"><input type="radio" name="kind" value="attack" ${answers.kind === 'attack' ? 'checked' : ''}> ${esc(t('Attack'))}</label><label class="checkbox"><input type="radio" name="kind" value="utility" ${answers.kind === 'utility' ? 'checked' : ''}> ${esc(t('Utility'))}</label></div>
      <div class="crawl-attack-only">
        <div class="form-group"><label>${esc(t('Range'))}</label><select name="ranged">${option('', t('Melee'), !answers.ranged)}${option('1', t('Ranged'), answers.ranged)}</select></div>
        <div class="form-group"><label>${esc(t('With'))}</label><select name="unarmed">${option('', t('Weapon'), !answers.unarmed)}${option('1', t('Unarmed'), answers.unarmed)}</select></div>
        <div class="form-group"><label>${esc(t('Stat'))}</label><select name="attackStat">${option('DEX', 'DEX', answers.stat !== 'STR')}${option('STR', 'STR', answers.stat === 'STR')}</select></div>
        <div class="form-group"><label>${esc(t('DamageType'))}</label><select name="damageType">${types}</select></div>
        <div class="form-group"><label>${esc(t('Die'))}</label><select name="die">${dice}</select></div>
        <div class="form-group">${check('addStat', answers.addStat, t('AddStat'))}</div>
      </div>
      <div class="crawl-utility-only">
        <div class="form-group"><label>${esc(t('Stat'))}</label><select name="utilityStat">${stats}</select></div>
        <div class="form-group"><label>${esc(t('Range'))}</label><select name="utilityRanged">${option('', t('NotRanged'), !answers.ranged)}${option('1', t('Ranged'), answers.ranged)}</select></div>
        <div class="form-group"><label>${esc(t('Targets'))}</label><div class="form-fields crawl-skill-targets">${targets}</div></div>
      </div>
      <div class="form-group">${check('passive', answers.passive, t('Passive'))}</div>
    </fieldset>
    <fieldset class="crawl-skill-effect"><legend>${esc(t('Step.Effect'))}</legend>
      <div class="form-group">${check('effect', answers.effect, t('Effect'))}</div>
      <p class="hint">${esc(t('EffectHint'))}</p>
      <div class="crawl-effect-only">
        <div class="form-group"><label>${esc(de('Modifies'))}</label><input type="text" name="effectSkills" value="${esc(answers.effectSkills)}" placeholder="${esc(t('EffectSkillsHint'))}"></div>
        <div class="form-group"><label>${esc(de('DamageMode'))}</label><select name="effectMode">${effectModes}</select></div>
        <div class="form-group crawl-effect-multiplies"><label>${esc(de('Multiplier'))}</label><input type="text" name="effectMultiplier" value="${esc(answers.effectMultiplier)}" placeholder="@rank"></div>
        <div class="form-group"><label>${esc(de('ConditionLabel'))}</label><select name="effectCondition">${conditions}</select></div>
        <div class="form-group crawl-effect-conditional"><label>${esc(de('Threshold'))}</label><input type="text" name="effectThreshold" value="${esc(answers.effectThreshold)}" placeholder="1: 15, 5: 25, 10: 50, 15: 75"></div>
        <p class="hint">${esc(de('ScalingHint'))}</p>
      </div>
    </fieldset>
    <fieldset><legend>${esc(t('Step.Limits'))}</legend>
      <div class="form-group stacked"><label>${esc(t('Limitations'))}</label><textarea name="limitations" rows="2" placeholder="${esc(t('LimitationsHint'))}">${esc(answers.limitations)}</textarea></div>
      <div class="form-group"><label>${esc(t('CooldownLabel'))}</label><select name="cooldown">${cooldowns}</select><input type="number" name="cooldownAmount" min="1" step="1" value="${answers.cooldownAmount}"></div>
    </fieldset>
    <fieldset><legend>${esc(t('Step.Upgrades'))}</legend>
      ${(['rank5', 'rank10', 'rank15'] as const).map((rank) => `<div class="form-group"><label>${esc(t(`Upgrade.${rank}`))}</label><input type="text" name="${rank}" value="${esc(answers[rank])}" placeholder="${esc(t('UpgradeHint'))}"></div>`).join('')}
    </fieldset>
    <div class="form-group stacked"><label>${esc(t('Description'))}</label><textarea name="description" rows="3">${esc(answers.description)}</textarea></div>
    <fieldset class="crawl-skill-balance"><legend>${esc(t('Step.Balance'))}</legend><ul></ul></fieldset>
    <p class="crawl-skill-credit hint">${t('Credit', { link: `<a href="${CREDIT_URL}" target="_blank" rel="noopener">${esc(t('CreditLink'))}</a>` })}</p>
  </div>`
}

function read(root: HTMLElement): SkillAnswers {
  const value = (name: string) => (root.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.value ?? ''
  const checked = (name: string) => !!(root.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.checked
  const kind = (root.querySelector('[name="kind"]:checked') as HTMLInputElement | null)?.value === 'attack' ? 'attack' : 'utility'
  return {
    ...defaultAnswers(),
    name: value('name'),
    hobby: value('hobby') || undefined,
    intent: value('intent'),
    kind,
    ranged: kind === 'attack' ? !!value('ranged') : !!value('utilityRanged'),
    unarmed: !!value('unarmed'),
    stat: kind === 'attack' ? value('attackStat') : value('utilityStat'),
    damageType: value('damageType'),
    passive: checked('passive'),
    die: Number(value('die')),
    addStat: checked('addStat'),
    targets: [...root.querySelectorAll<HTMLInputElement>('[name="targets"]:checked')].map((input) => input.value),
    limitations: value('limitations'),
    cooldown: value('cooldown') as SkillAnswers['cooldown'],
    cooldownAmount: Number(value('cooldownAmount')),
    description: value('description'),
    rank5: value('rank5'),
    rank10: value('rank10'),
    rank15: value('rank15'),
    effect: checked('effect'),
    effectSkills: value('effectSkills'),
    effectMode: (value('effectMode') || 'add') as SkillAnswers['effectMode'],
    effectMultiplier: value('effectMultiplier'),
    effectCondition: value('effectCondition') as SkillAnswers['effectCondition'],
    effectThreshold: value('effectThreshold'),
  }
}

function itemData(answers: SkillAnswers) {
  const range = answers.kind === 'attack' ? `${t(answers.ranged ? 'Ranged' : 'Melee')}, ${t(answers.unarmed ? 'Unarmed' : 'Weapon')}` : t(answers.ranged ? 'Ranged' : 'NotRanged')
  const targets = `${t('Targets')}: ${answers.targets.map((target) => t(`Target.${target}`)).join(', ') || '-'}`
  return skillItemData(answers, { range, targets, limitations: `${t('Limitations')}:`, note: answers.hobby ? t('HobbyNote', { hobby: answers.hobby }) : t('Note') })
}

/** The folder world skills from the Creator go in. */
async function creatorFolder() {
  const name = t('Folder')
  return game.folders.find((folder: any) => folder.type === 'Item' && folder.name === name) ?? (await Folder.create({ name, type: 'Item' }))
}

/** Open the Skill Creator. With an actor, the skill goes on that crawler; else into the world (GM). */
export async function openSkillCreator(options: { actor?: any; answers?: Partial<SkillAnswers> } = {}) {
  if (!skillCreatorOn()) return ui.notifications.warn(t('Off'))
  const actor = options.actor ?? null
  if (actor ? !actor.isOwner : !game.user.isGM) return ui.notifications.warn(t('NoPermission'))
  const answers = { ...defaultAnswers(), ...options.answers }
  const result = await DialogV2.wait({
    window: { title: actor ? t('TitleFor', { name: actor.name }) : t('Title'), icon: 'fa-solid fa-wand-magic-sparkles' },
    position: { width: 560 },
    classes: ['crawlspace'],
    content: form(answers),
    buttons: [
      { action: 'create', label: t('Create'), icon: 'fa-solid fa-check', default: true, callback: (_event: Event, button: any) => read(button.form) },
      { action: 'cancel', label: t('Cancel'), icon: 'fa-solid fa-xmark' },
    ],
    rejectClose: false,
    render: (_event: Event, dialog: any) => {
      const root: HTMLElement = dialog.element
      const panel = root.querySelector<HTMLElement>('.crawl-skill-creator')!
      const compare = root.querySelector<HTMLInputElement>('.crawl-skill-compare')!
      const compareList = root.querySelector<HTMLDataListElement>('#crawl-skill-compare-list')!
      const compareOpen = root.querySelector<HTMLAnchorElement>('.crawl-skill-compare-open')!
      const compareHint = root.querySelector<HTMLElement>('.crawl-skill-compare-hint')!
      const skills = allSkills()
      let choices: CompareSkill[] = []
      const picked = () => choices.find((skill) => skill.name.toLowerCase() === compare.value.trim().toLowerCase())
      // The compare box isn't part of the skill: its typing only shows or hides the open button.
      compare.addEventListener('input', (event) => {
        event.stopPropagation()
        compareOpen.hidden = !picked()
      })
      compareOpen.addEventListener('click', async () => (await fromUuid(picked()?.uuid ?? ''))?.sheet?.render(true))
      const balance = root.querySelector<HTMLElement>('.crawl-skill-balance ul')!
      let shownIntent = ''
      const update = async () => {
        const current = read(root)
        panel.dataset.kind = current.kind
        panel.dataset.effect = current.effect ? 'on' : ''
        panel.dataset.effectMode = current.effectMode
        panel.dataset.effectCondition = current.effectCondition
        const hints = balanceHints(current)
        balance.innerHTML = hints.length ? hints.map((hint) => `<li>${esc(t(`Balance.${hint}`))}</li>`).join('') : `<li class="ok">${esc(t('Balance.Ok'))}</li>`
        if (current.intent === shownIntent) return
        shownIntent = current.intent
        choices = compareChoices(await skills, current.intent)
        compareList.replaceChildren(...choices.map((skill) => Object.assign(document.createElement('option'), { value: skill.name })))
        compareOpen.hidden = !picked()
        compareHint.textContent = current.intent === 'fight' ? t('CompareFight') : choices.length ? '' : t('CompareNone')
      }
      root.addEventListener('input', () => void update())
      root.addEventListener('change', () => void update())
      root.querySelector('[data-action-hobby]')?.addEventListener('click', () => {
        const hobby = randomHobby()
        ;(root.querySelector('[name="name"]') as HTMLInputElement).value = hobby.name
        ;(root.querySelector('[name="hobby"]') as HTMLInputElement).value = hobby.name
        const description = root.querySelector('[name="description"]') as HTMLTextAreaElement
        if (!description.value.trim() || description.dataset.fromHobby) {
          description.value = hobby.description
          description.dataset.fromHobby = '1'
        }
        void update()
      })
      void update()
    },
  })
  if (!result || typeof result !== 'object') return
  const data: any = itemData(result as SkillAnswers)
  let created: any
  if (actor) [created] = await actor.createEmbeddedDocuments('Item', [data])
  else created = await Item.create({ ...data, folder: (await creatorFolder())?.id })
  ui.notifications.info(t('Created', { name: data.name }))
  created?.sheet?.render(true)
  return created
}

/** A "Make skill" button on the chat card of a hobby drawn from the hobby tables. */
async function addHobbyButton(message: any, html: HTMLElement) {
  const tableId = message.getFlag('core', 'RollTable')
  if (!tableId || !skillCreatorOn() || html.querySelector('[data-crawl-hobby-skill]')) return
  const world = game.tables.get(tableId)
  if (!(world?.getFlag('crawlspace', 'hobbies') || hobbyTableIds().has(tableId))) return
  const table = world ?? (await fromUuid(`Compendium.crawlspace.${HOBBY_PACK}.RollTable.${tableId}`))
  for (const row of html.querySelectorAll<HTMLElement>('.table-results [data-result-id]')) {
    // The card's result id is often blank, so the hobby is matched by the name the row starts with.
    const text = row.textContent?.trim() ?? ''
    const result =
      table?.results?.get(row.dataset.resultId) ??
      [...(table?.results ?? [])].filter((entry: any) => entry.name && text.startsWith(entry.name)).sort((a: any, b: any) => b.name.length - a.name.length)[0]
    if (!result) continue
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.crawlHobbySkill = ''
    button.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${esc(t('MakeSkill'))}`
    button.addEventListener('click', () => {
      const speaker = game.actors.get(message.speaker?.actor)
      const actor = speaker?.isOwner && speaker.type === 'crawler' ? speaker : null
      void openSkillCreator({ actor, answers: hobbyAnswers(result.name, result.description?.replace(/<[^>]+>/g, '') ?? '') })
    })
    row.after(button)
  }
}

export const skillCreatorApi = { open: openSkillCreator, randomHobby, enabled: skillCreatorOn }

export function registerSkillCreator() {
  game.settings.register('crawlspace', 'skillCreator', {
    name: 'CRAWLSPACE.SkillCreator.Setting',
    hint: 'CRAWLSPACE.SkillCreator.SettingHint',
    scope: 'world',
    config: true,
    restricted: true,
    type: Boolean,
    default: true,
    onChange: () => ui.items?.render?.(),
  })
  Hooks.on('renderItemDirectory', (_app: any, html: HTMLElement) => {
    if (!game.user.isGM || !skillCreatorOn() || html.querySelector('[data-crawl-skill-creator]')) return
    const footer = html.querySelector('.directory-footer') ?? html
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.crawlSkillCreator = ''
    button.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${esc(t('Title'))}`
    button.addEventListener('click', () => void openSkillCreator())
    footer.append(button)
  })
  Hooks.on('renderChatMessageHTML', (message: any, html: HTMLElement) => void addHobbyButton(message, html))
}
