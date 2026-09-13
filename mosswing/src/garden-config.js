'use strict';

// Pure data shared by the browser build and Node-based deterministic checks.
// Keep this file free of DOM, Three.js, time, storage, and ambient randomness.
const MOSSWING_GARDEN_CONFIG = {
  schemaVersion: 1,
  boardSize: 5,
  maxDays: 12,
  actionsPerDay: 3,
  maxHand: 5,
  runPoolSize: 4,
  targetProsperity: 75,
  tutorialTargetProsperity: 60,
  blightLossCount: 8,
  blightSpreadStartDay: 5,
  maxTriggerEvents: 128,
  maxDailyEvents: 192,
  tutorialSeed: 104729,
  basePlants: ['sunflower', 'dewcup', 'mint', 'thorn'],
  initialHand: ['sunflower', 'dewcup', 'mint', 'thorn'],
  directions: [
    { id: 'n', dx: 0, dy: -1 },
    { id: 'e', dx: 1, dy: 0 },
    { id: 's', dx: 0, dy: 1 },
    { id: 'w', dx: -1, dy: 0 }
  ],
  hearts: {
    balanced: { id: 'balanced', name: '苔心', maxHp: 5, initialWater: 0, actionCost: 1, dawnWater: 0 },
    reservoir: { id: 'reservoir', name: '潮心', maxHp: 4, initialWater: 2, actionCost: 1, dawnWater: 1 },
    moon: { id: 'moon', name: '月心', maxHp: 4, initialWater: 0, actionCost: 0, dawnWater: 0 }
  },
  plants: {
    sunflower: { id: 'sunflower', name: '向日葵', rotatable: false, role: 'light' },
    dewcup: { id: 'dewcup', name: '露杯草', rotatable: true, role: 'water' },
    mint: { id: 'mint', name: '薄荷', rotatable: false, role: 'water' },
    moonflower: { id: 'moonflower', name: '月光花', rotatable: false, role: 'night' },
    dandelion: { id: 'dandelion', name: '蒲公英', rotatable: true, role: 'growth' },
    bellflower: { id: 'bellflower', name: '铃兰', rotatable: true, role: 'pollination' },
    thorn: { id: 'thorn', name: '风荆', rotatable: false, role: 'defense' },
    glowcap: { id: 'glowcap', name: '辉菌', rotatable: true, role: 'blight' }
  },
  weather: {
    clear: { id: 'clear', name: '晴空', weight: 45 },
    rain: { id: 'rain', name: '骤雨', weight: 30 },
    wind: { id: 'wind', name: '强风', weight: 25 }
  },
  blessings: {
    'long-channel': { id: 'long-channel', name: '漫长水路' },
    afterglow: { id: 'afterglow', name: '夜光余韵' },
    'return-flight': { id: 'return-flight', name: '返程授粉' },
    'soft-rain': { id: 'soft-rain', name: '轻柔雨幕' },
    'living-barrier': { id: 'living-barrier', name: '活体篱笆' },
    'compost-light': { id: 'compost-light', name: '腐植微光' }
  },
  mutations: {
    vigorous: { id: 'vigorous', name: '盛放' },
    guardian: { id: 'guardian', name: '守护' }
  },
  tasks: {
    'bloom-six': { id: 'bloom-six', name: '单日同时开花6株', reward: 6 },
    'chain-eight': { id: 'chain-eight', name: '建立长度8的授粉网', reward: 8 },
    'mature-three': { id: 'mature-three', name: '使3株幼苗成熟', reward: 5, requires: ['dandelion'] },
    'clear-three': { id: 'clear-three', name: '累计清除3格污染', reward: 6 },
    'mixed-triggers': { id: 'mixed-triggers', name: '同日触发光、水和夜花', reward: 7, requires: ['moonflower'] }
  },
  blightSpawns: [
    { day: 2, behavior: 'dormant' },
    { day: 5, behavior: 'creep' },
    { day: 8, behavior: 'windborne' },
    { day: 10, behavior: 'creep' }
  ],
  cornerEntrances: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 }
  ],
  unlocks: {
    moonflower: { cost: 2, prerequisite: null },
    dandelion: { cost: 2, prerequisite: null },
    bellflower: { cost: 3, prerequisite: null },
    glowcap: { cost: 3, prerequisite: null },
    reservoir: { cost: 4, prerequisite: 'dewcup' },
    moon: { cost: 4, prerequisite: 'moonflower' }
  }
};

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

deepFreeze(MOSSWING_GARDEN_CONFIG);
if (typeof globalThis !== 'undefined') globalThis.MOSSWING_GARDEN_CONFIG = MOSSWING_GARDEN_CONFIG;
if (typeof module !== 'undefined') module.exports = MOSSWING_GARDEN_CONFIG;
