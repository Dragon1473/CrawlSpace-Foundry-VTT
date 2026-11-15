/**
 * The editing pieces shared by the neighborhood and borough page sheets, the Add Quarter window and the builder: text
 * fields, linked lists (drop a document, browse the world and compendiums, or add a custom name) and note rows. They
 * edit a plain data object by path and hand the new object back; whoever owns it saves it.
 */
import { getPath, linkEntry, moveEntry, noteEntry, setPath, type Field, type LinkEntry, type LinkKind, type Section } from './model'

export const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.Journal.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Journal.${key}`))
export const esc = (value: unknown) => foundry.utils.escapeHTML(String(value ?? ''))

const ITEM_TYPES = ['weapon', 'equipment', 'consumable', 'tattoo', 'loot']

/** What each kind of list takes: a document name and a test on its type (and a mob's kind). */
const KINDS: Record<LinkKind, { document: string; accepts: (entry: { type?: string; system?: any; pages?: any }) => boolean; icon: string }> = {
  mob: { document: 'Actor', accepts: (e) => e.type === 'mob' || e.type === 'minion', icon: 'fa-solid fa-dragon' },
  boss: { document: 'Actor', accepts: (e) => e.type === 'mob' && e.system?.kind === 'boss', icon: 'fa-solid fa-skull' },
  npc: { document: 'Actor', accepts: (e) => e.type === 'npc', icon: 'fa-solid fa-user' },
  trap: { document: 'Item', accepts: (e) => e.type === 'trap', icon: 'fa-solid fa-triangle-exclamation' },
  item: { document: 'Item', accepts: (e) => ITEM_TYPES.includes(e.type ?? ''), icon: 'fa-solid fa-box' },
  achievement: { document: 'Item', accepts: (e) => e.type === 'achievement', icon: 'fa-solid fa-trophy' },
  reward: { document: 'Item', accepts: (e) => ITEM_TYPES.includes(e.type ?? '') || e.type === 'lootBox', icon: 'fa-solid fa-gift' },
  quest: { document: 'JournalEntry', accepts: () => true, icon: 'fa-solid fa-scroll' },
  scene: { document: 'Scene', accepts: () => true, icon: 'fa-solid fa-map' },
  neighborhood: { document: 'JournalEntry', accepts: (e) => !e.pages || [...(e.pages ?? [])].some((page: any) => page.type === 'neighborhood'), icon: 'fa-solid fa-city' },
}
export const kindIcon = (kind: LinkKind) => KINDS[kind].icon

/** Whether a document fits a list: quests also take single pages, neighborhoods a neighborhood page. */
export function accepts(kind: LinkKind, document: any) {
  if (!document) return false
  if (document.documentName === 'JournalEntryPage') return kind === 'quest' || (kind === 'neighborhood' && document.type === 'neighborhood')
  return document.documentName === KINDS[kind].document && KINDS[kind].accepts(document)
}

/* Rendering */

function linkRow(field: Extract<Field, { type: 'links' }>, path: string, entry: LinkEntry, index: number, readOnly: boolean) {
  const name = entry.uuid
    ? `<a class="content-link journal-link" draggable="true" data-link data-uuid="${esc(entry.uuid)}"><i class="${kindIcon(field.kind)}"></i> ${esc(entry.name || t('Untitled'))}</a>`
    : `<input type="text" data-path="${path}.${index}.name" value="${esc(entry.name)}" placeholder="${esc(t('Name'))}" ${readOnly ? 'disabled' : ''}>`
  const number = (key: 'quantity' | 'weight', label: string) =>
    `<label class="journal-number" data-tooltip="${esc(label)}">${key === 'weight' ? '<i class="fa-solid fa-dice-d20"></i>' : '×'}<input type="number" min="1" step="1" data-path="${path}.${index}.${key}" value="${entry[key] ?? 1}" ${readOnly ? 'disabled' : ''}></label>`
  return `<li class="journal-row" data-index="${index}">
    <div class="journal-row-main">${name}
      ${field.quantity ? number('quantity', t('Quantity')) : ''}${field.weight ? number('weight', t('Weight')) : ''}
      ${readOnly ? '' : rowButtons(path, index)}</div>
    <input type="text" class="journal-row-notes" data-path="${path}.${index}.notes" value="${esc(entry.notes)}" placeholder="${esc(t('Notes'))}" ${readOnly ? 'disabled' : ''}>
  </li>`
}

const rowButtons = (path: string, index: number) =>
  `<span class="journal-row-buttons">
    <a data-list-action="up" data-list="${path}" data-index="${index}" data-tooltip="${esc(t('MoveUp'))}"><i class="fa-solid fa-arrow-up"></i></a>
    <a data-list-action="down" data-list="${path}" data-index="${index}" data-tooltip="${esc(t('MoveDown'))}"><i class="fa-solid fa-arrow-down"></i></a>
    <a data-list-action="remove" data-list="${path}" data-index="${index}" data-tooltip="${esc(t('Remove'))}"><i class="fa-solid fa-trash"></i></a>
  </span>`

function renderField(data: any, field: Field, base: string, readOnly: boolean) {
  const path = base ? `${base}.${field.key}` : field.key
  const value = getPath(data, path)
  const disabled = readOnly ? 'disabled' : ''
  switch (field.type) {
    case 'text':
      return `<label class="journal-field">${esc(field.label)}<input type="text" data-path="${path}" value="${esc(value)}" ${disabled}></label>`
    case 'textarea':
      return `<label class="journal-field">${esc(field.label)}<textarea data-path="${path}" rows="4" placeholder="${esc(field.hint ?? '')}" ${disabled}>${esc(value)}</textarea></label>`
    case 'links': {
      const entries: LinkEntry[] = value ?? []
      return `<section class="journal-list" data-links="${path}" data-kind="${field.kind}">
        <h4>${esc(field.label)}${field.weight ? ` <span class="hint">${esc(t('WeightHint'))}</span>` : ''}</h4>
        <ol>${entries.map((entry, index) => linkRow(field, path, entry, index, readOnly)).join('')}</ol>
        ${readOnly ? '' : `<div class="journal-list-add">
          <button type="button" data-list-action="pick" data-list="${path}" data-kind="${field.kind}"><i class="fa-solid fa-magnifying-glass"></i> ${esc(t('Browse'))}</button>
          <button type="button" data-list-action="custom" data-list="${path}"><i class="fa-solid fa-plus"></i> ${esc(t('Custom'))}</button>
          <span class="hint">${esc(t('DropHint'))}</span></div>`}
      </section>`
    }
    case 'notes': {
      const entries = value ?? []
      return `<section class="journal-list">
        <h4>${esc(field.label)}</h4>
        <ol>${entries
          .map(
            (entry: any, index: number) => `<li class="journal-row">
            <div class="journal-row-main">
              ${field.roll ? `<input type="text" class="journal-roll" data-path="${path}.${index}.roll" value="${esc(entry.roll)}" placeholder="${esc(t('Roll'))}" ${disabled}>` : ''}
              <input type="text" data-path="${path}.${index}.name" value="${esc(entry.name)}" placeholder="${esc(t('Title'))}" ${disabled}>
              ${readOnly ? '' : rowButtons(path, index)}</div>
            <textarea data-path="${path}.${index}.description" rows="2" placeholder="${esc(t('Description'))}" ${disabled}>${esc(entry.description)}</textarea>
          </li>`,
          )
          .join('')}</ol>
        ${readOnly ? '' : `<div class="journal-list-add"><button type="button" data-list-action="add" data-list="${path}"><i class="fa-solid fa-plus"></i> ${esc(t('Add'))}</button></div>`}
      </section>`
    }
  }
}

export const renderSection = (data: any, section: Section, base = '', readOnly = false) => section.fields.map((field) => renderField(data, field, base, readOnly)).join('')

/** Tabs across the top; `active` is the open one. */
export const renderTabs = (tabs: { id: string; label: string }[], active: string) =>
  `<nav class="journal-tabs">${tabs.map((tab) => `<a data-journal-tab="${tab.id}" class="${tab.id === active ? 'active' : ''}">${esc(tab.label)}</a>`).join('')}</nav>`

/** A single linked document slot (a boss): drop or browse, with a clear button. */
export function renderSlot(path: string, kind: LinkKind, entry: { uuid: string; name: string }, label: string, readOnly = false) {
  const filled = entry?.uuid
    ? `<a class="content-link journal-link" draggable="true" data-link data-uuid="${esc(entry.uuid)}"><i class="${kindIcon(kind)}"></i> ${esc(entry.name)}</a>${readOnly ? '' : `<a data-slot-action="clear" data-slot="${path}" data-tooltip="${esc(t('Remove'))}"><i class="fa-solid fa-xmark"></i></a>`}`
    : `<span class="hint">${esc(t('DropHint'))}</span>`
  return `<section class="journal-slot" data-slot="${path}" data-kind="${kind}">
    <h4>${esc(label)}</h4><div class="journal-slot-body">${filled}
    ${readOnly ? '' : `<button type="button" data-slot-action="pick" data-slot="${path}" data-kind="${kind}"><i class="fa-solid fa-magnifying-glass"></i> ${esc(t('Browse'))}</button>`}</div>
  </section>`
}

/* Editing */

/** Reads what was dropped: the document it names, if any. */
async function dropped(event: DragEvent) {
  const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event)
  if (!data?.uuid) return null
  return fromUuid(data.uuid)
}

/**
 * Wires the fields inside `root` to a data object: typing, list buttons, drops and the picker. `get` reads the current
 * data and `set` takes a changed copy.
 */
/** `set` gets the new data, and whether the window needs drawing again (typing in a field doesn't: it's already on screen). */
export function bindFields(root: HTMLElement, get: () => any, set: (data: any, redraw?: boolean) => void) {
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-path]').forEach((input) =>
    input.addEventListener('change', (event) => {
      event.stopPropagation()
      const value = input.type === 'number' ? Math.max(1, Math.floor(Number(input.value) || 1)) : input.value
      set(setPath(get(), input.dataset.path!, value), false)
    }),
  )
  root.querySelectorAll<HTMLElement>('[data-list-action]').forEach((button) =>
    button.addEventListener('click', async (event) => {
      event.preventDefault()
      const path = button.dataset.list!
      const list: any[] = getPath(get(), path) ?? []
      const index = Number(button.dataset.index)
      switch (button.dataset.listAction) {
        case 'up':
        case 'down':
          return set(setPath(get(), path, moveEntry(list, index, button.dataset.listAction === 'up' ? -1 : 1)))
        case 'remove':
          return set(setPath(get(), path, list.filter((_, i) => i !== index)))
        case 'custom':
          return set(setPath(get(), path, [...list, linkEntry()]))
        case 'add':
          return set(setPath(get(), path, [...list, noteEntry()]))
        case 'pick': {
          const chosen = await pickDocument(button.dataset.kind as LinkKind)
          if (chosen) set(setPath(get(), path, [...(getPath(get(), path) ?? []), linkEntry({ uuid: chosen.uuid, name: chosen.name })]))
        }
      }
    }),
  )
  root.querySelectorAll<HTMLElement>('[data-slot-action]').forEach((button) =>
    button.addEventListener('click', async (event) => {
      event.preventDefault()
      const path = button.dataset.slot!
      if (button.dataset.slotAction === 'clear') return set(setPath(setPath(get(), `${path}.uuid`, ''), `${path}.name`, ''))
      const chosen = await pickDocument(button.dataset.kind as LinkKind)
      if (chosen) set(setPath(setPath(get(), `${path}.uuid`, chosen.uuid), `${path}.name`, chosen.name))
    }),
  )
  const dropTargets = root.querySelectorAll<HTMLElement>('[data-links], [data-slot]')
  dropTargets.forEach((target) => {
    target.addEventListener('dragover', (event) => {
      event.preventDefault()
      target.classList.add('drop-hover')
    })
    target.addEventListener('dragleave', () => target.classList.remove('drop-hover'))
    target.addEventListener('drop', async (event) => {
      event.preventDefault()
      event.stopPropagation()
      target.classList.remove('drop-hover')
      const kind = target.dataset.kind as LinkKind
      const document = await dropped(event)
      if (!accepts(kind, document)) return ui.notifications.warn(t('WrongKind', { kind: t(`Kind.${kind}`) }))
      if (target.dataset.slot) {
        const path = target.dataset.slot
        return set(setPath(setPath(get(), `${path}.uuid`, document.uuid), `${path}.name`, document.name))
      }
      const path = target.dataset.links!
      set(setPath(get(), path, [...(getPath(get(), path) ?? []), linkEntry({ uuid: document.uuid, name: document.name })]))
    })
  })
  // Linked names open their document.
  root.querySelectorAll<HTMLElement>('[data-link]').forEach((anchor) => {
    anchor.addEventListener('click', async (event) => {
      event.preventDefault()
      ;(await fromUuid(anchor.dataset.uuid!))?.sheet?.render(true)
    })
    anchor.addEventListener('dragstart', (event) => {
      const document = fromUuidSync(anchor.dataset.uuid!)
      const type = document?.documentName ?? (anchor.dataset.uuid!.includes('Actor.') ? 'Actor' : 'Item')
      event.dataTransfer?.setData('text/plain', JSON.stringify({ type, uuid: anchor.dataset.uuid }))
    })
  })
}

/* The picker: the world's documents and every compendium's, of the kind a list takes. */

type Choice = { uuid: string; name: string; img: string; source: string }

async function choicesFor(kind: LinkKind): Promise<Choice[]> {
  const { document } = KINDS[kind]
  const out: Choice[] = []
  const collection = game.collections.get(document)
  for (const entry of collection?.contents ?? []) if (accepts(kind, entry)) out.push({ uuid: entry.uuid, name: entry.name, img: entry.img ?? '', source: t('World') })
  for (const pack of game.packs.filter((pack: any) => pack.documentName === document && pack.visible)) {
    if (document === 'JournalEntry' && kind === 'neighborhood') continue
    const index = await pack.getIndex({ fields: ['type', 'system.kind'] })
    for (const entry of index) {
      if (document !== 'JournalEntry' && !KINDS[kind].accepts(entry)) continue
      out.push({ uuid: entry.uuid ?? `Compendium.${pack.collection}.${document}.${entry._id}`, name: entry.name, img: entry.img ?? '', source: pack.title })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Lets the GM pick one document of a kind; resolves to it, or null if closed. */
export function pickDocument(kind: LinkKind): Promise<Choice | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (choice: Choice | null) => {
      if (done) return
      done = true
      resolve(choice)
    }
    choicesFor(kind).then((choices) => {
      const list = choices
        .slice(0, 2000)
        .map((choice, index) => `<li data-index="${index}" data-search="${esc(`${choice.name} ${choice.source}`.toLowerCase())}"><img src="${esc(choice.img || 'icons/svg/mystery-man.svg')}" alt=""><span>${esc(choice.name)}</span><small>${esc(choice.source)}</small></li>`)
        .join('')
      const dialog = new foundry.applications.api.DialogV2({
        window: { title: t('PickTitle', { kind: t(`Kind.${kind}`) }), icon: kindIcon(kind) },
        classes: ['crawlspace', 'journal-picker'],
        position: { width: 460, height: 560 },
        content: `<input type="search" placeholder="${esc(t('Search'))}" autofocus><ul class="journal-picker-list">${list || `<li class="hint">${esc(t('NoneFound'))}</li>`}</ul>`,
        buttons: [{ action: 'cancel', label: t('Cancel'), default: true }],
        submit: () => finish(null),
      })
      dialog.addEventListener('close', () => finish(null))
      dialog.render({ force: true }).then(() => {
        const element = dialog.element as HTMLElement
        const search = element.querySelector<HTMLInputElement>('input[type=search]')!
        search.addEventListener('input', () => {
          const words = search.value.toLowerCase().split(/\s+/).filter(Boolean)
          element.querySelectorAll<HTMLElement>('.journal-picker-list li[data-index]').forEach((li) => (li.hidden = !words.every((word) => li.dataset.search!.includes(word))))
        })
        element.querySelectorAll<HTMLElement>('.journal-picker-list li[data-index]').forEach((li) =>
          li.addEventListener('click', () => {
            finish(choices[Number(li.dataset.index)])
            dialog.close()
          }),
        )
      })
    })
  })
}

/** Switching tabs: `onTab` gets the tab's id. */
export function bindTabs(root: HTMLElement, onTab: (id: string) => void) {
  root.querySelectorAll<HTMLElement>('[data-journal-tab]').forEach((tab) =>
    tab.addEventListener('click', (event) => {
      event.preventDefault()
      onTab(tab.dataset.journalTab!)
    }),
  )
}
