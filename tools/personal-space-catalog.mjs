/**
 * The Personal Space catalog: space levels, upgrades, table attachments, guild services and coupons, written for this
 * system from the GM's Personal Space toolkit (tier, floor and suggested prices are the toolkit's GM estimates; the
 * wording is ours). `status` says whether the idea comes from the published game/novels (canon) or is the toolkit's
 * homebrew. Built into packs-src/homebrew-personal-space by tools/build-personal-space-packs.mjs.
 *
 * Automation (actors/personal-space.ts) only acts while a crawler is in the space:
 *   rest.longRestHours  a Long Rest takes this many hours (0: instant)
 *   rest.goodSleepHours a Long Rest also grants Good Sleep for this long
 *   rest.shortRestSlots a Short Rest heals this many more Health Bar slots
 *   training            once a day, one grinding hour counts as this many
 *   advantage           Advantage on these named checks (an Active Effect copied to the crawler)
 */

/** [id, name, kind, category, tier, floor, price, status, footprint, summary, text, automation?] */
const RAW = [
  // Space levels and services
  ['C-001', 'Personal Space (Level 1)', 'level', 'Space Level', 1, 4, 50000, 'canon', 'Base space', 'The starter space: a bathroom, a sofa and screens, cots and room for five crafting tables.', 'A private apartment that opens off any saferoom door once the Personal Space system unlocks on the Fourth Floor. It has the basics and a small crafting corner that holds up to five tables. 50,000 gold is the list price; a hard bargainer can talk the system down, to about 37,500 at best.', { spaceLevel: 1 }],
  ['C-002', 'Personal Space Level 2', 'level', 'Space Level', 1, 4, 100000, 'canon', 'Expansion', 'The space grows and can take kitchen upgrades.', 'More room, and the space can now hold a kitchen. The price is the toolkit\'s estimate.', { spaceLevel: 2 }],
  ['C-003', 'Personal Space Level 3', 'level', 'Space Level', 1, 4, 250000, 'canon', 'Expansion', 'Big enough for major rooms such as a Training Room; can anchor a communal hall.', 'The space is now a headquarters rather than an apartment: it fits major rooms, and joined with another member\'s space it can host a shared common hall. The price is the toolkit\'s estimate.', { spaceLevel: 3 }],
  ['C-004', 'Personal Space Level 4', 'level', 'Space Level', 2, 6, 500000, 'canon', 'Expansion', 'A larger communal base; no special feature of its own.', 'Level 4 exists but adds nothing named beyond more room. Parties usually reach it by joining spaces rather than buying it outright. The price is a conservative estimate.', { spaceLevel: 4 }],
  ['C-005', 'Personal Space Level 5', 'level', 'Space Level', 2, 6, 1000000, 'canon', 'Expansion', 'A manager or helper can attach a space of their own to the common area.', 'At Level 5 a manager or other helper gets a private room joined to the party\'s common area. The canon route is conjoining several Level 3 spaces; buying it directly is a GM convenience.', { spaceLevel: 5 }],
  ['C-006', 'Conjoining Service', 'upgrade', 'Space Service', 1, 4, 5000, 'canon', 'Infrastructure', 'Joins two Personal Spaces into one shared base; 5,000 gold per join.', 'Each join of two spaces costs 5,000 gold, so three spaces need two joins. Members share the installed upgrades, but each upgrade still belongs to whoever bought it: if they leave or die, it goes with them and the space may shrink. Record each crawler as an Owner on the space\'s sheet.'],
  ['C-018', 'Deity Shrine', 'feature', 'Faith Facility', 0, 3, 0, 'canon', 'Small shrine', 'Appears on its own when a crawler\'s worship needs it.', 'A shrine to the crawler\'s god shows up in the space so daily offerings and tithes can go on. It is never bought; use the normal worship rules.'],

  // Beds, kitchens, medical, guests, storage
  ['C-010', 'Ultra-Stabilized Sleep Apparatus', 'upgrade', 'Bed', 1, 4, 250000, 'canon', 'Major room', 'Two hours in it is a full Long Rest, plus Good Sleep for 30 hours.', 'A bed that fits itself to the sleeper\'s body and wounds. A Long Rest in it takes 2 hours instead of 8 and grants the Good Sleep buff (+Floor to every stat) for 30 hours.', { rest: { longRestHours: 2, goodSleepHours: 30 } }],
  ['C-011', 'Tier 2 Instant-Rest Bed', 'upgrade', 'Bed', 2, 6, 1000000, 'canon', 'Major room', 'Press the button: an immediate Long Rest.', 'Activating the bed gives a Long Rest on the spot, with no time passing. It does not grant Good Sleep unless the GM says this model does.', { rest: { longRestHours: 0 } }],
  ['C-012', 'Tier 3 Full-Refresh Bed', 'upgrade', 'Bed', 3, 9, 5000000, 'canon', 'Major room', 'Step across the glowing panel: an instant Long Rest and 30 hours of Good Sleep.', 'Less a bed than a lit floor plate. Crossing it gives an immediate Long Rest and the Good Sleep buff for 30 hours. Normally out of reach before the Ninth Floor.', { rest: { longRestHours: 0, goodSleepHours: 30 } }],
  ['C-015', 'Food Synthesizers', 'upgrade', 'Kitchen', 1, 5, 250000, 'canon', 'Large room', 'Personal food cabinets whose meals give a small all-day buff.', 'Three cabinets serve each crawler a rotating, passable menu. A day\'s meals leave the eater a little tougher: give a minor internal buff of the GM\'s choosing (for example, one extra Health Bar slot from the next Short Rest) rather than percentage math. Needs a Level 2 space.'],
  ['HB-202', 'Banquet Engine', 'upgrade', 'Kitchen', 3, 9, 5000000, 'homebrew', 'Large room (8 units)', 'Once a day per crawler: +1 to a chosen stat for 8 hours.', 'The kitchen plans a meal around the eater\'s day. Once per day each crawler picks a stat and gains +1 to it for 8 hours. An internal buff; it does not stack with another meal buff from the same kitchen line.'],
  ['HB-102', 'Performance Galley', 'upgrade', 'Kitchen', 2, 6, 600000, 'homebrew', 'Large room (8 units)', 'Once a day per crawler: +1 to a chosen stat for 4 hours.', 'Order a meal built for one stat: +1 to it for 4 hours, once per day per crawler. An internal buff that does not stack with another meal from this upgrade.'],
  ['HB-101', 'Decontamination Suite', 'upgrade', 'Bathroom / Medical', 2, 6, 600000, 'homebrew', 'Large room (8 units)', 'Once a day, a 10-minute cycle removes one contamination debuff.', 'Once per day a 10-minute cycle strips one debuff caused by poison, gas, filth, parasites or similar contamination. The GM decides what qualifies; it never touches Divine debuffs, curses, injuries, class or race drawbacks, or story conditions.'],
  ['HB-201', 'Total Reset Spa', 'upgrade', 'Bathroom / Medical', 3, 9, 5000000, 'homebrew', 'Large room (8 units)', 'Once a day: a Long Rest in 2 hours, and one contamination debuff gone.', 'Once per day one crawler spends 2 hours in the spa for the benefits of a Long Rest, and loses one non-Divine, non-injury debuff. It does not heal injuries, lift curses or reset cooldowns a Long Rest wouldn\'t. (The shortened rest is automated; keep the once-a-day limit yourself.)', { rest: { longRestHours: 2 } }],
  ['HB-004', 'First-Aid Alcove', 'upgrade', 'Medical', 1, 4, 50000, 'homebrew', 'Module (2 units)', 'A Short Rest here heals 1 more Health Bar slot.', 'A stocked treatment nook. A Short Rest taken in the space heals one extra Health Bar slot. No effect on combat healing or a Full Day Rest.', { rest: { shortRestSlots: 1 } }],
  ['HB-103', 'Recovery Clinic', 'upgrade', 'Medical', 2, 6, 600000, 'homebrew', 'Large room (8 units)', 'Short Rests heal 6 slots instead of 5; a Long Rest also mends a Minor Injury.', 'A Short Rest in the space heals one more Health Bar slot. A Long Rest here also mends one Minor Injury per crawler. Major Injuries follow the normal rules.', { rest: { shortRestSlots: 1 } }],
  ['HB-215', 'Emergency Ward', 'upgrade', 'Medical', 3, 9, 5000000, 'homebrew', 'Large room (8 units)', 'Once per floor, stabilizes a Dying crawler brought inside at 10% Health.', 'If a Dying crawler reaches the space before their timer runs out, the ward stabilizes them at 10% of their Health Bar, once per floor. It cannot bring back the dead.'],
  ['HB-116', 'NPC Workroom', 'upgrade', 'Manager / Helper', 2, 6, 350000, 'homebrew', 'Small room (4 units)', 'Once a day, one interruption doesn\'t halve the manager\'s crafting output.', 'A proper workshop for a manager. Once per day, one interruption while they craft does not cut the consumables they produce in half. Every other manager crafting limit still applies.'],
  ['HB-014', 'Spare Bunk Module', 'upgrade', 'Guest / Retinue', 1, 4, 100000, 'homebrew', 'Small room (4 units)', 'Four guest bunks for normal rests.', 'Four fold-out bunks. Guests the owners allow in can take normal rests here, but get no shared upgrades, ownership or manager status unless granted separately.'],
  ['HB-211', 'Retinue Wing', 'upgrade', 'Guest / Retinue', 3, 9, 3000000, 'homebrew', 'Large room (8 units)', 'Quarters for up to eight hired NPCs or mercenaries.', 'Eight small rooms off one hall house hired NPCs or mercenaries, who rest normally here. They do not count as housed in guild barracks for guild training.'],
  ['HB-111', 'Secure Vault', 'upgrade', 'Storage / Security', 2, 6, 350000, 'homebrew', 'Small room (4 units)', 'Storage only listed owners and people they authorize can open.', 'Keeps guests and ordinary NPCs out of the party\'s valuables. It does not stop the System, plot events or abilities that explicitly bypass Personal Space security.'],
  ['HB-208', 'Dimensional Vault', 'upgrade', 'Storage / Security', 3, 9, 3000000, 'homebrew', 'Small room (4 units)', 'The same vault from every entrance to the space.', 'Whichever saferoom the party came in through, the vault holds the same contents. Shared storage only: no duplicating items and no reaching it from the field.'],

  // Crafting
  ['C-020', 'Enhanced Crafting Studio', 'upgrade', 'Crafting Facility', 1, 4, 255000, 'canon', 'Large room', 'A dedicated workshop that houses the party\'s crafting tables.', 'A large shared crafting floor. It gives no bonus of its own; it is where the tables live.'],
  ['C-028', 'Crafting Table Upgrade', 'tableUpgrade', 'Crafting Upgrade', 1, 4, 250000, 'canon', 'Module', 'Raises one crafting table by one tier.', 'Raises a table one tier, up to Tier 10 (use the + on the table\'s row on the space\'s sheet). Tables also gain a tier each time their owner reaches a new floor.'],
  ['HB-010', 'Crafting Safety Hood', 'attachment', 'Crafting', 1, 4, 50000, 'homebrew', 'Module (2 units)', 'Once per floor, a Critical Fail at this table counts as a Major Fail.', 'Attach it to a table. Once per floor, a Critical Fail on a crafting check at that table becomes a Major Fail instead; materials are lost or salvaged by the Major Fail result. It cannot stop story disasters or deliberate over-enchanting.'],
  ['HB-009', 'Material Locker', 'upgrade', 'Crafting', 1, 4, 50000, 'homebrew', 'Module (2 units)', 'Once a day, Advantage on one Salvage check after a failed craft here.', 'Sorted bins for leftover parts. Once per day, after a failed project in the space, one Salvage check is made with Advantage. It can\'t recover what the rules call unsalvageable.'],
  ['HB-114', 'Cauldron Attachment', 'attachment', 'Crafting Attachment', 2, 6, 350000, 'homebrew', 'Module (2 units)', 'Extra potions in a batch take half the usual extra time.', 'Attach it to an Alchemy table. When brewing a batch, each potion after the first adds only half its usual time (round down to the minute). Every potion still needs its ingredients and the check.'],
  ['HB-115', 'Infusion Station', 'attachment', 'Crafting Attachment', 2, 6, 600000, 'homebrew', 'Module (2 units)', 'Once per floor, reroll a failed Alchemy or Arcane crafting check at this table.', 'Attach it to a table. Once per floor, reroll one failed Alchemy or Arcane crafting check made there; the new roll stands. No rerolling a deliberate over-enchant or a roll already rerolled.'],
  ['HB-113', 'Speed Multiplier Attachment', 'attachment', 'Crafting Attachment', 2, 6, 600000, 'homebrew', 'Module (2 units)', 'Projects at this table take a quarter less time.', 'Attach it to a table. Work done there takes 25% less time, rounded down to the half hour, but never below 30 minutes unless the project was already shorter.'],
  ['HB-112', 'Precision Fabrication Lab', 'upgrade', 'Crafting', 2, 6, 1000000, 'homebrew', 'Large room (8 units)', 'Once a day, one project treats its tables as one tier higher.', 'Once per day, one crafting project finished in the lab treats each table it needs as one tier higher (to Tier 10) before the lowest-table rule.'],
  ['HB-207', 'Adaptive Crafting Nexus', 'upgrade', 'Crafting', 3, 9, 5000000, 'homebrew', 'Major room (12 units)', 'Once a day, one project treats every required table as one tier higher.', 'Once per day, every table one project needs counts one tier higher (to Tier 10), applied before the lowest-table rule. One project only.'],

  // Utilities and fixtures
  ['C-013', 'Automatic Shower', 'upgrade', 'Bathroom', 1, 4, 250000, 'canon', 'Fixture', 'A thorough automated wash that leaves a short buff and makes the crawler harder to track.', 'Give a short internal buff of the GM\'s choosing after a shower (for example, Advantage on the next Stealth check before leaving the saferoom) instead of the novel\'s percentages.'],
  ['C-019', 'Bijou Fairy Cote', 'feature', 'Patron Communication', 0, 3, 0, 'canon', 'Fixture', 'A Bard\'s patron sends and receives messages by fairy.', 'Appears for a Bard whose patron needs physical messages. A trip takes 5 minutes each way on the same floor, plus 5 minutes per floor between. Never bought.'],
  ['C-014', 'Cleaner Bot', 'upgrade', 'Housekeeping', 1, 4, 25000, 'canon', 'Fixture', 'A flying robot that keeps the space clean.', 'Blood, gore and everyday mess disappear without a roll. Magical hazards, active threats and plot evidence are the GM\'s call.'],
  ['C-016', 'Popcorn Machine', 'upgrade', 'Entertainment Amenity', 1, 4, 25000, 'canon', 'Fixture', 'A popcorn machine. That is the whole upgrade.', 'An official reward with no stated rules. Flavor, or a tiny morale perk if the table wants one.'],
  ['C-017', 'Pudding Machine', 'upgrade', 'Food Amenity', 1, 5, 50000, 'canon', 'Fixture', 'A sponsored pudding dispenser.', 'An official reward with no stated rules. Flavor by default, or a minor short food buff.'],
  ['HB-011', 'Environmental Comfort Controls', 'upgrade', 'Utility / Rest', 1, 4, 50000, 'homebrew', 'Infrastructure (0 units)', 'Heat, cold, noise and damp never spoil a rest here.', 'Mundane environmental trouble does not interfere with resting in the space. It grants no Resistance and does nothing against magical hazards.'],
  ['HB-001', 'Loadout Locker', 'upgrade', 'Storage', 1, 4, 25000, 'homebrew', 'Fixture (1 unit)', 'Save three loadouts; switching takes a minute inside the space.', 'Store up to three named gear and Hotlist setups. Swapping to one takes 1 minute in the space, never in combat. It adds no inventory room and ignores no gear-slot rule.'],
  ['HB-217', 'Rapid Loadout Conveyor', 'upgrade', 'Storage', 3, 9, 1500000, 'homebrew', 'Module (2 units)', 'Swap saved loadouts instantly inside the space.', 'Saved loadouts swap at once while in the space. Gear slots, ownership, curses and equip limits still apply; useless in combat or outside.'],
  ['HB-212', 'Reality Scrubber', 'upgrade', 'Housekeeping / Utility', 3, 9, 3000000, 'homebrew', 'Module (2 units)', 'Cleans mundane contamination; once a day neutralizes one lasting hazard.', 'Between outings it clears ordinary blood, smoke, toxins and residue from the common areas. Once per day it neutralizes one lasting nonmagical hazard inside the space. No curses, magical hazards, enemies or quest objects.'],
  ['HB-007', 'Recap Theater', 'upgrade', 'Entertainment / Information', 1, 4, 25000, 'homebrew', 'Fixture (1 unit)', 'After a recap, ask the GM one question about what was broadcast.', 'Watch the latest recap, then ask the GM one question; the answer uses only what viewers would have seen. Nothing redacted, private or hidden.'],
  ['HB-008', 'Soundproofing Package', 'upgrade', 'Utility / Privacy', 1, 4, 25000, 'homebrew', 'Infrastructure (0 units)', 'Nobody outside hears ordinary talk inside.', 'Creatures outside the space can\'t overhear normal conversation. The System, the production and magic that pierces saferoom privacy still can.'],

  // Training and magic
  ['C-030', 'Training Room', 'upgrade', 'Training', 1, 4, 250000, 'canon', 'Major room', 'One hour a day of real practice in one non-spell skill.', 'Once a day a crawler trains one non-spell skill for an hour as if using it for real: that hour is a normal grinding hour for the skill, under the usual advancement rules. Needs a Level 3 space.', { training: 1 }],
  ['C-031', "Bomber's Studio", 'upgrade', 'Training', 2, 6, 600000, 'canon', 'Large room', 'Safe practice with explosives, which a Training Room can\'t handle.', 'Time here counts as grinding hours for explosives skills under the normal rules.'],
  ['C-032', 'Magic Workshop', 'upgrade', 'Magic Training', 2, 6, 1000000, 'canon', 'Major room', 'Spell training and magic-boosting functions.', 'Practice here uses the normal spell and skill advancement rules. It teaches no new spells by itself.'],
  ['C-033', 'Ultimate Training Room', 'upgrade', 'Training', 4, 10, 10000000, 'canon', 'Major room', 'Up to six training hours a day across six skills, with every kind of practice in one room.', 'The top training room: up to six hours a day spread over up to six skills or spells, covering regular, magic, explosives and crafting practice, and it shows progress toward each advancement. Keep the normal advancement limits. No normal floor unlocks it.'],
  ['HB-015', 'Compact Practice Nook', 'upgrade', 'Training', 1, 4, 100000, 'homebrew', 'Small room (4 units)', 'One hour a day counts as a grinding hour for a non-combat skill of Rank 5 or lower.', 'A cramped practice corner. One session a day is a grinding hour for one non-combat skill at Rank 5 or below; no spells, passives or combat skills.', { training: 1 }],
  ['HB-106', 'Adaptive Combat Simulator', 'upgrade', 'Training', 2, 6, 1000000, 'homebrew', 'Major room (12 units)', 'Once a day, one hour counts as 2 grinding hours toward a combat skill.', 'One 1-hour session a day counts as two grinding hours for one combat skill. A skill still can\'t be ground twice in one day.', { training: 2 }],
  ['HB-107', 'Skill Lab', 'upgrade', 'Training', 2, 6, 600000, 'homebrew', 'Large room (8 units)', 'Once a day, one hour counts as 2 grinding hours toward a non-combat skill.', 'One 1-hour session a day counts as two grinding hours for one non-combat skill. The player describes how the lab simulates it.', { training: 2 }],
  ['HB-108', 'Spell Practice Chamber', 'upgrade', 'Magic / Training', 2, 6, 1000000, 'homebrew', 'Major room (12 units)', 'Once a day, one hour counts as 2 grinding hours toward a spell or magic skill.', 'One 1-hour session a day counts as two grinding hours for one spell or magic skill. It doesn\'t waive mana costs in real fights or grant spells.', { training: 2 }],
  ['HB-205', 'Mastery Arena', 'upgrade', 'Training', 3, 9, 5000000, 'homebrew', 'Major room (12 units)', 'Once a day, one hour counts as 3 grinding hours.', 'One 1-hour session a day counts as three grinding hours for one eligible skill. Normal grinding limits still apply.', { training: 3 }],
  ['HB-206', 'Arcane Crucible', 'upgrade', 'Magic / Training', 3, 9, 5000000, 'homebrew', 'Major room (12 units)', 'Once per floor, one eligible magic advancement check with Advantage.', 'After an hour of practice, once per floor, make one magic or spell advancement check that is already allowed with Advantage. It never creates an extra roll.'],
  ['HB-216', 'Holo-Scenario Archive', 'upgrade', 'Training / Tactical', 3, 9, 3000000, 'homebrew', 'Large room (8 units)', 'Replays up to three fought foes; reviewing one gives Advantage on a Tactics or Perception check.', 'Store up to three Mob or Boss profiles from real fights. Once a day, a 30-minute review gives Advantage on one Tactics or Perception check about one of them before the next Long Rest. It never reveals what the party didn\'t see. (While in the space, the crawler has Advantage on Tactics and Perception; keep the once-a-day limit yourself.)', { advantage: 'Tactics, Perception' }],

  // Pets and mounts
  ['C-040', 'Basic Kennel', 'upgrade', 'Pet Facility', 1, 4, 100000, 'canon', 'Small room', 'A kennel that gives a pet small buffs.', 'Give short pet buffs or Animal Handling help using the normal pet rules.'],
  ['C-041', 'Basic Stable', 'upgrade', 'Mount Facility', 1, 4, 100000, 'canon', 'Small room', 'Stabling for mounts.', 'No details are given; tie any benefit to Riding, recovery or mount care rather than a new subsystem.'],
  ['C-043', 'Upgraded Litterbox', 'upgrade', 'Pet Amenity', 2, 6, 50000, 'canon', 'Fixture', 'A very fancy litterbox.', 'Litter takes care of itself. No combat benefit.'],
  ['C-042', 'Upgraded Pet Shower', 'upgrade', 'Pet Bathroom', 2, 6, 350000, 'canon', 'Module', 'Washes dungeon grime and blood out of a pet\'s coat.', 'At the least, a pet leaves clean and odor-free. Any grooming bonus is a small GM effect.'],
  ['HB-005', 'Pet Grooming Station', 'upgrade', 'Pet', 1, 4, 50000, 'homebrew', 'Module (2 units)', 'After grooming, Advantage on the next Animal Handling check with that pet.', 'Fifteen minutes of grooming gives Advantage on the next Animal Handling check with that pet before the next Long Rest, once per pet per day. (While in the space, the crawler has Advantage on Animal Handling.)', { advantage: 'Animal Handling' }],
  ['HB-104', 'Beast Recovery Den', 'upgrade', 'Pet', 2, 6, 350000, 'homebrew', 'Small room (4 units)', 'A bonded pet\'s Long Rest here restores it to full Health.', 'A bonded pet that takes a Long Rest here returns to full Health, and its owner has Advantage on the next Animal Handling check with it before the following Long Rest. No undoing level loss, death, curses or special conditions.'],
  ['HB-203', 'Monster Performance Habitat', 'upgrade', 'Pet', 3, 9, 3000000, 'homebrew', 'Large room (8 units)', 'After an hour of training: Advantage on Animal Handling and +1 damage on the pet\'s first hit.', 'Once per pet per day, an hour of training gives the owner Advantage on the next Animal Handling check with it, and the pet +1 damage on its first successful attack next combat.'],
  ['HB-006', 'Tack & Saddle Locker', 'upgrade', 'Mount', 1, 4, 50000, 'homebrew', 'Module (2 units)', 'After preparing, Advantage on the next Riding check with that mount.', 'Fifteen minutes of preparation gives Advantage on the next Riding check with that mount before the next Long Rest, once per mount per day. A proper saddle and a rideable mount are still needed. (While in the space, the crawler has Advantage on Riding.)', { advantage: 'Riding' }],
  ['HB-105', 'Recovery Stable', 'upgrade', 'Mount', 2, 6, 350000, 'homebrew', 'Small room (4 units)', 'A mount\'s Short Rest here heals 2 slots; after a Long Rest, Advantage on its first Riding check.', 'A mount resting briefly here heals 2 Health Bar slots, never past its maximum. After a Long Rest, the first Riding check with it has Advantage.'],
  ['HB-204', 'War Mount Hangar', 'upgrade', 'Mount', 3, 9, 3000000, 'homebrew', 'Large room (8 units)', 'A mount\'s Long Rest here restores it fully; once a day, Advantage on a combat Riding check.', 'A mount that takes a Long Rest here returns to full Health. Once a day the rider has Advantage on the first Riding check made in combat or rough terrain. No new levels, attacks or immunities for the mount.'],

  // Social, quests and commerce
  ['C-052', "Adventurer's, Inc. Employment Agency", 'upgrade', 'Quest / Jobs', 1, 4, 100000, 'canon', 'Fixture', 'A job board of dungeon side work.', 'Fill it with bounties, escorts, recovery contracts and other paid side jobs.'],
  ['C-053', 'Naughty Boys Employment Agency', 'upgrade', 'Quest / Jobs', 1, 4, 500000, 'canon', 'Fixture', 'Specialized quests with specialized rewards.', 'Only offer it once the crawlers have earned access, and make its jobs strange enough to be worth the price.'],
  ['C-054', 'Marketplace Interface (Tier 1)', 'upgrade', 'Commerce', 1, 5, 250000, 'canon', 'Fixture', 'A virtual store: basic potions and scrolls, rotating stock, selling and later auctions.', 'Buy basics and rotating items, sell loot, and later bid in auctions from inside the space. A crawler\'s price modifiers apply.'],
  ['C-055', 'Marketplace Interface (Tier 2)', 'upgrade', 'Commerce', 2, 6, 500000, 'canon', 'Fixture', 'The same marketplace, a tier up, at twice the price.', 'As the Tier 1 marketplace with the next tier\'s stock.'],
  ['C-051', 'Quest Screen', 'upgrade', 'Quest', 1, 4, 90000, 'canon', 'Fixture', 'Lists the quests available in the current area.', 'Show the quests and known details, never hidden objectives or secret consequences.'],
  ['C-050', 'Social Screen', 'upgrade', 'Social', 1, 4, 50000, 'canon', 'Fixture', 'A curated feed of what the audience says about the crawler.', 'Share audience reactions, memes, rumors and sponsor chatter. No set numeric bonus.'],
  ['HB-003', 'Appraisal Kiosk', 'upgrade', 'Commerce', 1, 4, 50000, 'homebrew', 'Fixture (1 unit)', 'Once a day, Advantage on a Determine Value check here.', 'Once per day, one Determine Value check on an item examined in the space has Advantage. It reveals nothing Determine Value wouldn\'t. (While in the space, the crawler has Advantage on Determine Value.)', { advantage: 'Determine Value' }],
  ['HB-109', 'Audience Analytics Suite', 'upgrade', 'Social', 2, 6, 350000, 'homebrew', 'Module (2 units)', 'Learn a current audience trend; playing into it gives Advantage on a Popularity check.', 'Once a session the GM shares one real audience trend about the party. A crawler who leans into it makes their next check that could earn Popularity with Advantage, if used before the session ends.'],
  ['HB-013', 'Basic Map Table', 'upgrade', 'Quest / Tactical', 1, 4, 100000, 'homebrew', 'Small room (4 units)', 'Once a day, Advantage on an Investigation, Survival or Tactics check over a map you own.', 'Once per day, Advantage on one Investigation, Survival or Tactics check that works from a map the party owns. It shows nothing undiscovered. (While in the space, the crawler has Advantage on those checks.)', { advantage: 'Investigation, Survival, Tactics' }],
  ['HB-117', 'Tactical Map Room', 'upgrade', 'Quest / Tactical', 2, 6, 600000, 'homebrew', 'Large room (8 units)', 'After 15 minutes of planning, Advantage on an Investigation, Survival or Tactics check.', 'Once per day, after 15 minutes of planning, the party has Advantage on one Investigation, Survival or Tactics check tied to a known map, route or active quest. (While in the space, the crawler has Advantage on those checks.)', { advantage: 'Investigation, Survival, Tactics' }],
  ['HB-119', 'Quest Operations Desk', 'upgrade', 'Quest / Social', 2, 6, 350000, 'homebrew', 'Module (2 units)', 'Once a day, a clean summary of one active quest.', 'Pick an active quest: the GM sums up its objectives, timers, places and known failure conditions, using only what the party has learned.'],
  ['HB-210', 'Predictive Ops Center', 'upgrade', 'Quest / Tactical', 3, 9, 5000000, 'homebrew', 'Large room (8 units)', 'Once a day, one useful tactical clue from what the party already knows.', 'Ask one concrete question about an active quest, known foe or mapped area; the GM gives one clue the party could reasonably work out. No hidden System facts, future events or private thoughts.'],
  ['HB-118', 'Private Broadcast Booth', 'upgrade', 'Social / Entertainment', 2, 6, 600000, 'homebrew', 'Small room (4 units)', 'Once per floor, record a performance; an Amazing Success or Critical gains +1 Popularity.', 'Once per floor a crawler records a short public piece. An Amazing Success or Critical on the Performance check earns +1 Popularity; the GM sets the Difficulty.'],
  ['HB-209', 'Sponsor Operations Studio', 'upgrade', 'Social / Patron', 3, 9, 3000000, 'homebrew', 'Small room (4 units)', 'Once per floor, Advantage on a sponsor-facing social check after preparing.', 'Once per floor, after 30 minutes of preparation, Advantage on one Good First Impression, Negotiation or Performance check with a sponsor, patron or outworlder who cares about presentation. (While in the space, the crawler has Advantage on those checks.)', { advantage: 'Good First Impression, Negotiation, Performance' }],
  ['HB-213', 'Interfloor Brokerage Terminal', 'upgrade', 'Commerce', 3, 9, 5000000, 'homebrew', 'Module (2 units)', 'Once per floor, one rare listing at full market price.', 'The GM offers one rare item fit for the floor, about Gold or Platinum box quality, at full market value. No unique, Celestial or restricted items unless the story allows.'],
  ['HB-002', 'Trophy Display Wall', 'upgrade', 'Social / Decoration', 1, 4, 25000, 'homebrew', 'Fixture (1 unit)', 'Once per floor, mounting a new boss or quest trophy gives an owner +1 Popularity.', 'The GM decides what counts as a real trophy. One award per encounter.'],
  ['HB-110', 'Vendor Aggregator', 'upgrade', 'Commerce', 2, 6, 600000, 'homebrew', 'Module (2 units)', 'Once a day, after a Determine Value check, a 10% better deal (up to 50,000 gold).', 'After a successful Determine Value check, one purchase or sale shifts 10% in the party\'s favor, to at most 50,000 gold. The GM may exclude unique, quest, sponsor or auction items.'],
  ['HB-012', 'Wardrobe & Costume Wall', 'upgrade', 'Social', 1, 4, 50000, 'homebrew', 'Module (2 units)', 'Once a session, Advantage on a check where the outfit matters.', 'Once a session, Advantage on one Good First Impression or Performance check where clothing or presentation really matters; the player says how. No armor or magic.'],

  // Travel and guild
  ['C-060', 'Tier 3 Doggie Door', 'upgrade', 'Travel', 3, 9, 5000000, 'canon', 'Door', 'Leave the space through any door the owner has used on this floor.', 'Turns every door the owner has already passed through on the current floor into an exit, with access controls for guests and party. It adds no new destinations.'],
  ['C-061', 'Tier 3 Teleport Portal', 'upgrade', 'Travel', 3, 9, 3000000, 'canon', 'Portal', 'A teleport portal; its destinations are up to the GM.', 'Canon confirms these exist at Tier 3 but not how they work. Keep its destinations modest and no stronger than the Doggie Door.'],
  ['HB-214', 'Waypoint Control Console', 'upgrade', 'Travel', 3, 9, 1500000, 'homebrew', 'Module (2 units)', 'Favorites, a default exit and access presets for a Doggie Door.', 'Adds ten favorite exits, a default exit and group permissions to an installed Doggie Door. Every exit must still be a door used on this floor.'],
  ['C-070', 'Guild Charter', 'guild', 'Guild', 0, 6, 500000, 'canon', 'Guild structure', 'Founds a guild of up to five parties or individuals with a shared common area.', 'Members\' spaces gain a common area; private party areas stay closed unless opened. Track the leader, permissions, membership, dues and treasury.'],
  ['C-071', 'Guild Environmental Licensing', 'guild', 'Guild Service', 0, 6, 0, 'canon', 'Guild service', 'Shares an existing environmental upgrade with the whole guild for a fee.', 'Suggested fee: 10% of the upgrade\'s price, at least 25,000 and at most 250,000 gold. The upgrade keeps its owner; unique or personal effects may be excluded.'],
  ['C-072', 'Guild Shared Experience', 'guild', 'Guild Service', 0, 6, 1000000, 'canon', 'Guild service', 'Guild members advance more like one party.', 'Only use it with a clear shared-leveling house rule; the novels\' experience math doesn\'t exist here.'],
  ['C-074', 'Guild Barracks (20)', 'guild', 'Guild Retinue', 0, 6, 2000000, 'canon', 'Guild major room', 'Houses 20 mercenaries, who can then use the Mercenary Training Arcade.', 'Track the 20 places. Mercenaries housed in private spaces don\'t get the arcade\'s training.'],
  ['C-075', 'Guild Barracks Expansion (100)', 'guild', 'Guild Retinue', 0, 6, 5000000, 'canon', 'Guild major room', 'Raises the barracks from 20 to 100 mercenaries.', 'A bigger barracks, same rules.'],
  ['C-073', 'Mercenary Training Arcade', 'guild', 'Guild Training', 0, 6, 5000000, 'canon', 'Guild major room', 'Trains and levels mercenaries housed in the guild barracks.', 'Only barracks residents qualify for its advancement.'],
  ['C-076', 'Guild-wide Doggie Door License', 'guild', 'Guild Travel', 3, 9, 25000000, 'canon', 'Guild infrastructure', 'Gives the Doggie Door\'s door network to the whole guild.', 'No new destinations: every exit is still a door already used on the current floor.'],
  ['C-077', 'Dimensional Hangar', 'guild', 'Guild Travel', 3, 9, 25000000, 'canon', 'Guild infrastructure', 'An elevator to a hangar for airships; up to three member spaces become airports.', 'Airships can be docked, repaired and upgraded there. Track the three airports and where each ship is.'],
  ['HG-007', 'Guild Armory Vault', 'guild', 'Guild / Storage', 3, 9, 15000000, 'homebrew', 'Major room (12 units)', 'Secure guild storage for the leader, officers and quartermasters.', 'Access control only: no duplication and no reaching it from the field.'],
  ['HG-006', 'Guild Broadcast Hall', 'guild', 'Guild / Social', 2, 6, 1750000, 'homebrew', 'Large room (8 units)', 'Once per floor, a guild performance; a big success gives a participant +1 Popularity.', 'Use a Performance skill at a Difficulty the GM sets. An Amazing Success or Critical gives one chosen participant +1 Popularity.'],
  ['HG-011', 'Guild Food Hall', 'guild', 'Guild / Kitchen', 2, 6, 3000000, 'homebrew', 'Large room (8 units)', 'Once a day, up to twenty members get the kitchen\'s minor meal buff.', 'Use whatever minor meal buff the campaign\'s kitchens give. Meal buffs from one source don\'t stack.'],
  ['HG-012', 'Guild Guest Wing', 'guild', 'Guild / Guest', 2, 6, 3000000, 'homebrew', 'Large room (8 units)', 'Rest space for up to twenty guests, kept out of private areas.', 'Guests get no membership, ownership, shared experience or treasury access.'],
  ['HG-002', 'Guild Infirmary', 'guild', 'Guild / Medical', 2, 6, 5000000, 'homebrew', 'Major room (12 units)', 'Short Rests here heal 1 more slot; a Long Rest mends one Minor Injury.', 'Only while resting in the infirmary. One Minor Injury per Long Rest.', { rest: { shortRestSlots: 1 } }],
  ['HG-001', 'Guild Quartermaster Office', 'guild', 'Guild / Commerce', 2, 6, 3000000, 'homebrew', 'Large room (8 units)', 'Once a day, the quartermaster has Advantage on a guild Determine Value check.', 'The quartermaster can also hand out stored gear without a separate scene. One economic Advantage a day; auctions and unique prices are untouched.'],
  ['HG-009', 'Guild Sponsor Suite', 'guild', 'Guild / Social', 3, 9, 7500000, 'homebrew', 'Large room (8 units)', 'Once per floor, Advantage on one sponsor-facing social check.', 'One chosen crawler gets Advantage on a Negotiation, Good First Impression or Performance check with a reachable sponsor, patron or outworlder. It never forces agreement.'],
  ['HG-005', 'Guild Stable Yard', 'guild', 'Guild / Mount', 2, 6, 3000000, 'homebrew', 'Large room (8 units)', 'Stabling for ten mounts; a Long Rest here restores a mount fully.', 'No Riding bonus, and no making unsuitable creatures rideable.'],
  ['HG-008', 'Guild Transit Control', 'guild', 'Guild / Travel', 3, 9, 25000000, 'homebrew', 'Major room (12 units)', 'One console to manage up to twenty travel endpoints and airport permissions.', 'Adds no destinations; every endpoint must already be legal under an installed travel upgrade.'],
  ['HG-003', 'Guild War Room', 'guild', 'Guild / Tactical', 2, 6, 3000000, 'homebrew', 'Large room (8 units)', 'Once a day, a planned operation gets Advantage on its first Tactics or Investigation check.', 'After 30 minutes of planning, for one declared operation, not every roll.'],
  ['HG-004', 'Guild Workshop Annex', 'guild', 'Guild / Crafting', 2, 6, 5000000, 'homebrew', 'Major room (12 units)', 'Holds ten crafting tables; once a day one project\'s lowest table counts a tier higher.', 'The tables are still bought and owned normally; the annex adds room and the daily +1 tier (to Tier 10).'],
  ['HG-010', 'Mercenary Command Center', 'guild', 'Guild / Retinue', 3, 9, 15000000, 'homebrew', 'Large room (8 units)', 'Once a day, Advantage on a Tactics check to coordinate housed mercenaries.', 'No damage bonus, extra capacity or mercenary levels.'],

  // Coupons
  ['C-086', '5% Personal Space Discount Coupon', 'coupon', 'Coupon', 0, 4, 0, 'canon', 'Coupon', 'Takes 5% off a qualifying Personal Space purchase.', 'Read the coupon as written.'],
  ['C-082', 'Crafting Table Upgrade Coupon', 'coupon', 'Coupon', 1, 4, 0, 'canon', 'Coupon', 'Raises one crafting table by a tier (worth about 250,000 gold).', 'Use the + on the table\'s row on the space\'s sheet.'],
  ['C-084', 'Free Level 3 Personal Space Coupon', 'coupon', 'Coupon', 1, 4, 0, 'canon', 'Coupon', 'A Personal Space that starts at Level 3.', 'Worth about 400,000 gold of upgrades.', { spaceLevel: 3 }],
  ['C-083', 'Personal Space Coupon', 'coupon', 'Coupon', 0, 4, 0, 'canon', 'Coupon', 'Grants or upgrades a Personal Space.', 'Use the value it names; a generic one is worth the current purchase price.'],
  ['C-081', 'Tier 1 Crafting Table Coupon', 'coupon', 'Coupon', 1, 4, 0, 'canon', 'Coupon', 'One Tier 1 crafting table (about 25,000 gold).', 'Roll on the Crafting Table table or let the crawler choose.'],
  ['C-080', 'Tier 1 Environmental Upgrade Coupon', 'coupon', 'Coupon', 1, 4, 0, 'canon', 'Coupon', 'Pays for one Tier 1 upgrade up to 250,000 gold.', 'Two coupons can\'t be combined on one purchase.'],
  ['C-085', 'Tier 3 Personal Space Upgrade Coupon', 'coupon', 'Coupon', 3, 9, 0, 'canon', 'Coupon', 'Pays for one Tier 3 upgrade (suggested cap 5,000,000 gold).', 'Read the coupon as written.'],
]

const FOLDERS = {
  level: 'Space Levels & Services',
  feature: 'Space Levels & Services',
  tableUpgrade: 'Crafting & Attachments',
  attachment: 'Crafting & Attachments',
  guild: 'Guild',
  coupon: 'Coupons',
}
const folderOf = (kind, tier) => FOLDERS[kind] ?? (tier ? `Tier ${tier} Upgrades` : 'Space Levels & Services')

const ICONS = {
  Bed: 'icons/svg/sleep.svg',
  Kitchen: 'icons/consumables/food/bowl-stew-brown.webp',
  Medical: 'icons/svg/regen.svg',
  Training: 'icons/skills/melee/weapons-crossed-swords-yellow.webp',
  Crafting: 'icons/tools/smithing/anvil.webp',
  Pet: 'icons/svg/pawprint.svg',
  Mount: 'icons/environment/settlement/stable.webp',
  Travel: 'icons/svg/door-exit.svg',
  Commerce: 'icons/commodities/currency/coins-plain-stack-gold.webp',
  Coupon: 'icons/sundries/documents/document-sealed-signatures-red.webp',
  Guild: 'icons/environment/settlement/castle.webp',
  Space: 'icons/environment/settlement/house-two-stories-small.webp',
}
function iconFor(kind, category) {
  if (kind === 'coupon') return ICONS.Coupon
  if (kind === 'guild') return ICONS.Guild
  if (kind === 'level') return ICONS.Space
  for (const [word, icon] of Object.entries(ICONS)) if (category.includes(word)) return icon
  return 'icons/svg/house.svg'
}

const p = (text) => `<p>${text.replace(/&/g, '&amp;')}</p>`

export const CATALOG = RAW.map(([ref, name, kind, category, tier, floor, price, status, footprint, summary, text, auto = {}]) => ({
  ref,
  name,
  folder: folderOf(kind, tier),
  img: iconFor(kind, category),
  system: {
    description: p(text),
    notes: '',
    kind,
    category,
    tier,
    floor,
    price,
    status,
    footprint,
    spaceLevel: auto.spaceLevel ?? 0,
    owner: '',
    installed: true,
    attachedTo: '',
    summary,
    rest: { longRestHours: auto.rest?.longRestHours ?? null, goodSleepHours: auto.rest?.goodSleepHours ?? 0, shortRestSlots: auto.rest?.shortRestSlots ?? 0 },
    training: { hours: auto.training ?? 0 },
  },
  advantage: auto.advantage ?? '',
}))

/** Roll tables: [label, formula, rows]. A row is [low, high, catalog ref | homebrew-items table name | text]. */
export const TABLES = [
  ['Personal Space Upgrade (Tier 1)', '1d100', [
    [1, 3, 'C-015'], [4, 6, 'C-010'], [7, 9, 'HB-004'], [10, 12, 'HB-014'], [13, 15, { item: 'Alchemy Table' }], [16, 18, { item: 'Arcanist Table' }],
    [19, 21, { item: 'Armorer Table' }], [22, 24, 'C-028'], [25, 27, { item: 'Engineering Table' }], [28, 30, 'C-020'], [31, 33, { item: 'Metalworking Table' }],
    [34, 36, { item: "Sapper's Table" }], [37, 39, { item: 'Writing Table' }], [40, 42, 'HB-010'], [43, 45, 'HB-009'], [46, 48, 'C-013'], [49, 51, 'C-014'],
    [52, 54, 'C-016'], [55, 57, 'C-017'], [58, 60, 'HB-011'], [61, 63, 'HB-001'], [64, 66, 'HB-007'], [67, 69, 'HB-008'], [70, 72, 'C-030'], [73, 74, 'HB-015'],
    [75, 76, 'C-040'], [77, 78, 'C-041'], [79, 80, 'HB-005'], [81, 82, 'HB-006'], [83, 84, 'C-052'], [85, 86, 'C-054'], [87, 88, 'C-053'], [89, 90, 'C-051'],
    [91, 92, 'C-050'], [93, 94, 'HB-003'], [95, 96, 'HB-013'], [97, 98, 'HB-002'], [99, 100, 'HB-012'],
  ]],
  ['Personal Space Upgrade (Tier 2)', '1d100', [
    [1, 4, 'C-011'], [5, 8, 'HB-101'], [9, 12, 'HB-116'], [13, 16, 'HB-102'], [17, 20, 'HB-103'], [21, 24, 'HB-111'], [25, 28, 'HB-114'], [29, 32, 'HB-115'],
    [33, 36, 'HB-112'], [37, 40, 'HB-113'], [41, 44, 'C-031'], [45, 48, 'C-032'], [49, 52, 'HB-106'], [53, 56, 'HB-107'], [57, 60, 'HB-108'], [61, 64, 'C-043'],
    [65, 68, 'C-042'], [69, 72, 'HB-104'], [73, 76, 'HB-105'], [77, 80, 'C-055'], [81, 84, 'HB-109'], [85, 88, 'HB-118'], [89, 92, 'HB-119'], [93, 96, 'HB-117'],
    [97, 100, 'HB-110'],
  ]],
  ['Personal Space Upgrade (Tier 3)', '1d100', [
    [1, 5, 'C-012'], [6, 10, 'HB-202'], [11, 15, 'HB-208'], [16, 20, 'HB-215'], [21, 25, 'HB-211'], [26, 30, 'HB-201'], [31, 35, 'HB-207'], [36, 40, 'HB-217'],
    [41, 45, 'HB-212'], [46, 50, 'HB-206'], [51, 55, 'HB-216'], [56, 60, 'HB-205'], [61, 65, 'HB-203'], [66, 70, 'HB-204'], [71, 75, 'HB-213'], [76, 80, 'HB-210'],
    [81, 85, 'HB-209'], [86, 90, 'C-060'], [91, 95, 'C-061'], [96, 100, 'HB-214'],
  ]],
  ['Crafting Table', '1d8', [
    [1, 1, { item: 'Alchemy Table' }], [2, 2, { item: 'Arcanist Table' }], [3, 3, { item: 'Armorer Table' }], [4, 4, { item: 'Engineering Table' }],
    [5, 5, { item: 'Metalworking Table' }], [6, 6, { item: "Sapper's Table" }], [7, 7, { item: 'Writing Table' }],
    [8, 8, { text: 'GM\'s choice: a specialty table (the rules allow more kinds than the seven listed).' }],
  ]],
  ['Platinum Box Housing Reward', '1d12', [
    [1, 4, { table: 'Crafting Table' }], [5, 7, 'C-082'], [8, 10, 'C-083'], [11, 11, { table: 'Personal Space Upgrade (Tier 1)' }],
    [12, 12, { text: 'GM\'s choice: a sponsored, odd Personal Space reward. Roll on Weird Amenity for ideas.' }],
  ]],
  ['Weird Amenity', '1d8', [
    [1, 1, 'C-016'], [2, 2, 'C-017'], [3, 3, 'C-014'], [4, 4, 'C-043'], [5, 5, 'HB-007'], [6, 6, 'HB-002'], [7, 7, 'HB-012'],
    [8, 8, { text: 'GM\'s choice: something branded, useful and a little ridiculous.' }],
  ]],
]
