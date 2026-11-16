/**
 * Headshot maker: crop a square from an actor's portrait (or any image) and save it as the actor's headshot
 * (flags.crawlspace.headshot), which the boss battle's VS. overlay shows. Drag to move, scroll or use the
 * slider to zoom. Opened from the actor sheet's menu, the Actors list's context menu, or
 * game.crawlspace.openHeadshotMaker(actor).
 */
import { ActorPopup } from './actions-config'
import { ensureDirectory } from './account-import'
import { loadImage } from './token-maker'
import { HEADSHOT_ZOOM_MAX, headshotCrop } from '../rules/headshot'

const t = (key: string, data?: Record<string, unknown>) => game.i18n.format(`CRAWLSPACE.Headshot.${key}`, data ?? {})
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'actor'
/** The saved headshot's width and height. */
const OUTPUT = 512

export class HeadshotMakerApp extends ActorPopup {
  static DEFAULT_OPTIONS: any = {
    classes: ['crawlspace', 'headshot-maker'],
    position: { width: 340, height: 'auto' },
    window: { icon: 'fa-solid fa-id-badge' },
    actions: {
      chooseImage: HeadshotMakerApp.#onChooseImage,
      reset: HeadshotMakerApp.#onReset,
      save: HeadshotMakerApp.#onSave,
      remove: HeadshotMakerApp.#onRemove,
    },
  }

  static PARTS = { main: { template: 'systems/crawlspace/templates/apps/headshot-maker.hbs' } }

  static open(actor: any) {
    const id = `crawl-headshot-${actor.uuid.replace(/\./g, '-')}`
    const app = (foundry.applications.instances.get(id) as HeadshotMakerApp | undefined) ?? new HeadshotMakerApp(actor, { id })
    return app.render({ force: true })
  }

  source = ''
  image: HTMLImageElement | null = null
  error = ''
  /** Zoom (1 = largest square) and the crop's centre as fractions of the picture. Faces sit high in most portraits. */
  crop = { zoom: 1, x: 0.5, y: 0.3 }
  busy = false

  get title() {
    return `${t('Title')}: ${this.actor.name}`
  }

  get canUpload() {
    return this.editable && game.user.can('FILES_UPLOAD')
  }

  get current() {
    return this.actor.getFlag('crawlspace', 'headshot') ?? ''
  }

  async _prepareContext() {
    if (!this.source) this.source = this.actor.img ?? ''
    if (this.source && this.image?.dataset.source !== this.source) await this.#load(this.source)
    return { ready: !!this.image, error: this.error, zoom: this.crop.zoom, zoomMax: HEADSHOT_ZOOM_MAX, current: this.current, canUpload: this.canUpload, editable: this.editable }
  }

  async #load(src: string) {
    this.error = ''
    this.image = null
    try {
      const image = await loadImage(src)
      image.dataset.source = src
      this.image = image
      this.crop = { zoom: 1, x: 0.5, y: image.naturalHeight > image.naturalWidth ? 0.3 : 0.5 }
    } catch {
      this.error = t('CantRead')
    }
  }

  get #canvas() {
    return (this.element as HTMLElement).querySelector<HTMLCanvasElement>('canvas.headshot-preview')
  }

  #area() {
    return headshotCrop({ width: this.image!.naturalWidth, height: this.image!.naturalHeight }, this.crop)
  }

  #draw(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')!
    context.clearRect(0, 0, canvas.width, canvas.height)
    const { sx, sy, side } = this.#area()
    context.drawImage(this.image!, sx, sy, side, side, 0, 0, canvas.width, canvas.height)
  }

  #redraw() {
    const canvas = this.#canvas
    if (canvas && this.image) this.#draw(canvas)
  }

  #setZoom(zoom: number) {
    this.crop.zoom = Math.min(HEADSHOT_ZOOM_MAX, Math.max(1, zoom))
    const slider = (this.element as HTMLElement).querySelector<HTMLInputElement>('[data-field=zoom]')
    if (slider) slider.value = String(this.crop.zoom)
    this.#settle()
  }

  /** Keep the stored centre where the square actually is, so dragging back from an edge responds at once. */
  #settle() {
    if (!this.image) return
    const { sx, sy, side } = this.#area()
    this.crop.x = (sx + side / 2) / this.image.naturalWidth
    this.crop.y = (sy + side / 2) / this.image.naturalHeight
    this.#redraw()
  }

  /** Move the crop by a distance on the preview, in preview pixels. */
  #pan(dx: number, dy: number) {
    const canvas = this.#canvas
    if (!canvas || !this.image) return
    const { side } = this.#area()
    const rect = canvas.getBoundingClientRect()
    this.crop.x -= (dx * side) / Math.max(1, rect.width) / this.image.naturalWidth
    this.crop.y -= (dy * side) / Math.max(1, rect.height) / this.image.naturalHeight
    this.#settle()
  }

  async _onRender(context: any, options: any) {
    await super._onRender(context, options)
    const root = this.element as HTMLElement
    root.querySelector<HTMLInputElement>('[data-field=zoom]')?.addEventListener('input', (event) => this.#setZoom(Number((event.target as HTMLInputElement).value)))
    const canvas = this.#canvas
    if (!canvas) return
    let last: { x: number; y: number } | null = null
    canvas.addEventListener('pointerdown', (event) => {
      canvas.focus()
      canvas.setPointerCapture(event.pointerId)
      last = { x: event.clientX, y: event.clientY }
    })
    canvas.addEventListener('pointermove', (event) => {
      if (!last) return
      this.#pan(event.clientX - last.x, event.clientY - last.y)
      last = { x: event.clientX, y: event.clientY }
    })
    canvas.addEventListener('lostpointercapture', () => (last = null))
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault()
        this.#setZoom(this.crop.zoom * Math.exp(-Math.sign(event.deltaY) * 0.1))
      },
      { passive: false },
    )
    canvas.addEventListener('keydown', (event) => {
      const direction = ({ ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] } as Record<string, number[]>)[event.key]
      if (!direction) return
      event.preventDefault()
      event.stopPropagation()
      const step = event.shiftKey ? 16 : 4
      this.#pan(direction[0] * step, direction[1] * step)
    })
    this.#redraw()
  }

  static #onChooseImage(this: HeadshotMakerApp) {
    const FilePicker = foundry.applications.apps.FilePicker.implementation
    new FilePicker({
      type: 'image',
      current: this.source,
      callback: (path: string) => {
        this.source = path
        this.render()
      },
    }).render({ force: true })
  }

  static #onReset(this: HeadshotMakerApp) {
    if (!this.image) return
    this.crop = { zoom: 1, x: 0.5, y: this.image.naturalHeight > this.image.naturalWidth ? 0.3 : 0.5 }
    this.#setZoom(1)
  }

  /** Upload the square as a PNG into the world and remember it on the actor. */
  static async #onSave(this: HeadshotMakerApp, _event: Event, button: HTMLButtonElement) {
    if (!this.image || this.busy || !this.canUpload) return
    this.busy = true
    button.disabled = true
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = Math.min(OUTPUT, this.#area().side)
      this.#draw(canvas)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error(t('SaveFailed'))
      const directory = `worlds/${game.world.id}/crawlspace-headshots`
      await ensureDirectory(directory)
      // A new name each time, so nobody sees a cached older headshot.
      const file = new File([blob], `${slug(this.actor.name)}-headshot-${Date.now().toString(36)}.png`, { type: 'image/png' })
      const FilePicker = foundry.applications.apps.FilePicker.implementation
      const result: any = await FilePicker.upload('data', directory, file, {}, { notify: false })
      if (!result?.path) throw new Error(t('SaveFailed'))
      await this.actor.setFlag('crawlspace', 'headshot', result.path)
      ui.notifications.info(t('Saved', { name: this.actor.name }))
      await this.close()
    } catch (error: any) {
      ui.notifications.error(error?.message || t('SaveFailed'))
    } finally {
      this.busy = false
      button.disabled = false
    }
  }

  /** Forget the headshot; the overlay goes back to the portrait. The file stays in the world folder. */
  static async #onRemove(this: HeadshotMakerApp) {
    if (!this.editable || !this.current) return
    await this.actor.unsetFlag('crawlspace', 'headshot')
    this.render()
  }
}
