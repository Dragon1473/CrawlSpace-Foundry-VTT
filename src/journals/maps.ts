/**
 * Image maps on neighborhood, borough, city, province, country and floor pages. Any of them can take a plain image
 * as its map: the GM picks one, makes a scene from it (rules/journal-maps.ts) and the page links that scene, so
 * it works without CrawlSpace Atlas. Anyone reading the page can open the image; the GM can also view the scene.
 */
import { mapSceneData } from '../rules/journal-maps'
import { esc, renderSlot, t } from './fields'

/** The image's own size, read by loading it. */
function imageSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => resolve({ width: 0, height: 0 })
    image.src = src
  })
}

const linkedScene = (data: any) => (data?.scene?.uuid ? (fromUuidSync(data.scene.uuid) as any) : null)

/** The Map tab when editing: the image, its preview, the linked scene, and the button that makes or updates it. */
export function mapTab(data: any) {
  const image = String(data.mapImage ?? '')
  const scene = linkedScene(data)
  return `<section class="journal-image-map">
    <label class="journal-field">${esc(t('MapImage'))}
      <span class="journal-map-path"><input type="text" data-path="mapImage" value="${esc(image)}" placeholder="${esc(t('MapImagePlaceholder'))}">
      <button type="button" class="journal-map-browse" data-tooltip="${esc(t('Browse'))}" aria-label="${esc(t('Browse'))}"><i class="fa-solid fa-file-image"></i></button></span>
    </label>
    ${image ? `<img class="journal-map-preview" src="${esc(image)}" alt="${esc(t('MapImage'))}">` : `<p class="hint">${esc(t('MapImageHint'))}</p>`}
    ${renderSlot('scene', 'scene', data.scene, t('MapScene'))}
    ${
      game.user.isGM
        ? `<div class="journal-map-buttons">
      <button type="button" class="journal-map-make bright" ${image ? '' : 'disabled'}><i class="fa-solid fa-map"></i> ${esc(t(scene ? 'MapSceneUpdate' : 'MapSceneMake'))}</button>
      ${scene ? `<button type="button" class="journal-map-view"><i class="fa-solid fa-eye"></i> ${esc(t('MapSceneView'))}</button>` : ''}
    </div><p class="hint">${esc(t('MapSceneHint'))}</p>`
        : ''
    }
  </section>`
}

/** The map at the top of the page when reading it: the image (click to open it), and the GM's scene button. */
export function mapView(data: any) {
  const image = String(data.mapImage ?? '')
  const scene = linkedScene(data)
  if (!image && !scene) return ''
  return `<figure class="journal-map-figure">
    ${image ? `<img class="journal-map-preview journal-map-popout" src="${esc(image)}" alt="${esc(t('MapImage'))}" data-tooltip="${esc(t('MapOpenImage'))}">` : ''}
    ${scene && game.user.isGM ? `<figcaption><button type="button" class="journal-map-view"><i class="fa-solid fa-eye"></i> ${esc(t('MapSceneView'))}</button></figcaption>` : ''}
  </figure>`
}

/** Make a scene from the page's image, or point its linked scene at the new image; then link it on the page. */
export async function makeMapScene(page: any) {
  const src = String(page.system.mapImage ?? '').trim()
  if (!src || !game.user.isGM) return
  const data = mapSceneData(page.name, src, await imageSize(src))
  let scene = linkedScene(page.system)
  if (scene) {
    // The image goes on the scene's first level (Foundry V14), whatever that level is called.
    const level = scene.levels?.contents?.[0] ?? scene.levels?.[0]
    await scene.update({ width: data.width, height: data.height })
    if (level) await level.update({ 'background.src': src })
  }
  else scene = await (CONFIG as any).Scene.documentClass.create({ ...data, navigation: false })
  if (!scene) return
  try {
    const thumb = await scene.createThumbnail()
    if (thumb?.thumb) await scene.update({ thumb: thumb.thumb })
  } catch {}
  await page.update({ 'system.scene': { uuid: scene.uuid, name: scene.name } })
  ui.notifications.info(t('MapSceneMade', { name: scene.name }))
}

/** Wire the map buttons in `root` for `page`; `save` stores a new image path when browsing. */
export function bindMap(root: HTMLElement, page: any, save?: (path: string) => unknown) {
  root.querySelectorAll<HTMLButtonElement>('.journal-map-browse').forEach((button) =>
    button.addEventListener('click', (event) => {
      event.preventDefault()
      const FilePicker = foundry.applications.apps.FilePicker.implementation
      new FilePicker({ type: 'image', current: page.system.mapImage ?? '', callback: (path: string) => save?.(path) }).render(true)
    }),
  )
  root.querySelectorAll<HTMLButtonElement>('.journal-map-make').forEach((button) =>
    button.addEventListener('click', async (event) => {
      event.preventDefault()
      button.disabled = true
      try {
        await makeMapScene(page)
      } finally {
        button.disabled = false
      }
    }),
  )
  root.querySelectorAll<HTMLButtonElement>('.journal-map-view').forEach((button) =>
    button.addEventListener('click', (event) => {
      event.preventDefault()
      linkedScene(page.system)?.view()
    }),
  )
  root.querySelectorAll<HTMLImageElement>('.journal-map-popout').forEach((image) =>
    image.addEventListener('click', () => new foundry.applications.apps.ImagePopout({ src: image.getAttribute('src'), window: { title: page.name } }).render(true)),
  )
}
