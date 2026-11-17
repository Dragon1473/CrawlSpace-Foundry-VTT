/**
 * Vehicles on the table (rules/vehicles.ts): fill one in from the sample vehicles, ram targeted tokens with it
 * (its crawler drives, rolling Driving against each target's Evade), and blow it up at 0%.
 */
import { rollAttack, rollDamage, type Modifier } from '../dice/rolls'
import { explosionFormula, occupantDamage, ramDice, SAMPLE_VEHICLES, sizeValue } from '../rules/vehicles'

const isVehicle = (actor: any) => actor?.type === 'companion' && actor.system?.kind === 'vehicle'
const floorOf = (actor: any) => Number(actor?.system?.details?.floor ?? actor?.system?.floor) || 0

/** Fill in Move, size, DR and occupancy from one of the sample vehicles. */
export async function chooseSampleVehicle(vehicle: any) {
  const options = SAMPLE_VEHICLES.map((sample) => {
    const label = game.i18n.localize(`CRAWLSPACE.Vehicle.Sample.${sample.id}`)
    return `<option value="${sample.id}">${label} · ${game.i18n.format('CRAWLSPACE.Vehicle.SampleStats', { move: sample.move, size: sample.size, dr: sample.dr })}</option>`
  }).join('')
  const id = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize('CRAWLSPACE.Vehicle.SampleTitle') },
    content: `<div class="form-group"><label>${game.i18n.localize('CRAWLSPACE.Vehicle.SampleLabel')}</label><div class="form-fields"><select name="sample">${options}</select></div></div><p class="hint">${game.i18n.localize('CRAWLSPACE.Vehicle.SampleHint')}</p>`,
    ok: { label: game.i18n.localize('CRAWLSPACE.Vehicle.SampleApply'), callback: (_event: Event, button: any) => button.form.elements.sample.value },
    rejectClose: false,
  })
  const sample = SAMPLE_VEHICLES.find((entry) => entry.id === id)
  if (!sample) return
  await vehicle.update({
    'system.move.value': sample.move,
    'system.size': String(sample.size),
    'system.dr.armor': sample.dr,
    'system.companion.occupants': sample.occupants,
  })
}

/**
 * Ram the targeted tokens: the vehicle's crawler rolls Driving against each target's Evade, for 1d6 per size
 * value and per 10 ft of Move. A ram plate (ticked in the roll dialog) adds the Floor.
 */
export async function ramWith(vehicle: any, options: { fast?: boolean } = {}) {
  const driver = vehicle.system.master ? fromUuidSync(vehicle.system.master) : null
  if (!driver) return ui.notifications.warn(game.i18n.localize('CRAWLSPACE.Vehicle.NoDriver'))
  if (!game.user.targets.size) return ui.notifications.warn(game.i18n.localize('CRAWLSPACE.Vehicle.NoTarget'))
  const driving = driver.items.find((item: any) => item.type === 'skill' && item.name.toLowerCase() === 'driving')
  const size = sizeValue(vehicle.system.size)
  const move = Number(vehicle.system.move?.total ?? vehicle.system.move?.value) || 0
  const floor = floorOf(driver)
  const modifiers: Modifier[] = driving
    ? driving.checkModifiers()
    : [{ label: 'DEX', value: Number(driver.system.attributes?.dex?.mod) || 0 }]
  if (floor) modifiers.push({ label: game.i18n.localize('CRAWLSPACE.Vehicle.RamPlate'), value: 0, enabled: false, damage: String(floor), detail: game.i18n.format('CRAWLSPACE.Vehicle.RamPlateDetail', { floor }) })
  const dr = Number(vehicle.system.dr?.total ?? vehicle.system.dr?.armor) || 0
  return rollAttack(
    driver,
    {
      label: game.i18n.format('CRAWLSPACE.Vehicle.RamLabel', { vehicle: vehicle.name }),
      subtitle: driving ? driving.name : game.i18n.localize('CRAWLSPACE.Vehicle.Untrained'),
      img: vehicle.img,
      modifiers,
      sources: ['Driving'],
      damage: { formula: ramDice(size, move), types: ['Bludgeoning'] },
      details: `<p class="hint">${game.i18n.format('CRAWLSPACE.Vehicle.RamRecoil', { dr })}</p>`,
    },
    options,
  )
}

/** What one occupant takes when their vehicle takes `damage` (for the GM's reference in chat). */
export const occupantShare = (damage: number, occupant: any, vehicle: any) =>
  occupantDamage(damage, Number(occupant?.system?.dr?.total) || 0, Number(vehicle?.system?.dr?.total ?? vehicle?.system?.dr?.armor) || 0)

/** At 0% a vehicle explodes: the GM's client rolls size d6 + Floor Fire damage at its crawler. */
export function registerVehicleExplosions() {
  Hooks.on('updateActor', async (actor: any, changes: any, _options: any, userId: string) => {
    if (!isVehicle(actor) || userId !== game.user.id || changes.system?.slotsLost === undefined) return
    if (actor.system.health.value > 0 || actor.getFlag('crawlspace', 'exploded')) return
    await actor.setFlag('crawlspace', 'exploded', true)
    const driver = actor.system.master ? fromUuidSync(actor.system.master) : null
    await rollDamage(actor, { formula: explosionFormula(sizeValue(actor.system.size), floorOf(driver)), types: ['Fire'] }, {
      label: game.i18n.format('CRAWLSPACE.Vehicle.Explodes', { vehicle: actor.name }),
      targets: driver ? [driver.uuid] : [],
      details: `<p class="hint">${game.i18n.localize('CRAWLSPACE.Vehicle.ExplodesHint')}</p>`,
    })
  })
  // Repairing it back above 0% lets it blow up again later.
  Hooks.on('updateActor', (actor: any, _changes: any, _options: any, userId: string) => {
    if (isVehicle(actor) && userId === game.user.id && actor.system.health.value > 0 && actor.getFlag('crawlspace', 'exploded')) actor.unsetFlag('crawlspace', 'exploded')
  })
}
