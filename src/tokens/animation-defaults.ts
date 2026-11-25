/**
 * Default Automated Animations recognitions (autorec entries) for CrawlSpace's weapons, attack skills and spells, so a
 * world with the module gets animations without hand configuration. They use the free JB2A animations only. The module
 * matches an entry when its label appears anywhere in the item's name (spaces and case ignored, longest label first), so
 * "Heal" covers "Heal Self", "Heal Others" and "Heal Critter". The module's own defaults already cover Sword (so
 * Longsword), Dagger, Rapier, Maul, Spear, Bow, Crossbow, Bite, Claw (so Back Claw), Magic Missile and Fireball. Adding
 * entries skips any label the world already has, so a world's own edits are never overwritten.
 */

/** Raise this when entries are added, so worlds that merged an older set merge again (and only get the new labels). */
export const ANIMATION_DEFAULTS_VERSION = 1

type Video = [dbSection: string, menuType: string, animation: string, variant: string, color: string]

function entry(menu: string, label: string, [dbSection, menuType, animation, variant, color]: Video, extra: object = {}) {
  const video = { dbSection, menuType, animation, variant, color, enableCustom: false, customPath: '' }
  return { label, menu, ...extra, primary: { video, ...(extra as any).primary } }
}

/** Melee swings stay swings at any distance (the module would otherwise switch to a thrown arrow past 2 squares). */
const NO_SWITCH = { meleeSwitch: { options: { switchType: 'off' } } }
const melee = (label: string, video: Video) => entry('melee', label, video, NO_SWITCH)
const range = (label: string, video: Video) => entry('range', label, video)
/** `playOn`: 'default' (the targets, else the user), 'target' or 'source'. */
const onToken = (label: string, video: Video, playOn: string, size = 1) => entry('ontoken', label, video, { primary: { options: { playOn, size } } })

const PUNCH: Video = ['melee', 'weapon', 'unarmedstrike', 'physical', 'blue']
const CLAW: Video = ['melee', 'creature', 'claw', '01', 'red']
const CLUB: Video = ['melee', 'weapon', 'club', '01', 'white']
const AXE: Video = ['melee', 'weapon', 'handaxe', '01', 'white']
const GLAIVE: Video = ['melee', 'weapon', 'glaive', '01', 'white']
const BULLET: Video = ['range', 'weapon', 'bullet', '1', 'orange']
const PELLET: Video = ['range', 'weapon', 'bullet', '2', 'orange']
const THROWN: Video = ['range', 'weapon', 'dagger', '01', 'white']
const FROST: Video = ['range', 'spell', 'rayoffrost', '01', 'blue']
const SHOCK: Video = ['range', 'spell', 'witchbolt', '01', 'blue']
const DRAIN: Video = ['range', 'generic', 'energystrand', '01', 'purple']
const SONIC: Video = ['static', 'spell', 'thunderwave', 'center', 'blue']
const HEALING = (color: string): Video => ['static', 'spell', 'generichealing', '01', color]

/** The entries, by Automated Animations menu: the game compendium's and the homebrew compendiums' names. */
export function animationDefaults() {
  return {
    melee: [
      // Unarmed and grappling
      melee('Unarmed', PUNCH),
      melee('Pugilism', PUNCH),
      melee('Wrasslin', PUNCH),
      melee('Noggin', PUNCH),
      melee('Palm Fighter', PUNCH),
      melee('Heel Striker', PUNCH),
      melee('Grapple', PUNCH),
      melee('Shoulder Charge', PUNCH),
      melee('Punch', PUNCH),
      melee('Kick', PUNCH),
      // Natural weapons
      melee('Talons', CLAW),
      melee('Slice Attack', CLAW),
      // Weapons and weapon skills
      melee('Knife', ['melee', 'weapon', 'dagger', '01', 'white']),
      melee('Close Blade', ['melee', 'weapon', 'shortsword', '01', 'white']),
      melee('Saber', ['melee', 'weapon', 'sword', '01', 'white']),
      melee('Club', CLUB),
      melee('Baton', CLUB),
      melee('Staff', CLUB),
      melee('Improvised', CLUB),
      melee('Axe', AXE),
      melee('Hatchet', AXE),
      melee('Polearm', GLAIVE),
      melee('Glaive', GLAIVE),
      melee('Lance', ['melee', 'weapon', 'spear', '01', 'white']),
      melee('Hammer', ['melee', 'weapon', 'hammer', '01', 'white']),
      melee('Warhammer', ['melee', 'weapon', 'warhammer', '01', 'white']),
      melee('Wrench', ['melee', 'weapon', 'wrench', '01', 'white']),
    ],
    range: [
      // Guns, slings and thrown weapons
      range('Gun', BULLET),
      range('Pistol', BULLET),
      range('Rifle', BULLET),
      range('Sidearm', BULLET),
      range('Sling', PELLET),
      range('Catapult', PELLET),
      range('Javelin', THROWN),
      range('Shuriken', THROWN),
      range('Throwing', THROWN),
      // Spells
      range('Fire Fingers', ['range', 'spell', 'scorchingray', '01', 'orange']),
      range('Fireblast', ['range', 'spell', 'fireballbeam', '01', 'orange']),
      range('Ember Palm', ['range', 'spell', 'firebolt', '01', 'orange']),
      range('Icicles', ['range', 'generic', 'iceshard', '01', 'blue']),
      range('Ice Blast', FROST),
      range('Frost Scar', FROST),
      range('Rime Lash', FROST),
      range('Lightning Bolt', ['range', 'spell', 'chainlightning', 'primary', 'blue']),
      range('Shock Treatment', SHOCK),
      range('Static Jab', SHOCK),
      range('Unnecessary Force', ['range', 'spell', 'eldritchblast', '01', 'purple']),
      range('Drain Life', DRAIN),
      range('Soul Collector', DRAIN),
      range('Spirit Siphon', DRAIN),
      range('Dirt Clod', PELLET),
      range('Gravel Flick', PELLET),
    ],
    ontoken: [
      // Healing plays on the targets, or on the caster with none
      onToken('Heal', HEALING('green'), 'default', 1.5),
      onToken('Regeneration', HEALING('green'), 'default', 1.5),
      onToken('Nature', HEALING('green'), 'default', 1.5),
      onToken('First Aid', HEALING('yellow'), 'default', 1.5),
      onToken('Intimate Touches', HEALING('purple'), 'default', 1.5),
      // Spells that strike the targets where they stand
      onToken('Thunderlash', SONIC, 'target'),
      onToken('Earworm', SONIC, 'target'),
      onToken('Mind Tickle', ['static', 'generic', 'outpulse', '01', 'whiteblue'], 'target'),
      onToken('Paladin', ['static', 'spell', 'divinesmite', 'target', 'yellowblue'], 'target'),
      onToken('Bad Faith', ['static', 'spell', 'tollthedead', 'skull', 'green'], 'target'),
      onToken('Solsplash', ['static', 'generic', 'explosion', '01', 'orange'], 'target'),
      onToken('Vine Porn', ['static', 'spell', 'entangle', '01', 'green'], 'target'),
      onToken('Web', ['static', 'spell', 'web', '01', 'white'], 'target'),
      onToken('Holy Aura', ['static', 'spell', 'sacredflame', 'target', 'yellow'], 'source', 1.5),
    ],
  }
}

function autorec() {
  return (globalThis as any).AutomatedAnimations?.AutorecManager
}

/** Add the entries the world lacks. Returns whether the module was there to take them. */
export async function mergeAnimationDefaults(): Promise<boolean> {
  const manager = autorec()
  if (!game.user.isActiveGM || !game.modules.get('autoanimations')?.active || !manager?.mergeMenus) return false
  const version = game.settings.get('autoanimations', 'aaAutorec')?.version
  await manager.mergeMenus(JSON.stringify({ version, ...animationDefaults() }), { submitAll: true })
  return true
}

/** World settings: the toggle, and the defaults version this world last merged. */
export function registerAnimationDefaults() {
  game.settings.register('crawlspace', 'animationDefaultsVersion', { scope: 'world', config: false, type: Number, default: 0 })
  game.settings.register('crawlspace', 'animationDefaults', {
    name: 'CRAWLSPACE.Settings.AnimationDefaults',
    hint: 'CRAWLSPACE.Settings.AnimationDefaultsHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    // Turning it back on adds any default the world has since deleted.
    onChange: (on: boolean) => {
      if (on) void syncAnimationDefaults(true)
    },
  })
}

/** On load (GM): add the entries once per defaults version, unless the world turned them off. */
export async function syncAnimationDefaults(force = false) {
  if (!game.user.isActiveGM || !game.settings.get('crawlspace', 'animationDefaults')) return
  if (!force && Number(game.settings.get('crawlspace', 'animationDefaultsVersion')) >= ANIMATION_DEFAULTS_VERSION) return
  try {
    if (await mergeAnimationDefaults()) await game.settings.set('crawlspace', 'animationDefaultsVersion', ANIMATION_DEFAULTS_VERSION)
  } catch (error) {
    console.warn('CrawlSpace | Automated Animations defaults', error)
  }
}
