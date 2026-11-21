/**
 * The item sheet's Crafting tab (GM only): the recipes that make this item, and the recipes the item teaches when
 * a crawler studies it (a recipe book or blueprint). Drag items, materials, skills and spells onto the drop zones.
 */
import { craftCategories, RECIPES_FLAG, TEACHES_FLAG } from '../actors/crafting'
import { BONUS_KINDS, CRAFT_METHODS, craftDifficulty, craftMinutes, formatMinutes, ITEM_SIZES, normalizeRecipe, randomId, recipeKey, UNLOCK_TYPES, VISIBILITIES } from '../rules/crafting'

const t = (key: string) => game.i18n.localize(`CRAWLSPACE.Craft.${key}`)
const choices = (list: readonly string[], prefix: string) => Object.fromEntries(list.map((id) => [id, `CRAWLSPACE.Craft.${prefix}.${id}`]))

function recipesOf(item: any) {
  return (item.getFlag('crawlspace', RECIPES_FLAG) ?? []).map(normalizeRecipe)
}

export function recipeEditorContext(item: any) {
  const categories = Object.fromEntries(craftCategories().map((category) => [category.id, category.label]))
  const teaches: string[] = item.getFlag('crawlspace', TEACHES_FLAG) ?? []
  return {
    recipes: recipesOf(item).map((recipe: any, index: number) => ({
      ...recipe,
      index,
      computedDifficulty: craftDifficulty({ ...recipe, difficulty: null }),
      computedTime: formatMinutes(craftMinutes({ ...recipe, minutes: null })),
      mundane: recipe.method === 'mundane',
      hidden: recipe.visibility !== 'known',
      junk: ITEM_SIZES.find((size) => size.id === recipe.size)?.junk,
    })),
    categories,
    methods: choices(CRAFT_METHODS, 'Method'),
    kinds: choices(Object.keys(BONUS_KINDS), 'Kind'),
    sizes: Object.fromEntries(ITEM_SIZES.map((size) => [size.id, `${size.label} (${size.junk})`])),
    visibilities: choices(VISIBILITIES, 'Visibility'),
    unlockTypes: choices(UNLOCK_TYPES, 'UnlockType'),
    approvals: { '': 'CRAWLSPACE.Craft.ApprovalFollow', auto: 'CRAWLSPACE.Craft.Approval.auto', gm: 'CRAWLSPACE.Craft.Approval.gm' },
    unlockModes: { all: 'CRAWLSPACE.Craft.UnlockAll', any: 'CRAWLSPACE.Craft.UnlockAny' },
    teaches: teaches.map((key) => {
      const [uuid, id] = key.split('#')
      const doc: any = fromUuidSync(uuid)
      const recipe = (doc?.flags?.crawlspace?.[RECIPES_FLAG] ?? []).find((entry: any) => entry?.id === id)
      return { key, name: doc ? `${doc.name}${recipe?.name ? ` (${recipe.name})` : ''}` : t('MissingRecipe'), img: doc?.img ?? 'icons/svg/hazard.svg', missing: !doc || !recipe }
    }),
  }
}

async function saveRecipes(item: any, recipes: any[]) {
  await item.setFlag('crawlspace', RECIPES_FLAG, recipes)
}

/** What a dropped document reads as: its name, picture, source and kind. */
async function dropped(event: DragEvent) {
  const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event)
  if (data?.type !== 'Item') return null
  return (Item.implementation as any).fromDropData(data)
}

const sourceUuid = (doc: any) => doc?._stats?.compendiumSource ?? doc?.uuid ?? ''

export function bindRecipeEditor(sheet: any, html: HTMLElement) {
  const item = sheet.document
  const root = html.querySelector<HTMLElement>('[data-recipe-editor]')
  if (!root || !game.user.isGM) return
  const update = async (mutate: (recipes: any[]) => void) => {
    const recipes = recipesOf(item)
    mutate(recipes)
    await saveRecipes(item, recipes)
  }

  root.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement
    const field = input.dataset.field
    const card = input.closest<HTMLElement>('[data-recipe]')
    if (!field || !card) return
    const index = Number(card.dataset.recipe)
    const value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value
    update((recipes) => foundry.utils.setProperty(recipes[index], field, value))
  })

  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-recipe-op]')
    if (!button) return
    event.preventDefault()
    const op = button.dataset.recipeOp
    const card = button.closest<HTMLElement>('[data-recipe]')
    const index = Number(card?.dataset.recipe)
    const row = Number(button.dataset.row)
    switch (op) {
      case 'add':
        return update((recipes) => recipes.push(normalizeRecipe({ id: randomId(), category: craftCategories()[0]?.id ?? 'mundane' })))
      case 'delete':
        return foundry.applications.api.DialogV2.confirm({ window: { title: t('DeleteRecipe') }, content: `<p>${t('DeleteRecipeAsk')}</p>` }).then((yes: boolean) => yes && update((recipes) => recipes.splice(index, 1)))
      case 'duplicate':
        return update((recipes) => recipes.splice(index + 1, 0, { ...foundry.utils.deepClone(recipes[index]), id: randomId() }))
      case 'addTag':
        return update((recipes) => recipes[index].ingredients.push({ tag: t('NewTag'), quantity: 1 }))
      case 'addTable':
        return update((recipes) => recipes[index].tables.push({ category: recipes[index].category, tier: 1, upgrades: [] }))
      case 'addCondition':
        return update((recipes) => recipes[index].unlock.conditions.push({ type: 'level', name: '', value: 1 }))
      case 'addJunk':
        return update((recipes) => {
          const recipe = recipes[index]
          const junk = ITEM_SIZES.find((size) => size.id === recipe.size)?.junk ?? 1
          const existing = recipe.ingredients.find((entry: any) => /misc\.? junk/i.test(entry.name ?? ''))
          if (existing) existing.quantity = junk
          else recipe.ingredients.push({ name: 'Misc. Junk', quantity: junk, img: 'icons/environment/settlement/rubble-scrap-refuse-wood-metal.webp' })
        })
      case 'remove': {
        const list = button.dataset.list!
        return update((recipes) => foundry.utils.getProperty(recipes[index], list).splice(row, 1))
      }
      case 'removeTeach': {
        const key = button.dataset.key
        return item.setFlag('crawlspace', TEACHES_FLAG, (item.getFlag('crawlspace', TEACHES_FLAG) ?? []).filter((entry: string) => entry !== key))
      }
      case 'teachOwn': {
        const own = recipesOf(item).map((recipe: any) => recipeKey(item.uuid, recipe.id))
        return item.setFlag('crawlspace', TEACHES_FLAG, [...new Set([...(item.getFlag('crawlspace', TEACHES_FLAG) ?? []), ...own])])
      }
    }
  })

  for (const zone of root.querySelectorAll<HTMLElement>('[data-recipe-drop]')) {
    zone.addEventListener('dragover', (event) => {
      event.preventDefault()
      zone.classList.add('drop-hover')
    })
    zone.addEventListener('dragleave', () => zone.classList.remove('drop-hover'))
    zone.addEventListener('drop', async (event) => {
      event.preventDefault()
      event.stopPropagation()
      zone.classList.remove('drop-hover')
      const doc = await dropped(event)
      if (!doc) return
      const kind = zone.dataset.recipeDrop
      if (kind === 'teaches') {
        const keys = (doc.flags?.crawlspace?.[RECIPES_FLAG] ?? []).map((recipe: any) => recipeKey(doc.uuid, recipe.id))
        if (!keys.length) return ui.notifications.warn(t('NoRecipesOnDrop'))
        return item.setFlag('crawlspace', TEACHES_FLAG, [...new Set([...(item.getFlag('crawlspace', TEACHES_FLAG) ?? []), ...keys])])
      }
      const index = Number(zone.closest<HTMLElement>('[data-recipe]')?.dataset.recipe)
      await update((recipes) => {
        const recipe = recipes[index]
        if (!recipe) return
        if (kind === 'ingredients') {
          if (doc.type === 'skill' || doc.type === 'spell') return recipe.skills.push({ name: doc.name, rank: 1 })
          const existing = recipe.ingredients.find((entry: any) => entry.uuid === sourceUuid(doc) || entry.name === doc.name)
          if (existing) existing.quantity += 1
          else recipe.ingredients.push({ name: doc.name, img: doc.img, uuid: sourceUuid(doc), quantity: 1 })
        } else if (kind === 'requires') {
          if (doc.type === 'skill' || doc.type === 'spell') {
            if (!recipe.skills.some((entry: any) => entry.name === doc.name)) recipe.skills.push({ name: doc.name, rank: 1 })
          } else if (doc.type === 'craftingTable') recipe.tables.push({ category: doc.system.category, tier: Math.floor(Number(doc.system.tier) || 1), upgrades: [] })
          else recipe.tools.push({ name: doc.name, img: doc.img, uuid: sourceUuid(doc), kind: 'item' })
        } else if (kind === 'unlock') {
          if (doc.type === 'skill' || doc.type === 'spell') recipe.unlock.conditions.push({ type: 'skill', name: doc.name, value: 1 })
          else if (doc.type === 'craftingTable') recipe.unlock.conditions.push({ type: 'table', name: doc.system.category, value: Math.floor(Number(doc.system.tier) || 1) })
          else recipe.unlock.conditions.push({ type: 'item', name: doc.name, uuid: sourceUuid(doc) })
        }
      })
    })
  }
}
