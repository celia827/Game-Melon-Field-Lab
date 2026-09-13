'use strict';

(function initGardenModel(root) {
  const CONFIG = root.MOSSWING_GARDEN_CONFIG ||
    (typeof require === 'function' ? require('./garden-config.js') : null);
  if (!CONFIG) throw new Error('MOSSWING_GARDEN_CONFIG is required');

  const PHASES = new Set(['dawn', 'draft', 'planning', 'preview', 'resolving', 'night', 'reward', 'mutation', 'result']);
  const DIRS = CONFIG.directions;
  const BASE_POOL = CONFIG.basePlants;

  const clone = value => JSON.parse(JSON.stringify(value));
  const key = (x, y) => `${x},${y}`;
  const inBounds = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < CONFIG.boardSize && y < CONFIG.boardSize;
  const indexOf = (x, y) => y * CONFIG.boardSize + x;
  const cellAt = (state, x, y) => inBounds(x, y) ? state.board[indexOf(x, y)] : null;
  const plantAt = (state, x, y) => cellAt(state, x, y)?.plant || null;
  const direction = orientation => DIRS[((orientation % 4) + 4) % 4];
  const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  function nextRandom(state) {
    state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
    return state.rngState / 4294967296;
  }

  function randomIndex(state, length) {
    return Math.min(length - 1, Math.floor(nextRandom(state) * length));
  }

  function shuffle(state, values) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = randomIndex(state, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function chooseWeightedWeather(state, excluded = null) {
    const entries = Object.values(CONFIG.weather).filter(item => item.id !== excluded);
    const total = entries.reduce((sum, item) => sum + item.weight, 0);
    let roll = nextRandom(state) * total;
    for (const item of entries) {
      roll -= item.weight;
      if (roll < 0) return item.id;
    }
    return entries[entries.length - 1].id;
  }

  function createWeather(state) {
    const result = [{ id: 'clear', windDirection: null }];
    for (let day = 2; day <= CONFIG.maxDays; day++) {
      let id = chooseWeightedWeather(state);
      if (result.length >= 2 && result.at(-1).id === id && result.at(-2).id === id) {
        id = chooseWeightedWeather(state, id);
      }
      result.push({ id, windDirection: id === 'wind' ? DIRS[randomIndex(state, DIRS.length)].id : null });
    }
    return result;
  }

  function normalizedUnlockedPool(input) {
    const valid = [...new Set((Array.isArray(input) ? input : []).filter(id => CONFIG.plants[id]))];
    const pool = valid.length >= 3 ? valid : BASE_POOL.slice();
    for (const id of BASE_POOL) if (!pool.includes(id)) pool.push(id);
    return pool;
  }

  function normalizedRunPool(unlockedPool, input) {
    if (input === undefined || input === null) return BASE_POOL.slice();
    if (!Array.isArray(input) || input.length !== CONFIG.runPoolSize || new Set(input).size !== CONFIG.runPoolSize) {
      throw new Error(`selectedPlantIds must contain exactly ${CONFIG.runPoolSize} unique plants`);
    }
    if (input.some(id => !CONFIG.plants[id])) throw new Error('selectedPlantIds contains an unknown plant');
    if (input.some(id => !unlockedPool.includes(id))) throw new Error('selectedPlantIds contains a locked plant');
    return input.slice();
  }

  function createCard(state, plantType) {
    state.counters.card += 1;
    return { cardId: `card-${state.counters.card}`, plantType };
  }

  function createPlant(state, type, stage = 'mature') {
    state.counters.plant += 1;
    return {
      instanceId: `plant-${state.counters.plant}`,
      type,
      orientation: 1,
      stage,
      water: 0,
      light: 0,
      bloomCount: 0,
      propagated: false,
      bornDay: stage === 'seedling' ? state.day : null,
      mutation: null,
      dailyFlags: freshFlags()
    };
  }

  function freshFlags() {
    return {
      triggered: false,
      refreshed: false,
      bloomed: false,
      visited: false,
      bridgeUsed: false,
      guardianUsed: false,
      forcedNight: false
    };
  }

  function createBoard() {
    return Array.from({ length: CONFIG.boardSize * CONFIG.boardSize }, (_, index) => ({
      x: index % CONFIG.boardSize,
      y: Math.floor(index / CONFIG.boardSize),
      terrain: 'soil',
      plant: null,
      blight: null
    }));
  }

  function compatibleTaskIds(pool) {
    return Object.values(CONFIG.tasks)
      .filter(task => !task.requires || task.requires.every(id => pool.includes(id)))
      .map(task => task.id);
  }

  function createTask(state, id, kind) {
    const task = CONFIG.tasks[id];
    return { id, kind, reward: task.reward, completed: false, completedDay: null };
  }

  function makeSnapshot(state) {
    const snapshot = clone(state);
    snapshot.undoSnapshot = null;
    snapshot.previewSummary = null;
    return snapshot;
  }

  function createRun(options = {}) {
    const heartId = options.heartId;
    if (!CONFIG.hearts[heartId]) throw new Error('createRun requires a valid heartId');
    if (typeof options.runId !== 'string' || !options.runId.trim()) throw new Error('createRun requires runId');
    if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new Error('createRun requires a uint32 seed');
    const seed = options.seed >>> 0;
    const unlockedPool = normalizedUnlockedPool(options.unlockedPlantIds);
    const heartPrerequisite = CONFIG.unlocks[heartId]?.prerequisite;
    if (heartPrerequisite && !unlockedPool.includes(heartPrerequisite)) {
      throw new Error(`${heartId} heart requires unlocked plant ${heartPrerequisite}`);
    }
    const runPool = normalizedRunPool(unlockedPool, options.selectedPlantIds);
    const state = {
      schemaVersion: CONFIG.schemaVersion,
      runId: options.runId,
      seed,
      rngState: seed,
      phase: 'planning',
      day: 1,
      actionPoints: CONFIG.actionsPerDay,
      heart: {
        id: heartId,
        hp: CONFIG.hearts[heartId].maxHp,
        maxHp: CONFIG.hearts[heartId].maxHp,
        water: CONFIG.hearts[heartId].initialWater,
        dailyAbilityUsed: false
      },
      board: createBoard(),
      unlockedPoolSnapshot: unlockedPool,
      runPoolSnapshot: runPool,
      availablePlantSnapshot: [],
      offer: [],
      hand: [],
      weather: [],
      windDirection: null,
      prosperity: 0,
      longestChain: 0,
      blessings: [],
      tasks: [],
      mutationUsed: false,
      stats: {
        totalBlooms: 0,
        blightCleared: 0,
        seedlingsMatured: 0,
        plantsPlaced: 0,
        daysResolved: 0,
        maxBloomDay: 0,
        maxChain: 0,
        overflowCount: 0
      },
      daily: createDailyState(),
      lastReport: null,
      undoSnapshot: null,
      previewSummary: null,
      eventLog: [],
      result: null,
      pending: { mutationInstanceId: null, blessingDue: false, blessingOffer: [] },
      entrances: [],
      counters: { card: 0, plant: 0, event: 0 },
      tutorial: !!options.tutorial,
      pendingCompostLightTarget: null
    };

    state.weather = createWeather(state);
    state.entrances = shuffle(state, CONFIG.cornerEntrances).map(pos => ({ ...pos }));
    const initial = CONFIG.initialHand.slice();
    if (heartId === 'moon') initial[initial.indexOf('thorn')] = 'moonflower';
    const availableTypes = [...new Set([...initial, ...runPool])];
    state.availablePlantSnapshot = availableTypes;
    const possibleTasks = compatibleTaskIds(availableTypes);
    const mainTaskId = possibleTasks[randomIndex(state, possibleTasks.length)];
    state.tasks.push(createTask(state, mainTaskId, 'main'));

    state.hand = initial.map(type => createCard(state, type));
    state.windDirection = state.weather[0].windDirection;
    state.eventLog = [
      event(state, 'day-start', { day: 1 }),
      event(state, 'weather-applied', { ...state.weather[0] })
    ];
    state.undoSnapshot = makeSnapshot(state);
    return state;
  }

  function createDailyState() {
    return {
      cleared: [],
      bloomed: [],
      visited: [],
      usedLight: false,
      usedWater: false,
      usedNight: false,
      directProsperity: 0,
      prosperityGained: 0,
      chainLength: 0,
      report: null,
      triggerOverflow: false,
      nightBloomBonusUsed: false
    };
  }

  function event(state, type, details = {}) {
    state.counters.event += 1;
    return { seq: state.counters.event, type, ...details };
  }

  function recordResolutionOverflow(state, events, limit, scope) {
    if (events.some(item => item.type === 'resolution-overflow')) return;
    state.daily.triggerOverflow = true;
    state.stats.overflowCount += 1;
    const details = { limit, scope };
    if (events.length >= CONFIG.maxDailyEvents) {
      const replaced = events[CONFIG.maxDailyEvents - 1];
      events[CONFIG.maxDailyEvents - 1] = { seq: replaced.seq, type: 'resolution-overflow', ...details };
    } else {
      events.push(event(state, 'resolution-overflow', details));
    }
  }

  function emit(state, events, type, details = {}) {
    if (events.length >= CONFIG.maxDailyEvents) {
      recordResolutionOverflow(state, events, CONFIG.maxDailyEvents, 'daily-events');
      return false;
    }
    events.push(event(state, type, details));
    return true;
  }

  function reject(state, reason) {
    return { accepted: false, reason, state, events: [] };
  }

  function accept(state, events = []) {
    state.eventLog = events;
    return { accepted: true, reason: null, state, events };
  }

  function requirePlanning(state) {
    return state.phase === 'planning';
  }

  function dispatch(input, command = {}) {
    if (!input || typeof input !== 'object') return reject(input, 'invalid-state');
    if (!command || typeof command.type !== 'string') return reject(input, 'invalid-command');

    if (command.type === 'choose-draft') return chooseDraft(input, command);
    if (command.type === 'choose-mutation') return chooseMutation(input, command);
    if (command.type === 'choose-blessing') return chooseBlessing(input, command);
    if (command.type === 'undo-day') return undoDay(input);
    if (command.type === 'preview-day') return previewDay(input);
    if (command.type === 'return-to-planning') return returnToPlanning(input);
    if (command.type === 'confirm-night') {
      if (input.phase !== 'preview') return reject(input, 'wrong-phase');
      const state = clone(input);
      state.phase = 'planning';
      state.previewSummary = null;
      return resolveDay(state);
    }
    if (!requirePlanning(input)) return reject(input, 'wrong-phase');

    if (command.type === 'plant') return plantCard(input, command);
    if (command.type === 'rotate') return rotatePlant(input, command);
    if (command.type === 'move') return movePlant(input, command);
    if (command.type === 'clean') return cleanBlight(input, command);
    if (command.type === 'heart-ability') return useHeartAbility(input, command);
    return reject(input, 'unknown-command');
  }

  function chooseDraft(input, command) {
    if (input.phase !== 'draft') return reject(input, 'wrong-phase');
    const offered = input.offer.find(card => card.cardId === command.cardId);
    if (!offered) return reject(input, 'card-not-offered');
    if (input.hand.length >= CONFIG.maxHand) {
      const discard = input.hand.find(card => card.cardId === command.discardCardId);
      if (!discard) return reject(input, 'discard-required');
    }
    const state = clone(input);
    const events = [];
    if (state.hand.length >= CONFIG.maxHand) {
      const index = state.hand.findIndex(card => card.cardId === command.discardCardId);
      const [discarded] = state.hand.splice(index, 1);
      emit(state, events, 'card-composted', { cardId: discarded.cardId, plantType: discarded.plantType });
    }
    const selected = state.offer.find(card => card.cardId === command.cardId);
    state.hand.push(selected);
    state.offer = [];
    state.phase = 'planning';
    emit(state, events, 'draft-chosen', { cardId: selected.cardId, plantType: selected.plantType });
    return accept(state, events);
  }

  function plantCard(input, command) {
    if (input.actionPoints < 1) return reject(input, 'not-enough-actions');
    if (!inBounds(command.x, command.y) || (command.x === 2 && command.y === 2)) return reject(input, 'invalid-cell');
    const source = input.hand.find(card => card.cardId === command.cardId);
    if (!source) return reject(input, 'card-not-in-hand');
    const current = cellAt(input, command.x, command.y);
    if (current.plant) return reject(input, 'cell-occupied');
    if (current.blight) return reject(input, 'cell-blighted');
    const state = clone(input);
    const target = cellAt(state, command.x, command.y);
    const cardIndex = state.hand.findIndex(card => card.cardId === command.cardId);
    const [card] = state.hand.splice(cardIndex, 1);
    target.plant = createPlant(state, card.plantType);
    state.actionPoints -= 1;
    state.stats.plantsPlaced += 1;
    const events = [event(state, 'card-played', { cardId: card.cardId, plantType: card.plantType, x: command.x, y: command.y })];
    return accept(state, events);
  }

  function rotatePlant(input, command) {
    if (input.actionPoints < 1) return reject(input, 'not-enough-actions');
    const plant = plantAt(input, command.x, command.y);
    if (!plant) return reject(input, 'plant-not-found');
    if (plant.stage !== 'mature') return reject(input, 'plant-not-ready');
    if (!CONFIG.plants[plant.type]?.rotatable) return reject(input, 'plant-not-rotatable');
    const state = clone(input);
    const target = plantAt(state, command.x, command.y);
    target.orientation = (target.orientation + 1) % 4;
    state.actionPoints -= 1;
    const events = [event(state, 'plant-rotated', { instanceId: target.instanceId, x: command.x, y: command.y, orientation: target.orientation })];
    return accept(state, events);
  }

  function movePlant(input, command) {
    if (input.actionPoints < 1) return reject(input, 'not-enough-actions');
    if (!inBounds(command.fromX, command.fromY) || !inBounds(command.toX, command.toY)) return reject(input, 'invalid-cell');
    if (Math.abs(command.fromX - command.toX) + Math.abs(command.fromY - command.toY) !== 1) return reject(input, 'destination-not-adjacent');
    if (command.toX === 2 && command.toY === 2) return reject(input, 'invalid-cell');
    const source = cellAt(input, command.fromX, command.fromY);
    const target = cellAt(input, command.toX, command.toY);
    if (!source.plant) return reject(input, 'plant-not-found');
    if (source.plant.stage !== 'mature') return reject(input, 'plant-not-ready');
    if (target.plant) return reject(input, 'cell-occupied');
    if (target.blight) return reject(input, 'cell-blighted');
    const state = clone(input);
    const from = cellAt(state, command.fromX, command.fromY);
    const to = cellAt(state, command.toX, command.toY);
    to.plant = from.plant;
    from.plant = null;
    state.actionPoints -= 1;
    const events = [event(state, 'plant-moved', { instanceId: to.plant.instanceId, fromX: command.fromX, fromY: command.fromY, toX: command.toX, toY: command.toY })];
    return accept(state, events);
  }

  function cleanBlight(input, command) {
    if (input.actionPoints < 2) return reject(input, 'not-enough-actions');
    const target = cellAt(input, command.x, command.y);
    if (!target) return reject(input, 'invalid-cell');
    if (!target.blight) return reject(input, 'blight-not-found');
    const state = clone(input);
    cellAt(state, command.x, command.y).blight = null;
    state.actionPoints -= 2;
    state.stats.blightCleared += 1;
    state.daily.cleared.push({ x: command.x, y: command.y });
    const events = [event(state, 'blight-cleared', { x: command.x, y: command.y })];
    return accept(state, events);
  }

  function addPlanningResource(state, plant, resource, amount) {
    if (resource === 'light') plant.light += amount;
    else plant.water = Math.min(2, plant.water + amount);
  }

  function useHeartAbility(input, command) {
    if (input.heart.dailyAbilityUsed) return reject(input, 'ability-already-used');
    const heartConfig = CONFIG.hearts[input.heart.id];
    if (input.actionPoints < heartConfig.actionCost) return reject(input, 'not-enough-actions');
    const payload = command.payload || {};
    const target = plantAt(input, payload.x, payload.y);
    if (!target || target.stage !== 'mature') return reject(input, 'plant-not-found');
    if (input.heart.id === 'balanced') {
      if (manhattan({ x: 2, y: 2 }, payload) !== 1) return reject(input, 'target-not-adjacent');
      if (!['light', 'water'].includes(payload.resource)) return reject(input, 'invalid-resource');
    } else if (input.heart.id === 'reservoir') {
      if (input.heart.water < 1) return reject(input, 'heart-has-no-water');
      if (payload.x !== 2 && payload.y !== 2) return reject(input, 'target-not-aligned');
    } else if (input.heart.id === 'moon') {
      if (target.type !== 'moonflower') return reject(input, 'target-not-night-plant');
    }
    const state = clone(input);
    const selected = plantAt(state, payload.x, payload.y);
    const events = [event(state, 'heart-ability-used', { heartId: state.heart.id, x: payload.x, y: payload.y, resource: payload.resource || null })];
    if (state.heart.id === 'balanced') addPlanningResource(state, selected, payload.resource, 1);
    else if (state.heart.id === 'reservoir') {
      state.heart.water -= 1;
      addPlanningResource(state, selected, 'water', 1);
    } else {
      if (selected.water < 1) {
        selected.water = 1;
        emit(state, events, 'resource-added', { x: payload.x, y: payload.y, instanceId: selected.instanceId, resource: 'water', amount: 1, source: 'moon-heart' });
      }
      selected.dailyFlags.forcedNight = true;
    }
    state.heart.dailyAbilityUsed = true;
    state.actionPoints -= heartConfig.actionCost;
    return accept(state, events);
  }

  function undoDay(input) {
    if (input.phase !== 'planning' && input.phase !== 'preview') return reject(input, 'wrong-phase');
    if (!input.undoSnapshot) return reject(input, 'undo-unavailable');
    const state = clone(input.undoSnapshot);
    const snapshot = makeSnapshot(state);
    state.undoSnapshot = snapshot;
    state.eventLog = [event(state, 'day-undone', { day: state.day })];
    return accept(state, state.eventLog);
  }

  function previewDay(input) {
    if (input.phase !== 'planning') return reject(input, 'wrong-phase');
    const simulation = preview(input);
    const state = clone(input);
    state.phase = 'preview';
    state.previewSummary = simulation.summary;
    return { accepted: true, reason: null, state, events: simulation.events };
  }

  function returnToPlanning(input) {
    if (input.phase !== 'preview') return reject(input, 'wrong-phase');
    const state = clone(input);
    state.phase = 'planning';
    state.previewSummary = null;
    return accept(state, []);
  }

  function queueResource(queue, target, resource, amount, source = null) {
    if (!target || amount <= 0) return;
    queue.push({ kind: 'resource', x: target.x, y: target.y, resource, amount, source, order: queue.nextOrder++ });
  }

  function queueCheck(queue, target) {
    if (!target) return;
    queue.push({ kind: 'check', x: target.x, y: target.y, order: queue.nextOrder++ });
  }

  function sortedNeighbors(x, y, windDirection = null) {
    let dirs = DIRS;
    if (windDirection) {
      const start = DIRS.findIndex(item => item.id === windDirection);
      dirs = Array.from({ length: 4 }, (_, offset) => DIRS[(start + offset) % 4]);
    }
    return dirs.map(dir => ({ x: x + dir.dx, y: y + dir.dy, dir })).filter(pos => inBounds(pos.x, pos.y));
  }

  function bloom(state, cell, events, queue, options = {}) {
    const plant = cell.plant;
    if (!plant || plant.stage !== 'mature') return false;
    const first = !plant.dailyFlags.bloomed;
    if (first) {
      plant.dailyFlags.bloomed = true;
      plant.bloomCount += 1;
      state.daily.bloomed.push(plant.instanceId);
      state.stats.totalBlooms += 1;
      if (plant.mutation === 'vigorous') state.daily.directProsperity += 1;
    }
    if (options.night) {
      state.daily.usedNight = true;
      if (state.blessings.includes('afterglow') && !state.daily.nightBloomBonusUsed) {
        state.daily.nightBloomBonusUsed = true;
        state.daily.directProsperity += 1;
      }
    }
    emit(state, events, 'plant-bloomed', { x: cell.x, y: cell.y, instanceId: plant.instanceId, plantType: plant.type, first, night: !!options.night });
    for (const pos of sortedNeighbors(cell.x, cell.y)) {
      const neighbor = cellAt(state, pos.x, pos.y);
      if (neighbor?.plant?.type === 'bellflower' && neighbor.plant.stage === 'mature' && !neighbor.plant.dailyFlags.triggered) {
        neighbor.plant.dailyFlags.triggered = true;
        bloom(state, neighbor, events, queue);
      }
    }
    return true;
  }

  function propagateDandelion(state, cell, events) {
    const plant = cell.plant;
    if (plant.propagated) return;
    const windId = state.windDirection || direction(plant.orientation).id;
    const dir = DIRS.find(item => item.id === windId);
    const target = cellAt(state, cell.x + dir.dx, cell.y + dir.dy);
    if (!target || target.plant || target.blight || (target.x === 2 && target.y === 2)) return;
    target.plant = createPlant(state, 'dandelion', 'seedling');
    plant.propagated = true;
    emit(state, events, 'seedling-created', { x: target.x, y: target.y, instanceId: target.plant.instanceId, parentId: plant.instanceId });
  }

  function tryTrigger(state, cell, events, queue) {
    const plant = cell?.plant;
    if (!plant || plant.stage !== 'mature') return;
    if (plant.type === 'sunflower' && !plant.dailyFlags.triggered && plant.light >= 1) {
      plant.light -= 1;
      plant.dailyFlags.triggered = true;
      state.daily.usedLight = true;
      bloom(state, cell, events, queue);
      for (const pos of sortedNeighbors(cell.x, cell.y)) queueResource(queue, pos, 'light', 1, plant.instanceId);
    } else if (plant.type === 'mint' && !plant.dailyFlags.triggered && plant.water >= 1) {
      plant.water -= 1;
      plant.dailyFlags.triggered = true;
      state.daily.usedWater = true;
      bloom(state, cell, events, queue);
      const candidate = sortedNeighbors(cell.x, cell.y)
        .map(pos => cellAt(state, pos.x, pos.y))
        .find(other => other?.plant && other.plant.type !== 'mint' && other.plant.dailyFlags.triggered && !other.plant.dailyFlags.refreshed);
      if (candidate) {
        candidate.plant.dailyFlags.triggered = false;
        candidate.plant.dailyFlags.refreshed = true;
        emit(state, events, 'plant-refreshed', { x: candidate.x, y: candidate.y, instanceId: candidate.plant.instanceId, by: plant.instanceId });
        queueCheck(queue, candidate);
      }
    } else if (plant.type === 'dandelion' && !plant.dailyFlags.triggered && (plant.light >= 1 || plant.water >= 1)) {
      const resource = plant.light >= 1 ? 'light' : 'water';
      plant[resource] -= 1;
      plant.dailyFlags.triggered = true;
      state.daily[resource === 'light' ? 'usedLight' : 'usedWater'] = true;
      bloom(state, cell, events, queue);
      propagateDandelion(state, cell, events);
    }
  }

  function processQueue(state, events, queue) {
    if (queue.stopped) {
      queue.length = 0;
      return;
    }
    while (queue.length) {
      queue.sort((a, b) => a.y - b.y || a.x - b.x || a.order - b.order);
      const item = queue.shift();
      queue.processed += 1;
      if (queue.processed > CONFIG.maxTriggerEvents) {
        queue.length = 0;
        queue.stopped = true;
        recordResolutionOverflow(state, events, CONFIG.maxTriggerEvents, 'trigger-events');
        break;
      }
      const cell = cellAt(state, item.x, item.y);
      const plant = cell?.plant;
      if (!plant || plant.stage !== 'mature') continue;
      if (item.kind === 'resource') {
        if (item.resource === 'light') plant.light += item.amount;
        else {
          const before = plant.water;
          plant.water = Math.min(2, plant.water + item.amount);
          if (before + item.amount > 2) emit(state, events, 'resource-overflow', { x: cell.x, y: cell.y, resource: 'water', amount: before + item.amount - 2 });
        }
        emit(state, events, 'resource-added', { x: cell.x, y: cell.y, instanceId: plant.instanceId, resource: item.resource, amount: item.amount, source: item.source });
      }
      tryTrigger(state, cell, events, queue);
    }
  }

  function applyDawnEffects(state, events, queue) {
    const weather = state.weather[state.day - 1];
    state.windDirection = weather.windDirection;
    emit(state, events, 'weather-applied', { ...weather, day: state.day });
    const heartConfig = CONFIG.hearts[state.heart.id];
    if (heartConfig.dawnWater > 0 && state.heart.water < heartConfig.initialWater) {
      const amount = Math.min(heartConfig.dawnWater, heartConfig.initialWater - state.heart.water);
      state.heart.water += amount;
      emit(state, events, 'heart-water-restored', { amount, water: state.heart.water });
    }
    if (state.pendingCompostLightTarget) {
      const target = state.board.find(cell => cell.plant?.instanceId === state.pendingCompostLightTarget);
      if (target) queueResource(queue, target, 'light', 1, 'compost-light');
      state.pendingCompostLightTarget = null;
    }
    if (weather.id === 'clear') {
      for (const cell of state.board) if (cell.plant?.type === 'sunflower' && cell.plant.stage === 'mature') queueResource(queue, cell, 'light', 1, 'weather-clear');
    } else if (weather.id === 'rain') {
      for (const cell of state.board) if (cell.plant?.type === 'dewcup' && cell.plant.stage === 'mature') queueResource(queue, cell, 'water', 1, 'weather-rain');
    }
    for (const cell of state.board) if (cell.plant?.stage === 'mature') queueCheck(queue, cell);
    processQueue(state, events, queue);

    for (const cell of state.board) {
      const plant = cell.plant;
      if (!plant || plant.stage !== 'mature' || plant.type !== 'dewcup') continue;
      const before = plant.water;
      plant.water = Math.min(2, plant.water + 1);
      emit(state, events, 'resource-added', { x: cell.x, y: cell.y, instanceId: plant.instanceId, resource: 'water', amount: 1, source: 'dewcup-dawn' });
      if (before >= 2) emit(state, events, 'resource-overflow', { x: cell.x, y: cell.y, resource: 'water', amount: 1 });
      if (plant.water >= 2) {
        const dir = direction(plant.orientation);
        const maxDistance = state.blessings.includes('long-channel') ? 2 : 1;
        let target = null;
        for (let distance = 1; distance <= maxDistance; distance++) {
          const candidate = cellAt(state, cell.x + dir.dx * distance, cell.y + dir.dy * distance);
          if (candidate?.plant?.stage === 'mature') { target = candidate; break; }
        }
        plant.water -= 1;
        if (target) {
          emit(state, events, 'resource-transferred', { fromX: cell.x, fromY: cell.y, toX: target.x, toY: target.y, resource: 'water', amount: 1 });
          queueResource(queue, target, 'water', 1, plant.instanceId);
        }
      }
    }

    for (const cell of state.board) {
      const plant = cell.plant;
      if (!plant || plant.stage !== 'mature' || plant.type !== 'glowcap' || plant.dailyFlags.triggered) continue;
      if (!state.daily.cleared.some(pos => manhattan(pos, cell) === 1)) continue;
      plant.dailyFlags.triggered = true;
      bloom(state, cell, events, queue);
      const dir = direction(plant.orientation);
      const diagonals = dir.dy !== 0
        ? [{ x: cell.x - 1, y: cell.y + dir.dy }, { x: cell.x + 1, y: cell.y + dir.dy }]
        : [{ x: cell.x + dir.dx, y: cell.y - 1 }, { x: cell.x + dir.dx, y: cell.y + 1 }];
      diagonals.forEach(pos => queueResource(queue, pos, 'light', 1, plant.instanceId));
    }

    for (const cell of state.board) {
      const plant = cell.plant;
      if (plant?.type === 'moonflower' && plant.stage === 'mature' && plant.dailyFlags.forcedNight && plant.water >= 1 && !plant.dailyFlags.triggered) {
        plant.water -= 1;
        plant.dailyFlags.triggered = true;
        bloom(state, cell, events, queue, { night: true });
      }
    }
    processQueue(state, events, queue);
  }

  function pollinationOrder(state) {
    const blooming = new Set(state.board.filter(cell => cell.plant?.stage === 'mature' && cell.plant.dailyFlags.bloomed).map(cell => key(cell.x, cell.y)));
    const queue = sortedNeighbors(2, 2, state.windDirection).filter(pos => blooming.has(key(pos.x, pos.y)));
    const queued = new Set(queue.map(pos => key(pos.x, pos.y)));
    const visited = new Set();
    const route = [];
    while (queue.length) {
      const current = queue.shift();
      const currentKey = key(current.x, current.y);
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);
      route.push({ x: current.x, y: current.y });
      const plant = plantAt(state, current.x, current.y);
      if (plant?.type === 'bellflower' && !plant.dailyFlags.bridgeUsed) {
        const dir = direction(plant.orientation);
        const bridge = { x: current.x + dir.dx * 2, y: current.y + dir.dy * 2 };
        const bridgeKey = key(bridge.x, bridge.y);
        if (inBounds(bridge.x, bridge.y) && blooming.has(bridgeKey) && !visited.has(bridgeKey) && !queued.has(bridgeKey)) {
          queue.unshift(bridge);
          queued.add(bridgeKey);
          plant.dailyFlags.bridgeUsed = true;
        }
      }
      for (const pos of sortedNeighbors(current.x, current.y, state.windDirection)) {
        const neighborKey = key(pos.x, pos.y);
        if (blooming.has(neighborKey) && !visited.has(neighborKey) && !queued.has(neighborKey)) {
          queue.push({ x: pos.x, y: pos.y });
          queued.add(neighborKey);
        }
      }
    }
    return route;
  }

  function applyPollination(state, events) {
    const route = pollinationOrder(state);
    state.daily.visited = route.map(pos => plantAt(state, pos.x, pos.y)?.instanceId).filter(Boolean);
    state.daily.chainLength = state.daily.visited.length;
    if (!route.length) return;
    emit(state, events, 'pollination-started', { returnFlight: false, length: route.length });
    for (const pos of route) {
      const plant = plantAt(state, pos.x, pos.y);
      if (!plant) continue;
      plant.dailyFlags.visited = true;
      emit(state, events, 'mosswing-visited', { x: pos.x, y: pos.y, instanceId: plant.instanceId, returnFlight: false });
      if (plant.type === 'bellflower') state.daily.directProsperity += 1;
    }
    emit(state, events, 'chain-completed', { returnFlight: false, length: route.length });
    if (route.length >= 6 && state.blessings.includes('return-flight')) {
      emit(state, events, 'pollination-started', { returnFlight: true, length: route.length });
      for (const pos of route) {
        const plant = plantAt(state, pos.x, pos.y);
        emit(state, events, 'mosswing-visited', { x: pos.x, y: pos.y, instanceId: plant?.instanceId || null, returnFlight: true });
        if (plant?.type === 'bellflower') state.daily.directProsperity += 1;
      }
      emit(state, events, 'chain-completed', { returnFlight: true, length: route.length });
    }
  }

  function applyNightFlowers(state, events, queue) {
    for (const cell of state.board) {
      const plant = cell.plant;
      if (plant?.type === 'moonflower' && plant.stage === 'mature' && !plant.dailyFlags.triggered && plant.water >= 1) {
        plant.water -= 1;
        plant.dailyFlags.triggered = true;
        bloom(state, cell, events, queue, { night: true });
      }
    }
  }

  function perimeterFrom(entry) {
    const result = [];
    for (let x = 0; x < 5; x++) result.push({ x, y: 0 });
    for (let y = 1; y < 5; y++) result.push({ x: 4, y });
    for (let x = 3; x >= 0; x--) result.push({ x, y: 4 });
    for (let y = 3; y >= 1; y--) result.push({ x: 0, y });
    const start = result.findIndex(pos => pos.x === entry.x && pos.y === entry.y);
    return start < 0 ? result : result.slice(start).concat(result.slice(0, start));
  }

  function guardianFor(state, target) {
    return state.board
      .filter(cell => cell.plant?.stage === 'mature' && cell.plant.mutation === 'guardian' && !cell.plant.dailyFlags.guardianUsed && manhattan(cell, target) === 1)
      .sort((a, b) => a.y - b.y || a.x - b.x)[0] || null;
  }

  function placeBlight(state, target, behavior, events, type) {
    if (!target || target.blight || (target.x === 2 && target.y === 2)) return false;
    const guardian = guardianFor(state, target);
    if (guardian) {
      guardian.plant.dailyFlags.guardianUsed = true;
      emit(state, events, 'blight-blocked', { x: target.x, y: target.y, guardianId: guardian.plant.instanceId });
      return false;
    }
    if (target.plant?.type === 'thorn' && target.plant.stage === 'mature') {
      if (state.blessings.includes('living-barrier')) {
        target.plant.stage = 'seedling';
        target.plant.bornDay = state.day;
      } else {
        target.plant.stage = 'withered';
        setCompostLightTarget(state, target);
      }
      emit(state, events, 'thorn-consumed', { x: target.x, y: target.y, instanceId: target.plant.instanceId });
      return false;
    }
    if (target.plant && target.plant.stage !== 'withered') {
      if (state.pendingCompostLightTarget === target.plant.instanceId) state.pendingCompostLightTarget = null;
      target.plant.stage = 'withered';
      emit(state, events, 'plant-withered', { x: target.x, y: target.y, instanceId: target.plant.instanceId, cause: 'blight' });
      setCompostLightTarget(state, target);
    }
    target.blight = { behavior, age: 0 };
    emit(state, events, type, { x: target.x, y: target.y, behavior });
    return true;
  }

  function setCompostLightTarget(state, witheredCell) {
    if (!state.blessings.includes('compost-light') || state.pendingCompostLightTarget) return;
    const nearest = state.board
      .filter(cell => cell.plant && cell.plant.stage === 'mature' && cell !== witheredCell)
      .sort((a, b) => manhattan(a, witheredCell) - manhattan(b, witheredCell) || a.y - b.y || a.x - b.x)[0];
    if (nearest) state.pendingCompostLightTarget = nearest.plant.instanceId;
  }

  function applyBlight(state, events) {
    const existingSources = state.board.filter(cell => cell.blight).sort((a, b) => a.y - b.y || a.x - b.x);
    let added = 0;
    const spawn = CONFIG.blightSpawns.find(item => item.day === state.day);
    if (spawn) {
      const entry = state.entrances[CONFIG.blightSpawns.indexOf(spawn)];
      const target = perimeterFrom(entry).map(pos => cellAt(state, pos.x, pos.y)).find(cell => !cell.blight);
      if (target && placeBlight(state, target, spawn.behavior, events, 'blight-spawned')) added += 1;
    }
    const claimedTargets = new Set();
    for (const source of existingSources) {
      const blight = source.blight;
      if (!blight) continue;
      if (blight.behavior === 'dormant') {
        blight.behavior = 'creep';
        blight.age += 1;
        continue;
      }
      if (state.day >= CONFIG.blightSpreadStartDay && added < 2) {
        const neighbors = sortedNeighbors(source.x, source.y).filter(pos => {
          const target = cellAt(state, pos.x, pos.y);
          return target && !target.blight && !(pos.x === 2 && pos.y === 2);
        });
        neighbors.sort((a, b) => {
          if (blight.behavior === 'windborne' && state.windDirection) {
            const preferred = DIRS.find(dir => dir.id === state.windDirection);
            const aWind = a.x === source.x + preferred.dx && a.y === source.y + preferred.dy ? 0 : 1;
            const bWind = b.x === source.x + preferred.dx && b.y === source.y + preferred.dy ? 0 : 1;
            if (aWind !== bWind) return aWind - bWind;
          }
          return manhattan(a, { x: 2, y: 2 }) - manhattan(b, { x: 2, y: 2 }) || a.y - b.y || a.x - b.x;
        });
        const targetPos = neighbors.find(pos => !claimedTargets.has(key(pos.x, pos.y)));
        const target = targetPos ? cellAt(state, targetPos.x, targetPos.y) : null;
        if (target) claimedTargets.add(key(target.x, target.y));
        if (target && placeBlight(state, target, blight.behavior, events, 'blight-spread')) added += 1;
      }
      blight.age += 1;
    }
    if (sortedNeighbors(2, 2).some(pos => cellAt(state, pos.x, pos.y)?.blight)) {
      state.heart.hp -= 1;
      emit(state, events, 'heart-damaged', { amount: 1, hp: state.heart.hp });
    }
  }

  function matureSeedlings(state, events) {
    const rainy = state.weather[state.day - 1].id === 'rain' && !state.blessings.includes('soft-rain');
    for (const cell of state.board) {
      const plant = cell.plant;
      if (!plant || plant.stage !== 'seedling' || plant.bornDay >= state.day || rainy) continue;
      plant.stage = 'mature';
      plant.bornDay = null;
      state.stats.seedlingsMatured += 1;
      emit(state, events, 'plant-matured', { x: cell.x, y: cell.y, instanceId: plant.instanceId });
    }
  }

  function taskCompleted(state, task) {
    if (task.id === 'bloom-six') return state.daily.bloomed.length >= 6;
    if (task.id === 'chain-eight') return state.daily.chainLength >= 8;
    if (task.id === 'mature-three') return state.stats.seedlingsMatured >= 3;
    if (task.id === 'clear-three') return state.stats.blightCleared >= 3;
    if (task.id === 'mixed-triggers') return state.daily.usedLight && state.daily.usedWater && state.daily.usedNight;
    return false;
  }

  function scoreDay(state, events) {
    const blooms = state.daily.bloomed.length;
    const chainBonus = Math.max(0, state.daily.chainLength - 3);
    let gained = blooms + chainBonus + state.daily.directProsperity;
    for (const task of state.tasks) {
      if (!task.completed && taskCompleted(state, task)) {
        task.completed = true;
        task.completedDay = state.day;
        gained += task.reward;
        emit(state, events, 'task-completed', { taskId: task.id, reward: task.reward });
      }
    }
    state.prosperity += gained;
    state.daily.prosperityGained = gained;
    state.stats.maxBloomDay = Math.max(state.stats.maxBloomDay, blooms);
    state.stats.maxChain = Math.max(state.stats.maxChain, state.daily.chainLength);
    state.longestChain = Math.max(state.longestChain, state.daily.chainLength);
    emit(state, events, 'prosperity-added', { amount: gained, total: state.prosperity, blooms, chainBonus, direct: state.daily.directProsperity });
  }

  function chooseSideTask(state) {
    if (state.day !== 4 || state.tasks.some(task => task.kind === 'side')) return;
    const candidates = compatibleTaskIds(state.availablePlantSnapshot).filter(id => !state.tasks.some(task => task.id === id));
    if (candidates.length) state.tasks.push(createTask(state, candidates[randomIndex(state, candidates.length)], 'side'));
  }

  function createBlessingOffer(state) {
    const available = Object.keys(CONFIG.blessings).filter(id => !state.blessings.includes(id));
    return shuffle(state, available).slice(0, 3);
  }

  function firstMutationCandidate(state) {
    return state.board
      .filter(cell => cell.plant?.stage === 'mature' && cell.plant.bloomCount >= 3 && !cell.plant.mutation)
      .sort((a, b) => a.y - b.y || a.x - b.x || a.plant.instanceId.localeCompare(b.plant.instanceId))[0] || null;
  }

  function finishOrAdvance(state, events) {
    const blightCount = state.board.filter(cell => cell.blight).length;
    if (state.heart.hp <= 0) state.result = 'heart-lost';
    else if (blightCount >= CONFIG.blightLossCount) state.result = 'blight-overrun';
    else if (state.day >= CONFIG.maxDays) {
      const target = state.tutorial ? CONFIG.tutorialTargetProsperity : CONFIG.targetProsperity;
      state.result = state.prosperity >= target ? 'win' : 'target-missed';
    }
    if (state.result) {
      state.phase = 'result';
      emit(state, events, state.result === 'win' ? 'run-won' : 'run-lost', { result: state.result, day: state.day, prosperity: state.prosperity });
      return;
    }
    const mutation = !state.mutationUsed ? firstMutationCandidate(state) : null;
    state.pending.mutationInstanceId = mutation?.plant.instanceId || null;
    state.pending.blessingDue = state.day === 4 || state.day === 8;
    if (mutation) {
      state.phase = 'mutation';
      emit(state, events, 'mutation-offered', { instanceId: mutation.plant.instanceId, choices: Object.keys(CONFIG.mutations) });
    } else if (state.pending.blessingDue) enterBlessing(state, events);
    else beginNextDay(state, events);
  }

  function enterBlessing(state, events) {
    state.pending.blessingOffer = createBlessingOffer(state);
    state.phase = 'reward';
    emit(state, events, 'blessing-offered', { choices: state.pending.blessingOffer.slice() });
  }

  function beginNextDay(state, events) {
    state.day += 1;
    state.phase = 'dawn';
    state.actionPoints = CONFIG.actionsPerDay;
    state.heart.dailyAbilityUsed = false;
    state.daily = createDailyState();
    state.previewSummary = null;
    state.pending = { mutationInstanceId: null, blessingDue: false, blessingOffer: [] };
    for (const cell of state.board) {
      if (cell.plant?.stage === 'withered') cell.plant = null;
      if (cell.plant) {
        cell.plant.light = 0;
        cell.plant.dailyFlags = freshFlags();
      }
    }
    state.windDirection = state.weather[state.day - 1].windDirection;
    emit(state, events, 'day-start', { day: state.day });
    state.offer = shuffle(state, state.runPoolSnapshot).slice(0, 3).map(type => createCard(state, type));
    state.phase = 'draft';
    emit(state, events, 'draft-offered', { cards: state.offer.map(card => ({ ...card })) });
    state.undoSnapshot = makeSnapshot(state);
  }

  function resolveDay(input) {
    if (input.phase !== 'planning') return reject(input, 'wrong-phase');
    const state = clone(input);
    state.phase = 'resolving';
    state.previewSummary = null;
    const events = [];
    const queue = [];
    queue.nextOrder = 0;
    queue.processed = 0;
    queue.stopped = false;
    applyDawnEffects(state, events, queue);
    applyPollination(state, events);
    state.phase = 'night';
    queue.processed = 0;
    queue.stopped = false;
    applyNightFlowers(state, events, queue);
    processQueue(state, events, queue);
    applyBlight(state, events);
    matureSeedlings(state, events);
    scoreDay(state, events);
    chooseSideTask(state);
    state.stats.daysResolved += 1;
    state.daily.report = {
      day: state.day,
      prosperity: state.daily.prosperityGained,
      totalProsperity: state.prosperity,
      blooms: state.daily.bloomed.length,
      chain: state.daily.chainLength,
      usedLight: state.daily.usedLight,
      usedWater: state.daily.usedWater,
      usedNight: state.daily.usedNight,
      heartDamage: events.filter(item => item.type === 'heart-damaged').reduce((sum, item) => sum + item.amount, 0),
      blightAdded: events.filter(item => item.type === 'blight-spawned' || item.type === 'blight-spread').length
    };
    state.lastReport = clone(state.daily.report);
    finishOrAdvance(state, events);
    state.eventLog = events;
    return accept(state, events);
  }

  function chooseMutation(input, command) {
    if (input.phase !== 'mutation') return reject(input, 'wrong-phase');
    if (!CONFIG.mutations[command.mutationId]) return reject(input, 'invalid-mutation');
    const state = clone(input);
    const target = state.board.find(cell => cell.plant?.instanceId === state.pending.mutationInstanceId);
    if (!target) return reject(input, 'mutation-target-missing');
    target.plant.mutation = command.mutationId;
    state.mutationUsed = true;
    state.pending.mutationInstanceId = null;
    const events = [event(state, 'mutation-chosen', { instanceId: target.plant.instanceId, mutationId: command.mutationId })];
    if (state.pending.blessingDue) enterBlessing(state, events);
    else beginNextDay(state, events);
    return accept(state, events);
  }

  function chooseBlessing(input, command) {
    if (input.phase !== 'reward') return reject(input, 'wrong-phase');
    if (!input.pending.blessingOffer.includes(command.blessingId)) return reject(input, 'blessing-not-offered');
    const state = clone(input);
    state.blessings.push(command.blessingId);
    state.pending.blessingOffer = [];
    state.pending.blessingDue = false;
    const events = [event(state, 'blessing-chosen', { blessingId: command.blessingId })];
    beginNextDay(state, events);
    return accept(state, events);
  }

  function preview(input) {
    if (!input || !['planning', 'preview'].includes(input.phase)) throw new Error('preview requires planning or preview phase');
    const state = clone(input);
    state.phase = 'planning';
    state.previewSummary = null;
    const result = resolveDay(state);
    const report = result.state.lastReport || result.state.daily.report || {};
    return {
      events: result.events,
      summary: {
        day: input.day,
        prosperity: report.prosperity || 0,
        totalProsperity: report.totalProsperity ?? input.prosperity,
        blooms: report.blooms || 0,
        chain: report.chain || 0,
        heartDamage: report.heartDamage || 0,
        blightAdded: report.blightAdded || 0,
        result: result.state.result,
        nextPhase: result.state.phase
      },
      state: result.state
    };
  }

  function validate(state, options = {}) {
    const errors = [];
    const add = condition => { if (condition) errors.push(condition); };
    const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
    const isNonNegativeInteger = value => Number.isInteger(value) && value >= 0;
    const validDirections = new Set(DIRS.map(item => item.id));
    const validResults = new Set(['win', 'heart-lost', 'blight-overrun', 'target-missed']);
    const requiredFlags = ['triggered', 'refreshed', 'bloomed', 'visited', 'bridgeUsed', 'guardianUsed', 'forcedNight'];
    const statKeys = ['totalBlooms', 'blightCleared', 'seedlingsMatured', 'plantsPlaced', 'daysResolved', 'maxBloomDay', 'maxChain', 'overflowCount'];
    if (!state || typeof state !== 'object') return { valid: false, errors: ['state-not-object'] };
    add(state.schemaVersion !== CONFIG.schemaVersion && 'unsupported-schema');
    add(typeof state.runId !== 'string' || !state.runId.trim() ? 'invalid-run-id' : null);
    add(!PHASES.has(state.phase) && 'invalid-phase');
    add(!Number.isInteger(state.seed) || state.seed < 0 || state.seed > 0xffffffff ? 'invalid-seed' : null);
    add(!Number.isInteger(state.rngState) || state.rngState < 0 || state.rngState > 0xffffffff ? 'invalid-rng-state' : null);
    add(!Number.isInteger(state.day) || state.day < 1 || state.day > CONFIG.maxDays ? 'invalid-day' : null);
    add(!Number.isInteger(state.actionPoints) || state.actionPoints < 0 || state.actionPoints > CONFIG.actionsPerDay ? 'invalid-action-points' : null);
    if (!Array.isArray(state.board) || state.board.length !== CONFIG.boardSize * CONFIG.boardSize) errors.push('invalid-board');
    else {
      const plantIds = new Set();
      state.board.forEach((cell, index) => {
        const expected = { x: index % CONFIG.boardSize, y: Math.floor(index / CONFIG.boardSize) };
        if (!isObject(cell)) {
          errors.push('invalid-cell');
          return;
        }
        add((cell.x !== expected.x || cell.y !== expected.y) && 'invalid-cell-coordinate');
        add(cell.terrain !== 'soil' && 'invalid-terrain');
        add(index === indexOf(2, 2) && (cell.plant || cell.blight) ? 'invalid-heart-cell' : null);
        if (cell.plant) {
          const plant = cell.plant;
          if (!isObject(plant)) {
            errors.push('invalid-plant');
            return;
          }
          add(typeof plant.instanceId !== 'string' || !plant.instanceId ? 'invalid-plant-id' : null);
          add(!CONFIG.plants[plant.type] && 'invalid-plant-type');
          add(plantIds.has(plant.instanceId) && 'duplicate-plant-id');
          plantIds.add(cell.plant.instanceId);
          add(!Number.isInteger(plant.orientation) || plant.orientation < 0 || plant.orientation > 3 ? 'invalid-orientation' : null);
          add(!['seedling', 'mature', 'withered'].includes(plant.stage) && 'invalid-plant-stage');
          add(!Number.isInteger(plant.water) || plant.water < 0 || plant.water > 2 ? 'invalid-water' : null);
          add(!isNonNegativeInteger(plant.light) && 'invalid-light');
          add(!isNonNegativeInteger(plant.bloomCount) && 'invalid-bloom-count');
          add(typeof plant.propagated !== 'boolean' && 'invalid-propagated');
          add(plant.bornDay !== null && (!Number.isInteger(plant.bornDay) || plant.bornDay < 1 || plant.bornDay > state.day) ? 'invalid-born-day' : null);
          add(plant.stage === 'seedling' && plant.bornDay === null ? 'invalid-born-day' : null);
          add(plant.stage === 'mature' && plant.bornDay !== null ? 'invalid-born-day' : null);
          add(plant.mutation !== null && !CONFIG.mutations[plant.mutation] ? 'invalid-mutation' : null);
          if (!isObject(plant.dailyFlags) || requiredFlags.some(flag => typeof plant.dailyFlags[flag] !== 'boolean')) errors.push('invalid-daily-flags');
        } else if (cell.plant !== null) errors.push('invalid-plant');
        if (cell.blight) {
          add(!isObject(cell.blight) && 'invalid-blight');
          if (isObject(cell.blight)) {
            add(!['creep', 'windborne', 'dormant'].includes(cell.blight.behavior) && 'invalid-blight-behavior');
            add(!isNonNegativeInteger(cell.blight.age) && 'invalid-blight-age');
          }
        } else if (cell.blight !== null) errors.push('invalid-blight');
        add(cell.blight && cell.plant && cell.plant.stage !== 'withered' ? 'invalid-blighted-plant' : null);
      });
    }
    const cardIds = new Set();
    const validateCards = (cards, location) => {
      if (!Array.isArray(cards)) {
        errors.push(`invalid-${location}`);
        return;
      }
      for (const card of cards) {
        if (!isObject(card) || typeof card.cardId !== 'string' || !card.cardId || !CONFIG.plants[card.plantType]) {
          errors.push('invalid-card');
          continue;
        }
        if (cardIds.has(card.cardId)) errors.push('duplicate-card-id');
        cardIds.add(card.cardId);
      }
    };
    validateCards(state.hand, 'hand');
    validateCards(state.offer, 'offer');
    add(Array.isArray(state.hand) && state.hand.length > CONFIG.maxHand && 'invalid-hand-size');
    add(Array.isArray(state.offer) && state.phase === 'draft' && state.offer.length !== 3 ? 'invalid-draft-offer' : null);
    add(Array.isArray(state.offer) && state.phase !== 'draft' && state.offer.length !== 0 ? 'unexpected-offer' : null);

    if (!Array.isArray(state.unlockedPoolSnapshot) || state.unlockedPoolSnapshot.length < CONFIG.runPoolSize ||
      new Set(state.unlockedPoolSnapshot).size !== state.unlockedPoolSnapshot.length || state.unlockedPoolSnapshot.some(id => !CONFIG.plants[id]) ||
      BASE_POOL.some(id => !state.unlockedPoolSnapshot.includes(id))) {
      errors.push('invalid-unlocked-pool');
    }
    if (!Array.isArray(state.runPoolSnapshot) || state.runPoolSnapshot.length !== CONFIG.runPoolSize ||
      new Set(state.runPoolSnapshot).size !== state.runPoolSnapshot.length ||
      state.runPoolSnapshot.some(id => !CONFIG.plants[id] || !Array.isArray(state.unlockedPoolSnapshot) || !state.unlockedPoolSnapshot.includes(id))) {
      errors.push('invalid-run-pool');
    }
    if (!Array.isArray(state.availablePlantSnapshot) || new Set(state.availablePlantSnapshot).size !== state.availablePlantSnapshot.length ||
      state.availablePlantSnapshot.some(id => !CONFIG.plants[id]) ||
      (Array.isArray(state.runPoolSnapshot) && state.runPoolSnapshot.some(id => !state.availablePlantSnapshot.includes(id)))) {
      errors.push('invalid-available-plants');
    }
    if (Array.isArray(state.hand) && Array.isArray(state.availablePlantSnapshot) &&
      state.hand.some(card => isObject(card) && !state.availablePlantSnapshot.includes(card.plantType))) errors.push('invalid-hand-plant');
    if (Array.isArray(state.offer) && Array.isArray(state.runPoolSnapshot) &&
      state.offer.some(card => isObject(card) && !state.runPoolSnapshot.includes(card.plantType))) errors.push('invalid-offer-plant');
    if (Array.isArray(state.board) && Array.isArray(state.availablePlantSnapshot) &&
      state.board.some(cell => cell?.plant && !state.availablePlantSnapshot.includes(cell.plant.type))) errors.push('invalid-board-plant');
    if (!Array.isArray(state.weather) || state.weather.length !== CONFIG.maxDays) errors.push('invalid-weather');
    else state.weather.forEach(item => {
      if (!isObject(item) || !CONFIG.weather[item.id]) errors.push('invalid-weather-entry');
      else if (item.id === 'wind') add(!validDirections.has(item.windDirection) && 'invalid-wind-direction');
      else add(item.windDirection !== null && 'invalid-wind-direction');
    });
    add(state.windDirection !== null && !validDirections.has(state.windDirection) ? 'invalid-current-wind' : null);

    if (!isObject(state.heart) || !CONFIG.hearts[state.heart.id]) errors.push('invalid-heart');
    else {
      const expectedHeart = CONFIG.hearts[state.heart.id];
      const prerequisite = CONFIG.unlocks[state.heart.id]?.prerequisite;
      add(prerequisite && (!Array.isArray(state.unlockedPoolSnapshot) || !state.unlockedPoolSnapshot.includes(prerequisite)) ? 'invalid-heart-prerequisite' : null);
      add(state.heart.maxHp !== expectedHeart.maxHp && 'invalid-heart-max-hp');
      add(!Number.isInteger(state.heart.hp) || state.heart.hp < 0 || state.heart.hp > state.heart.maxHp ? 'invalid-heart-hp' : null);
      add(!Number.isInteger(state.heart.water) || state.heart.water < 0 || state.heart.water > 2 ? 'invalid-heart-water' : null);
      add(state.heart.id !== 'reservoir' && state.heart.water !== 0 ? 'invalid-heart-water' : null);
      add(typeof state.heart.dailyAbilityUsed !== 'boolean' && 'invalid-heart-ability-flag');
      const initialTypes = CONFIG.initialHand.slice();
      if (state.heart.id === 'moon') initialTypes[initialTypes.indexOf('thorn')] = 'moonflower';
      const expectedAvailable = new Set([...initialTypes, ...(Array.isArray(state.runPoolSnapshot) ? state.runPoolSnapshot : [])]);
      add(Array.isArray(state.availablePlantSnapshot) &&
        (state.availablePlantSnapshot.length !== expectedAvailable.size || state.availablePlantSnapshot.some(id => !expectedAvailable.has(id)))
        ? 'invalid-available-plants' : null);
    }

    add(!Number.isFinite(state.prosperity) || state.prosperity < 0 ? 'invalid-prosperity' : null);
    add(!isNonNegativeInteger(state.longestChain) && 'invalid-longest-chain');
    if (!Array.isArray(state.blessings) || state.blessings.length > 2 || new Set(state.blessings).size !== state.blessings.length || state.blessings.some(id => !CONFIG.blessings[id])) errors.push('invalid-blessings');
    if (!Array.isArray(state.tasks) || state.tasks.length < 1 || state.tasks.length > 2) errors.push('invalid-tasks');
    else {
      const taskIds = new Set();
      let mainTasks = 0;
      let sideTasks = 0;
      for (const task of state.tasks) {
        if (!isObject(task) || !CONFIG.tasks[task.id] || !['main', 'side'].includes(task.kind) || task.reward !== CONFIG.tasks[task.id]?.reward || typeof task.completed !== 'boolean') {
          errors.push('invalid-task');
          continue;
        }
        if (task.kind === 'main') mainTasks += 1;
        else sideTasks += 1;
        if (taskIds.has(task.id)) errors.push('duplicate-task');
        taskIds.add(task.id);
        if (CONFIG.tasks[task.id].requires?.some(id => !state.availablePlantSnapshot?.includes?.(id))) errors.push('invalid-task-prerequisite');
        if (task.completedDay !== null && (!Number.isInteger(task.completedDay) || task.completedDay < 1 || task.completedDay > state.day)) errors.push('invalid-task-day');
        if (task.completed !== (task.completedDay !== null)) errors.push('invalid-task-completion');
      }
      if (mainTasks !== 1 || sideTasks > 1) errors.push('invalid-task-kinds');
    }
    add(typeof state.mutationUsed !== 'boolean' && 'invalid-mutation-used');
    if (Array.isArray(state.board)) {
      const mutationCount = state.board.filter(cell => cell?.plant?.mutation).length;
      add(mutationCount > 1 || (mutationCount === 1 && state.mutationUsed !== true) ? 'invalid-mutation-state' : null);
    }
    if (!isObject(state.stats) || statKeys.some(name => !isNonNegativeInteger(state.stats[name]))) errors.push('invalid-stats');
    if (!isObject(state.daily) || !Array.isArray(state.daily.cleared) || !Array.isArray(state.daily.bloomed) || !Array.isArray(state.daily.visited) ||
      ['usedLight', 'usedWater', 'usedNight', 'triggerOverflow', 'nightBloomBonusUsed'].some(name => typeof state.daily?.[name] !== 'boolean') ||
      ['directProsperity', 'prosperityGained', 'chainLength'].some(name => !isNonNegativeInteger(state.daily?.[name]))) errors.push('invalid-daily');
    else {
      add(state.daily.cleared.some(pos => !isObject(pos) || !inBounds(pos.x, pos.y)) ? 'invalid-daily-cleared' : null);
      add(new Set(state.daily.cleared.map(pos => isObject(pos) ? key(pos.x, pos.y) : '')).size !== state.daily.cleared.length ? 'invalid-daily-cleared' : null);
      add(state.daily.bloomed.some(id => typeof id !== 'string' || !id) || new Set(state.daily.bloomed).size !== state.daily.bloomed.length ? 'invalid-daily-bloomed' : null);
      add(state.daily.visited.some(id => typeof id !== 'string' || !id) || new Set(state.daily.visited).size !== state.daily.visited.length ? 'invalid-daily-visited' : null);
      add(state.daily.report !== null && !isObject(state.daily.report) ? 'invalid-daily-report' : null);
    }
    if (state.lastReport !== null && !isObject(state.lastReport)) errors.push('invalid-last-report');
    if (state.previewSummary !== null && !isObject(state.previewSummary)) errors.push('invalid-preview-summary');
    if (!Array.isArray(state.eventLog) || state.eventLog.some(item => !isObject(item) || !Number.isInteger(item.seq) || item.seq < 1 || typeof item.type !== 'string')) errors.push('invalid-event-log');
    else {
      for (let index = 1; index < state.eventLog.length; index++) {
        if (state.eventLog[index].seq <= state.eventLog[index - 1].seq) errors.push('invalid-event-sequence');
      }
    }
    if (!isObject(state.pending) || typeof state.pending.blessingDue !== 'boolean' || !Array.isArray(state.pending.blessingOffer) ||
      new Set(state.pending.blessingOffer).size !== state.pending.blessingOffer.length || state.pending.blessingOffer.some(id => !CONFIG.blessings[id]) ||
      (state.pending.mutationInstanceId !== null && typeof state.pending.mutationInstanceId !== 'string')) errors.push('invalid-pending');
    else {
      add(state.phase === 'reward' && state.pending.blessingOffer.length !== 3 ? 'invalid-blessing-offer' : null);
      add(state.phase !== 'reward' && state.pending.blessingOffer.length !== 0 ? 'unexpected-blessing-offer' : null);
      add(state.phase === 'mutation' && !state.pending.mutationInstanceId ? 'missing-mutation-target' : null);
      add(state.phase !== 'mutation' && state.pending.mutationInstanceId !== null ? 'unexpected-mutation-target' : null);
      if (state.pending.mutationInstanceId && Array.isArray(state.board)) {
        const mutationTarget = state.board.find(cell => cell?.plant?.instanceId === state.pending.mutationInstanceId)?.plant;
        if (!mutationTarget) errors.push('missing-mutation-target');
        else add(mutationTarget.stage !== 'mature' || mutationTarget.mutation !== null || mutationTarget.bloomCount < 3 ? 'invalid-mutation-target' : null);
      }
      add(state.phase === 'mutation' && state.mutationUsed === true ? 'invalid-mutation-state' : null);
    }
    if (!Array.isArray(state.entrances) || state.entrances.length !== CONFIG.cornerEntrances.length ||
      new Set(state.entrances?.map(pos => key(pos?.x, pos?.y))).size !== CONFIG.cornerEntrances.length ||
      state.entrances?.some(pos => !CONFIG.cornerEntrances.some(corner => corner.x === pos?.x && corner.y === pos?.y))) errors.push('invalid-entrances');
    if (!isObject(state.counters) || ['card', 'plant', 'event'].some(name => !isNonNegativeInteger(state.counters[name]))) errors.push('invalid-counters');
    add(typeof state.tutorial !== 'boolean' && 'invalid-tutorial-flag');
    add(state.pendingCompostLightTarget !== null && typeof state.pendingCompostLightTarget !== 'string' ? 'invalid-compost-target' : null);
    if (state.pendingCompostLightTarget && Array.isArray(state.board)) {
      const compostTarget = state.board.find(cell => cell?.plant?.instanceId === state.pendingCompostLightTarget)?.plant;
      add(!state.blessings?.includes?.('compost-light') || !compostTarget || compostTarget.stage !== 'mature' ? 'invalid-compost-target' : null);
    }
    add(state.result !== null && !validResults.has(state.result) ? 'invalid-result' : null);
    add(state.phase === 'result' && !state.result ? 'missing-result' : null);
    add(state.phase !== 'result' && state.result !== null ? 'unexpected-result' : null);
    if (state.phase === 'result' && validResults.has(state.result) && Array.isArray(state.board) && isObject(state.heart)) {
      const blightCount = state.board.filter(cell => cell?.blight).length;
      const target = state.tutorial ? CONFIG.tutorialTargetProsperity : CONFIG.targetProsperity;
      if (state.result === 'heart-lost') add(state.heart.hp > 0 ? 'invalid-result-condition' : null);
      if (state.result === 'blight-overrun') add(state.heart.hp <= 0 || blightCount < CONFIG.blightLossCount ? 'invalid-result-condition' : null);
      if (state.result === 'win') add(state.heart.hp <= 0 || blightCount >= CONFIG.blightLossCount || state.day !== CONFIG.maxDays || state.prosperity < target ? 'invalid-result-condition' : null);
      if (state.result === 'target-missed') add(state.heart.hp <= 0 || blightCount >= CONFIG.blightLossCount || state.day !== CONFIG.maxDays || state.prosperity >= target ? 'invalid-result-condition' : null);
    }
    if (!options.skipSnapshot) {
      if (!isObject(state.undoSnapshot)) errors.push('invalid-undo-snapshot');
      else {
        add(state.undoSnapshot.undoSnapshot !== null && 'nested-undo-snapshot');
        const snapshotResult = validate(state.undoSnapshot, { skipSnapshot: true });
        if (!snapshotResult.valid) errors.push(...snapshotResult.errors.map(item => `snapshot-${item}`));
      }
    } else add(state.undoSnapshot !== null && 'nested-undo-snapshot');
    return { valid: errors.length === 0, errors: [...new Set(errors)] };
  }

  function serialize(state) {
    const result = validate(state);
    if (!result.valid) throw new Error(`Cannot serialize invalid garden state: ${result.errors.join(', ')}`);
    return JSON.stringify(state);
  }

  function restore(serialized) {
    const state = typeof serialized === 'string' ? JSON.parse(serialized) : clone(serialized);
    const result = validate(state);
    if (!result.valid) throw new Error(`Invalid garden save: ${result.errors.join(', ')}`);
    return state;
  }

  const GardenModel = Object.freeze({
    createRun,
    restore,
    dispatch,
    preview,
    resolveDay,
    serialize,
    validate,
    config: CONFIG
  });

  root.MosswingGardenModel = GardenModel;
  if (typeof module !== 'undefined') module.exports = GardenModel;
})(typeof globalThis !== 'undefined' ? globalThis : this);
