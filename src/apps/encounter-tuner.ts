/**
 * The Encounter Tuner (GM): pick a threat and a party size (the players' party by default) and it shows how many mobs
 * to use, with the whole table for other party sizes. Opened from the CarlRPG controls or
 * game.crawlspace.encounter.open(). The CrawlSpace Atlas module uses game.crawlspace.encounter to size the groups its
 * Place Mobs puts in each room. The `encounterTuner` setting turns the tool off.
 */
import { partyCrawlers } from '../actors/party'
import { cleanPartySize, isThreat, mobCount, TABLE_SIZES, THREATS, type ThreatId } from '../rules/encounter'

const { DialogV2 } = foundry.applications.api

const t = (key: string, data?: Record<string, unknown>) => (data ? game.i18n.format(`CRAWLSPACE.Encounter.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Encounter.${key}`))
const esc = (text: unknown) => foundry.utils.escapeHTML(String(text ?? ''))

export const encounterTunerOn = () => game.settings.get('crawlspace', 'encounterTuner') !== false

/** How many crawlers are in the players' party (at least 1). */
export const partySize = () => cleanPartySize(partyCrawlers().length)

let lastThreat: ThreatId = 'moderate'

/** The tuner window. */
export async function openEncounterTuner() {
  if (!game.user.isGM) return
  if (!encounterTunerOn()) return ui.notifications.warn(t('Off'))
  const size = partySize()
  const threatOptions = THREATS.map(
    (threat) => `<option value="${threat.id}" ${threat.id === lastThreat ? 'selected' : ''}>${esc(t(`Threat.${threat.id}`))} (${threat.percent}%)</option>`,
  ).join('')
  const head = TABLE_SIZES.map((columns) => `<th data-size="${columns}">${columns}</th>`).join('')
  const rows = THREATS.map(
    (threat) =>
      `<tr data-threat="${threat.id}"><th>${esc(t(`Threat.${threat.id}`))}</th>${TABLE_SIZES.map((columns) => `<td data-size="${columns}">${mobCount(columns, threat.id)}${threat.id === 'overwhelming' ? '+' : ''}</td>`).join('')}</tr>`,
  ).join('')
  const content = `<div class="crawl-encounter-tuner">
    <p class="hint">${esc(t('Hint'))}</p>
    <div class="form-group"><label>${esc(t('PartySize'))}</label><input type="number" name="size" min="1" max="99" step="1" value="${size}"></div>
    <div class="form-group"><label>${esc(t('ThreatLabel'))}</label><select name="threat">${threatOptions}</select></div>
    <p class="crawl-encounter-result"></p>
    <table class="crawl-encounter-table"><thead><tr><th>${esc(t('ThreatLabel'))} \\ ${esc(t('Crawlers'))}</th>${head}</tr></thead><tbody>${rows}</tbody></table>
    <ul class="hint">${['Tip1', 'Tip2', 'Tip3'].map((key) => `<li>${esc(t(key))}</li>`).join('')}</ul>
  </div>`
  await DialogV2.wait({
    window: { title: t('Title'), icon: 'fa-solid fa-scale-balanced' },
    position: { width: 460 },
    content,
    buttons: [{ action: 'close', label: t('Close'), icon: 'fa-solid fa-check', default: true }],
    rejectClose: false,
    render: (_event: Event, dialog: any) => {
      const root: HTMLElement = dialog.element
      const sizeInput = root.querySelector<HTMLInputElement>('input[name="size"]')!
      const threatSelect = root.querySelector<HTMLSelectElement>('select[name="threat"]')!
      const result = root.querySelector<HTMLElement>('.crawl-encounter-result')!
      const update = () => {
        const crawlers = cleanPartySize(sizeInput.value)
        const threat = isThreat(threatSelect.value) ? threatSelect.value : 'moderate'
        lastThreat = threat
        const count = mobCount(crawlers, threat)
        result.textContent = t(threat === 'overwhelming' ? 'ResultOrMore' : 'Result', { count, crawlers })
        root.querySelectorAll<HTMLElement>('.crawl-encounter-table [data-size], .crawl-encounter-table tr[data-threat]').forEach((cell) => {
          const column = cell.dataset.size ? Number(cell.dataset.size) === crawlers : false
          const row = cell.dataset.threat === threat
          cell.classList.toggle('active', column || row)
        })
      }
      sizeInput.addEventListener('input', update)
      threatSelect.addEventListener('change', update)
      update()
    },
  })
}

/** game.crawlspace.encounter: the tuner for other modules (CrawlSpace Atlas). */
export const encounterApi = {
  threats: THREATS,
  mobCount,
  partySize,
  enabled: encounterTunerOn,
  open: openEncounterTuner,
}

export function registerEncounterTuner() {
  game.settings.register('crawlspace', 'encounterTuner', {
    name: 'CRAWLSPACE.Encounter.Setting',
    hint: 'CRAWLSPACE.Encounter.SettingHint',
    scope: 'world',
    config: true,
    restricted: true,
    type: Boolean,
    default: true,
    onChange: () => ui.controls?.render?.({ reset: true }),
  })
}
