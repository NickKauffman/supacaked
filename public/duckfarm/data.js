// Duck Farm — content definitions: crops, quests.

// Seasons cycle over real time; each lasts SEASON_LEN seconds.
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_LEN = 200;
export const seasonFor = (clock) => SEASONS[Math.floor(clock / SEASON_LEN) % 4];
export const SEASON_ICON = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };

// Crops: planted on tilled dirt. cost = coins to plant, sell = coins per harvest,
// grow = seconds to ripen, xp = xp on harvest, level = farmer level to unlock.
export const CROPS = {
  wheat:   { name: 'Wheat',   grow: 8,  cost: 0,  sell: 4,  xp: 2,  level: 1,
             leaf: '#7cc457', a: '#ffe25a', b: '#f0b800', c: '#caa12e' },
  corn:    { name: 'Corn',    grow: 16, cost: 6,  sell: 11, xp: 4,  level: 2,
             leaf: '#5fb04a', a: '#ffe25a', b: '#f4c83a', c: '#3f9248' },
  berry:   { name: 'Berry',   grow: 24, cost: 14, sell: 24, xp: 7,  level: 3,
             leaf: '#4f9e3a', a: '#ff5a6a', b: '#e0304f', c: '#b01f3a' },
  pumpkin: { name: 'Pumpkin', grow: 40, cost: 30, sell: 60, xp: 14, level: 5,
             leaf: '#4f9e3a', a: '#ff9a3c', b: '#e8742a', c: '#b8531a' },
};
export const CROP_ORDER = ['wheat', 'corn', 'berry', 'pumpkin'];

// Fish — caught at water with the fishing minigame; sell or donate to the Museum.
export const FISH = {
  anchovy:  { name: 'Anchovy',    value: 4,  tier: 1 },
  minnow:   { name: 'Minnow',     value: 3,  tier: 1 },
  carp:     { name: 'Carp',       value: 7,  tier: 1 },
  bass:     { name: 'Bass',       value: 9,  tier: 1 },
  goldfish: { name: 'Goldfish',   value: 12, tier: 2 },
  catfish:  { name: 'Catfish',    value: 15, tier: 2 },
  snapper:  { name: 'Snapper',    value: 17, tier: 2 },
  icefish:  { name: 'Ice Fish',   value: 19, tier: 2 },
  puffer:   { name: 'Pufferfish', value: 24, tier: 3 },
  koi:      { name: 'Koi',        value: 30, tier: 3 },
  tuna:     { name: 'Tuna',       value: 34, tier: 3 },
  shark:    { name: 'Shark',      value: 65, tier: 4 },
};
export const FISH_ORDER = Object.keys(FISH);
export const FISH_POOLS = {
  pond: ['minnow', 'carp', 'carp', 'goldfish', 'catfish', 'koi'],
  sea: ['anchovy', 'bass', 'bass', 'snapper', 'tuna', 'puffer', 'shark'],
  ice: ['minnow', 'icefish', 'icefish', 'carp', 'koi'],
  default: ['minnow', 'carp', 'bass'],
};
export const biomePool = (biome) => biome === 'beach' ? 'sea' : biome === 'snow' ? 'ice' : (biome === 'grass' || biome === 'forest' || biome === 'mountain' || biome === 'farm') ? 'pond' : 'default';

// XP needed to go from level L to L+1.
export const xpForLevel = (lvl) => 12 + lvl * 10;

// Sequential quests. `stat` names a tracked counter / derived value; when it
// reaches `goal`, the quest completes and grants the reward, then the next begins.
// A guided journey: learn the farm, head into town, then tour the whole world.
// stat 'visit' + `area` completes when that area is first entered (tracked in main.js).
// Quests advance in order, so exploring out of order still ticks them off in a cascade.
export const QUESTS = [
  // — learning the farm —
  { id: 'plant',    text: 'Plant your first crop',                  stat: 'planted',       goal: 1,   reward: { coins: 12, xp: 5 } },
  { id: 'harvest5', text: 'Harvest 5 crops',                        stat: 'harvested',     goal: 5,   reward: { coins: 18, xp: 8 } },
  { id: 'feed',     text: 'Feed a hungry duck',                     stat: 'fed',           goal: 1,   reward: { coins: 10, xp: 5 } },
  { id: 'eggs10',   text: 'Collect 10 fresh eggs',                  stat: 'eggsCollected', goal: 10,  reward: { coins: 22, xp: 10 } },
  { id: 'sell',     text: 'Sell goods at the Barn',                 stat: 'sold',          goal: 1,   reward: { coins: 15, xp: 8 } },
  // — into town —
  { id: 'town',     text: 'Follow the road south to Quacksborough', stat: 'visit', area: 'quack',    goal: 1, reward: { coins: 20, xp: 10 } },
  { id: 'fish1',    text: 'Cast a line and catch a fish',           stat: 'caught',        goal: 1,   reward: { coins: 18, xp: 10 } },
  { id: 'donate',   text: 'Donate a fish to the Quack Museum',      stat: 'donated',       goal: 1,   reward: { coins: 25, xp: 12 } },
  { id: 'ride',     text: 'Ride a mount from the Duck Emporium',    stat: 'rode',          goal: 1,   reward: { coins: 25, xp: 12 } },
  // — the grand tour of the world —
  { id: 'meadow',   text: 'Stroll east to Sunny Meadow',            stat: 'visit', area: 'meadow',   goal: 1, reward: { coins: 25, xp: 12 } },
  { id: 'beach',    text: 'Reach the seaside town of Sandyshores',  stat: 'visit', area: 'sunny',    goal: 1, reward: { coins: 30, xp: 14 } },
  { id: 'dive',     text: 'Dive to the sunken city of Bubbletown',  stat: 'visit', area: 'bubble',   goal: 1, reward: { coins: 40, xp: 18 } },
  { id: 'desert',   text: 'Trek to Dusty Gulch in the desert',      stat: 'visit', area: 'dunes',    goal: 1, reward: { coins: 35, xp: 16 } },
  { id: 'forest',   text: 'Venture south through Maple Forest',     stat: 'visit', area: 'maple',    goal: 1, reward: { coins: 30, xp: 14 } },
  { id: 'cavern',   text: 'Brave the dark Mossy Cavern',            stat: 'visit', area: 'cave',     goal: 1, reward: { coins: 40, xp: 18 } },
  { id: 'peak',     text: 'Climb to Pinnacle Village',              stat: 'visit', area: 'pinnacle', goal: 1, reward: { coins: 45, xp: 20 } },
  { id: 'snow',     text: 'Reach the snow town of Frostfall',       stat: 'visit', area: 'frost',    goal: 1, reward: { coins: 50, xp: 22 } },
  { id: 'glacier',  text: 'Discover the icy Glacier Depths',        stat: 'visit', area: 'glacier',  goal: 1, reward: { coins: 60, xp: 26 } },
  // — mastery (the long game) —
  { id: 'ducks8',   text: 'Raise a flock of 8 ducks',               stat: 'ducks',         goal: 8,   reward: { coins: 30,  xp: 15 } },
  { id: 'breeds',   text: 'Discover all 5 duck breeds',             stat: 'breeds',        goal: 5,   reward: { coins: 60,  xp: 30 } },
  { id: 'explorer', text: 'Explore all 11 corners of the world',    stat: 'places',        goal: 11,  reward: { coins: 120, xp: 50 } },
  { id: 'ducks15',  text: 'Grow a grand flock of 15 ducks',         stat: 'ducks',         goal: 15,  reward: { coins: 90,  xp: 40 } },
  { id: 'rich',     text: 'Save up 300 coins',                      stat: 'coins',         goal: 300, reward: { coins: 0,   xp: 50 } },
];
