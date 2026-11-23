/**
 * The party screen: everyone can open it (crawler frames header, the CarlRPG controls, or
 * game.crawlspace.openPartyScreen()). Two tabs, and a third while the party has a conjoined Personal Space:
 *
 * - Overview: a bigger crawler frame for each party crawler (the frames' own members, conditions, pets, mounts and
 *   minions), with its token, stars and skulls, race, class, Evade, DR, enhanced stats and unenhanced stat points.
 *   The crawler with the most unenhanced stat points leads the party and wears the crown. Clicking a name opens
 *   its details: AI favor, popularity, immunities, vulnerabilities, resistances, the paper doll, skills and
 *   spells. Under the cards, every skill and spell the party has, once each at the best rank, with a tooltip of
 *   who has it.
 * - Quests: the GM writes quests (a world setting, so every client has them). Players see the accepted (and
 *   completed) quests by name and reward and read the summary; the GM sees and edits every section, and drags
 *   mobs, bosses, traps, items, achievements, rewards and NPCs into theirs or adds them from a list of the
 *   world's and the compendiums'.
 * - Conjoined Space (apps/party-space.ts): the conjoined space's Level, members, upgrades, tables and description.
 */
import { partyCrawlers, playerPartyLabel, playerPartyName } from '../actors/party'
import { canLead, leaderActor, registerPartyLeader, setPartyName, setPartyTitle, titleOf } from '../actors/party-leader'
import { conditionsOf, followerFrames, marksOf } from './frames'
import { paperDollContext } from '../sheets/paper-doll'
import { healthColor } from '../rules/boss-bar'
import { STAT_KEYS, STATS } from '../config'
import { conjoinedSpacesOf, spaceOverview } from './party-space'
import { partySkills, signedRank, unenhancedTotal, type PartySkillKind } from '../rules/party-screen'
import {
  acceptsLink,
  cleanQuests,
  QUEST_LINK_SECTIONS,
  QUEST_STATUSES,
  QUEST_TEXT_FIELDS,
  questsFor,
  questSections,
  SECTION_LINKS,
  type Quest,
  type QuestLink,
  type QuestLinkKey,
} from '../rules/quests'

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api
const TextEditor = () => foundry.applications.ux.TextEditor.implementation

const APP_ID = 'crawl-party-screen'
const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.PartyScreen.${key}`, data) : game.i18n.localize(`CRAWLSPACE.PartyScreen.${key}`))
const esc = (value: unknown) => foundry.utils.escapeHTML(String(value ?? ''))

const storedQuests = () => cleanQuests(game.settings.get('crawlspace', 'quests'))

/** Change the quests (GM only) and save them for everyone. */
async function saveQuests(change: (quests: Quest[]) => Quest[] | void) {
  if (!game.user.isGM) return
  const quests = storedQuests()
  await game.settings.set('crawlspace', 'quests', change(quests) ?? quests)
}

const healthPct = (system: any) => {
  if (Number.isFinite(system.health?.pct)) return Math.floor(system.health.pct)
  const max = Number(system.health?.max) || 0
  return max > 0 ? Math.floor(Math.clamp((Number(system.health.value) || 0) / max, 0, 1) * 100) : 0
}

/** An actor's ranked skills or spells (inherent spells stay with abilities). */
const rankedItems = (actor: any, kind: PartySkillKind) =>
  actor.items
    .filter((item: any) => item.type === kind && (kind === 'skill' || item.system.usage !== 'inherent'))
    .map((item: any) => ({ id: item.id, name: item.name, img: item.img, kind, rank: Math.floor(Number(item.system.rank?.total ?? item.system.rank?.value) || 0) }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name))

const statusName = (id: string) => {
  const status = CONFIG.statusEffects.find((entry: any) => entry.id === id)
  return status ? game.i18n.localize(status.name) : id
}

/** What a member's card shows when its name is clicked. */
function memberDetails(actor: any, skills: any[], spells: any[]) {
  const system = actor.system
  const traits = system.traits ?? {}
  const list = (set: any) => [...(set ?? [])].map(String).sort((a, b) => a.localeCompare(b))
  return {
    aiFavor: Math.floor(Number(system.details?.aiFavor) || 0),
    popularity: Math.floor(Number(system.details?.popularity) || 0),
    immunities: [...list(traits.immunities), ...list(traits.conditionImmunities).map(statusName)],
    vulnerabilities: list(traits.vulnerabilities),
    resistances: list(traits.resistances),
    doll: paperDollContext(actor),
    skills: skills.map((skill) => ({ ...skill, rankLabel: signedRank(skill.rank) })),
    spells: spells.map((spell) => ({ ...spell, rankLabel: signedRank(spell.rank) })),
  }
}

/** Pick actors or items for a quest section from the world and every compendium. */
async function pickLinks(key: QuestLinkKey, taken: Set<string>): Promise<QuestLink[]> {
  const section = QUEST_LINK_SECTIONS.find((entry) => entry.key === key)!
  const candidates: (QuestLink & { source: string })[] = []
  const world = section.documentName === 'Actor' ? game.actors : game.items
  for (const doc of world) if (acceptsLink(key, doc)) candidates.push({ uuid: doc.uuid, name: doc.name, img: doc.img, source: t('World') })
  for (const pack of game.packs.filter((entry: any) => entry.documentName === section.documentName && entry.visible)) {
    try {
      const index = await pack.getIndex({ fields: ['img', 'type', 'system.kind'] })
      for (const row of index) {
        if (acceptsLink(key, { documentName: pack.documentName, type: row.type, system: row.system }))
          candidates.push({ uuid: row.uuid ?? `Compendium.${pack.collection}.${pack.documentName}.${row._id}`, name: row.name, img: row.img, source: pack.title })
      }
    } catch (error) {
      console.error(`CrawlSpace | quest picker: ${pack.collection}`, error)
    }
  }
  const open = candidates.filter((entry) => !taken.has(entry.uuid)).sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
  // DialogV2 takes an element with no attributes (and leaves its HTML uncleaned, so the checkboxes stay).
  const content = document.createElement('div')
  content.innerHTML = `<div class="crawl-link-picker"><input type="search" placeholder="${esc(t('Search'))}" aria-label="${esc(t('Search'))}">
    <ul>${open.map((entry, index) => `<li data-search="${esc(`${entry.name} ${entry.source}`.toLowerCase())}"><label><input type="checkbox" name="pick" value="${index}"><img src="${esc(entry.img || 'icons/svg/mystery-man.svg')}" alt="" loading="lazy"><span>${esc(entry.name)}</span><small>${esc(entry.source)}</small></label></li>`).join('')}</ul>
    ${open.length ? '' : `<p class="hint">${esc(t('NothingToAdd'))}</p>`}</div>`
  const picked = await DialogV2.prompt({
    classes: ['crawlspace', 'crawl-link-dialog'],
    window: { title: t('AddTitle', { section: t(`Link.${key}`) }), icon: 'fa-solid fa-plus' },
    position: { width: 460 },
    content,
    ok: { label: t('Add'), callback: (_event: Event, button: any) => [...button.form.querySelectorAll('input[name=pick]:checked')].map((input: any) => Number(input.value)) },
    render: (_event: Event, dialog: any) => {
      const search = dialog.element.querySelector('.crawl-link-picker input[type=search]')
      search?.addEventListener('input', () => {
        const words = String(search.value).toLowerCase().split(/\s+/).filter(Boolean)
        for (const row of dialog.element.querySelectorAll('.crawl-link-picker li')) row.hidden = !words.every((word: string) => row.dataset.search.includes(word))
      })
      search?.focus()
    },
    rejectClose: false,
  })
  return Array.isArray(picked) ? picked.map((index) => open[index]).filter(Boolean).map(({ uuid, name, img }) => ({ uuid, name, img })) : []
}

/** Ask for a crawler's party title and where it goes. */
async function promptTitle(actor: any) {
  if (!actor || !canLead()) return
  const title = titleOf(actor)
  const content = document.createElement('div')
  content.innerHTML = `<div class="crawl-title-dialog">
    <label class="crawl-dialog-field"><span>${esc(t('TitleLabel'))}</span><input type="text" name="text" value="${esc(title.text)}" maxlength="60" placeholder="${esc(t('TitleHint'))}" autofocus></label>
    <label class="crawl-dialog-field"><span>${esc(t('TitlePosition'))}</span><select name="position">${['before', 'after'].map((position) => `<option value="${position}" ${position === title.position ? 'selected' : ''}>${esc(t(`Position.${position}`))}</option>`).join('')}</select></label>
  </div>`
  const picked = await DialogV2.prompt({
    classes: ['crawlspace'],
    window: { title: t('TitleFor', { name: actor.name }), icon: 'fa-solid fa-signature' },
    content,
    ok: { label: t('Save'), callback: (_event: Event, button: any) => ({ text: button.form.elements.text.value, position: button.form.elements.position.value }) },
    rejectClose: false,
  })
  if (picked) await setPartyTitle(actor, picked)
}

class PartyScreen extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: any = {
    id: APP_ID,
    tag: 'form',
    classes: ['crawlspace', 'crawl-party-screen'],
    position: { width: 900, height: 760 },
    window: { title: 'CRAWLSPACE.PartyScreen.Title', icon: 'fa-solid fa-users-viewfinder', resizable: true },
    form: { handler: PartyScreen.#onSubmit, submitOnChange: true, closeOnSubmit: false },
    actions: {
      toggleMember: PartyScreen.#onToggleMember,
      openSheet: PartyScreen.#onOpenSheet,
      editItem: PartyScreen.#onOpenItem,
      selectQuest: PartyScreen.#onSelectQuest,
      addQuest: PartyScreen.#onAddQuest,
      deleteQuest: PartyScreen.#onDeleteQuest,
      addLink: PartyScreen.#onAddLink,
      removeLink: PartyScreen.#onRemoveLink,
      openLink: PartyScreen.#onOpenLink,
      addStage: PartyScreen.#onAddStage,
      removeStage: PartyScreen.#onRemoveStage,
    },
  }

  static PARTS = {
    tabs: { template: 'systems/crawlspace/templates/apps/party-tabs.hbs' },
    overview: { template: 'systems/crawlspace/templates/apps/party-overview.hbs', scrollable: [''] },
    quests: { template: 'systems/crawlspace/templates/apps/party-quests.hbs', scrollable: ['.quest-list', '.quest-detail'] },
    space: { template: 'systems/crawlspace/templates/apps/party-space.hbs', scrollable: [''] },
  }

  static TABS = {
    primary: { tabs: [{ id: 'overview' }, { id: 'quests' }, { id: 'space' }], initial: 'overview', labelPrefix: 'CRAWLSPACE.PartyScreen.Tab' },
  }

  /** Members whose details are open, and the quest being read. */
  #expanded = new Set<string>()
  #questId: string | null = null

  /** The Conjoined Space tab is there only while a party crawler is in a conjoined space. */
  _configureRenderParts(options: any) {
    const parts = super._configureRenderParts(options)
    if (!conjoinedSpacesOf(partyCrawlers()).length) {
      delete parts.space
      // A part left out of a render stays in the window, so take a stale one out.
      this.element?.querySelector('.party-space')?.remove()
    }
    return parts
  }

  _getTabsConfig(group: string) {
    const config = super._getTabsConfig(group)
    if (!config || group !== 'primary') return config
    const spaces = conjoinedSpacesOf(partyCrawlers())
    if (!spaces.length) {
      if (this.tabGroups.primary === 'space') this.tabGroups.primary = 'overview'
      return { ...config, tabs: config.tabs.filter((tab: any) => tab.id !== 'space') }
    }
    // One space: its tab carries its name.
    return { ...config, tabs: config.tabs.map((tab: any) => (tab.id === 'space' && spaces.length === 1 ? { ...tab, label: spaces[0].name } : tab)) }
  }

  get title() {
    return `${game.i18n.localize('CRAWLSPACE.PartyScreen.Title')}: ${playerPartyLabel()}`
  }

  async _preparePartContext(partId: string, context: any, options: any) {
    context = await super._preparePartContext(partId, context, options)
    if (context.tabs?.[partId]) context.tab = context.tabs[partId]
    context.gm = game.user.isGM
    context.canLead = canLead()
    if (partId === 'tabs') Object.assign(context, { tabList: Object.values(context.tabs ?? {}), partyName: playerPartyName(), partyLabel: playerPartyLabel(), fallback: game.i18n.localize('CRAWLSPACE.Frames.Title') })
    if (partId === 'overview') Object.assign(context, this.#overviewContext())
    if (partId === 'quests') Object.assign(context, await this.#questsContext())
    if (partId === 'space') context.spaces = await Promise.all(conjoinedSpacesOf(partyCrawlers()).map((space: any) => spaceOverview(space)))
    return context
  }

  #overviewContext() {
    const actors = partyCrawlers()
    const members = actors.map((actor: any) => {
      const system = actor.system
      const pct = healthPct(system)
      const mana = system.mana ?? {}
      const skills = rankedItems(actor, 'skill')
      const spells = rankedItems(actor, 'spell')
      const expanded = this.#expanded.has(actor.id)
      const title = titleOf(actor)
      return {
        id: actor.id,
        uuid: actor.uuid,
        name: actor.name,
        title: { ...title, before: !!title.text && title.position === 'before', after: !!title.text && title.position === 'after' },
        img: actor.prototypeToken?.texture?.src || actor.img,
        canOpen: !!actor.visible,
        ...marksOf(actor),
        level: system.details?.level ?? system.level ?? '—',
        race: system.details?.race || system.race || '—',
        className: system.details?.className || '—',
        evade: system.evade?.total ?? '—',
        dr: system.dr?.total ?? '—',
        stats: STAT_KEYS.map((key) => ({ code: STATS[key].code, label: STATS[key].label, total: system.attributes?.[key]?.total ?? '—', base: system.attributes?.[key]?.value ?? '—' })),
        unenhanced: unenhancedTotal(system.attributes),
        health: { pct, color: healthColor(pct) },
        mana: { value: mana.value ?? 0, max: mana.max ?? 0, pct: Math.floor(mana.pct ?? 0) },
        effects: conditionsOf(actor),
        followers: followerFrames(actor),
        expanded,
        details: expanded ? memberDetails(actor, skills, spells) : null,
        skills,
        spells,
      }
    })
    const leader = leaderActor(actors)
    for (const member of members as any[]) member.leader = member.id === leader?.id
    const skills = partySkills(members.map((member: any) => ({ name: member.name, skills: [...member.skills, ...member.spells] }))).map((skill) => ({
      ...skill,
      tooltip: `<strong>${esc(skill.name)}</strong><br>${skill.holders.map((holder) => `${esc(holder.name)}: ${esc(signedRank(holder.rank))}`).join('<br>')}`,
    }))
    return {
      members,
      partyName: playerPartyLabel(),
      partySkills: skills.filter((skill) => skill.kind === 'skill'),
      partySpells: skills.filter((skill) => skill.kind === 'spell'),
    }
  }

  async #questsContext() {
    const gm = game.user.isGM
    const quests = questsFor(storedQuests(), gm)
    const selected = quests.find((quest) => quest.id === this.#questId) ?? null
    const list = quests.map((quest) => ({
      id: quest.id,
      name: quest.name || t('Untitled'),
      reward: quest.reward,
      status: quest.status,
      statusLabel: t(`Status.${quest.status}`),
      active: quest.id === selected?.id,
    }))
    if (!selected) return { quests: list, quest: null }
    const enrich = (html: string) => TextEditor().enrichHTML(html ?? '', { secrets: gm })
    const sections: any[] = []
    for (const key of questSections(gm)) {
      const section: any = { key, label: t(`Section.${key}`) }
      if ((QUEST_TEXT_FIELDS as readonly string[]).includes(key)) {
        Object.assign(section, { text: true, raw: (selected as any)[key], enriched: await enrich((selected as any)[key]) })
      } else if (key === 'stages') {
        Object.assign(section, { isStages: true, stages: selected.stages })
      } else {
        section.groups = (SECTION_LINKS[key] ?? []).map((linkKey) => ({ key: linkKey, label: t(`Link.${linkKey}`), links: selected[linkKey] }))
      }
      sections.push(section)
    }
    return {
      quests: list,
      quest: { ...selected, displayName: selected.name || t('Untitled'), statusLabel: t(`Status.${selected.status}`) },
      statuses: QUEST_STATUSES.map((status) => ({ value: status, label: t(`Status.${status}`), selected: status === selected.status })),
      sections,
    }
  }

  _onFirstRender(context: any, options: any) {
    super._onFirstRender(context, options)
    // Right-click anywhere on a crawler's card: the leader (or GM) gives it a title.
    new foundry.applications.ux.ContextMenu.implementation(
      this.element,
      '.party-member',
      [
        {
          label: 'CRAWLSPACE.PartyScreen.SetTitle',
          icon: '<i class="fa-solid fa-signature"></i>',
          visible: () => canLead(),
          onClick: (_event: Event, target: HTMLElement) => promptTitle(game.actors.get(target.closest<HTMLElement>('[data-member-id]')?.dataset.memberId)),
        },
      ],
      { jQuery: false, fixed: true },
    )
  }

  _onRender(context: any, options: any) {
    super._onRender(context, options)
    if (!game.user.isGM) return
    for (const zone of (this.element as HTMLElement).querySelectorAll<HTMLElement>('[data-link-key]')) {
      if (zone.dataset.dropBound) continue
      zone.dataset.dropBound = '1'
      zone.addEventListener('dragover', (event) => {
        event.preventDefault()
        zone.classList.add('drop-hover')
      })
      zone.addEventListener('dragleave', () => zone.classList.remove('drop-hover'))
      zone.addEventListener('drop', (event) => {
        event.preventDefault()
        event.stopPropagation()
        zone.classList.remove('drop-hover')
        this.#onDropLink(event, zone.dataset.linkKey as QuestLinkKey)
      })
    }
  }

  /** Re-render only what changed, so the GM's open editors in the other tab are left alone. */
  refreshPart(...parts: ('tabs' | 'overview' | 'quests' | 'space')[]) {
    if (!this.rendered) return
    // The space tab can come or go with the party's spaces: then redraw it all.
    const hasSpace = !!this.element.querySelector('.party-space')
    if (hasSpace !== conjoinedSpacesOf(partyCrawlers()).length > 0) return this.render()
    this.render({ parts: hasSpace ? parts : parts.filter((part) => part !== 'space') })
  }

  async #onDropLink(event: DragEvent, key: QuestLinkKey) {
    const data: any = TextEditor().getDragEventData(event)
    if (!data?.uuid || !this.#questId) return
    const doc: any = await fromUuid(data.uuid)
    if (!doc) return
    if (!acceptsLink(key, doc)) return ui.notifications.warn(t('WrongKind', { name: doc.name, section: t(`Link.${key}`) }))
    await this.#addLinks(key, [{ uuid: doc.uuid, name: doc.name, img: doc.img }])
  }

  async #addLinks(key: QuestLinkKey, links: QuestLink[]) {
    const id = this.#questId
    await saveQuests((quests) => {
      const quest = quests.find((entry) => entry.id === id)
      if (!quest) return
      const have = new Set(quest[key].map((link) => link.uuid))
      quest[key].push(...links.filter((link) => !have.has(link.uuid)))
    })
  }

  static async #onSubmit(this: PartyScreen, _event: Event, _form: HTMLFormElement, formData: any) {
    const data = foundry.utils.expandObject(formData.object)
    if (canLead()) {
      if (typeof data.partyName === 'string' && data.partyName.trim() !== playerPartyName()) await setPartyName(data.partyName)
      for (const [id, title] of Object.entries<any>(data.titles ?? {})) {
        const actor = game.actors.get(id)
        const current = titleOf(actor)
        if (actor && (String(title?.text ?? '').trim() !== current.text || (title?.position ?? current.position) !== current.position)) await setPartyTitle(actor, { ...current, ...title })
      }
    }
    if (!game.user.isGM) return
    const id = data.questId
    const changes = data.quest
    if (!id || !changes) return
    await saveQuests((quests) => {
      const quest: any = quests.find((entry) => entry.id === id)
      if (!quest) return
      for (const field of ['name', 'reward', 'status', ...QUEST_TEXT_FIELDS]) if (field in changes) quest[field] = String(changes[field] ?? '')
      if (changes.stages) for (const stage of quest.stages) if (changes.stages[stage.id]) Object.assign(stage, { text: String(changes.stages[stage.id].text ?? ''), done: !!changes.stages[stage.id].done })
    })
  }

  static #onToggleMember(this: PartyScreen, _event: Event, target: HTMLElement) {
    const id = target.closest<HTMLElement>('[data-member-id]')?.dataset.memberId
    if (!id) return
    if (!this.#expanded.delete(id)) this.#expanded.add(id)
    this.refreshPart('overview')
  }

  static #onOpenSheet(this: PartyScreen, _event: Event, target: HTMLElement) {
    const actor: any = fromUuidSync(target.closest<HTMLElement>('[data-uuid]')?.dataset.uuid ?? '')
    if (actor?.visible) actor.sheet.render(true)
  }

  static #onOpenItem(this: PartyScreen, _event: Event, target: HTMLElement) {
    const actor: any = fromUuidSync(target.closest<HTMLElement>('[data-uuid]')?.dataset.uuid ?? '')
    const item = actor?.items.get(target.closest<HTMLElement>('[data-item-id]')?.dataset.itemId)
    if (item?.visible) item.sheet.render(true)
  }

  static #onSelectQuest(this: PartyScreen, _event: Event, target: HTMLElement) {
    const id = target.closest<HTMLElement>('[data-quest-id]')?.dataset.questId ?? null
    this.#questId = this.#questId === id ? null : id
    this.refreshPart('quests')
  }

  static async #onAddQuest(this: PartyScreen) {
    const id = foundry.utils.randomID()
    this.#questId = id
    await saveQuests((quests) => [...quests, ...cleanQuests([{ id, name: t('NewQuest'), status: 'offered' }])])
  }

  static async #onDeleteQuest(this: PartyScreen) {
    const quest = storedQuests().find((entry) => entry.id === this.#questId)
    if (!quest) return
    const confirmed = await DialogV2.confirm({ window: { title: t('DeleteTitle') }, content: `<p>${esc(t('DeleteConfirm', { name: quest.name || t('Untitled') }))}</p>`, rejectClose: false })
    if (!confirmed) return
    this.#questId = null
    await saveQuests((quests) => quests.filter((entry) => entry.id !== quest.id))
  }

  static async #onAddLink(this: PartyScreen, _event: Event, target: HTMLElement) {
    const key = target.closest<HTMLElement>('[data-link-key]')?.dataset.linkKey as QuestLinkKey
    const quest = storedQuests().find((entry) => entry.id === this.#questId)
    if (!key || !quest) return
    const links = await pickLinks(key, new Set(quest[key].map((link) => link.uuid)))
    if (links.length) await this.#addLinks(key, links)
  }

  static async #onRemoveLink(this: PartyScreen, _event: Event, target: HTMLElement) {
    const key = target.closest<HTMLElement>('[data-link-key]')?.dataset.linkKey as QuestLinkKey
    const uuid = target.closest<HTMLElement>('[data-link-uuid]')?.dataset.linkUuid
    const id = this.#questId
    await saveQuests((quests) => {
      const quest = quests.find((entry) => entry.id === id)
      if (quest && key) quest[key] = quest[key].filter((link) => link.uuid !== uuid)
    })
  }

  static async #onOpenLink(this: PartyScreen, _event: Event, target: HTMLElement) {
    const doc: any = await fromUuid(target.closest<HTMLElement>('[data-link-uuid]')?.dataset.linkUuid ?? '')
    if (doc) doc.sheet.render(true)
    else ui.notifications.warn(t('Missing'))
  }

  static async #onAddStage(this: PartyScreen) {
    const id = this.#questId
    await saveQuests((quests) => {
      quests.find((entry) => entry.id === id)?.stages.push({ id: foundry.utils.randomID(), text: '', done: false })
    })
  }

  static async #onRemoveStage(this: PartyScreen, _event: Event, target: HTMLElement) {
    const stageId = target.closest<HTMLElement>('[data-stage-id]')?.dataset.stageId
    const id = this.#questId
    await saveQuests((quests) => {
      const quest = quests.find((entry) => entry.id === id)
      if (quest) quest.stages = quest.stages.filter((stage) => stage.id !== stageId)
    })
  }
}

const screen = () => foundry.applications.instances.get(APP_ID) as PartyScreen | undefined

export function openPartyScreen() {
  return (screen() ?? new PartyScreen()).render({ force: true })
}

/** The party changed (an actor, its items or effects): redraw the overview if it's open. */
export function refreshPartyScreen() {
  screen()?.refreshPart('tabs', 'overview', 'space')
}

export function registerPartyScreen() {
  registerPartyLeader()
  game.settings.register('crawlspace', 'quests', { scope: 'world', config: false, type: Array, default: [], onChange: () => screen()?.refreshPart('quests') })
  game.keybindings.register('crawlspace', 'partyScreen', {
    name: 'CRAWLSPACE.PartyScreen.Open',
    hint: 'CRAWLSPACE.PartyScreen.KeybindHint',
    editable: [{ key: 'KeyP' }],
    onDown: () => {
      openPartyScreen()
      return true
    },
  })
  Hooks.once('ready', () => {
    if (game.crawlspace) game.crawlspace.openPartyScreen = openPartyScreen
  })
}
