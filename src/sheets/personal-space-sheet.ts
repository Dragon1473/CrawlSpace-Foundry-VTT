/**
 * The Personal Space sheet: level, members (owners, members, guests) with their "here now" toggle, installed
 * upgrades with their owners, crafting tables with tiers and attachments, and what the space does for a crawler.
 */
import { CONJOIN_COST, LEVEL_INFO, MEMBER_ROLES, SPACE_LEVELS, conjoinUnions, ownerLevels } from '../rules/personal-space'
import { attachTo, benefitLinesOf, conjoinSpaces, currentSpace, installLibrary, libraryOf, membersOf, ownerOf, removeMember, setInSpace } from '../actors/personal-space'
import { craftCategories } from '../actors/crafting'

const { HandlebarsApplicationMixin } = foundry.applications.api
const { ActorSheetV2 } = foundry.applications.sheets

const t = (key: string, data?: Record<string, unknown>) =>
  data ? game.i18n.format(`CRAWLSPACE.Space.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Space.${key}`)
const gold = (value: number) => Math.floor(Number(value) || 0).toLocaleString()

export class PersonalSpaceSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS: any = {
    classes: ['crawlspace', 'actor', 'personal-space'],
    position: { width: 720, height: 760 },
    form: { submitOnChange: true },
    window: { resizable: true },
    actions: {
      editItem: PersonalSpaceSheet.#onEditItem,
      deleteItem: PersonalSpaceSheet.#onDeleteItem,
      openMember: PersonalSpaceSheet.#onOpenMember,
      removeMember: PersonalSpaceSheet.#onRemoveMember,
      toggleHere: PersonalSpaceSheet.#onToggleHere,
      installLibrary: PersonalSpaceSheet.#onInstallLibrary,
      tableTier: PersonalSpaceSheet.#onTableTier,
      openPack: PersonalSpaceSheet.#onOpenPack,
    },
  }

  static PARTS = { main: { template: 'systems/crawlspace/templates/actor/personal-space.hbs', scrollable: [''] } }

  get actor() {
    return this.document
  }

  async _prepareContext(options: any) {
    const context: any = await super._prepareContext(options)
    const actor = this.actor
    const system = actor.system
    const members = membersOf(actor)
    const ownerChoices = [{ value: '', label: t('SpaceOwned') }, ...members.map((member) => ({ value: member.uuid, label: fromUuidSync(member.uuid)?.name ?? t('Missing') }))]
    const enrich = (text: string) => foundry.applications.ux.TextEditor.implementation.enrichHTML(text ?? '', { secrets: actor.isOwner, relativeTo: actor })
    const items = actor.items.contents
    const tables = items.filter((item: any) => item.type === 'craftingTable')
    const upgrades = items.filter((item: any) => item.type === 'spaceUpgrade')
    const info = LEVEL_INFO[system.level] ?? LEVEL_INFO[1]
    const benefitLines = benefitLinesOf(actor)
    return Object.assign(context, {
      actor,
      system,
      systemSource: actor.system._source,
      editable: this.isEditable,
      isGM: game.user.isGM,
      levels: SPACE_LEVELS.map((level) => ({ value: level, label: t('LevelN', { level }), selected: level === system.level })),
      levelPrice: gold(info.price),
      tableLimit: info.tables,
      tablesOver: tables.length > info.tables,
      conjoined: system.conjoinedLevel !== null,
      levelFromOwners: system.conjoinedLevel !== null && !system.levelLocked,
      conjoinedHint: system.conjoinedLevel !== null ? t('ConjoinedLevel', { level: system.conjoinedLevel, list: ownerLevels(members).sort((a, b) => b - a).join(' + ') }) : '',
      unions: conjoinUnions(members),
      unionCost: gold(conjoinUnions(members) * CONJOIN_COST),
      members: members.map((member, index) => {
        const crawler = fromUuidSync(member.uuid)
        return {
          index,
          uuid: member.uuid,
          name: crawler?.name ?? t('Missing'),
          img: crawler?.img ?? 'icons/svg/mystery-man.svg',
          missing: !crawler,
          here: crawler ? currentSpace(crawler) === actor : false,
          canToggle: !!crawler?.isOwner,
          library: libraryOf(crawler).length,
          roles: MEMBER_ROLES.map((role) => ({ value: role, label: t(`Role.${role}`), selected: role === member.role })),
          owner: member.role === 'owner',
          spaceLevels: [0, ...SPACE_LEVELS].map((level) => ({ value: level, label: level ? t('BroughtN', { level }) : t('BroughtNone'), selected: level === (member.spaceLevel ?? 0) })),
        }
      }),
      upgrades: await Promise.all(
        upgrades
          .sort((a: any, b: any) => a.system.tier - b.system.tier || a.name.localeCompare(b.name))
          .map(async (item: any) => ({
            id: item.id,
            name: item.name,
            img: item.img,
            tier: item.system.tier ? t('TierN', { tier: item.system.tier }) : '',
            category: item.system.category,
            installed: item.system.installed,
            homebrew: item.system.status === 'homebrew',
            summary: item.system.summary,
            attachment: item.system.kind === 'attachment',
            owners: ownerChoices.map((choice) => ({ ...choice, selected: choice.value === item.system.owner })),
            tables: [{ value: '', label: t('NotAttached') }, ...tables.map((table: any) => ({ value: table.id, label: table.name, selected: table.id === item.system.attachedTo }))],
            effects: item.effects.size,
          })),
      ),
      tables: tables.map((item: any) => ({
        id: item.id,
        name: item.name,
        img: item.img,
        tier: Math.floor(Number(item.system.tier) || 1),
        category: craftCategories().find((category) => category.id === item.system.category)?.label ?? item.system.category,
        upgrades: item.system.upgrades ?? [],
        broken: item.system.broken,
        owners: ownerChoices.map((choice) => ({ ...choice, selected: choice.value === ownerOf(item) })),
      })),
      benefitLines,
      enriched: { description: await enrich(system.description), notes: await enrich(system.notes) },
    })
  }

  async _onRender(context: any, options: any) {
    await super._onRender(context, options)
    // Item fields edit the embedded item, not the space, so they sit outside the sheet's own form data (no name).
    for (const input of this.element.querySelectorAll('[data-item-field]')) {
      input.addEventListener('change', (event: Event) => this.#onItemField(event))
    }
    for (const input of this.element.querySelectorAll('[data-member-role]')) {
      input.addEventListener('change', (event: Event) => this.#onMemberRole(event))
    }
    for (const input of this.element.querySelectorAll('[data-member-level]')) {
      input.addEventListener('change', (event: Event) => this.#onMemberLevel(event))
    }
  }

  async #onItemField(event: Event) {
    event.stopPropagation()
    const input = event.currentTarget as HTMLInputElement
    const item = this.actor.items.get(input.closest<HTMLElement>('[data-item-id]')?.dataset.itemId)
    if (!item || !this.isEditable) return
    const field = input.dataset.itemField
    const value = input.type === 'checkbox' ? input.checked : input.value
    if (field === 'attachedTo') return attachTo(this.actor, item, String(value))
    if (field === 'owner' && item.type === 'craftingTable')
      return value ? item.setFlag('crawlspace', 'spaceOwner', value) : item.unsetFlag('crawlspace', 'spaceOwner')
    return item.update({ [`system.${field}`]: value })
  }

  async #onMemberRole(event: Event) {
    event.stopPropagation()
    const input = event.currentTarget as HTMLSelectElement
    const index = Number(input.closest<HTMLElement>('[data-member]')?.dataset.member)
    const members = membersOf(this.actor)
    if (!members[index] || !this.isEditable) return
    members[index].role = input.value as any
    await this.actor.update({ 'system.members': members })
  }

  async #onMemberLevel(event: Event) {
    event.stopPropagation()
    const input = event.currentTarget as HTMLSelectElement
    const index = Number(input.closest<HTMLElement>('[data-member]')?.dataset.member)
    const members = membersOf(this.actor)
    if (!members[index] || !this.isEditable) return
    members[index].spaceLevel = Math.floor(Number(input.value) || 0)
    await this.actor.update({ 'system.members': members })
  }

  /** Drop a crawler to add them: the first one owns the space, later ones join as members. */
  async _onDropActor(_event: DragEvent, actor: any) {
    if (this.isEditable && actor?.type === 'personalSpace' && actor !== this.actor) return this.#conjoin(actor)
    if (!this.isEditable || actor?.type !== 'crawler') return
    const members = membersOf(this.actor)
    if (members.some((member) => member.uuid === actor.uuid)) return
    members.push({ uuid: actor.uuid, role: members.length ? 'member' : 'owner' })
    await this.actor.update({ 'system.members': members })
    if (libraryOf(actor).length) ui.notifications.info(t('HasLibrary', { name: actor.name }))
  }

  /** Drop another space on this one (GM) to conjoin them: it moves in here and is deleted. */
  async #conjoin(source: any) {
    if (!game.user.isGM) return ui.notifications.warn(t('ConjoinGM'))
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: t('ConjoinTitle') },
      content: `<p>${t('ConjoinHint', { source: foundry.utils.escapeHTML(source.name), target: foundry.utils.escapeHTML(this.actor.name), cost: gold(CONJOIN_COST) })}</p>`,
      rejectClose: false,
    })
    if (!confirmed) return
    const name = source.name
    await conjoinSpaces(this.actor, source)
    ui.notifications.info(t('ConjoinDone', { source: name, level: this.actor.system.level }))
  }

  /**
   * Only upgrades and crafting tables go in. A space-level entry raises the space's level instead of sitting in it.
   * What a member drops is theirs; what the GM drops belongs to the space until given an owner.
   */
  async _onDropItem(event: DragEvent, item: any) {
    if (!this.isEditable) return null
    if (!['spaceUpgrade', 'craftingTable'].includes(item.type)) {
      ui.notifications.warn(t('WrongItem'))
      return null
    }
    if (item.parent === this.actor) return super._onDropItem(event, item)
    if (item.type === 'spaceUpgrade' && item.system.spaceLevel && this.actor.system.conjoinedLevel !== null && !this.actor.system.levelLocked) {
      // Conjoined: the level item upgrades the dropping owner's own space, and the joined Level follows.
      const members = membersOf(this.actor)
      const mine = members.find((member) => member.role === 'owner' && member.uuid === game.user.character?.uuid)
      if (!mine) {
        ui.notifications.warn(t('ConjoinedLevelDrop'))
        return null
      }
      mine.spaceLevel = Math.max(mine.spaceLevel ?? 0, item.system.spaceLevel)
      await this.actor.update({ 'system.members': members })
      ui.notifications.info(t('LevelRaised', { level: this.actor.system.level }))
      return null
    }
    if (item.type === 'spaceUpgrade' && item.system.spaceLevel) {
      const level = Math.max(this.actor.system.level, item.system.spaceLevel)
      await this.actor.update({ 'system.level': level })
      ui.notifications.info(t('LevelRaised', { level }))
      return null
    }
    const data = item.toObject()
    delete data._id
    const character = game.user.character
    const owner = !game.user.isGM && character && membersOf(this.actor).some((member) => member.uuid === character.uuid) ? character.uuid : ''
    if (data.type === 'spaceUpgrade') data.system = { ...data.system, owner, attachedTo: '' }
    else if (owner) foundry.utils.setProperty(data, 'flags.crawlspace.spaceOwner', owner)
    foundry.utils.setProperty(data, '_stats.compendiumSource', item.uuid)
    return this.actor.createEmbeddedDocuments('Item', [data])
  }

  static #itemOf(sheet: PersonalSpaceSheet, target: HTMLElement) {
    return sheet.actor.items.get(target.closest<HTMLElement>('[data-item-id]')?.dataset.itemId)
  }

  static #onEditItem(this: PersonalSpaceSheet, _event: Event, target: HTMLElement) {
    PersonalSpaceSheet.#itemOf(this, target)?.sheet.render(true)
  }

  static async #onDeleteItem(this: PersonalSpaceSheet, _event: Event, target: HTMLElement) {
    const item = PersonalSpaceSheet.#itemOf(this, target)
    if (!item || !this.isEditable) return
    if (item.type === 'spaceUpgrade' && item.system.attachedTo) await attachTo(this.actor, item, '')
    await item.deleteDialog()
  }

  static #onOpenMember(_event: Event, target: HTMLElement) {
    fromUuidSync(target.closest<HTMLElement>('[data-uuid]')?.dataset.uuid ?? '')?.sheet.render(true)
  }

  /** A member leaves or dies: what they own goes with them (to their library), the rest stays. */
  static async #onRemoveMember(this: PersonalSpaceSheet, _event: Event, target: HTMLElement) {
    if (!this.isEditable) return
    const uuid = target.closest<HTMLElement>('[data-uuid]')?.dataset.uuid ?? ''
    const name = fromUuidSync(uuid)?.name ?? t('Missing')
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: t('RemoveTitle') },
      content: `<p>${t('RemoveHint', { name: foundry.utils.escapeHTML(name) })}</p>`,
      rejectClose: false,
    })
    if (!confirmed) return
    const taken = await removeMember(this.actor, uuid)
    ui.notifications.info(taken.length ? t('Removed', { name, list: taken.join(', ') }) : t('RemovedNothing', { name }))
  }

  static async #onToggleHere(this: PersonalSpaceSheet, _event: Event, target: HTMLElement) {
    const crawler = fromUuidSync(target.closest<HTMLElement>('[data-uuid]')?.dataset.uuid ?? '')
    if (!crawler?.isOwner) return
    await setInSpace(crawler, currentSpace(crawler) === this.actor ? null : this.actor)
    this.render()
  }

  static async #onInstallLibrary(this: PersonalSpaceSheet, _event: Event, target: HTMLElement) {
    const crawler = fromUuidSync(target.closest<HTMLElement>('[data-uuid]')?.dataset.uuid ?? '')
    if (!crawler || !this.isEditable) return
    const count = await installLibrary(this.actor, crawler)
    ui.notifications.info(t('LibraryInstalled', { name: crawler.name, count }))
  }

  static async #onTableTier(this: PersonalSpaceSheet, _event: Event, target: HTMLElement) {
    const item = PersonalSpaceSheet.#itemOf(this, target)
    if (!item || !this.isEditable) return
    const tier = Math.min(10, Math.max(1, Math.floor(Number(item.system.tier) || 1) + Number(target.dataset.step)))
    await item.update({ 'system.tier': tier })
  }

  static #onOpenPack(_event: Event, target: HTMLElement) {
    game.packs.get(`crawlspace.${target.dataset.pack}`)?.render(true)
  }
}
