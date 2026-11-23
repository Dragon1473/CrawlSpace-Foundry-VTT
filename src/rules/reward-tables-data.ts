/**
 * Reward tables (homebrew): the d100 box tables from the community "d100 reward box tables" sheet, one table per box
 * type and tier, Bronze to Legendary. Each row keeps its sheet text (`label`) and says what it gives; rules/reward-tables.ts
 * reads them and loot/reward-tables.ts turns a row into items. Generated from the sheet, then tidied by hand.
 */
import type { RewardRow } from './reward-tables.ts'

export const REWARD_TABLES: Record<string, Record<string, RewardRow[]>> = {
 "Adventurer": {
  "Bronze": [
   {
    "range": [
     1,
     12
    ],
    "label": "10x Torches",
    "kind": "named",
    "count": "10",
    "name": "Torch",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     13,
     20
    ],
    "label": "Non-Motorized Means of Transportation",
    "kind": "named",
    "count": "1",
    "name": "Non-Motorized Means of Transportation",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     21,
     28
    ],
    "label": "1d20 Misc. Junk",
    "kind": "junk",
    "count": "1d20",
    "times": 1
   },
   {
    "range": [
     29,
     36
    ],
    "label": "Random Mundane Weapon",
    "kind": "randomWeapon",
    "dex": false
   },
   {
    "range": [
     37,
     44
    ],
    "label": "1d6 Bandages (Removes Blood Trail Debuff)",
    "kind": "named",
    "count": "1d6",
    "name": "Bandage",
    "note": "Removes Blood Trail Debuff",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     45,
     52
    ],
    "label": "Dynamite Stick (1d6)",
    "kind": "named",
    "count": "1",
    "name": "Dynamite Stick",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "1d6"
    }
   },
   {
    "range": [
     53,
     60
    ],
    "label": "1d10 Gold",
    "kind": "gold",
    "count": "1d10",
    "times": 1
   },
   {
    "range": [
     61,
     68
    ],
    "label": "Healing Potion (Heals 5 Health Bar slots)",
    "kind": "named",
    "count": "1",
    "name": "Healing Potion",
    "note": "Heals 5 Health Bar slots",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     69,
     76
    ],
    "label": "Mana Potion (Full restore)",
    "kind": "named",
    "count": "1",
    "name": "Mana Potion",
    "note": "Full restore",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     77,
     84
    ],
    "label": "Weak Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": null,
    "usage": "scroll"
   },
   {
    "range": [
     85,
     92
    ],
    "label": "A Piece of Armor (1 DR)",
    "kind": "named",
    "count": "1",
    "name": "Piece of Armor",
    "note": "1 DR",
    "item": {
     "type": "equipment",
     "slot": "torso",
     "armorDr": 1
    }
   },
   {
    "range": [
     93,
     100
    ],
    "label": "Weak Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": null,
    "usage": "tome"
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     12
    ],
    "label": "100x Explorer's Biscuits",
    "kind": "named",
    "count": "100",
    "name": "Explorer's Biscuit",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     13,
     20
    ],
    "label": "2d20 Misc. Junk",
    "kind": "junk",
    "count": "2d20",
    "times": 1
   },
   {
    "range": [
     21,
     28
    ],
    "label": "1d10 x 100 Gold",
    "kind": "gold",
    "count": "1d10",
    "times": 100
   },
   {
    "range": [
     29,
     36
    ],
    "label": "Goblin Good Dynamites (2d6)",
    "kind": "named",
    "count": "1",
    "name": "Goblin Good Dynamite",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "2d6"
    }
   },
   {
    "range": [
     37,
     44
    ],
    "label": "2x Poison Antidotes",
    "kind": "named",
    "count": "2",
    "name": "Poison Antidote",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     45,
     52
    ],
    "label": "Good Healing Potion (Heals 6 Health Bar slots)",
    "kind": "named",
    "count": "1",
    "name": "Good Healing Potion",
    "note": "Heals 6 Health Bar slots",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     53,
     60
    ],
    "label": "Weak Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": null,
    "usage": "scroll"
   },
   {
    "range": [
     61,
     68
    ],
    "label": "Magic Paper (for writing Scrolls)",
    "kind": "named",
    "count": "1",
    "name": "Magic Paper",
    "note": "for writing Scrolls",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     69,
     76
    ],
    "label": "Weak Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": null,
    "usage": "tome"
   },
   {
    "range": [
     77,
     84
    ],
    "label": "Magic Item (One roll)",
    "kind": "gear",
    "gear": "item",
    "rolls": 1
   },
   {
    "range": [
     85,
     92
    ],
    "label": "Silver Ring of +2 to a Stat",
    "kind": "named",
    "count": "1",
    "name": "Silver Ring of +2 to a Stat",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     93,
     100
    ],
    "label": "Potion of +1 Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 1,
    "skills": null
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     12
    ],
    "label": "1d6 x 1,000 Gold",
    "kind": "gold",
    "count": "1d6",
    "times": 1000
   },
   {
    "range": [
     13,
     20
    ],
    "label": "Magic Paper (for writing Scrolls)",
    "kind": "named",
    "count": "1",
    "name": "Magic Paper",
    "note": "for writing Scrolls",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     21,
     28
    ],
    "label": "Weak or Medium Magic Scrolls",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": null,
    "usage": "scroll"
   },
   {
    "range": [
     29,
     36
    ],
    "label": "Gold Standard Healing Potion (Heals 7 Health Bar slots and mends one Minor Injury)",
    "kind": "named",
    "count": "1",
    "name": "Gold Standard Healing Potion",
    "note": "Heals 7 Health Bar slots and mends one Minor Injury",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     37,
     44
    ],
    "label": "Weak or Medium Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": null,
    "usage": "tome"
   },
   {
    "range": [
     45,
     52
    ],
    "label": "Workbench for (Crafting, Sapper, Engineer, Alchemy, or Metal Working)",
    "kind": "named",
    "count": "1",
    "name": "Workbench",
    "note": "Crafting, Sapper, Engineer, Alchemy, or Metal Working",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     53,
     60
    ],
    "label": "Magic Armor 2 DR + (One roll)",
    "kind": "gear",
    "gear": "armor",
    "rolls": 1,
    "dr": 2
   },
   {
    "range": [
     61,
     68
    ],
    "label": "Magic Item (Two rolls)",
    "kind": "gear",
    "gear": "item",
    "rolls": 2
   },
   {
    "range": [
     69,
     76
    ],
    "label": "Golden Ring of +3 to a Stat",
    "kind": "named",
    "count": "1",
    "name": "Golden Ring of +3 to a Stat",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     77,
     84
    ],
    "label": "Upgrade Patch",
    "kind": "named",
    "count": "1",
    "name": "Upgrade Patch",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     85,
     92
    ],
    "label": "Scroll of Upgrade",
    "kind": "named",
    "count": "1",
    "name": "Scroll of Upgrade",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     93,
     100
    ],
    "label": "Potion of +2 Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 2,
    "skills": null
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     12
    ],
    "label": "2d6 x 1,000 Gold",
    "kind": "gold",
    "count": "2d6",
    "times": 1000
   },
   {
    "range": [
     13,
     20
    ],
    "label": "2x Medium Magic Scrolls",
    "kind": "spell",
    "count": "2",
    "rarity": "medium",
    "focus": null,
    "usage": "scroll"
   },
   {
    "range": [
     21,
     28
    ],
    "label": "Supreme Healing Potion (Heals 8 Health Bar slots and mends one Minor or Major Injury)",
    "kind": "named",
    "count": "1",
    "name": "Supreme Healing Potion",
    "note": "Heals 8 Health Bar slots and mends one Minor or Major Injury",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     29,
     36
    ],
    "label": "Good Mana Refill Potion (Restores 15 Mana per round for 10 rounds)",
    "kind": "named",
    "count": "1",
    "name": "Good Mana Refill Potion",
    "note": "Restores 15 Mana per round for 10 rounds",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     37,
     44
    ],
    "label": "Medium Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "medium",
    "focus": null,
    "usage": "tome"
   },
   {
    "range": [
     45,
     52
    ],
    "label": "1d4 Different Workbenches or Workbench Upgrade Coupons",
    "kind": "named",
    "count": "1d4",
    "name": "Workbench or Workbench Upgrade Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     53,
     60
    ],
    "label": "Scratcher tickets",
    "kind": "named",
    "count": "1",
    "name": "Scratcher Ticket",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     61,
     68
    ],
    "label": "1d4 Personal Space Coupons",
    "kind": "named",
    "count": "1d4",
    "name": "Personal Space Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     69,
     76
    ],
    "label": "Magic Item (Three rolls)",
    "kind": "gear",
    "gear": "item",
    "rolls": 3
   },
   {
    "range": [
     77,
     84
    ],
    "label": "An interesting item granting +4 to a Stat",
    "kind": "named",
    "count": "1",
    "name": "An interesting item granting +4 to a Stat",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     85,
     92
    ],
    "label": "2x Scroll of Upgrade",
    "kind": "named",
    "count": "2",
    "name": "Scroll of Upgrade",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     93,
     100
    ],
    "label": "Potion of +3 Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 3,
    "skills": null
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     12
    ],
    "label": "1d10 x 10,000 Gold",
    "kind": "gold",
    "count": "1d10",
    "times": 10000
   },
   {
    "range": [
     13,
     20
    ],
    "label": "2x Rare Magic Scrolls",
    "kind": "spell",
    "count": "2",
    "rarity": "rare",
    "focus": null,
    "usage": "scroll"
   },
   {
    "range": [
     21,
     28
    ],
    "label": "2d2x Rare Magic Scrolls",
    "kind": "spell",
    "count": "2d2",
    "rarity": "rare",
    "focus": null,
    "usage": "scroll"
   },
   {
    "range": [
     29,
     36
    ],
    "label": "Heal Severe Injury Potion (Heals 9 Health Bar slots and mends all Injuries)",
    "kind": "named",
    "count": "1",
    "name": "Heal Severe Injury Potion",
    "note": "Heals 9 Health Bar slots and mends all Injuries",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     37,
     44
    ],
    "label": "2d4 Different Workbenches or Workbench Upgrade Coupons",
    "kind": "named",
    "count": "2d4",
    "name": "Workbench or Workbench Upgrade Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     45,
     52
    ],
    "label": "2d4 Personal Space Coupons",
    "kind": "named",
    "count": "2d4",
    "name": "Personal Space Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     53,
     60
    ],
    "label": "Magic Item (Four rolls)",
    "kind": "gear",
    "gear": "item",
    "rolls": 4
   },
   {
    "range": [
     61,
     68
    ],
    "label": "Rare Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "rare",
    "focus": null,
    "usage": "tome"
   },
   {
    "range": [
     69,
     76
    ],
    "label": "An interesting item granting +10% to a Stat",
    "kind": "named",
    "count": "1",
    "name": "An interesting item granting +10% to a Stat",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     77,
     84
    ],
    "label": "2x Scroll of Upgrade",
    "kind": "named",
    "count": "2",
    "name": "Scroll of Upgrade",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     85,
     92
    ],
    "label": "Potion of +5 Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 5,
    "skills": null
   },
   {
    "range": [
     93,
     100
    ],
    "label": "Unique and Customized Item For The Crawler",
    "kind": "unique"
   }
  ]
 },
 "Assassin's": {
  "Bronze": [
   {
    "range": [
     1,
     20
    ],
    "label": "Dynamite Stick (1d6)",
    "kind": "named",
    "count": "1",
    "name": "Dynamite Stick",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "1d6"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "Goblin Smoke Bomb",
    "kind": "named",
    "count": "1",
    "name": "Goblin Smoke Bomb",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "Random Dexterity Weapon",
    "kind": "randomWeapon",
    "dex": true
   },
   {
    "range": [
     61,
     80
    ],
    "label": "Weak Attack Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     81,
     100
    ],
    "label": "Weak Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "attack",
    "usage": "tome"
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     20
    ],
    "label": "Goblin Good Dynamites (2d6)",
    "kind": "named",
    "count": "1",
    "name": "Goblin Good Dynamite",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "2d6"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "2d2 Goblin Smoke Bombs",
    "kind": "named",
    "count": "2d2",
    "name": "Goblin Smoke Bomb",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "Weak Attack Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     61,
     80
    ],
    "label": "Weak Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "attack",
    "usage": "tome"
   },
   {
    "range": [
     81,
     100
    ],
    "label": "Magic Weapon (One roll)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 1
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     20
    ],
    "label": "Hobgoblin Smoke Bomb",
    "kind": "named",
    "count": "1",
    "name": "Hobgoblin Smoke Bomb",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "Weak or Medium Attack Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     41,
     60
    ],
    "label": "Weak or Medium Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": "attack",
    "usage": "tome"
   },
   {
    "range": [
     61,
     80
    ],
    "label": "Magic Weapon (Two rolls)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 2
   },
   {
    "range": [
     81,
     100
    ],
    "label": "Scroll of Upgrade",
    "kind": "named",
    "count": "1",
    "name": "Scroll of Upgrade",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     20
    ],
    "label": "2d2 Hobgoblin Mirror Globes",
    "kind": "named",
    "count": "2d2",
    "name": "Hobgoblin Mirror Globe",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "2x Medium Attack Magic Scrolls",
    "kind": "spell",
    "count": "2",
    "rarity": "medium",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     41,
     60
    ],
    "label": "Medium Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "medium",
    "focus": "attack",
    "usage": "tome"
   },
   {
    "range": [
     61,
     80
    ],
    "label": "Magic Weapon (Three rolls)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 3
   },
   {
    "range": [
     81,
     100
    ],
    "label": "Sharpening Stone",
    "kind": "named",
    "count": "1",
    "name": "Sharpening Stone",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     20
    ],
    "label": "2d2 Standard Explosives Demon Detonating Cord (5d6)",
    "kind": "named",
    "count": "2d2",
    "name": "Demon Detonating Cord",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "5d6"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "2x Rare Attack Magic Scrolls",
    "kind": "spell",
    "count": "2",
    "rarity": "rare",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     41,
     60
    ],
    "label": "Magic Weapon (Four rolls)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 4
   },
   {
    "range": [
     61,
     80
    ],
    "label": "Rare Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "rare",
    "focus": "attack",
    "usage": "tome"
   },
   {
    "range": [
     81,
     100
    ],
    "label": "2d2 Sharpening Stone",
    "kind": "named",
    "count": "2d2",
    "name": "Sharpening Stone",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   }
  ]
 },
 "Asshole's": {
  "Bronze": [
   {
    "range": [
     1,
     20
    ],
    "label": "Random Weapon",
    "kind": "randomWeapon",
    "dex": false
   },
   {
    "range": [
     21,
     36
    ],
    "label": "Dynamite Stick (1d6)",
    "kind": "named",
    "count": "1",
    "name": "Dynamite Stick",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "1d6"
    }
   },
   {
    "range": [
     37,
     52
    ],
    "label": "1d10 Gold",
    "kind": "gold",
    "count": "1d10",
    "times": 1
   },
   {
    "range": [
     53,
     68
    ],
    "label": "Weak Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": null,
    "usage": "scroll"
   },
   {
    "range": [
     69,
     84
    ],
    "label": "A Piece of Armor with something asshole written on it (1 DR)",
    "kind": "named",
    "count": "1",
    "name": "Piece of Armor (with something rude written on it)",
    "note": "1 DR",
    "item": {
     "type": "equipment",
     "slot": "torso",
     "armorDr": 1
    }
   },
   {
    "range": [
     85,
     100
    ],
    "label": "Weak Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": null,
    "usage": "tome"
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     20
    ],
    "label": "Goblin Good Dynamites (2d6)",
    "kind": "named",
    "count": "1",
    "name": "Goblin Good Dynamite",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "2d6"
    }
   },
   {
    "range": [
     21,
     36
    ],
    "label": "1d10 x 100 Gold",
    "kind": "gold",
    "count": "1d10",
    "times": 100
   },
   {
    "range": [
     37,
     52
    ],
    "label": "Weak or Medium Attack Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     53,
     68
    ],
    "label": "Weak Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "attack",
    "usage": "tome"
   },
   {
    "range": [
     69,
     84
    ],
    "label": "A Piece of Magic Armor with something asshole written on it (One Roll)",
    "kind": "gear",
    "gear": "armor",
    "rolls": 1,
    "dr": 1,
    "flavor": "asshole"
   },
   {
    "range": [
     85,
     100
    ],
    "label": "Magic Weapon (One roll)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 1
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     20
    ],
    "label": "2d2 Goblin Good Dynamites (2d6)",
    "kind": "named",
    "count": "2d2",
    "name": "Goblin Good Dynamite",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "2d6"
    }
   },
   {
    "range": [
     21,
     36
    ],
    "label": "Weak or Medium Attack Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     37,
     52
    ],
    "label": "Weak or Medium Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": "attack",
    "usage": "tome"
   },
   {
    "range": [
     53,
     68
    ],
    "label": "Upgrade Patch for Asshole Armor",
    "kind": "named",
    "count": "1",
    "name": "Upgrade Patch for Asshole Armor",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     69,
     84
    ],
    "label": "Magic Weapon (Two rolls)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 2
   },
   {
    "range": [
     85,
     100
    ],
    "label": "Scroll of Upgrade",
    "kind": "named",
    "count": "1",
    "name": "Scroll of Upgrade",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     20
    ],
    "label": "2d2 Goblin Explosives – Hob-Lobbers (3d6)",
    "kind": "named",
    "count": "2d2",
    "name": "Hob-Lobber",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "3d6"
    }
   },
   {
    "range": [
     21,
     36
    ],
    "label": "2x Medium Attack Magic Scrolls",
    "kind": "spell",
    "count": "2",
    "rarity": "medium",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     37,
     52
    ],
    "label": "Medium Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "medium",
    "focus": "attack",
    "usage": "tome"
   },
   {
    "range": [
     53,
     68
    ],
    "label": "2d2 Upgrade Patches for Asshole Armor",
    "kind": "named",
    "count": "2d2",
    "name": "Upgrade Patch for Asshole Armor",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     69,
     84
    ],
    "label": "Magic Weapon (Three Rolls)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 3
   },
   {
    "range": [
     85,
     100
    ],
    "label": "2x Scroll of Upgrade",
    "kind": "named",
    "count": "2",
    "name": "Scroll of Upgrade",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     20
    ],
    "label": "2d2 Standard Explosives Demon Detonating Cord (5d6)",
    "kind": "named",
    "count": "2d2",
    "name": "Demon Detonating Cord",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "5d6"
    }
   },
   {
    "range": [
     21,
     36
    ],
    "label": "2x Rare Attack Magic Scrolls",
    "kind": "spell",
    "count": "2",
    "rarity": "rare",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     37,
     52
    ],
    "label": "5x Upgrade Patches for Asshole Items",
    "kind": "named",
    "count": "5",
    "name": "Upgrade Patch for Asshole Items",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     53,
     68
    ],
    "label": "Magic Weapon (Four Rolls)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 4
   },
   {
    "range": [
     69,
     84
    ],
    "label": "Rare Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "rare",
    "focus": "attack",
    "usage": "tome"
   },
   {
    "range": [
     85,
     100
    ],
    "label": "2x Scroll of Upgrade",
    "kind": "named",
    "count": "2",
    "name": "Scroll of Upgrade",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   }
  ]
 },
 "Crafter's": {
  "Bronze": [
   {
    "range": [
     1,
     25
    ],
    "label": "4d6 Misc. Junk",
    "kind": "junk",
    "count": "4d6",
    "times": 1
   },
   {
    "range": [
     26,
     50
    ],
    "label": "6d6 Misc. Junk",
    "kind": "junk",
    "count": "6d6",
    "times": 1
   },
   {
    "range": [
     51,
     60
    ],
    "label": "8d6 Misc. Junk",
    "kind": "junk",
    "count": "8d6",
    "times": 1
   },
   {
    "range": [
     61,
     70
    ],
    "label": "10d6 Misc. Junk",
    "kind": "junk",
    "count": "10d6",
    "times": 1
   },
   {
    "range": [
     71,
     100
    ],
    "label": "Work Tools (Crafting Tools)",
    "kind": "named",
    "count": "1",
    "name": "Work Tools",
    "note": "Crafting Tools",
    "item": {
     "type": "loot"
    }
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     25
    ],
    "label": "8d6 Misc. Junk",
    "kind": "junk",
    "count": "8d6",
    "times": 1
   },
   {
    "range": [
     26,
     50
    ],
    "label": "10d6 Misc. Junk",
    "kind": "junk",
    "count": "10d6",
    "times": 1
   },
   {
    "range": [
     51,
     60
    ],
    "label": "12d6 Misc. Junk",
    "kind": "junk",
    "count": "12d6",
    "times": 1
   },
   {
    "range": [
     61,
     70
    ],
    "label": "Magical Working Tools (One Roll)",
    "kind": "gear",
    "gear": "tools",
    "rolls": 1
   },
   {
    "range": [
     71,
     100
    ],
    "label": "Potion of +1 Any Crafting Skill (Permanent)",
    "kind": "skillPotion",
    "ranks": 1,
    "skills": [
     "crafting"
    ]
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     25
    ],
    "label": "12d6 Misc. Junk",
    "kind": "junk",
    "count": "12d6",
    "times": 1
   },
   {
    "range": [
     26,
     50
    ],
    "label": "14d6 Misc. Junk",
    "kind": "junk",
    "count": "14d6",
    "times": 1
   },
   {
    "range": [
     51,
     60
    ],
    "label": "Magical Working Tools (Two Rolls)",
    "kind": "gear",
    "gear": "tools",
    "rolls": 2
   },
   {
    "range": [
     61,
     70
    ],
    "label": "Crafting Workbench",
    "kind": "named",
    "count": "1",
    "name": "Crafting Workbench",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     71,
     100
    ],
    "label": "Potion of +2 Any Crafting Skill (Permanent)",
    "kind": "skillPotion",
    "ranks": 2,
    "skills": [
     "crafting"
    ]
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     25
    ],
    "label": "1d10 x 100 Misc. Junk",
    "kind": "junk",
    "count": "1d10",
    "times": 100
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Magical Working Tools (Three Rolls)",
    "kind": "gear",
    "gear": "tools",
    "rolls": 3
   },
   {
    "range": [
     51,
     60
    ],
    "label": "1d4 Different Workbenches or Workbench Upgrade Coupons",
    "kind": "named",
    "count": "1d4",
    "name": "Workbench or Workbench Upgrade Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     61,
     70
    ],
    "label": "1d4 Personal Space Coupons",
    "kind": "named",
    "count": "1d4",
    "name": "Personal Space Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     71,
     100
    ],
    "label": "Potion of +3 Any Crafting Skill (Permanent)",
    "kind": "skillPotion",
    "ranks": 3,
    "skills": [
     "crafting"
    ]
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     25
    ],
    "label": "1d4 x 1,000 Misc. Junk",
    "kind": "junk",
    "count": "1d4",
    "times": 1000
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Magical Working Tools (Four Rolls)",
    "kind": "gear",
    "gear": "tools",
    "rolls": 4
   },
   {
    "range": [
     51,
     60
    ],
    "label": "2d4 Different Workbenches or Workbench Upgrade Coupons",
    "kind": "named",
    "count": "2d4",
    "name": "Workbench or Workbench Upgrade Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     61,
     70
    ],
    "label": "2d4 Personal Space Coupons",
    "kind": "named",
    "count": "2d4",
    "name": "Personal Space Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     71,
     100
    ],
    "label": "Potion of +5 Any Crafting Skill (Permanent)",
    "kind": "skillPotion",
    "ranks": 5,
    "skills": [
     "crafting"
    ]
   }
  ]
 },
 "Goblin": {
  "Bronze": [
   {
    "range": [
     1,
     20
    ],
    "label": "Dynamite Stick (1d6)",
    "kind": "named",
    "count": "1",
    "name": "Dynamite Stick",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "1d6"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "Goblin Smoke Bomb",
    "kind": "named",
    "count": "1",
    "name": "Goblin Smoke Bomb",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "2d2 Dynamite Sticks (1d6)",
    "kind": "named",
    "count": "2d2",
    "name": "Dynamite Stick",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "1d6"
    }
   },
   {
    "range": [
     61,
     80
    ],
    "label": "2d2 Goblin Smoke Bombs",
    "kind": "named",
    "count": "2d2",
    "name": "Goblin Smoke Bomb",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     81,
     100
    ],
    "label": "Goblin Good Dynamite (2d6)",
    "kind": "named",
    "count": "1",
    "name": "Goblin Good Dynamite",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "2d6"
    }
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     20
    ],
    "label": "2d4 Dynamite Sticks (1d6)",
    "kind": "named",
    "count": "2d4",
    "name": "Dynamite Stick",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "1d6"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "2d4 Goblin Smoke Bombs",
    "kind": "named",
    "count": "2d4",
    "name": "Goblin Smoke Bomb",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "1d2 Goblin Good Dynamites (2d6)",
    "kind": "named",
    "count": "1d2",
    "name": "Goblin Good Dynamite",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "2d6"
    }
   },
   {
    "range": [
     61,
     80
    ],
    "label": "1d2 Incendiary Devices – Carl's Explosive Carboys (1d8)",
    "kind": "named",
    "count": "1d2",
    "name": "Explosive Carboy",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "1d8"
    }
   },
   {
    "range": [
     81,
     100
    ],
    "label": "2d2 Goblin Good Dynamites (2d6)",
    "kind": "named",
    "count": "2d2",
    "name": "Goblin Good Dynamite",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "2d6"
    }
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     20
    ],
    "label": "2d2 Goblin Good Dynamites (2d6)",
    "kind": "named",
    "count": "2d2",
    "name": "Goblin Good Dynamite",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "2d6"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "2d2 Incendiary Devices – Carl's Explosive Carboys (1d8)",
    "kind": "named",
    "count": "2d2",
    "name": "Explosive Carboy",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "1d8"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "1d2 Hobgoblin Smoke Curtains",
    "kind": "named",
    "count": "1d2",
    "name": "Hobgoblin Smoke Curtain",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     61,
     80
    ],
    "label": "2d2 Goblin Good Dynamites (2d6)",
    "kind": "named",
    "count": "2d2",
    "name": "Goblin Good Dynamite",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "2d6"
    }
   },
   {
    "range": [
     81,
     100
    ],
    "label": "1d2 Goblin Explosives – Hob-Lobbers (3d6)",
    "kind": "named",
    "count": "1d2",
    "name": "Hob-Lobber",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "3d6"
    }
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     20
    ],
    "label": "2d2 Hobgoblin Smoke Curtains",
    "kind": "named",
    "count": "2d2",
    "name": "Hobgoblin Smoke Curtain",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "2d4 Goblin Good Dynamites (2d6)",
    "kind": "named",
    "count": "2d4",
    "name": "Goblin Good Dynamite",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "2d6"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "2d4 Goblin Explosives – Hob-Lobbers (3d6)",
    "kind": "named",
    "count": "2d4",
    "name": "Hob-Lobber",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "3d6"
    }
   },
   {
    "range": [
     61,
     80
    ],
    "label": "Hobgoblin Mirror Globe",
    "kind": "named",
    "count": "1",
    "name": "Hobgoblin Mirror Globe",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     81,
     100
    ],
    "label": "Standard Explosives Demon Detonating Cord (5d6)",
    "kind": "named",
    "count": "1",
    "name": "Demon Detonating Cord",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "5d6"
    }
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     20
    ],
    "label": "4d4 Goblin Explosives – Hob-Lobbers (3d6)",
    "kind": "named",
    "count": "4d4",
    "name": "Hob-Lobber",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "3d6"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "2d4 Incendiary Devices, Gnomish \"Knock-Knock\" (4d6)",
    "kind": "named",
    "count": "2d4",
    "name": "Gnomish \"Knock-Knock\" Incendiary Device",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "4d6"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "2d4 Hobgoblin Mirror Globes",
    "kind": "named",
    "count": "2d4",
    "name": "Hobgoblin Mirror Globe",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     61,
     80
    ],
    "label": "2d4 Standard Explosives Demon Detonating Cord (5d6)",
    "kind": "named",
    "count": "2d4",
    "name": "Demon Detonating Cord",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "5d6"
    }
   },
   {
    "range": [
     81,
     100
    ],
    "label": "2d2 x ALL EXPLOSIVES AND SMOKE BOMBS",
    "kind": "allExplosives",
    "count": "2d2"
   }
  ]
 },
 "Looter": {
  "Bronze": [
   {
    "range": [
     1,
     16
    ],
    "label": "Non-Motorized Means of Transportation",
    "kind": "named",
    "count": "1",
    "name": "Non-Motorized Means of Transportation",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     17,
     30
    ],
    "label": "4d6 Misc. Junk",
    "kind": "junk",
    "count": "4d6",
    "times": 1
   },
   {
    "range": [
     31,
     44
    ],
    "label": "6d6 Misc. Junk",
    "kind": "junk",
    "count": "6d6",
    "times": 1
   },
   {
    "range": [
     45,
     58
    ],
    "label": "8d6 Misc. Junk",
    "kind": "junk",
    "count": "8d6",
    "times": 1
   },
   {
    "range": [
     59,
     72
    ],
    "label": "10d6 Misc. Junk",
    "kind": "junk",
    "count": "10d6",
    "times": 1
   },
   {
    "range": [
     73,
     86
    ],
    "label": "1d10 Gold",
    "kind": "gold",
    "count": "1d10",
    "times": 1
   },
   {
    "range": [
     87,
     100
    ],
    "label": "1d100 Gold",
    "kind": "gold",
    "count": "1d100",
    "times": 1
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     16
    ],
    "label": "8d6 Misc. Junk",
    "kind": "junk",
    "count": "8d6",
    "times": 1
   },
   {
    "range": [
     17,
     30
    ],
    "label": "10d6 Misc. Junk",
    "kind": "junk",
    "count": "10d6",
    "times": 1
   },
   {
    "range": [
     31,
     44
    ],
    "label": "12d6 Misc. Junk",
    "kind": "junk",
    "count": "12d6",
    "times": 1
   },
   {
    "range": [
     45,
     58
    ],
    "label": "1d10 x 100 Gold",
    "kind": "gold",
    "count": "1d10",
    "times": 100
   },
   {
    "range": [
     59,
     72
    ],
    "label": "2d10 x 100 Gold",
    "kind": "gold",
    "count": "2d10",
    "times": 100
   },
   {
    "range": [
     73,
     86
    ],
    "label": "Potion of +1 Appraise Skill Rank",
    "kind": "skillPotion",
    "ranks": 1,
    "skills": [
     "Appraise"
    ]
   },
   {
    "range": [
     87,
     100
    ],
    "label": "Potion of +1 Trash Scavenging Skill Rank",
    "kind": "skillPotion",
    "ranks": 1,
    "skills": [
     "Trash Scavenging"
    ]
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     16
    ],
    "label": "14d6 Misc. Junk",
    "kind": "junk",
    "count": "14d6",
    "times": 1
   },
   {
    "range": [
     17,
     30
    ],
    "label": "16d6 Misc. Junk",
    "kind": "junk",
    "count": "16d6",
    "times": 1
   },
   {
    "range": [
     31,
     44
    ],
    "label": "1d6 x 1,000 Gold",
    "kind": "gold",
    "count": "1d6",
    "times": 1000
   },
   {
    "range": [
     45,
     58
    ],
    "label": "2d6 x 1,000 Gold",
    "kind": "gold",
    "count": "2d6",
    "times": 1000
   },
   {
    "range": [
     59,
     72
    ],
    "label": "Workbench for (Crafting, Sapper, Engineer, Alchemy, or Metal Working)",
    "kind": "named",
    "count": "1",
    "name": "Workbench",
    "note": "Crafting, Sapper, Engineer, Alchemy, or Metal Working",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     73,
     86
    ],
    "label": "Potion of +2 Appraise Skill Rank",
    "kind": "skillPotion",
    "ranks": 2,
    "skills": [
     "Appraise"
    ]
   },
   {
    "range": [
     87,
     100
    ],
    "label": "Potion of +2 Trash Scavenging Skill Rank",
    "kind": "skillPotion",
    "ranks": 2,
    "skills": [
     "Trash Scavenging"
    ]
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     16
    ],
    "label": "1d10 x 100 Misc. Junk",
    "kind": "junk",
    "count": "1d10",
    "times": 100
   },
   {
    "range": [
     17,
     30
    ],
    "label": "2d6 x 1,000 Gold",
    "kind": "gold",
    "count": "2d6",
    "times": 1000
   },
   {
    "range": [
     31,
     44
    ],
    "label": "4d6 x 1,000 Gold",
    "kind": "gold",
    "count": "4d6",
    "times": 1000
   },
   {
    "range": [
     45,
     58
    ],
    "label": "1d4 Different Workbenches or Workbench Upgrade Coupons",
    "kind": "named",
    "count": "1d4",
    "name": "Workbench or Workbench Upgrade Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     59,
     72
    ],
    "label": "1d4 Personal Space Coupons",
    "kind": "named",
    "count": "1d4",
    "name": "Personal Space Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     73,
     86
    ],
    "label": "Potion of +3 Appraise Skill Rank",
    "kind": "skillPotion",
    "ranks": 3,
    "skills": [
     "Appraise"
    ]
   },
   {
    "range": [
     87,
     100
    ],
    "label": "Potion of +3 Trash Scavenging Skill Rank",
    "kind": "skillPotion",
    "ranks": 3,
    "skills": [
     "Trash Scavenging"
    ]
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     16
    ],
    "label": "1d4 x 1,000 Misc. Junk",
    "kind": "junk",
    "count": "1d4",
    "times": 1000
   },
   {
    "range": [
     17,
     30
    ],
    "label": "1d10 x 10,000 Gold",
    "kind": "gold",
    "count": "1d10",
    "times": 10000
   },
   {
    "range": [
     31,
     44
    ],
    "label": "2d10 x 10,000 Gold",
    "kind": "gold",
    "count": "2d10",
    "times": 10000
   },
   {
    "range": [
     45,
     58
    ],
    "label": "2d4 Different Workbenches or Workbench Upgrade Coupons",
    "kind": "named",
    "count": "2d4",
    "name": "Workbench or Workbench Upgrade Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     59,
     72
    ],
    "label": "2d4 Personal Space Coupons",
    "kind": "named",
    "count": "2d4",
    "name": "Personal Space Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     73,
     86
    ],
    "label": "Potion of +5 Appraise Skill Rank",
    "kind": "skillPotion",
    "ranks": 5,
    "skills": [
     "Appraise"
    ]
   },
   {
    "range": [
     87,
     100
    ],
    "label": "Potion of +5 Trash Scavenging Skill Rank",
    "kind": "skillPotion",
    "ranks": 5,
    "skills": [
     "Trash Scavenging"
    ]
   }
  ]
 },
 "Lucky Bastard": {
  "Bronze": [
   {
    "range": [
     1,
     1
    ],
    "label": "Nothing",
    "kind": "nothing"
   },
   {
    "range": [
     2,
     50
    ],
    "label": "Casino Chip",
    "kind": "named",
    "count": "1",
    "name": "Casino Chip",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     51,
     99
    ],
    "label": "Weak Effect Scratch-Off (Rank 5 Effect)",
    "kind": "named",
    "count": "1",
    "name": "Weak Effect Scratch-Off",
    "note": "Rank 5 Effect",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     100,
     100
    ],
    "label": "All, except 1",
    "kind": "allExcept"
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     1
    ],
    "label": "Bronze Lucky Bastard's Boxes",
    "kind": "box",
    "tier": "Bronze",
    "type": "Lucky Bastard"
   },
   {
    "range": [
     2,
     50
    ],
    "label": "1d4 Casino Chips",
    "kind": "named",
    "count": "1d4",
    "name": "Casino Chip",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     51,
     99
    ],
    "label": "2d2 Weak Effect Scratch-Offs (Rank 5 Effect)",
    "kind": "named",
    "count": "2d2",
    "name": "Weak Effect Scratch-Off",
    "note": "Rank 5 Effect",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     100,
     100
    ],
    "label": "All, except 1",
    "kind": "allExcept"
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     1
    ],
    "label": "Silver Lucky Bastard's Boxes",
    "kind": "box",
    "tier": "Silver",
    "type": "Lucky Bastard"
   },
   {
    "range": [
     2,
     50
    ],
    "label": "2d4 Casino Chips",
    "kind": "named",
    "count": "2d4",
    "name": "Casino Chip",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     51,
     99
    ],
    "label": "1d2 Medium Effect Scratch-Offs (Rank 10 Effect)",
    "kind": "named",
    "count": "1d2",
    "name": "Medium Effect Scratch-Off",
    "note": "Rank 10 Effect",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     100,
     100
    ],
    "label": "All, except 1",
    "kind": "allExcept"
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     1
    ],
    "label": "Gold Lucky Bastard's Boxes",
    "kind": "box",
    "tier": "Gold",
    "type": "Lucky Bastard"
   },
   {
    "range": [
     2,
     50
    ],
    "label": "3d4 Casino Chips",
    "kind": "named",
    "count": "3d4",
    "name": "Casino Chip",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     51,
     99
    ],
    "label": "1d2 Rare Effect Scratch-Offs (Rank 15 Effect)",
    "kind": "named",
    "count": "1d2",
    "name": "Rare Effect Scratch-Off",
    "note": "Rank 15 Effect",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     100,
     100
    ],
    "label": "All, except 1",
    "kind": "allExcept"
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     1
    ],
    "label": "Platinum Lucky Bastard's Boxes",
    "kind": "box",
    "tier": "Platinum",
    "type": "Lucky Bastard"
   },
   {
    "range": [
     2,
     50
    ],
    "label": "4d4 Casino Chips",
    "kind": "named",
    "count": "4d4",
    "name": "Casino Chip",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     51,
     99
    ],
    "label": "2d4 Rare Effect Scratch-Offs (Rank 15 Effect)",
    "kind": "named",
    "count": "2d4",
    "name": "Rare Effect Scratch-Off",
    "note": "Rank 15 Effect",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     100,
     100
    ],
    "label": "All, except 1",
    "kind": "allExcept"
   }
  ]
 },
 "Lucky Bitch": {
  "Bronze": [
   {
    "range": [
     1,
     25
    ],
    "label": "1d10 Gold",
    "kind": "gold",
    "count": "1d10",
    "times": 1
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Weak Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": null,
    "usage": "scroll"
   },
   {
    "range": [
     51,
     75
    ],
    "label": "A Piece of Armor (1 DR)",
    "kind": "named",
    "count": "1",
    "name": "Piece of Armor",
    "note": "1 DR",
    "item": {
     "type": "equipment",
     "slot": "torso",
     "armorDr": 1
    }
   },
   {
    "range": [
     76,
     100
    ],
    "label": "Weak Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": null,
    "usage": "tome"
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     25
    ],
    "label": "1d10 x 100 Gold",
    "kind": "gold",
    "count": "1d10",
    "times": 100
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Magic Item (One roll)",
    "kind": "gear",
    "gear": "item",
    "rolls": 1
   },
   {
    "range": [
     51,
     75
    ],
    "label": "Silver Ring of +2 to a Stat",
    "kind": "named",
    "count": "1",
    "name": "Silver Ring of +2 to a Stat",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     76,
     100
    ],
    "label": "Potion of +1 Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 1,
    "skills": null
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     25
    ],
    "label": "1d6 x 1,000 Gold",
    "kind": "gold",
    "count": "1d6",
    "times": 1000
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Scroll of Upgrade (enhances the crawler's signature outfit)",
    "kind": "named",
    "count": "1",
    "name": "Scroll of Upgrade",
    "note": "enhances the crawler's signature outfit",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     51,
     75
    ],
    "label": "Scroll of Upgrade",
    "kind": "named",
    "count": "1",
    "name": "Scroll of Upgrade",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     76,
     100
    ],
    "label": "Potion of +2 Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 2,
    "skills": null
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     25
    ],
    "label": "2d6 x 1,000 Gold",
    "kind": "gold",
    "count": "2d6",
    "times": 1000
   },
   {
    "range": [
     26,
     50
    ],
    "label": "An interesting item granting +4 to a Stat",
    "kind": "named",
    "count": "1",
    "name": "An interesting item granting +4 to a Stat",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     51,
     75
    ],
    "label": "Scroll of Upgrade",
    "kind": "named",
    "count": "1",
    "name": "Scroll of Upgrade",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     76,
     100
    ],
    "label": "Potion of +3 Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 3,
    "skills": null
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     25
    ],
    "label": "1d10 x 10,000 Gold",
    "kind": "gold",
    "count": "1d10",
    "times": 10000
   },
   {
    "range": [
     26,
     50
    ],
    "label": "2x Scroll of Upgrade",
    "kind": "named",
    "count": "2",
    "name": "Scroll of Upgrade",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     51,
     75
    ],
    "label": "Potion of +5 Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 5,
    "skills": null
   },
   {
    "range": [
     76,
     100
    ],
    "label": "Unique and Customized Item For The Crawler",
    "kind": "unique"
   }
  ]
 },
 "Mechanic's": {
  "Bronze": [
   {
    "range": [
     1,
     25
    ],
    "label": "4d6 Misc. Junk",
    "kind": "junk",
    "count": "4d6",
    "times": 1
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Tool Boxes",
    "kind": "named",
    "count": "1",
    "name": "Tool Box",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     51,
     70
    ],
    "label": "Non-Motorized Vehicle",
    "kind": "named",
    "count": "1",
    "name": "Non-Motorized Vehicle",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     71,
     90
    ],
    "label": "Engine",
    "kind": "named",
    "count": "1",
    "name": "Engine",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     91,
     100
    ],
    "label": "Broken Motorized Vehicle",
    "kind": "named",
    "count": "1",
    "name": "Broken Motorized Vehicle",
    "item": {
     "type": "loot"
    }
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     25
    ],
    "label": "8d6 Misc. Junk",
    "kind": "junk",
    "count": "8d6",
    "times": 1
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Motorized Vehicle",
    "kind": "named",
    "count": "1",
    "name": "Motorized Vehicle",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     51,
     70
    ],
    "label": "Magical Tool Boxes (One Roll)",
    "kind": "gear",
    "gear": "tools",
    "rolls": 1
   },
   {
    "range": [
     71,
     90
    ],
    "label": "Potion of +1 Engineering, Repair, or Craft Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 1,
    "skills": [
     "Engineering",
     "Repair",
     "Craft"
    ]
   },
   {
    "range": [
     91,
     100
    ],
    "label": "Potion of +1 Motorhead Skill Rank",
    "kind": "skillPotion",
    "ranks": 1,
    "skills": [
     "Motorhead"
    ]
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     25
    ],
    "label": "Motorized Vehicle",
    "kind": "named",
    "count": "1",
    "name": "Motorized Vehicle",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Magical Tool Boxes (Two Rolls)",
    "kind": "gear",
    "gear": "tools",
    "rolls": 2
   },
   {
    "range": [
     51,
     70
    ],
    "label": "Workbench for (Engineer or Metallurgist)",
    "kind": "named",
    "count": "1",
    "name": "Workbench",
    "note": "Engineer or Metallurgist",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     71,
     90
    ],
    "label": "Potion of +2 Engineering, Repair, or Craft Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 2,
    "skills": [
     "Engineering",
     "Repair",
     "Craft"
    ]
   },
   {
    "range": [
     91,
     100
    ],
    "label": "Potion of +2 Motorhead Skill Rank",
    "kind": "skillPotion",
    "ranks": 2,
    "skills": [
     "Motorhead"
    ]
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     25
    ],
    "label": "Magical Tool Boxes (Three Rolls)",
    "kind": "gear",
    "gear": "tools",
    "rolls": 3
   },
   {
    "range": [
     26,
     50
    ],
    "label": "1d4 Different Workbenches or Workbench Upgrade Coupons",
    "kind": "named",
    "count": "1d4",
    "name": "Workbench or Workbench Upgrade Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     51,
     70
    ],
    "label": "1d4 Personal Space Coupons",
    "kind": "named",
    "count": "1d4",
    "name": "Personal Space Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     71,
     90
    ],
    "label": "Potion of +3 Engineering, Repair, or Craft Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 3,
    "skills": [
     "Engineering",
     "Repair",
     "Craft"
    ]
   },
   {
    "range": [
     91,
     100
    ],
    "label": "Potion of +3 Motorhead Skill Rank",
    "kind": "skillPotion",
    "ranks": 3,
    "skills": [
     "Motorhead"
    ]
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     25
    ],
    "label": "Magical Tool Boxes (Four Rolls)",
    "kind": "gear",
    "gear": "tools",
    "rolls": 4
   },
   {
    "range": [
     26,
     50
    ],
    "label": "2d4 Different Workbenches or Workbench Upgrade Coupons",
    "kind": "named",
    "count": "2d4",
    "name": "Workbench or Workbench Upgrade Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     51,
     70
    ],
    "label": "2d4 Personal Space Coupons",
    "kind": "named",
    "count": "2d4",
    "name": "Personal Space Coupon",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     71,
     90
    ],
    "label": "Potion of +5 Engineering, Repair, or Craft Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 5,
    "skills": [
     "Engineering",
     "Repair",
     "Craft"
    ]
   },
   {
    "range": [
     91,
     100
    ],
    "label": "Potion of +5 Motorhead Skill Rank",
    "kind": "skillPotion",
    "ranks": 5,
    "skills": [
     "Motorhead"
    ]
   }
  ]
 },
 "Pet": {
  "Bronze": [
   {
    "range": [
     1,
     25
    ],
    "label": "100x Pet Biscuits",
    "kind": "named",
    "count": "100",
    "name": "Pet Biscuit",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Cure Creature Scroll",
    "kind": "named",
    "count": "1",
    "name": "Cure Creature Scroll",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     51,
     75
    ],
    "label": "Pet Armor (1 DR)",
    "kind": "named",
    "count": "1",
    "name": "Pet Armor",
    "note": "1 DR",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     76,
     100
    ],
    "label": "Pet Storage Boxes",
    "kind": "named",
    "count": "1",
    "name": "Pet Storage Box",
    "item": {
     "type": "loot"
    }
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     25
    ],
    "label": "Heal Pet Potion (Heals 5 Health Bar slots)",
    "kind": "named",
    "count": "1",
    "name": "Heal Pet Potion",
    "note": "Heals 5 Health Bar slots",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Portable Pet Storage Boxes",
    "kind": "named",
    "count": "1",
    "name": "Portable Pet Storage Box",
    "item": {
     "type": "loot"
    }
   },
   {
    "range": [
     51,
     75
    ],
    "label": "Rank 5 Cure Creature Scroll",
    "kind": "named",
    "count": "1",
    "name": "Rank 5 Cure Creature Scroll",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     76,
     100
    ],
    "label": "Magical Pet Item (One Roll)",
    "kind": "gear",
    "gear": "pet",
    "rolls": 1
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     25
    ],
    "label": "Good Pet Cure Potion (Cures 6 Health Bar slots)",
    "kind": "named",
    "count": "1",
    "name": "Good Pet Cure Potion",
    "note": "Cures 6 Health Bar slots",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     26,
     50
    ],
    "label": "1d4 Rank 5 Cure Creature Scrolls",
    "kind": "named",
    "count": "1d4",
    "name": "Rank 5 Cure Creature Scroll",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     51,
     75
    ],
    "label": "Magical Pet Item (Two Rolls)",
    "kind": "gear",
    "gear": "pet",
    "rolls": 2
   },
   {
    "range": [
     76,
     100
    ],
    "label": "Potion of +2 Animal Handling Skill Rank",
    "kind": "skillPotion",
    "ranks": 2,
    "skills": [
     "Animal Handling"
    ]
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     25
    ],
    "label": "Supreme Pet Cure Potion (8 slots and All Injuries)",
    "kind": "named",
    "count": "1",
    "name": "Supreme Pet Cure Potion",
    "note": "8 slots and All Injuries",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Rank 10 Cure Creature Scroll",
    "kind": "named",
    "count": "1",
    "name": "Rank 10 Cure Creature Scroll",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     51,
     75
    ],
    "label": "Magical Pet Item (Three Rolls)",
    "kind": "gear",
    "gear": "pet",
    "rolls": 3
   },
   {
    "range": [
     76,
     100
    ],
    "label": "Potion of +3 Animal Handling Skill Rank",
    "kind": "skillPotion",
    "ranks": 3,
    "skills": [
     "Animal Handling"
    ]
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     25
    ],
    "label": "Severe Injury Pet Cure Potion (9 slots, Injuries, and Body Parts)",
    "kind": "named",
    "count": "1",
    "name": "Severe Injury Pet Cure Potion",
    "note": "9 slots, Injuries, and Body Parts",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     26,
     50
    ],
    "label": "Rank 15 Cure Creature Scroll",
    "kind": "named",
    "count": "1",
    "name": "Rank 15 Cure Creature Scroll",
    "item": {
     "type": "consumable",
     "consumableType": "scroll"
    }
   },
   {
    "range": [
     51,
     75
    ],
    "label": "Magical Pet Item (Four Rolls)",
    "kind": "gear",
    "gear": "pet",
    "rolls": 4
   },
   {
    "range": [
     76,
     100
    ],
    "label": "Potion of +5 Animal Handling Skill Rank",
    "kind": "skillPotion",
    "ranks": 5,
    "skills": [
     "Animal Handling"
    ]
   }
  ]
 },
 "Savage": {
  "Bronze": [
   {
    "range": [
     1,
     20
    ],
    "label": "Goblin Smoke Bomb",
    "kind": "named",
    "count": "1",
    "name": "Goblin Smoke Bomb",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "Dynamite Stick (1d6)",
    "kind": "named",
    "count": "1",
    "name": "Dynamite Stick",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "1d6"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "Random Weapon",
    "kind": "randomWeapon",
    "dex": false
   },
   {
    "range": [
     61,
     80
    ],
    "label": "Weak Attack Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     81,
     100
    ],
    "label": "Weak Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "attack",
    "usage": "tome"
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     20
    ],
    "label": "1d4 Goblin Smoke Bombs",
    "kind": "named",
    "count": "1d4",
    "name": "Goblin Smoke Bomb",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "1d2 Goblin Good Dynamites (2d6)",
    "kind": "named",
    "count": "1d2",
    "name": "Goblin Good Dynamite",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "2d6"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "Weak Attack Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     61,
     80
    ],
    "label": "Magic Weapon (One Roll)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 1
   },
   {
    "range": [
     81,
     100
    ],
    "label": "Weak Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "attack",
    "usage": "tome"
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     20
    ],
    "label": "1d2 Hobgoblin Smoke Bombs",
    "kind": "named",
    "count": "1d2",
    "name": "Hobgoblin Smoke Bomb",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "1d2 Gnomish Throwing Explosives (3d6)",
    "kind": "named",
    "count": "1d2",
    "name": "Gnomish Throwing Explosive",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "3d6"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "Weak or Medium Attack Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     61,
     80
    ],
    "label": "Magic Weapon (Two Rolls)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 2
   },
   {
    "range": [
     81,
     100
    ],
    "label": "Weak or Medium Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": "attack",
    "usage": "tome"
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     20
    ],
    "label": "2d2 Hobgoblin Mirror Globes",
    "kind": "named",
    "count": "2d2",
    "name": "Hobgoblin Mirror Globe",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "2d2 Gnomish \"Knock-Knock\" Incendiary Devices (4d6)",
    "kind": "named",
    "count": "2d2",
    "name": "Gnomish \"Knock-Knock\" Incendiary Device",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "4d6"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "Medium Attack Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "medium",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     61,
     80
    ],
    "label": "Magic Weapon (Three Rolls)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 3
   },
   {
    "range": [
     81,
     100
    ],
    "label": "Medium Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "medium",
    "focus": "attack",
    "usage": "tome"
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     20
    ],
    "label": "2d4 Hobgoblin Mirror Globes",
    "kind": "named",
    "count": "2d4",
    "name": "Hobgoblin Mirror Globe",
    "item": {
     "type": "consumable",
     "consumableType": "explosives"
    }
   },
   {
    "range": [
     21,
     40
    ],
    "label": "2d4 Standard Explosives Demon Detonating Cord (5d6)",
    "kind": "named",
    "count": "2d4",
    "name": "Demon Detonating Cord",
    "item": {
     "type": "consumable",
     "consumableType": "explosives",
     "damage": "5d6"
    }
   },
   {
    "range": [
     41,
     60
    ],
    "label": "Rare Attack Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "rare",
    "focus": "attack",
    "usage": "scroll"
   },
   {
    "range": [
     61,
     80
    ],
    "label": "Magic Weapon (Four Rolls)",
    "kind": "gear",
    "gear": "weapon",
    "rolls": 4
   },
   {
    "range": [
     81,
     100
    ],
    "label": "Rare Attack Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "rare",
    "focus": "attack",
    "usage": "tome"
   }
  ]
 },
 "Survivor's": {
  "Bronze": [
   {
    "range": [
     1,
     11
    ],
    "label": "1d6 Bandages (Removes Blood Trail Debuff)",
    "kind": "named",
    "count": "1d6",
    "name": "Bandage",
    "note": "Removes Blood Trail Debuff",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     12,
     22
    ],
    "label": "Healing Potion (Heals 5 Health Bar slots)",
    "kind": "named",
    "count": "1",
    "name": "Healing Potion",
    "note": "Heals 5 Health Bar slots",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     23,
     33
    ],
    "label": "Mana Potion (Full restore)",
    "kind": "named",
    "count": "1",
    "name": "Mana Potion",
    "note": "Full restore",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     34,
     44
    ],
    "label": "Poison Antidote",
    "kind": "named",
    "count": "1",
    "name": "Poison Antidote",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     45,
     55
    ],
    "label": "Weak Defensive Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "defensive",
    "usage": "scroll"
   },
   {
    "range": [
     56,
     66
    ],
    "label": "Weak Healing Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "healing",
    "usage": "scroll"
   },
   {
    "range": [
     67,
     78
    ],
    "label": "A Piece of Armor (1 DR)",
    "kind": "named",
    "count": "1",
    "name": "Piece of Armor",
    "note": "1 DR",
    "item": {
     "type": "equipment",
     "slot": "torso",
     "armorDr": 1
    }
   },
   {
    "range": [
     79,
     89
    ],
    "label": "Weak Defensive Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "defensive",
    "usage": "tome"
   },
   {
    "range": [
     90,
     100
    ],
    "label": "Weak Healing Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "healing",
    "usage": "tome"
   }
  ],
  "Silver": [
   {
    "range": [
     1,
     11
    ],
    "label": "2d6 Bandages (Removes Blood Trail Debuff)",
    "kind": "named",
    "count": "2d6",
    "name": "Bandage",
    "note": "Removes Blood Trail Debuff",
    "item": {
     "type": "consumable",
     "consumableType": "other"
    }
   },
   {
    "range": [
     12,
     22
    ],
    "label": "Good Healing Potion (Heals 6 Health Bar slots)",
    "kind": "named",
    "count": "1",
    "name": "Good Healing Potion",
    "note": "Heals 6 Health Bar slots",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     23,
     33
    ],
    "label": "1d4 Mana Potion (Full restore)",
    "kind": "named",
    "count": "1d4",
    "name": "Mana Potion",
    "note": "Full restore",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     34,
     44
    ],
    "label": "1d4+1 Poison Antidotes",
    "kind": "named",
    "count": "1d4+1",
    "name": "Poison Antidote",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     45,
     55
    ],
    "label": "Weak Defensive Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "defensive",
    "usage": "scroll"
   },
   {
    "range": [
     56,
     66
    ],
    "label": "Weak Healing Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "healing",
    "usage": "scroll"
   },
   {
    "range": [
     67,
     78
    ],
    "label": "A Piece of Magic Armor",
    "kind": "gear",
    "gear": "armor",
    "rolls": 1,
    "dr": 1
   },
   {
    "range": [
     79,
     89
    ],
    "label": "Weak Defensive Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "defensive",
    "usage": "tome"
   },
   {
    "range": [
     90,
     100
    ],
    "label": "Weak Healing Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weak",
    "focus": "healing",
    "usage": "tome"
   }
  ],
  "Gold": [
   {
    "range": [
     1,
     11
    ],
    "label": "Good Healing Potion (Heals 6 Health Bar slots)",
    "kind": "named",
    "count": "1",
    "name": "Good Healing Potion",
    "note": "Heals 6 Health Bar slots",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     12,
     22
    ],
    "label": "Gold Standard Healing Potion (Heals 7 Health Bar slots and mends one Minor Injury)",
    "kind": "named",
    "count": "1",
    "name": "Gold Standard Healing Potion",
    "note": "Heals 7 Health Bar slots and mends one Minor Injury",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     23,
     33
    ],
    "label": "Mana Recharge Potion (Restores 5 Mana per round for 5 rounds)",
    "kind": "named",
    "count": "1",
    "name": "Mana Recharge Potion",
    "note": "Restores 5 Mana per round for 5 rounds",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     34,
     44
    ],
    "label": "Poison Immunity Potion (Duration 5 minutes)",
    "kind": "named",
    "count": "1",
    "name": "Poison Immunity Potion",
    "note": "Duration 5 minutes",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     45,
     55
    ],
    "label": "Weak or Medium Defensive Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": "defensive",
    "usage": "scroll"
   },
   {
    "range": [
     56,
     66
    ],
    "label": "Weak or Medium Healing Magic Scroll",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": "healing",
    "usage": "scroll"
   },
   {
    "range": [
     67,
     78
    ],
    "label": "Magic Armor 2 DR + (One roll)",
    "kind": "gear",
    "gear": "armor",
    "rolls": 1,
    "dr": 2
   },
   {
    "range": [
     79,
     89
    ],
    "label": "Weak or Medium Defensive Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": "defensive",
    "usage": "tome"
   },
   {
    "range": [
     90,
     100
    ],
    "label": "Weak or Medium Healing Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "weakMedium",
    "focus": "healing",
    "usage": "tome"
   }
  ],
  "Platinum": [
   {
    "range": [
     1,
     11
    ],
    "label": "Supreme Healing Potion (Heals 8 Health Bar slots and mends one Minor or Major Injury)",
    "kind": "named",
    "count": "1",
    "name": "Supreme Healing Potion",
    "note": "Heals 8 Health Bar slots and mends one Minor or Major Injury",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     12,
     22
    ],
    "label": "Good Mana Refill Potion (Restores 15 Mana per round for 10 rounds)",
    "kind": "named",
    "count": "1",
    "name": "Good Mana Refill Potion",
    "note": "Restores 15 Mana per round for 10 rounds",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     23,
     33
    ],
    "label": "Daily Poison Immunity Potion (Duration one day)",
    "kind": "named",
    "count": "1",
    "name": "Daily Poison Immunity Potion",
    "note": "Duration one day",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     34,
     44
    ],
    "label": "Daily Disease Immunity Potion (Duration one day)",
    "kind": "named",
    "count": "1",
    "name": "Daily Disease Immunity Potion",
    "note": "Duration one day",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     45,
     55
    ],
    "label": "2x Medium Defensive Magic Scrolls",
    "kind": "spell",
    "count": "2",
    "rarity": "medium",
    "focus": "defensive",
    "usage": "scroll"
   },
   {
    "range": [
     56,
     66
    ],
    "label": "2x Medium Healing Magic Scrolls",
    "kind": "spell",
    "count": "2",
    "rarity": "medium",
    "focus": "healing",
    "usage": "scroll"
   },
   {
    "range": [
     67,
     78
    ],
    "label": "Magic Armor 3 DR + (Two rolls)",
    "kind": "gear",
    "gear": "armor",
    "rolls": 2,
    "dr": 3
   },
   {
    "range": [
     79,
     89
    ],
    "label": "Medium Defensive Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "medium",
    "focus": "defensive",
    "usage": "tome"
   },
   {
    "range": [
     90,
     100
    ],
    "label": "Medium Healing Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "medium",
    "focus": "healing",
    "usage": "tome"
   }
  ],
  "Legendary": [
   {
    "range": [
     1,
     11
    ],
    "label": "Heal Severe Injury Potion (Heals 9 Health Bar slots and mends all Injuries)",
    "kind": "named",
    "count": "1",
    "name": "Heal Severe Injury Potion",
    "note": "Heals 9 Health Bar slots and mends all Injuries",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     12,
     22
    ],
    "label": "2d2 Good Mana Refill Potions (Restores 15 Mana per round for 10 rounds)",
    "kind": "named",
    "count": "2d2",
    "name": "Good Mana Refill Potion",
    "note": "Restores 15 Mana per round for 10 rounds",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     23,
     33
    ],
    "label": "Daily Debuff Immunity Potion (Duration one day)",
    "kind": "named",
    "count": "1",
    "name": "Daily Debuff Immunity Potion",
    "note": "Duration one day",
    "item": {
     "type": "consumable",
     "consumableType": "potion"
    }
   },
   {
    "range": [
     34,
     44
    ],
    "label": "2x Rare Defensive Magic Scrolls",
    "kind": "spell",
    "count": "2",
    "rarity": "rare",
    "focus": "defensive",
    "usage": "scroll"
   },
   {
    "range": [
     45,
     55
    ],
    "label": "2x Your Choice Healing Magic Scrolls",
    "kind": "spell",
    "count": "2",
    "rarity": "choice",
    "focus": "healing",
    "usage": "scroll"
   },
   {
    "range": [
     56,
     66
    ],
    "label": "Magic Armor 4 DR + (Three rolls)",
    "kind": "gear",
    "gear": "armor",
    "rolls": 3,
    "dr": 4
   },
   {
    "range": [
     67,
     78
    ],
    "label": "Rare Defensive Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "rare",
    "focus": "defensive",
    "usage": "tome"
   },
   {
    "range": [
     79,
     89
    ],
    "label": "Your Choice Healing Magic Tome",
    "kind": "spell",
    "count": "1",
    "rarity": "choice",
    "focus": "healing",
    "usage": "tome"
   },
   {
    "range": [
     90,
     100
    ],
    "label": "Potion of +5 Survival Skill Rank (Permanent)",
    "kind": "skillPotion",
    "ranks": 5,
    "skills": [
     "Survival"
    ]
   }
  ]
 }
}
