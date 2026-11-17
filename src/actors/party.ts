/**
 * Parties. The players' party is the one with crawler frames; the GM adds or removes crawlers from the Actors
 * list's right-click menu and can name it. Other parties (rivals, NPC crawler groups) are only a name and the
 * crawlers who belong to them (flags.crawlspace.partyId); the boss battle overlay groups crawlers by party.
 * The GM manages names in the Parties window (crawler frames header, or game.crawlspace.openParties()).
 */
import { TokenMakerApp } from '../apps/token-maker'
import { HeadshotMakerApp } from '../apps/headshot-maker'
import { cleanParties, isCrawler, partyFlag, partyNameOf, pickParty, type OtherParty } from '../rules/party'

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api

/** Every crawler in the world: crawler actors and mobs marked as crawlers. */
const allCrawlers = (): any[] => game.actors.contents.filter((actor: any) => isCrawler(actor))

/** The party's crawlers, by name. Every user gets the whole party, including crawlers they can't open. */
export function partyCrawlers(): any[] {
  const crawlers = allCrawlers()
  return pickParty(crawlers).sort((a: any, b: any) => a.name.localeCompare(b.name))
}

export const inParty = (actor: any) => isCrawler(actor) && partyCrawlers().includes(actor)

const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.Party.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Party.${key}`))
const esc = (text: string) => foundry.utils.escapeHTML(text)

/** The players' party name as the GM set it ('' when unnamed). */
export const playerPartyName = () => String(game.settings.get('crawlspace', 'partyName') ?? '').trim()
/** The players' party name to show: its name, or "Crawlers". */
export const playerPartyLabel = () => playerPartyName() || game.i18n.localize('CRAWLSPACE.Frames.Title')
export const otherParties = (): OtherParty[] => cleanParties(game.settings.get('crawlspace', 'parties'))

/** The name of the party a crawler stands with ('' for Solo). */
export function partyNameFor(actor: any, members = new Set(partyCrawlers().map((member) => member.id))) {
  const base = actor?.isToken ? (actor.baseActor ?? actor) : actor
  if (!base) return ''
  return partyNameOf(base, { members, playerName: playerPartyName(), fallback: game.i18n.localize('CRAWLSPACE.Frames.Title'), parties: otherParties() })
}

/** Move a crawler: 'players' joins the players' party, a party id joins that party, '' leaves both (Solo). */
export async function setCrawlerParty(actor: any, choice: string) {
  if (choice === 'players') return actor.update({ 'flags.crawlspace.inParty': true, 'flags.crawlspace.-=partyId': null })
  const update: Record<string, unknown> = { 'flags.crawlspace.inParty': false }
  if (choice) update['flags.crawlspace.partyId'] = choice
  else update['flags.crawlspace.-=partyId'] = null
  return actor.update(update)
}

/** The parties a crawler can stand with ('players', other parties' ids, '' for Solo), its own marked. */
export function partyChoices(actor: any) {
  const current = inParty(actor) ? 'players' : (otherParties().find((party) => party.id === actor.getFlag('crawlspace', 'partyId'))?.id ?? '')
  return [
    { value: 'players', label: `${playerPartyLabel()} (${t('Players')})` },
    ...otherParties().map((party) => ({ value: party.id, label: party.name || t('Unnamed') })),
    { value: '', label: t('Solo') },
  ].map((choice) => ({ ...choice, selected: choice.value === current }))
}

/** Ask which party a crawler belongs to. */
async function chooseParty(actor: any) {
  const options = partyChoices(actor).map((choice) => `<option value="${esc(choice.value)}" ${choice.selected ? 'selected' : ''}>${esc(choice.label)}</option>`)
  const content = `<label class="crawl-dialog-field"><span>${esc(t('Party'))}</span><select name="party">${options.join('')}</select></label>
    <p class="hint">${esc(t('ChooseHint'))}</p>`
  const choice = await DialogV2.prompt({
    window: { title: t('ChooseTitle', { name: actor.name }), icon: 'fa-solid fa-people-group' },
    content,
    ok: { label: t('Save'), callback: (_event: Event, button: any) => button.form.querySelector('select[name=party]')?.value ?? null },
    rejectClose: false,
  })
  if (choice === null || choice === undefined) return
  await setCrawlerParty(actor, choice)
}

/** The GM's Parties window: name the players' party, and add, rename or remove other parties. */
class PartiesApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: any = {
    id: 'crawl-parties',
    tag: 'form',
    classes: ['crawlspace', 'crawl-parties'],
    position: { width: 420, height: 'auto' },
    window: { title: 'CRAWLSPACE.Party.Title', icon: 'fa-solid fa-people-group', resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false, handler: PartiesApp.#onSubmit },
    actions: { addParty: PartiesApp.#onAdd, removeParty: PartiesApp.#onRemove },
  }

  static PARTS = { main: { template: 'systems/crawlspace/templates/apps/parties.hbs' } }

  async _prepareContext() {
    const crawlers = allCrawlers()
    const members = partyCrawlers()
    const memberIds = new Set(members.map((actor) => actor.id))
    const names = (list: any[]) => list.map((actor) => actor.name).sort((a, b) => a.localeCompare(b)).join(', ')
    const parties = otherParties().map((party) => ({
      ...party,
      members: names(crawlers.filter((actor: any) => !memberIds.has(actor.id) && actor.getFlag('crawlspace', 'partyId') === party.id)),
    }))
    const grouped = new Set(parties.length ? crawlers.filter((actor: any) => parties.some((party) => party.id === actor.getFlag('crawlspace', 'partyId'))).map((actor: any) => actor.id) : [])
    return {
      partyName: playerPartyName(),
      fallback: game.i18n.localize('CRAWLSPACE.Frames.Title'),
      players: names(members),
      parties,
      solo: names(crawlers.filter((actor: any) => !memberIds.has(actor.id) && !grouped.has(actor.id))),
    }
  }

  static async #onSubmit(this: PartiesApp, _event: Event, _form: HTMLFormElement, formData: any) {
    const data = foundry.utils.expandObject(formData.object)
    await game.settings.set('crawlspace', 'partyName', String(data.partyName ?? '').trim())
    const names = data.parties ?? {}
    const parties = otherParties().map((party) => (party.id in names ? { ...party, name: String(names[party.id] ?? '').trim() } : party))
    await game.settings.set('crawlspace', 'parties', parties)
  }

  static async #onAdd(this: PartiesApp) {
    await game.settings.set('crawlspace', 'parties', [...otherParties(), { id: foundry.utils.randomID(), name: t('NewParty') }])
    this.render()
  }

  /** Removing a party makes its crawlers Solo. */
  static async #onRemove(this: PartiesApp, _event: Event, target: HTMLElement) {
    const id = target.closest<HTMLElement>('[data-party-id]')?.dataset.partyId
    const party = otherParties().find((entry) => entry.id === id)
    if (!party) return
    const confirmed = await DialogV2.confirm({ window: { title: t('RemoveTitle') }, content: `<p>${esc(t('RemoveConfirm', { name: party.name || t('Unnamed') }))}</p>`, rejectClose: false })
    if (!confirmed) return
    await game.settings.set('crawlspace', 'parties', otherParties().filter((entry) => entry.id !== id))
    const updates = game.actors.contents.filter((actor: any) => actor.getFlag('crawlspace', 'partyId') === id).map((actor: any) => ({ _id: actor.id, 'flags.crawlspace.-=partyId': null }))
    if (updates.length) await Actor.implementation.updateDocuments(updates)
    this.render()
  }
}

export function openParties() {
  if (!game.user.isGM) return
  const existing = foundry.applications.instances.get('crawl-parties')
  return (existing ?? new PartiesApp()).render({ force: true })
}

const redrawParties = () => {
  ui.actors?.render()
  const app: any = foundry.applications.instances.get('crawl-parties')
  if (app?.rendered) app.render()
  Hooks.callAll('crawlspacePartiesChanged')
}

export function registerParty() {
  game.settings.register('crawlspace', 'partyName', { scope: 'world', config: false, type: String, default: '', onChange: redrawParties })
  game.settings.register('crawlspace', 'parties', { scope: 'world', config: false, type: Array, default: [], onChange: redrawParties })
  Hooks.on('getActorContextOptions', (_app: any, options: any[]) => {
    const actorOf = (li: HTMLElement) => game.actors.get(li.closest<HTMLElement>('[data-entry-id]')?.dataset.entryId)
    const crawler = (li: HTMLElement) => game.user.isGM && isCrawler(actorOf(li))
    options.push(
      {
        label: 'CRAWLSPACE.Party.Add',
        icon: 'fa-solid fa-user-plus',
        visible: (li: HTMLElement) => crawler(li) && partyFlag(actorOf(li)) !== true,
        onClick: (_event: Event, li: HTMLElement) => setCrawlerParty(actorOf(li), 'players'),
      },
      {
        label: 'CRAWLSPACE.Party.Remove',
        icon: 'fa-solid fa-user-minus',
        visible: (li: HTMLElement) => crawler(li) && inParty(actorOf(li)),
        onClick: (_event: Event, li: HTMLElement) => actorOf(li).setFlag('crawlspace', 'inParty', false),
      },
      {
        label: 'CRAWLSPACE.Party.Choose',
        icon: 'fa-solid fa-people-group',
        visible: (li: HTMLElement) => crawler(li),
        onClick: (_event: Event, li: HTMLElement) => chooseParty(actorOf(li)),
      },
      {
        label: 'CRAWLSPACE.TokenMaker.Open',
        icon: 'fa-solid fa-circle-user',
        visible: (li: HTMLElement) => !!actorOf(li)?.isOwner,
        onClick: (_event: Event, li: HTMLElement) => TokenMakerApp.open(actorOf(li)),
      },
      {
        label: 'CRAWLSPACE.Headshot.Open',
        icon: 'fa-solid fa-id-badge',
        visible: (li: HTMLElement) => !!actorOf(li)?.isOwner,
        onClick: (_event: Event, li: HTMLElement) => HeadshotMakerApp.open(actorOf(li)),
      },
    )
  })
  // Redraw the list (and the Parties window) when membership changes, so the marks follow.
  Hooks.on('updateActor', (actor: any, changes: any) => {
    if ((isCrawler(actor) || foundry.utils.hasProperty(changes, 'system.crawler')) && (foundry.utils.hasProperty(changes, 'system.crawler') || foundry.utils.hasProperty(changes, 'flags.crawlspace.inParty') || foundry.utils.hasProperty(changes, 'flags.crawlspace.partyId') || foundry.utils.hasProperty(changes, 'flags.crawlspace.-=partyId')))
      redrawParties()
  })
}

/** Mark party crawlers in the Actors list: the players' party, and members of other parties with their party's name. */
export function markPartyInDirectory(root: HTMLElement) {
  const members = new Set(partyCrawlers().map((actor) => actor.id))
  const parties = otherParties()
  for (const li of root.querySelectorAll<HTMLElement>('li.directory-item[data-entry-id]')) {
    li.querySelector('.crawl-party-mark')?.remove()
    const actor: any = game.actors.get(li.dataset.entryId)
    const other = !members.has(li.dataset.entryId) && isCrawler(actor) ? parties.find((party) => party.id === actor.getFlag('crawlspace', 'partyId')) : null
    if (!members.has(li.dataset.entryId) && !other) continue
    const mark = document.createElement('i')
    mark.className = `crawl-party-mark fa-solid ${other ? 'fa-people-group other' : 'fa-users'}`
    mark.dataset.tooltip = other ? t('OtherMember', { name: other.name || t('Unnamed') }) : t('Member')
    li.querySelector('.entry-name, .document-name')?.append(mark)
  }
}
