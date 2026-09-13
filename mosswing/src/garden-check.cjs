'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CONFIG = require('./garden-config.js');
const GardenProfile = require('./garden-profile.js');
const GardenModel = require('./garden-model.js');

const ALL_PLANTS = Object.keys(CONFIG.plants);
const LOADOUTS = {
  base: CONFIG.basePlants,
  moonlit: ['moonflower', 'dewcup', 'sunflower', 'mint'],
  night: ['moonflower', 'glowcap', 'thorn', 'dewcup']
};
const LOADOUT_PRIORITIES = {
  base: ['sunflower', 'mint', 'dewcup', 'thorn', 'bellflower', 'dandelion', 'moonflower', 'glowcap'],
  moonlit: ['sunflower', 'moonflower', 'dewcup', 'mint', 'bellflower', 'dandelion', 'glowcap', 'thorn']
};
const copy = value => JSON.parse(JSON.stringify(value));
const boardCell = (state, x, y) => state.board[y * CONFIG.boardSize + x];
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function run(seed = 1, options = {}) {
  return GardenModel.createRun({
    seed,
    runId: `test-${seed}`,
    heartId: options.heartId || 'balanced',
    unlockedPlantIds: options.unlockedPool || options.pool || ALL_PLANTS,
    selectedPlantIds: options.selectedPool,
    tutorial: !!options.tutorial
  });
}

function directPlant(state, type, x, y, options = {}) {
  state.counters.plant += 1;
  boardCell(state, x, y).plant = {
    instanceId: options.instanceId || `fixture-${state.counters.plant}`,
    type,
    orientation: options.orientation ?? 1,
    stage: options.stage || 'mature',
    water: options.water || 0,
    light: options.light || 0,
    bloomCount: options.bloomCount || 0,
    propagated: !!options.propagated,
    bornDay: options.bornDay ?? null,
    mutation: options.mutation || null,
    dailyFlags: {
      triggered: false,
      refreshed: false,
      bloomed: false,
      visited: false,
      bridgeUsed: false,
      guardianUsed: false,
      forcedNight: false
    }
  };
  return boardCell(state, x, y).plant;
}

function fixture(seed = 11) {
  const state = run(seed);
  state.board.forEach(cell => { cell.plant = null; cell.blight = null; });
  state.hand = [];
  state.offer = [];
  state.phase = 'planning';
  state.actionPoints = 3;
  state.prosperity = 0;
  state.result = null;
  state.tasks = [];
  state.daily = {
    cleared: [], bloomed: [], visited: [], usedLight: false, usedWater: false,
    usedNight: false, directProsperity: 0, prosperityGained: 0, chainLength: 0,
    report: null, triggerOverflow: false, nightBloomBonusUsed: false
  };
  state.weather[state.day - 1] = { id: 'wind', windDirection: 'e' };
  state.windDirection = 'e';
  state.undoSnapshot = null;
  return state;
}

function resolve(state) {
  const result = GardenModel.resolveDay(state);
  assert.equal(result.accepted, true, result.reason);
  return result;
}

function dispatch(state, command) {
  const result = GardenModel.dispatch(state, command);
  assert.equal(result.accepted, true, `${command.type}: ${result.reason}`);
  return result.state;
}

function settleChoiceStates(state) {
  let current = state;
  while (current.phase === 'mutation' || current.phase === 'reward') {
    current = current.phase === 'mutation'
      ? dispatch(current, { type: 'choose-mutation', mutationId: 'vigorous' })
      : dispatch(current, { type: 'choose-blessing', blessingId: current.pending.blessingOffer[0] });
  }
  return current;
}

function taskFixture(id, kind = 'main') {
  return { id, kind, reward: CONFIG.tasks[id].reward, completed: false, completedDay: null };
}

// Module purity and public surface.
const modelSource = fs.readFileSync(path.join(__dirname, 'garden-model.js'), 'utf8');
const profileSource = fs.readFileSync(path.join(__dirname, 'garden-profile.js'), 'utf8');
assert(!/\bdocument\b|\bwindow\b|\bTHREE\b|localStorage|Date\.now|Math\.random/.test(modelSource));
assert(!/\bdocument\b|\bwindow\b|\bTHREE\b|localStorage|Date\.now|Math\.random/.test(profileSource));
assert.deepEqual(Object.keys(GardenModel).sort(), ['config', 'createRun', 'dispatch', 'preview', 'resolveDay', 'restore', 'serialize', 'validate'].sort());
assert.deepEqual(Object.keys(GardenProfile).sort(), ['completeTutorial', 'contentUnlocked', 'defaultProfile', 'normalize', 'settleRun', 'startRun', 'unlock'].sort());
assert(Object.isFrozen(CONFIG));

// M5 profile defaults, one-time rewards, fixed unlock nodes, and immutable run snapshots.
const freshProfile = GardenProfile.defaultProfile();
assert.deepEqual(freshProfile.unlockedPlantIds, CONFIG.basePlants);
assert.deepEqual(freshProfile.unlockedHeartIds, ['balanced']);
assert.equal(freshProfile.memorySeeds, 0);
assert.equal(freshProfile.tutorialComplete, false);
assert.equal(freshProfile.wins, 0);
assert.equal(freshProfile.highestProsperity, 0);
assert.equal(freshProfile.longestChain, 0);
assert.deepEqual(
  GardenProfile.normalize({ ...freshProfile, unlockedHeartIds: ['balanced', 'moon'] }).unlockedHeartIds,
  ['balanced'],
  'profile normalization must remove an unlock whose prerequisite is missing'
);

let progression = GardenProfile.startRun(freshProfile);
const winSettlement = GardenProfile.settleRun(progression, {
  runId: 'profile-win', phase: 'result', result: 'win', prosperity: 88, longestChain: 10,
  stats: { daysResolved: 12 },
  tasks: [{ id: 'bloom-six', completed: true }, { id: 'chain-eight', completed: true }]
});
assert.equal(winSettlement.changed, true);
assert.deepEqual(winSettlement.reward, {
  runId: 'profile-win', result: 'win', daysResolved: 12,
  baseReward: 3, taskReward: 2, totalReward: 5, taskIds: ['bloom-six', 'chain-eight']
});
assert.equal(winSettlement.profile.memorySeeds, 5);
assert.equal(winSettlement.profile.wins, 1);
assert.equal(winSettlement.profile.highestProsperity, 88);
assert.equal(winSettlement.profile.longestChain, 10);
const repeatedSettlement = GardenProfile.settleRun(winSettlement.profile, {
  runId: 'profile-win', phase: 'result', result: 'win', prosperity: 88, longestChain: 10,
  stats: { daysResolved: 12 }, tasks: []
});
assert.equal(repeatedSettlement.changed, false);
assert.equal(repeatedSettlement.profile.memorySeeds, 5);
assert.equal(repeatedSettlement.profile.wins, 1);

progression = GardenProfile.startRun(winSettlement.profile);
const daySixLoss = GardenProfile.settleRun(progression, {
  runId: 'profile-day-six-loss', phase: 'result', result: 'blight-overrun', prosperity: 32, longestChain: 4,
  stats: { daysResolved: 6 }, tasks: [{ id: 'bloom-six', completed: true }]
});
assert.equal(daySixLoss.reward.totalReward, 1);
assert.equal(daySixLoss.profile.memorySeeds, 6);
assert.equal(daySixLoss.profile.wins, 1);

progression = GardenProfile.startRun(daySixLoss.profile);
const earlyExit = GardenProfile.settleRun(progression, {
  runId: 'profile-early-exit', phase: 'planning', result: null, prosperity: 4, longestChain: 2,
  stats: { daysResolved: 2 }, tasks: []
});
assert.equal(earlyExit.accepted, false);
assert.equal(earlyExit.profile.memorySeeds, 6);
const earlyLoss = GardenProfile.settleRun(progression, {
  runId: 'profile-early-loss', phase: 'result', result: 'heart-lost', prosperity: 4, longestChain: 2,
  stats: { daysResolved: 5 }, tasks: []
});
assert.equal(earlyLoss.reward.totalReward, 0);
assert.equal(earlyLoss.profile.memorySeeds, 6);

let unlockProfile = { ...GardenProfile.defaultProfile(), memorySeeds: 10 };
const liveRunBeforeUnlock = run(101, { unlockedPool: CONFIG.basePlants, selectedPool: CONFIG.basePlants });
const liveRunSnapshot = copy(liveRunBeforeUnlock);
let unlocked = GardenProfile.unlock(unlockProfile, 'moon');
assert.equal(unlocked.accepted, false);
assert.equal(unlocked.reason, 'prerequisite-locked');
unlocked = GardenProfile.unlock(unlockProfile, 'moonflower');
assert.equal(unlocked.accepted, true);
assert.equal(unlocked.profile.memorySeeds, 8);
unlockProfile = unlocked.profile;
unlocked = GardenProfile.unlock(unlockProfile, 'moon');
assert.equal(unlocked.accepted, true);
assert.equal(unlocked.profile.memorySeeds, 4);
assert.deepEqual(liveRunBeforeUnlock, liveRunSnapshot);
assert.deepEqual(liveRunBeforeUnlock.runPoolSnapshot, CONFIG.basePlants);
assert.equal(GardenProfile.completeTutorial(freshProfile).tutorialComplete, true);

function loadModelWithConfig(config) {
  const context = vm.createContext({ MOSSWING_GARDEN_CONFIG: config });
  vm.runInContext(modelSource, context);
  return context.MosswingGardenModel;
}

// Creation, deterministic weather, entrances, task, and fallback pool.
const createdA = run(90210);
const createdB = run(90210);
assert.deepEqual(createdA, createdB);
assert.equal(createdA.phase, 'planning');
assert.equal(createdA.day, 1);
assert.equal(createdA.hand.length, 4);
assert.equal(createdA.board.length, 25);
assert.equal(Object.isFrozen(createdA.entrances[0]), false);
assert.equal(createdA.weather[0].id, 'clear');
for (let i = 2; i < createdA.weather.length; i++) {
  assert(!(createdA.weather[i].id === createdA.weather[i - 1].id && createdA.weather[i].id === createdA.weather[i - 2].id));
}
assert.notDeepEqual(run(90211).weather, createdA.weather);
assert.notDeepEqual(run(0).weather, run(1).weather);
assert.deepEqual(run(3, { pool: ['bad'] }).unlockedPoolSnapshot, CONFIG.basePlants);
assert.deepEqual(run(4, { unlockedPool: ALL_PLANTS, selectedPool: LOADOUTS.night }).runPoolSnapshot, LOADOUTS.night);
assert.throws(() => run(5, { unlockedPool: ALL_PLANTS, selectedPool: ['sunflower', 'mint', 'thorn'] }), /exactly 4/);
assert.throws(() => run(6, { unlockedPool: CONFIG.basePlants, selectedPool: LOADOUTS.night }), /locked plant/);
assert.throws(() => run(7, { unlockedPool: CONFIG.basePlants, selectedPool: LOADOUTS.base, heartId: 'moon' }), /requires unlocked plant moonflower/);
assert.throws(() => run(8, { unlockedPool: ALL_PLANTS, selectedPool: [...LOADOUTS.base, 'unknown'] }), /exactly 4/);
assert.throws(() => run(9, { unlockedPool: ALL_PLANTS, selectedPool: ['sunflower', 'dewcup', 'mint', 'unknown'] }), /unknown plant/);
assert.throws(() => run(10, { unlockedPool: ALL_PLANTS, selectedPool: ['sunflower', 'dewcup', 'mint', 'mint'] }), /exactly 4/);
assert.throws(() => run(11, { heartId: 'unknown' }), /valid heartId/);
assert.throws(() => GardenModel.createRun({ seed: 1, runId: 'missing-heart', unlockedPlantIds: ALL_PLANTS }), /valid heartId/);
assert.throws(() => GardenModel.createRun({ seed: 1, heartId: 'balanced', unlockedPlantIds: ALL_PLANTS }), /runId/);
assert.throws(() => GardenModel.createRun({ seed: 1, runId: '   ', heartId: 'balanced', unlockedPlantIds: ALL_PLANTS }), /runId/);
assert.throws(() => GardenModel.createRun({ seed: -1, runId: 'bad-seed', heartId: 'balanced', unlockedPlantIds: ALL_PLANTS }), /uint32 seed/);

// Commands are immutable, validate action costs, and keep the center reserved.
let state = run(12);
const original = copy(state);
let rejected = GardenModel.dispatch(state, { type: 'plant', cardId: state.hand[0].cardId, x: 2, y: 2 });
assert.equal(rejected.accepted, false);
assert.equal(rejected.reason, 'invalid-cell');
assert.deepEqual(state, original);
const sunflowerCard = state.hand.find(card => card.plantType === 'sunflower');
let result = GardenModel.dispatch(state, { type: 'plant', cardId: sunflowerCard.cardId, x: 2, y: 1 });
assert.equal(result.accepted, true);
assert.deepEqual(state, original);
state = result.state;
assert.equal(state.actionPoints, 2);
assert.equal(boardCell(state, 2, 1).plant.type, 'sunflower');
assert(!state.hand.some(card => card.cardId === sunflowerCard.cardId));
rejected = GardenModel.dispatch(state, { type: 'rotate', x: 2, y: 1 });
assert.equal(rejected.reason, 'plant-not-rotatable');

// Rotation, movement, and cleanup.
let commandState = fixture(13);
directPlant(commandState, 'dewcup', 0, 0);
commandState = dispatch(commandState, { type: 'rotate', x: 0, y: 0 });
assert.equal(boardCell(commandState, 0, 0).plant.orientation, 2);
commandState = dispatch(commandState, { type: 'move', fromX: 0, fromY: 0, toX: 1, toY: 0 });
assert.equal(boardCell(commandState, 0, 0).plant, null);
assert.equal(boardCell(commandState, 1, 0).plant.type, 'dewcup');
boardCell(commandState, 4, 4).blight = { behavior: 'creep', age: 0 };
commandState.actionPoints = 2;
commandState = dispatch(commandState, { type: 'clean', x: 4, y: 4 });
assert.equal(boardCell(commandState, 4, 4).blight, null);
assert.equal(commandState.stats.blightCleared, 1);

// All three heart abilities obey their target and resource contracts.
let heartState = fixture(14);
directPlant(heartState, 'sunflower', 2, 1);
heartState = dispatch(heartState, { type: 'heart-ability', payload: { x: 2, y: 1, resource: 'light' } });
assert.equal(boardCell(heartState, 2, 1).plant.light, 1);
assert.equal(heartState.heart.dailyAbilityUsed, true);

heartState = run(15, { heartId: 'reservoir' });
heartState.board.forEach(cell => { cell.plant = null; cell.blight = null; });
directPlant(heartState, 'mint', 2, 0);
heartState = dispatch(heartState, { type: 'heart-ability', payload: { x: 2, y: 0 } });
assert.equal(heartState.heart.water, 1);
assert.equal(boardCell(heartState, 2, 0).plant.water, 1);
result = resolve(heartState);
assert.equal(result.state.heart.water, 2);
assert(result.events.some(item => item.type === 'heart-water-restored' && item.amount === 1));

heartState = run(16, { heartId: 'moon' });
heartState.board.forEach(cell => { cell.plant = null; cell.blight = null; });
directPlant(heartState, 'moonflower', 2, 1);
const moonActionsBefore = heartState.actionPoints;
heartState = dispatch(heartState, { type: 'heart-ability', payload: { x: 2, y: 1 } });
assert.equal(heartState.actionPoints, moonActionsBefore);
assert.equal(boardCell(heartState, 2, 1).plant.water, 1);
result = resolve(heartState);
assert(result.events.some(item => item.type === 'plant-bloomed' && item.plantType === 'moonflower' && item.night));

// Draft requires a valid offered card and a discard when the hand is full.
let draft = run(20);
draft = resolve(draft).state;
draft = settleChoiceStates(draft);
assert.equal(draft.phase, 'draft');
assert.equal(draft.offer.length, 3);
assert(draft.offer.every(card => draft.runPoolSnapshot.includes(card.plantType)));
while (draft.hand.length < CONFIG.maxHand) draft.hand.push({ cardId: `extra-${draft.hand.length}`, plantType: 'thorn' });
rejected = GardenModel.dispatch(draft, { type: 'choose-draft', cardId: draft.offer[0].cardId });
assert.equal(rejected.reason, 'discard-required');
const discardedId = draft.hand[0].cardId;
draft = dispatch(draft, { type: 'choose-draft', cardId: draft.offer[0].cardId, discardCardId: discardedId });
assert.equal(draft.phase, 'planning');
assert.equal(draft.hand.length, CONFIG.maxHand);
assert(!draft.hand.some(card => card.cardId === discardedId));

// Undo returns to the dawn snapshot, including its RNG state and offer.
const beforeDraft = copy(draft.undoSnapshot);
const afterUndo = dispatch(draft, { type: 'undo-day' });
assert.equal(afterUndo.phase, beforeDraft.phase);
assert.equal(afterUndo.rngState, beforeDraft.rngState);
assert.deepEqual(afterUndo.offer, beforeDraft.offer);

// Preview is non-mutating and agrees with confirmed resolution.
let previewState = fixture(30);
directPlant(previewState, 'sunflower', 2, 1, { light: 1 });
const previewInputHash = hash(previewState);
const preview = GardenModel.preview(previewState);
assert.equal(hash(previewState), previewInputHash);
let previewCommand = GardenModel.dispatch(previewState, { type: 'preview-day' });
assert.equal(previewCommand.accepted, true);
assert.equal(previewCommand.state.phase, 'preview');
const returnedToPlanning = dispatch(previewCommand.state, { type: 'return-to-planning' });
assert.equal(returnedToPlanning.phase, 'planning');
assert.equal(returnedToPlanning.previewSummary, null);
previewCommand = GardenModel.dispatch(returnedToPlanning, { type: 'preview-day' });
previewCommand = GardenModel.dispatch(previewCommand.state, { type: 'confirm-night' });
assert.equal(previewCommand.accepted, true);
assert.equal(previewCommand.state.lastReport.prosperity, preview.summary.prosperity);
assert.equal(previewCommand.state.lastReport.blooms, preview.summary.blooms);

// Sunflower produces light, and a connected flower is visited.
let plantState = fixture(40);
directPlant(plantState, 'sunflower', 2, 1, { light: 1 });
result = resolve(plantState);
assert(result.events.some(item => item.type === 'plant-bloomed' && item.plantType === 'sunflower'));
assert(result.events.some(item => item.type === 'mosswing-visited' && item.x === 2 && item.y === 1));

// Dewcup transfers at two water and triggers mint.
plantState = fixture(41);
directPlant(plantState, 'dewcup', 0, 2, { water: 1, orientation: 1 });
directPlant(plantState, 'mint', 1, 2);
result = resolve(plantState);
assert(result.events.some(item => item.type === 'resource-transferred' && item.toX === 1 && item.toY === 2));
assert(result.events.some(item => item.type === 'plant-bloomed' && item.plantType === 'mint'));

// Mint refreshes one already-triggered non-mint plant exactly once.
plantState = fixture(42);
directPlant(plantState, 'sunflower', 1, 1, { light: 2 });
directPlant(plantState, 'mint', 2, 1, { water: 1 });
result = resolve(plantState);
assert(result.events.some(item => item.type === 'plant-refreshed'));
assert.equal(result.events.filter(item => item.type === 'plant-bloomed' && item.plantType === 'sunflower').length, 2);

// Moonflower, dandelion propagation, and seedling maturation.
plantState = fixture(43);
directPlant(plantState, 'moonflower', 2, 1, { water: 1 });
result = resolve(plantState);
assert(result.events.some(item => item.type === 'plant-bloomed' && item.plantType === 'moonflower' && item.night));
assert.equal(result.state.lastReport.usedNight, true);

plantState = fixture(44);
directPlant(plantState, 'dandelion', 1, 1, { light: 1, orientation: 1 });
result = resolve(plantState);
assert.equal(boardCell(result.state, 2, 1).plant.type, 'dandelion');
assert.equal(boardCell(result.state, 2, 1).plant.stage, 'seedling');
let seedlingState = settleChoiceStates(result.state);
if (seedlingState.phase === 'draft') seedlingState = dispatch(seedlingState, { type: 'choose-draft', cardId: seedlingState.offer[0].cardId });
seedlingState.weather[seedlingState.day - 1] = { id: 'clear', windDirection: null };
result = resolve(seedlingState);
assert(result.events.some(item => item.type === 'plant-matured'));

// Bellflower blooms from a neighbor and bridges a one-cell gap in the route.
plantState = fixture(45);
directPlant(plantState, 'bellflower', 2, 1, { orientation: 2 });
directPlant(plantState, 'sunflower', 1, 1, { light: 1 });
directPlant(plantState, 'sunflower', 2, 3, { light: 1 });
result = resolve(plantState);
assert(result.events.some(item => item.type === 'plant-bloomed' && item.plantType === 'bellflower'));
assert(result.events.some(item => item.type === 'mosswing-visited' && item.x === 2 && item.y === 3));

// Glowcap turns a planning cleanup into light and bloom.
plantState = fixture(46);
directPlant(plantState, 'glowcap', 1, 0, { orientation: 2 });
boardCell(plantState, 0, 0).blight = { behavior: 'creep', age: 0 };
plantState.actionPoints = 2;
plantState = dispatch(plantState, { type: 'clean', x: 0, y: 0 });
result = resolve(plantState);
assert(result.events.some(item => item.type === 'plant-bloomed' && item.plantType === 'glowcap'));

// Fixed build fixtures prove the three promised archetypes are mechanically distinct.
let buildState = fixture(47);
directPlant(buildState, 'sunflower', 2, 1, { light: 2 });
directPlant(buildState, 'mint', 1, 1, { water: 1 });
directPlant(buildState, 'bellflower', 1, 2, { orientation: 1 });
result = resolve(buildState);
assert(['sunflower', 'mint', 'bellflower'].every(type => result.events.some(item => item.type === 'plant-bloomed' && item.plantType === type)));
assert(result.events.some(item => item.type === 'plant-refreshed'));

buildState = fixture(48);
directPlant(buildState, 'dewcup', 0, 1, { water: 1, orientation: 1 });
directPlant(buildState, 'dandelion', 1, 1);
directPlant(buildState, 'dewcup', 0, 2, { water: 1, orientation: 1 });
directPlant(buildState, 'mint', 1, 2);
result = resolve(buildState);
assert(['mint', 'dandelion'].every(type => result.events.some(item => item.type === 'plant-bloomed' && item.plantType === type)));
assert(result.events.filter(item => item.type === 'resource-transferred' && item.resource === 'water').length >= 2);
assert(result.events.some(item => item.type === 'seedling-created'));

buildState = fixture(49);
buildState.day = 2;
buildState.entrances[0] = { x: 0, y: 0 };
directPlant(buildState, 'thorn', 0, 0);
directPlant(buildState, 'glowcap', 1, 1, { orientation: 1 });
directPlant(buildState, 'moonflower', 2, 1, { water: 1 });
boardCell(buildState, 1, 0).blight = { behavior: 'creep', age: 0 };
buildState.actionPoints = 2;
buildState = dispatch(buildState, { type: 'clean', x: 1, y: 0 });
result = resolve(buildState);
assert(['glowcap', 'moonflower'].every(type => result.events.some(item => item.type === 'plant-bloomed' && item.plantType === type)));
assert(result.events.some(item => item.type === 'thorn-consumed'));

// Thorn blocks blight, guardian blocks an adjacent target, and heart damage is capped at one.
let blightState = fixture(50);
blightState.day = 2;
blightState.entrances[0] = { x: 0, y: 0 };
directPlant(blightState, 'thorn', 0, 0);
result = resolve(blightState);
assert(result.events.some(item => item.type === 'thorn-consumed'));
assert.equal(boardCell(result.state, 0, 0).blight, null);

blightState = fixture(51);
directPlant(blightState, 'sunflower', 1, 1, { mutation: 'guardian' });
blightState.day = 2;
blightState.entrances[0] = { x: 0, y: 1 };
result = resolve(blightState);
assert(result.events.some(item => item.type === 'blight-blocked'));

blightState = fixture(52);
boardCell(blightState, 2, 1).blight = { behavior: 'creep', age: 0 };
boardCell(blightState, 1, 2).blight = { behavior: 'creep', age: 0 };
const hpBefore = blightState.heart.hp;
result = resolve(blightState);
assert.equal(result.state.heart.hp, hpBefore - 1);

blightState = fixture(521);
blightState.heart.hp = 1;
boardCell(blightState, 2, 1).blight = { behavior: 'creep', age: 0 };
result = resolve(blightState);
assert.equal(result.state.result, 'heart-lost');
const fixedHeartLossResult = result.state.result;

// Dormant blight wakes on the following night, even before spreading begins.
blightState = fixture(522);
blightState.day = 2;
blightState.entrances[0] = { x: 0, y: 0 };
result = resolve(blightState);
blightState = settleChoiceStates(result.state);
blightState = dispatch(blightState, { type: 'choose-draft', cardId: blightState.offer[0].cardId });
result = resolve(blightState);
assert.equal(boardCell(result.state, 0, 0).blight.behavior, 'creep');
assert.equal(boardCell(result.state, 0, 0).blight.age, 1);

// Day-nine spread is bounded and deterministic.
blightState = fixture(53);
blightState.day = 9;
boardCell(blightState, 0, 0).blight = { behavior: 'creep', age: 0 };
boardCell(blightState, 4, 4).blight = { behavior: 'windborne', age: 0 };
result = resolve(blightState);
assert.equal(result.events.filter(item => item.type === 'blight-spread').length, 2);

// A spawn counts toward the same nightly cap, and cannot spread on its birth night.
blightState = fixture(531);
blightState.day = 10;
blightState.entrances[3] = { x: 0, y: 0 };
blightState.weather[9] = { id: 'wind', windDirection: 'e' };
boardCell(blightState, 4, 4).blight = { behavior: 'creep', age: 0 };
result = resolve(blightState);
const nightTenAdditions = result.events.filter(item => item.type === 'blight-spawned' || item.type === 'blight-spread');
assert.equal(nightTenAdditions.length, 2);
assert.equal(nightTenAdditions.filter(item => item.type === 'blight-spawned').length, 1);
assert.equal(boardCell(result.state, 1, 0).blight, null);

// Eight blighted cells lose, and day twelve has both win and target-missed outcomes.
blightState = fixture(54);
[0, 1, 2, 3, 4, 5, 9, 15].forEach(index => { blightState.board[index].blight = { behavior: 'creep', age: 0 }; });
result = resolve(blightState);
assert.equal(result.state.result, 'blight-overrun');
const fixedBlightLossResult = result.state.result;

let finalState = fixture(55);
finalState.day = 12;
finalState.prosperity = CONFIG.targetProsperity;
result = resolve(finalState);
assert.equal(result.state.result, 'win');
const fixedWinResult = result.state.result;
finalState = fixture(56);
finalState.day = 12;
finalState.prosperity = 0;
result = resolve(finalState);
assert.equal(result.state.result, 'target-missed');

// Every blessing has an isolated rule test, not only an offer/selection test.
let blessingState = fixture(570);
blessingState.blessings = ['long-channel'];
directPlant(blessingState, 'dewcup', 0, 0, { orientation: 1, water: 1 });
directPlant(blessingState, 'mint', 2, 0);
result = resolve(blessingState);
assert(result.events.some(item => item.type === 'resource-transferred' && item.fromX === 0 && item.toX === 2));

blessingState = fixture(571);
blessingState.blessings = ['afterglow'];
directPlant(blessingState, 'moonflower', 1, 2, { water: 1 });
result = resolve(blessingState);
assert.equal(result.state.lastReport.prosperity, 2);
assert.equal(result.state.lastReport.usedNight, true);

blessingState = fixture(572);
blessingState.blessings = ['return-flight'];
[[2, 1], [1, 1], [0, 1], [1, 2], [1, 3], [2, 3]].forEach(([x, y]) => {
  directPlant(blessingState, 'sunflower', x, y, { light: 1 });
});
result = resolve(blessingState);
assert.equal(result.events.filter(item => item.type === 'pollination-started').length, 2);
assert(result.events.some(item => item.type === 'pollination-started' && item.returnFlight === true));

blessingState = fixture(573);
blessingState.day = 2;
blessingState.weather[1] = { id: 'rain', windDirection: null };
blessingState.blessings = ['soft-rain'];
directPlant(blessingState, 'dandelion', 1, 1, { stage: 'seedling', bornDay: 1 });
result = resolve(blessingState);
assert(result.events.some(item => item.type === 'plant-matured' && item.x === 1 && item.y === 1));

blessingState = fixture(574);
blessingState.day = 2;
blessingState.entrances[0] = { x: 0, y: 0 };
blessingState.blessings = ['living-barrier'];
directPlant(blessingState, 'thorn', 0, 0);
result = resolve(blessingState);
assert(result.events.some(item => item.type === 'thorn-consumed'));
assert.equal(boardCell(result.state, 0, 0).plant.stage, 'seedling');
assert.equal(boardCell(result.state, 0, 0).blight, null);

blessingState = fixture(575);
blessingState.day = 2;
blessingState.entrances[0] = { x: 0, y: 0 };
blessingState.weather[2] = { id: 'wind', windDirection: 'e' };
blessingState.blessings = ['compost-light'];
directPlant(blessingState, 'mint', 0, 0);
const compostTarget = directPlant(blessingState, 'sunflower', 1, 0);
result = resolve(blessingState);
blessingState = settleChoiceStates(result.state);
if (blessingState.phase === 'draft') {
  blessingState = dispatch(blessingState, { type: 'choose-draft', cardId: blessingState.offer[0].cardId });
}
result = resolve(blessingState);
assert(result.events.some(item => item.type === 'resource-added' && item.source === 'compost-light' && item.instanceId === compostTarget.instanceId));

// A thorn that withers while blocking blight also feeds compost-light.
blessingState = fixture(576);
blessingState.day = 2;
blessingState.entrances[0] = { x: 0, y: 0 };
blessingState.blessings = ['compost-light'];
directPlant(blessingState, 'thorn', 0, 0);
const thornCompostTarget = directPlant(blessingState, 'sunflower', 1, 0);
result = resolve(blessingState);
assert.equal(result.state.pendingCompostLightTarget, thornCompostTarget.instanceId);

// Mutation precedes a same-day blessing, and blessings occur on days four and eight only.
let rewardState = fixture(60);
rewardState.day = 4;
directPlant(rewardState, 'sunflower', 2, 1, { light: 1, bloomCount: 2 });
result = resolve(rewardState);
assert.equal(result.state.phase, 'mutation');
assert.equal(result.state.pending.blessingDue, true);
rewardState = dispatch(result.state, { type: 'choose-mutation', mutationId: 'vigorous' });
assert.equal(rewardState.phase, 'reward');
assert.equal(rewardState.pending.blessingOffer.length, 3);
rewardState = dispatch(rewardState, { type: 'choose-blessing', blessingId: rewardState.pending.blessingOffer[0] });
assert.equal(rewardState.day, 5);
assert.equal(rewardState.phase, 'draft');

// The recalibrated queue budget can settle the maximum legal all-sunflower board.
let overflowState = fixture(61);
overflowState.weather[0] = { id: 'clear', windDirection: null };
overflowState.board.forEach(cell => {
  if (cell.x !== 2 || cell.y !== 2) directPlant(overflowState, 'sunflower', cell.x, cell.y);
});
result = resolve(overflowState);
assert(!result.events.some(item => item.type === 'resolution-overflow'));
assert.equal(result.state.stats.overflowCount, 0);

// Both defensive caps retain a visible overflow event when deliberately lowered.
const triggerCapConfig = copy(CONFIG);
triggerCapConfig.maxTriggerEvents = 1;
let cappedModel = loadModelWithConfig(triggerCapConfig);
let cappedState = cappedModel.createRun({
  seed: 62,
  runId: 'trigger-cap',
  heartId: 'balanced',
  unlockedPlantIds: CONFIG.basePlants,
  selectedPlantIds: CONFIG.basePlants
});
cappedState.board.forEach(cell => { cell.plant = null; cell.blight = null; });
directPlant(cappedState, 'sunflower', 2, 1);
directPlant(cappedState, 'sunflower', 1, 1);
result = cappedModel.resolveDay(cappedState);
assert(result.events.some(item => item.type === 'resolution-overflow' && item.scope === 'trigger-events'));
assert.equal(result.state.stats.overflowCount, 1);

const dailyCapConfig = copy(CONFIG);
dailyCapConfig.maxDailyEvents = 3;
cappedModel = loadModelWithConfig(dailyCapConfig);
cappedState = cappedModel.createRun({
  seed: 63,
  runId: 'daily-cap',
  heartId: 'balanced',
  unlockedPlantIds: CONFIG.basePlants,
  selectedPlantIds: CONFIG.basePlants
});
cappedState.board.forEach(cell => { cell.plant = null; cell.blight = null; });
directPlant(cappedState, 'sunflower', 2, 1);
result = cappedModel.resolveDay(cappedState);
assert.equal(result.events.length, dailyCapConfig.maxDailyEvents);
assert.equal(result.events.at(-1).type, 'resolution-overflow');
assert.equal(result.events.at(-1).scope, 'daily-events');
assert.equal(result.state.stats.overflowCount, 1);

// Serialization, restoration, and future resolution remain byte-for-byte deterministic.
let saveState = run(77);
saveState = dispatch(saveState, { type: 'plant', cardId: saveState.hand[0].cardId, x: 2, y: 1 });
const serialized = GardenModel.serialize(saveState);
const restored = GardenModel.restore(serialized);
assert.deepEqual(restored, saveState);
assert.equal(hash(GardenModel.preview(restored)), hash(GardenModel.preview(saveState)));
for (const property of Object.keys(saveState)) {
  for (const malformedValue of [null, {}, []]) {
    const malformedState = copy(saveState);
    malformedState[property] = malformedValue;
    assert.doesNotThrow(() => GardenModel.validate(malformedState), `validate threw for malformed ${property}`);
  }
}
assert.throws(() => GardenModel.restore('{"schemaVersion":99}'), /Invalid garden save/);
const invalidHeartSave = copy(saveState);
invalidHeartSave.heart.hp = -1;
assert.equal(GardenModel.validate(invalidHeartSave).valid, false);
assert.throws(() => GardenModel.restore(JSON.stringify(invalidHeartSave)), /invalid-heart-hp/);
const invalidMoonPrerequisiteSave = run(78, { heartId: 'moon' });
invalidMoonPrerequisiteSave.unlockedPoolSnapshot = CONFIG.basePlants.slice();
assert.throws(() => GardenModel.restore(JSON.stringify(invalidMoonPrerequisiteSave)), /invalid-heart-prerequisite/);
const invalidAvailablePlantSave = copy(saveState);
invalidAvailablePlantSave.availablePlantSnapshot.push('moonflower');
assert.throws(() => GardenModel.restore(JSON.stringify(invalidAvailablePlantSave)), /invalid-available-plants/);
const missingDailySave = copy(saveState);
delete missingDailySave.daily;
assert.equal(GardenModel.validate(missingDailySave).valid, false);
assert.throws(() => GardenModel.restore(JSON.stringify(missingDailySave)), /invalid-daily/);
const invalidBlightSave = copy(saveState);
invalidBlightSave.board[0].blight = { behavior: 'nonsense', age: -1 };
assert.equal(GardenModel.validate(invalidBlightSave).valid, false);
assert.throws(() => GardenModel.restore(JSON.stringify(invalidBlightSave)), /invalid-blight/);
const invalidOfferPlantSave = copy(draft.undoSnapshot);
invalidOfferPlantSave.offer[0].plantType = 'moonflower';
assert.throws(() => GardenModel.restore(JSON.stringify(invalidOfferPlantSave)), /invalid-offer-plant/);
const malformedPoolSave = copy(saveState);
malformedPoolSave.unlockedPoolSnapshot = {};
malformedPoolSave.availablePlantSnapshot = {};
malformedPoolSave.hand = [null];
assert.doesNotThrow(() => GardenModel.validate(malformedPoolSave));
assert.equal(GardenModel.validate(malformedPoolSave).valid, false);
const invalidSeedlingSave = copy(saveState);
boardCell(invalidSeedlingSave, 2, 1).plant.stage = 'seedling';
boardCell(invalidSeedlingSave, 2, 1).plant.bornDay = null;
assert.throws(() => GardenModel.restore(JSON.stringify(invalidSeedlingSave)), /invalid-born-day/);
const invalidDailyCoordinateSave = copy(saveState);
invalidDailyCoordinateSave.daily.cleared = [null];
assert.throws(() => GardenModel.restore(JSON.stringify(invalidDailyCoordinateSave)), /invalid-daily-cleared/);
const invalidBlightedPlantSave = copy(saveState);
boardCell(invalidBlightedPlantSave, 2, 1).blight = { behavior: 'creep', age: 0 };
assert.throws(() => GardenModel.restore(JSON.stringify(invalidBlightedPlantSave)), /invalid-blighted-plant/);
const invalidBoardPlantSave = copy(saveState);
boardCell(invalidBoardPlantSave, 2, 1).plant.type = 'moonflower';
assert.throws(() => GardenModel.restore(JSON.stringify(invalidBoardPlantSave)), /invalid-board-plant/);
const invalidEventSequenceSave = copy(saveState);
invalidEventSequenceSave.eventLog.push({ ...invalidEventSequenceSave.eventLog[0] });
assert.throws(() => GardenModel.restore(JSON.stringify(invalidEventSequenceSave)), /invalid-event-sequence/);
const invalidTaskPrerequisiteSave = copy(saveState);
invalidTaskPrerequisiteSave.tasks = [taskFixture('mixed-triggers')];
assert.throws(() => GardenModel.restore(JSON.stringify(invalidTaskPrerequisiteSave)), /invalid-task-prerequisite/);
const invalidTaskCompletionSave = copy(saveState);
invalidTaskCompletionSave.tasks[0].completed = true;
assert.throws(() => GardenModel.restore(JSON.stringify(invalidTaskCompletionSave)), /invalid-task-completion/);
const missingMutationTargetSave = copy(saveState);
missingMutationTargetSave.phase = 'mutation';
missingMutationTargetSave.pending.mutationInstanceId = 'plant-missing';
assert.throws(() => GardenModel.restore(JSON.stringify(missingMutationTargetSave)), /missing-mutation-target/);
const invalidMutationTargetSave = copy(saveState);
invalidMutationTargetSave.phase = 'mutation';
invalidMutationTargetSave.pending.mutationInstanceId = boardCell(invalidMutationTargetSave, 2, 1).plant.instanceId;
assert.throws(() => GardenModel.restore(JSON.stringify(invalidMutationTargetSave)), /invalid-mutation-target/);
const invalidCompostTargetSave = copy(saveState);
invalidCompostTargetSave.blessings = ['compost-light'];
invalidCompostTargetSave.pendingCompostLightTarget = boardCell(invalidCompostTargetSave, 2, 1).plant.instanceId;
boardCell(invalidCompostTargetSave, 2, 1).plant.stage = 'withered';
assert.throws(() => GardenModel.restore(JSON.stringify(invalidCompostTargetSave)), /invalid-compost-target/);
const impossibleWinSave = copy(saveState);
impossibleWinSave.phase = 'result';
impossibleWinSave.result = 'win';
impossibleWinSave.prosperity = CONFIG.targetProsperity;
assert.throws(() => GardenModel.restore(JSON.stringify(impossibleWinSave)), /invalid-result-condition/);

// All five task contracts complete under their exact daily or cumulative condition.
let taskState = fixture(80);
taskState.tasks = [taskFixture('bloom-six'), taskFixture('chain-eight', 'side')];
[[2, 1], [1, 1], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0], [3, 1]].forEach(([x, y]) => {
  directPlant(taskState, 'sunflower', x, y, { light: 1 });
});
result = resolve(taskState);
assert.deepEqual(result.events.filter(item => item.type === 'task-completed').map(item => item.taskId).sort(), ['bloom-six', 'chain-eight']);

taskState = fixture(81);
taskState.day = 2;
taskState.weather[1] = { id: 'wind', windDirection: 'e' };
taskState.stats.seedlingsMatured = 2;
taskState.tasks = [taskFixture('mature-three')];
directPlant(taskState, 'dandelion', 1, 1, { stage: 'seedling', bornDay: 1 });
result = resolve(taskState);
assert(result.events.some(item => item.type === 'task-completed' && item.taskId === 'mature-three'));

taskState = fixture(82);
taskState.tasks = [taskFixture('clear-three')];
taskState.stats.blightCleared = 2;
boardCell(taskState, 4, 4).blight = { behavior: 'creep', age: 0 };
taskState.actionPoints = 2;
taskState = dispatch(taskState, { type: 'clean', x: 4, y: 4 });
result = resolve(taskState);
assert(result.events.some(item => item.type === 'task-completed' && item.taskId === 'clear-three'));

taskState = fixture(83);
taskState.tasks = [taskFixture('mixed-triggers')];
directPlant(taskState, 'sunflower', 2, 1, { light: 1 });
directPlant(taskState, 'mint', 1, 1, { water: 1 });
directPlant(taskState, 'moonflower', 1, 2, { water: 1 });
result = resolve(taskState);
assert(result.events.some(item => item.type === 'task-completed' && item.taskId === 'mixed-triggers'));

function chooseDraftForBot(state, priorities) {
  const offered = state.offer.slice().sort((a, b) => priorities.indexOf(a.plantType) - priorities.indexOf(b.plantType));
  const command = { type: 'choose-draft', cardId: offered[0].cardId };
  if (state.hand.length >= CONFIG.maxHand) {
    const keepScore = card => priorities.indexOf(card.plantType);
    command.discardCardId = state.hand.slice().sort((a, b) => keepScore(b) - keepScore(a))[0].cardId;
  }
  return dispatch(state, command);
}

const BOT_POSITIONS = [
  [2, 1], [1, 2], [0, 2], [1, 1], [3, 1], [3, 2], [2, 3], [1, 3],
  [3, 3], [2, 0], [4, 2], [2, 4], [0, 1], [4, 1], [4, 3], [0, 3],
  [1, 0], [3, 0], [1, 4], [3, 4], [0, 0], [4, 0], [4, 4], [0, 4]
];
function useHeartForBot(state) {
  if (state.actionPoints < CONFIG.hearts[state.heart.id].actionCost || state.heart.dailyAbilityUsed) return state;
  let target = null;
  let payload = null;
  if (state.heart.id === 'balanced') {
    target = [[2, 1], [3, 2], [2, 3], [1, 2]]
      .map(([x, y]) => boardCell(state, x, y))
      .find(cell => cell.plant?.stage === 'mature');
    if (target) {
      const resource = ['mint', 'dandelion', 'moonflower'].includes(target.plant.type) ? 'water' : 'light';
      payload = { x: target.x, y: target.y, resource };
    }
  } else if (state.heart.id === 'reservoir' && state.heart.water > 0) {
    target = state.board
      .filter(cell => cell.plant?.stage === 'mature' && (cell.x === 2 || cell.y === 2) && cell.plant.water < 2)
      .sort((a, b) => {
        const waterUsers = new Set(['mint', 'dandelion', 'moonflower', 'dewcup']);
        return Number(!waterUsers.has(a.plant.type)) - Number(!waterUsers.has(b.plant.type));
      })[0];
    if (target) payload = { x: target.x, y: target.y };
  } else if (state.heart.id === 'moon') {
    target = state.board.find(cell => cell.plant?.type === 'moonflower' && cell.plant.stage === 'mature' && !cell.plant.dailyFlags.triggered);
    if (target) payload = { x: target.x, y: target.y };
  }
  if (!payload) return state;
  const ability = GardenModel.dispatch(state, { type: 'heart-ability', payload });
  return ability.accepted ? ability.state : state;
}

function playBotPlanning(state, priorities, tutorial, positions = BOT_POSITIONS, cleanBlight = true) {
  let current = state;
  const danger = current.board
    .filter(cell => cell.blight)
    .sort((a, b) => manhattanToHeart(a) - manhattanToHeart(b))[0];
  if (cleanBlight && danger && current.actionPoints >= 2 && (tutorial || current.day % 2 === 0)) {
    current = dispatch(current, { type: 'clean', x: danger.x, y: danger.y });
  }

  while (current.actionPoints > 0 && current.hand.length) {
    const open = positions.map(([x, y]) => boardCell(current, x, y)).find(cell => !cell.plant && !cell.blight);
    if (!open) break;
    const card = current.hand.slice().sort((a, b) => priorities.indexOf(a.plantType) - priorities.indexOf(b.plantType))[0];
    current = dispatch(current, { type: 'plant', cardId: card.cardId, x: open.x, y: open.y });
  }
  return useHeartForBot(current);
}

function autoplay(seed, options = {}) {
  const tutorial = !!options.tutorial;
  let state = options.initialState ? copy(options.initialState) : run(seed, {
    tutorial,
    unlockedPool: options.unlockedPool || ALL_PLANTS,
    selectedPool: options.selectedPool || CONFIG.basePlants,
    heartId: options.heartId || 'balanced'
  });
  const priorities = options.priorities || (tutorial
    ? ['sunflower', 'bellflower', 'mint', 'dewcup', 'dandelion', 'moonflower', 'glowcap', 'thorn']
    : LOADOUT_PRIORITIES.base);
  let guard = 0;
  while (state.phase !== 'result' && guard++ < 200) {
    if (state.phase === 'draft') {
      state = chooseDraftForBot(state, priorities);
      continue;
    }
    if (state.phase === 'mutation') {
      state = dispatch(state, { type: 'choose-mutation', mutationId: 'vigorous' });
      continue;
    }
    if (state.phase === 'reward') {
      const preferred = ['return-flight', 'afterglow', 'long-channel', 'soft-rain', 'living-barrier', 'compost-light'];
      const choice = preferred.find(id => state.pending.blessingOffer.includes(id)) || state.pending.blessingOffer[0];
      state = dispatch(state, { type: 'choose-blessing', blessingId: choice });
      continue;
    }
    assert.equal(state.phase, 'planning');
    state = playBotPlanning(state, priorities, tutorial, options.positions || BOT_POSITIONS, options.cleanBlight !== false);
    state = dispatch(state, { type: 'preview-day' });
    state = dispatch(state, { type: 'confirm-night' });
    const valid = GardenModel.validate(state);
    assert.equal(valid.valid, true, valid.errors.join(', '));
  }
  assert(guard < 200, `simulation ${seed} did not terminate`);
  assert.equal(state.phase, 'result');
  return state;
}

function manhattanToHeart(cell) {
  return Math.abs(cell.x - 2) + Math.abs(cell.y - 2);
}

function runFixedTutorial() {
  let state = run(CONFIG.tutorialSeed, { tutorial: true, pool: CONFIG.basePlants, heartId: 'balanced' });
  const sunflower = state.hand.find(card => card.plantType === 'sunflower');
  const dewcup = state.hand.find(card => card.plantType === 'dewcup');
  state = dispatch(state, { type: 'plant', cardId: sunflower.cardId, x: 2, y: 1 });
  state = dispatch(state, { type: 'plant', cardId: dewcup.cardId, x: 1, y: 1 });
  state = dispatch(state, { type: 'rotate', x: 1, y: 1 });
  state = dispatch(state, { type: 'preview-day' });
  assert(state.previewSummary.blooms >= 1);
  state = dispatch(state, { type: 'confirm-night' });

  state = chooseDraftForBot(state, ['sunflower', 'mint', 'dewcup', 'thorn']);
  state = playBotPlanning(state, ['sunflower', 'mint', 'dewcup', 'thorn'], true);
  state = dispatch(state, { type: 'preview-day' });
  state = dispatch(state, { type: 'confirm-night' });
  state = settleChoiceStates(state);
  state = chooseDraftForBot(state, ['sunflower', 'mint', 'dewcup', 'thorn']);
  const firstBlight = state.board.find(cell => cell.blight);
  assert(firstBlight, 'tutorial must expose the first blight before the cleanup lesson');
  state = dispatch(state, { type: 'clean', x: firstBlight.x, y: firstBlight.y });
  return autoplay(CONFIG.tutorialSeed, { tutorial: true, pool: CONFIG.basePlants, heartId: 'balanced', initialState: state });
}

// The fixed tutorial uses only the initially unlocked content and performs the documented four-step opening.
const tutorial = runFixedTutorial();
assert.equal(tutorial.result, 'win', JSON.stringify({ result: tutorial.result, day: tutorial.day, prosperity: tutorial.prosperity, heart: tutorial.heart.hp, blight: tutorial.board.filter(cell => cell.blight).length, stats: tutorial.stats }));

// One thousand deterministic runs: termination, invariants, outcome distribution, and replay hash.
const simulation = { runs: 1000, wins: 0, totalDays: 0, totalProsperity: 0, totalFinalBlight: 0, minHeartHp: Infinity, maxFinalBlight: 0, overflowCount: 0, outcomes: {} };
for (let seed = 1; seed <= simulation.runs; seed++) {
  const outcome = autoplay(seed, { unlockedPool: ALL_PLANTS, selectedPool: LOADOUTS.base, priorities: LOADOUT_PRIORITIES.base, heartId: 'balanced' });
  simulation.wins += outcome.result === 'win' ? 1 : 0;
  simulation.totalDays += outcome.stats.daysResolved;
  simulation.totalProsperity += outcome.prosperity;
  const finalBlight = outcome.board.filter(cell => cell.blight).length;
  simulation.totalFinalBlight += finalBlight;
  simulation.minHeartHp = Math.min(simulation.minHeartHp, outcome.heart.hp);
  simulation.maxFinalBlight = Math.max(simulation.maxFinalBlight, finalBlight);
  simulation.overflowCount += outcome.stats.overflowCount;
  simulation.outcomes[outcome.result] = (simulation.outcomes[outcome.result] || 0) + 1;
  assert.equal(hash(outcome), hash(autoplay(seed, { unlockedPool: ALL_PLANTS, selectedPool: LOADOUTS.base, priorities: LOADOUT_PRIORITIES.base, heartId: 'balanced' })));
  assert(Number.isFinite(outcome.prosperity));
  assert(outcome.actionPoints >= 0);
  assert(outcome.board.every(cell => inRange(cell.x) && inRange(cell.y)));
}

const summary = {
  runs: simulation.runs,
  winRate: Number((simulation.wins / simulation.runs).toFixed(3)),
  averageDays: Number((simulation.totalDays / simulation.runs).toFixed(3)),
  averageProsperity: Number((simulation.totalProsperity / simulation.runs).toFixed(3)),
  averageFinalBlight: Number((simulation.totalFinalBlight / simulation.runs).toFixed(3)),
  minHeartHp: simulation.minHeartHp,
  maxFinalBlight: simulation.maxFinalBlight,
  overflowCount: simulation.overflowCount,
  outcomes: simulation.outcomes
};
assert(summary.winRate >= 0.35 && summary.winRate <= 0.65, `baseline bot win rate ${summary.winRate} is outside 0.35..0.65`);
assert.equal(summary.overflowCount, 0);

function summarizeMatrixEntry(name, options, runs = 500) {
  const aggregate = { name, runs, wins: 0, totalDays: 0, totalProsperity: 0, totalFinalBlight: 0, minHeartHp: Infinity, maxFinalBlight: 0, overflowCount: 0, overflowSeeds: [], outcomes: {} };
  for (let seed = 1; seed <= runs; seed++) {
    const outcome = autoplay(seed, options);
    aggregate.wins += outcome.result === 'win' ? 1 : 0;
    aggregate.totalDays += outcome.stats.daysResolved;
    aggregate.totalProsperity += outcome.prosperity;
    const finalBlight = outcome.board.filter(cell => cell.blight).length;
    aggregate.totalFinalBlight += finalBlight;
    aggregate.minHeartHp = Math.min(aggregate.minHeartHp, outcome.heart.hp);
    aggregate.maxFinalBlight = Math.max(aggregate.maxFinalBlight, finalBlight);
    aggregate.overflowCount += outcome.stats.overflowCount;
    if (outcome.stats.overflowCount) aggregate.overflowSeeds.push(seed);
    aggregate.outcomes[outcome.result] = (aggregate.outcomes[outcome.result] || 0) + 1;
  }
  return {
    name,
    runs,
    winRate: Number((aggregate.wins / runs).toFixed(3)),
    averageDays: Number((aggregate.totalDays / runs).toFixed(3)),
    averageProsperity: Number((aggregate.totalProsperity / runs).toFixed(3)),
    averageFinalBlight: Number((aggregate.totalFinalBlight / runs).toFixed(3)),
    minHeartHp: aggregate.minHeartHp,
    maxFinalBlight: aggregate.maxFinalBlight,
    overflowCount: aggregate.overflowCount,
    overflowSeeds: aggregate.overflowSeeds,
    outcomes: aggregate.outcomes
  };
}

const balanceMatrix = [
  summarizeMatrixEntry('base-balanced', { unlockedPool: CONFIG.basePlants, selectedPool: LOADOUTS.base, priorities: LOADOUT_PRIORITIES.base, heartId: 'balanced' }),
  summarizeMatrixEntry('base-reservoir', { unlockedPool: CONFIG.basePlants, selectedPool: LOADOUTS.base, priorities: LOADOUT_PRIORITIES.base, heartId: 'reservoir' }),
  summarizeMatrixEntry('unlocked-balanced', { unlockedPool: ALL_PLANTS, selectedPool: LOADOUTS.base, priorities: LOADOUT_PRIORITIES.base, heartId: 'balanced' }),
  summarizeMatrixEntry('unlocked-reservoir', { unlockedPool: ALL_PLANTS, selectedPool: LOADOUTS.base, priorities: LOADOUT_PRIORITIES.base, heartId: 'reservoir' }),
  summarizeMatrixEntry('unlocked-moon', { unlockedPool: ALL_PLANTS, selectedPool: LOADOUTS.moonlit, priorities: LOADOUT_PRIORITIES.moonlit, heartId: 'moon' })
];
for (const entry of balanceMatrix) {
  assert(entry.winRate >= 0.35 && entry.winRate <= 0.65, `${entry.name} win rate ${entry.winRate} is outside 0.35..0.65`);
  assert.equal(entry.overflowCount, 0, `${entry.name} overflowed resolution`);
}

const m6FixedBuilds = [
  { name: 'sun-chain', seed: 1, options: { unlockedPool: ALL_PLANTS, selectedPool: LOADOUTS.base, priorities: LOADOUT_PRIORITIES.base, heartId: 'balanced' } },
  { name: 'tide-channel', seed: 1, options: { unlockedPool: ALL_PLANTS, selectedPool: LOADOUTS.base, priorities: LOADOUT_PRIORITIES.base, heartId: 'reservoir' } },
  { name: 'moon-bloom', seed: 1, options: { unlockedPool: ALL_PLANTS, selectedPool: LOADOUTS.moonlit, priorities: LOADOUT_PRIORITIES.moonlit, heartId: 'moon' } }
].map(scenario => {
  const outcome = autoplay(scenario.seed, scenario.options);
  assert.equal(outcome.result, 'win', `${scenario.name} fixed seed ${scenario.seed} must win`);
  assert.equal(outcome.stats.daysResolved, 12);
  return { name: scenario.name, seed: scenario.seed, heartId: outcome.heart.id, pool: outcome.runPoolSnapshot, result: outcome.result, prosperity: outcome.prosperity, longestChain: outcome.longestChain };
});

const pressureProbe = summarizeMatrixEntry('ignore-blight', {
  unlockedPool: ALL_PLANTS,
  selectedPool: LOADOUTS.base,
  priorities: LOADOUT_PRIORITIES.base,
  heartId: 'balanced',
  cleanBlight: false
});
assert(pressureProbe.winRate < 0.2, `ignore-blight win rate ${pressureProbe.winRate} must stay below 0.2`);
assert((pressureProbe.outcomes['blight-overrun'] || 0) > 0, 'ignoring blight must produce blight-overrun losses');
assert.equal(pressureProbe.overflowCount, 0);

function inRange(value) {
  return Number.isInteger(value) && value >= 0 && value < CONFIG.boardSize;
}

console.log('PASS: garden commands, 8 plants, weather, blight, pollination, mutation, blessings, 5 tasks, win/loss, strict save validation, replay, queue guard.');
console.log('M5_PROFILE: fresh base-only, win +3, day-six loss +1, early exit +0, first-task +1 each, idempotent settlement, fixed unlock prerequisites.');
console.log(`M4_FIXED_SCENARIOS: ${JSON.stringify({ win: fixedWinResult, heartLoss: fixedHeartLossResult, blightLoss: fixedBlightLossResult })}`);
console.log(`SIMULATION: ${JSON.stringify(summary)}`);
console.log(`TUTORIAL: ${JSON.stringify({ seed: CONFIG.tutorialSeed, pool: 'base', heartId: 'balanced', result: tutorial.result, prosperity: tutorial.prosperity })}`);
console.log(`BALANCE_MATRIX: ${JSON.stringify(balanceMatrix)}`);
console.log(`M6_FIXED_BUILDS: ${JSON.stringify(m6FixedBuilds)}`);
console.log(`PRESSURE_PROBE: ${JSON.stringify(pressureProbe)}`);
