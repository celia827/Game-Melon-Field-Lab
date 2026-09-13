'use strict';

(() => {
  const MODEL = globalThis.MosswingGardenModel;
  const CONFIG = globalThis.MOSSWING_GARDEN_CONFIG;
  const PROFILE_MODEL = globalThis.MosswingGardenProfile;
  const VIEW = globalThis.MosswingGardenView;
  const RUN_KEY = 'mosswing.garden.run.v1';
  const PROFILE_KEY = 'mosswing.garden.profile.v1';
  const RUN_META_KEY = 'mosswing.garden.run-meta.v1';
  const PRESENTATION_KEY = 'mosswing.garden.presentation.v1';
  const REPORT_ACK_KEY = 'mosswing.garden.report-ack.v1';
  const STABLE_PHASES = new Set(['planning', 'preview', 'draft', 'reward', 'mutation', 'result']);
  const DIRECTION_LABELS = ['↑', '→', '↓', '←'];
  const DIRECTION_NAMES = { n: '向北', e: '向东', s: '向南', w: '向西' };
  const PLANT_SYMBOLS = { sunflower: '☀', dewcup: '◡', mint: '✦', moonflower: '☾', dandelion: '✺', bellflower: '♬', thorn: '▲', glowcap: '●' };
  const HEART_SYMBOLS = { balanced: '♦', reservoir: '◉', moon: '◐' };
  const WEATHER_PRESENTATION = {
    clear: { icon: '☀', detail: '晴空：光照植物更容易形成连锁。' },
    rain: { icon: '☂', detail: '骤雨：全园获得水，但幼苗成熟会延后。' },
    wind: { icon: '➜', detail: '强风：影响蒲公英繁殖与风行污染方向。' }
  };
  const BLIGHT_PRESENTATION = {
    dormant: { symbol: '◇', name: '休眠污染', detail: '本夜休眠，下一夜转为蔓生污染。' },
    creep: { symbol: '◈', name: '蔓生污染', detail: '从第5天起优先向心芽方向扩散。' },
    windborne: { symbol: '◆', name: '风行污染', detail: '扩散时优先沿当日风向推进。' }
  };
  const BLESSING_DETAILS = {
    'long-channel': '露杯草的供水距离延长，连接更自由。',
    afterglow: '夜花结算获得额外繁荣。',
    'return-flight': '返程时 Mosswing 可形成第二段授粉。',
    'soft-rain': '雨天不再阻碍幼苗成熟。',
    'living-barrier': '风荆与守护突变获得更强防线。',
    'compost-light': '植物凋零后把光留给最近的植物。'
  };
  const MUTATION_DETAILS = {
    vigorous: '盛放：这株植物今后开花时贡献更多繁荣。',
    guardian: '守护：每夜可替相邻一格阻挡一次污染。'
  };
  const PLANT_DETAILS = {
    sunflower: '获得光后开花，并向四向邻居传递光。',
    dewcup: '黎明储水；蓄满后沿朝向为植物供水。',
    mint: '消耗水开花，并恢复相邻植物的一次触发。',
    thorn: '污染进入本格时抵消污染并承担代价。',
    moonflower: '夜晚消耗水开花，是夜花构筑核心。',
    dandelion: '获得光或水后开花，并向下风向繁殖。',
    bellflower: '响应邻花，并扩展 Mosswing 授粉网络。',
    glowcap: '清理相邻污染后开花，把压力转化为光。'
  };
  const PLANT_SETUP_HINTS = {
    sunflower: '光连锁核心',
    dewcup: '定向供水',
    mint: '恢复植物触发',
    thorn: '抵消污染',
    moonflower: '夜花构筑核心',
    dandelion: '顺风繁殖',
    bellflower: '扩展授粉网络',
    glowcap: '污染转光'
  };
  const HEART_DETAILS = {
    balanced: '5生命；每天一次，为相邻植物提供1光或1水。',
    reservoir: '4生命；储存露水，并向同行或同列植物供水。',
    moon: '4生命；每天催放一株成熟月光花。'
  };
  const PROFILE_REASONS = {
    'unknown-unlock': '这个解锁节点不存在。',
    'already-unlocked': '该内容已经解锁。',
    'prerequisite-locked': '还没有满足前置条件。',
    'not-enough-memory-seeds': '记忆种子不足。'
  };
  const EVENT_LABELS = {
    'weather-applied': '天气开始影响花园',
    'heart-water-restored': '心芽恢复了水分',
    'resource-added': '资源抵达植物',
    'resource-transferred': '资源沿连接流动',
    'resource-overflow': '多余的水分溢散了',
    'plant-bloomed': '一株植物开花了',
    'plant-refreshed': '植物获得了第二次响应',
    'seedling-created': '新的幼苗落在浮岛上',
    'pollination-started': 'Mosswing 开始授粉',
    'mosswing-visited': 'Mosswing 访问了开花植物',
    'chain-completed': 'Mosswing 完成连锁并返巢',
    'blight-spawned': '新污染出现',
    'blight-spread': '污染向相邻浮岛扩散',
    'blight-cleared': '污染已被清除',
    'blight-blocked': '守护植物挡住了污染',
    'thorn-consumed': '风荆抵消污染后枯萎',
    'plant-withered': '植物受污染而枯萎',
    'plant-matured': '幼苗成熟了',
    'heart-damaged': '污染伤害了心芽',
    'task-completed': '生态任务已完成',
    'prosperity-added': '今日繁荣已结算',
    'run-won': '花园达成繁荣目标',
    'run-lost': '本局花园结束',
    'resolution-overflow': '生态反应达到安全上限'
  };
  const PHASE_LABELS = {
    planning: '规划中',
    preview: '今夜预演',
    resolving: '生态结算',
    night: '夜晚',
    draft: '晨间选种',
    reward: '奖励选择',
    mutation: '突变选择',
    result: '本局结束'
  };
  const REASONS = {
    'not-enough-actions': '行动点不足',
    'invalid-cell': '这个格子不能操作',
    'card-not-in-hand': '这张牌已不在手中',
    'cell-occupied': '格子上已有植物',
    'cell-blighted': '污染格不能种植',
    'plant-not-found': '请先选择一株植物',
    'plant-not-ready': '幼苗尚不能进行该操作',
    'plant-not-rotatable': '这种植物无需旋转',
    'destination-not-adjacent': '只能移到正交相邻的空格',
    'blight-not-found': '请先选择一格污染',
    'ability-already-used': '今天已经使用过心芽能力',
    'target-not-adjacent': '苔心只能影响正交相邻植物',
    'target-not-aligned': '潮心只能影响同行或同列植物',
    'target-not-night-plant': '月心只能催放成熟的月光花',
    'heart-has-no-water': '潮心当前没有可用水分',
    'invalid-resource': '请选择光或水',
    'discard-required': '手牌已满，还需选择一张原手牌堆肥',
    'card-not-offered': '这张提案已经不可选',
    'blessing-not-offered': '这个祝福不在当前提案中',
    'invalid-mutation': '这个突变不可用',
    'mutation-target-missing': '突变目标已经不存在',
    'undo-unavailable': '当日暂无可撤销操作',
    'wrong-phase': '当前阶段不能进行该操作'
  };

  const $ = id => document.getElementById(id);
  let context = null;
  let view = null;
  let run = null;
  let profile = null;
  let mounted = false;
  let lifecycle = 'idle';
  let selectedHeartId = 'balanced';
  let selectedPlantIds = [];
  let selectedRunKind = 'standard';
  let currentRunKind = 'standard';
  let tutorialGuideComplete = false;
  let tutorialCompletionNotice = false;
  let activeProfileReward = null;
  let compendiumReturnFocus = null;
  let selectedCardId = null;
  let selectedCellIndex = -1;
  let moveFromIndex = -1;
  let setupNotice = '';
  let previewEvents = [];
  let previewData = null;
  let resolution = null;
  let lastResolution = null;
  let playbackSpeed = 1;
  let userReducedMotion = false;
  let pausedFrom = 'running';
  let dangerConfirmArmed = false;
  let resolutionDispatchCount = 0;
  let choiceKind = null;
  let selectedChoiceId = null;
  let selectedDiscardCardId = null;
  let recoveredResolutionCount = 0;
  let storageAvailable = true;
  let resultCueRunId = null;
  const systemReducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  let listenerCount = 0;
  const listeners = [];

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function defaultProfile() {
    return PROFILE_MODEL.defaultProfile();
  }

  function normalizeProfile(value) {
    return PROFILE_MODEL.normalize(value);
  }

  function markStorageUnavailable() {
    storageAvailable = false;
    setupNotice = '当前浏览器无法保存；本局仍可继续，关闭页面后进度可能丢失。';
    const warning = $('garden-storage-warning');
    if (warning) warning.hidden = false;
    announce(setupNotice, true);
  }

  function playSound(cue, detail = {}) {
    try { context?.playSound?.(cue, detail); } catch {}
  }

  function loadProfile() {
    let stored = null;
    try { stored = localStorage.getItem(PROFILE_KEY); }
    catch {
      markStorageUnavailable();
      return defaultProfile();
    }
    if (!stored) return defaultProfile();
    try { return normalizeProfile(JSON.parse(stored)); }
    catch { return defaultProfile(); }
  }

  function saveProfile() {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
    catch { markStorageUnavailable(); }
  }

  function loadRun() {
    let stored = null;
    try {
      stored = localStorage.getItem(RUN_KEY);
    } catch {
      markStorageUnavailable();
      return null;
    }
    if (!stored) return null;
    try {
      return MODEL.restore(stored);
    } catch {
      removeStoredRun();
      setupNotice = '上次的花园存档已损坏，已安全放弃该存档。';
      announce(setupNotice, true);
      return null;
    }
  }

  function saveRun() {
    if (!run || !STABLE_PHASES.has(run.phase)) return;
    try { localStorage.setItem(RUN_KEY, MODEL.serialize(run)); }
    catch { markStorageUnavailable(); }
  }

  function removeStoredRun() {
    try {
      localStorage.removeItem(RUN_KEY);
      localStorage.removeItem(RUN_META_KEY);
      localStorage.removeItem(PRESENTATION_KEY);
      localStorage.removeItem(REPORT_ACK_KEY);
    } catch { markStorageUnavailable(); }
  }

  function saveRunMeta() {
    if (!run) return;
    try {
      localStorage.setItem(RUN_META_KEY, JSON.stringify({
        schemaVersion: 1,
        runId: run.runId,
        kind: currentRunKind,
        heartId: run.heart.id,
        selectedPlantIds: run.runPoolSnapshot.slice(),
        tutorialGuideComplete
      }));
    } catch { markStorageUnavailable(); }
  }

  function loadRunMeta(state) {
    const fallback = {
      kind: state?.tutorial ? 'tutorial' : 'standard',
      heartId: state?.heart?.id || selectedHeartId,
      selectedPlantIds: state?.runPoolSnapshot?.slice?.() || selectedPlantIds.slice(),
      tutorialGuideComplete: !state?.tutorial
    };
    let raw = null;
    try { raw = localStorage.getItem(RUN_META_KEY); }
    catch {
      markStorageUnavailable();
      return fallback;
    }
    try {
      const value = JSON.parse(raw);
      if (!value || value.schemaVersion !== 1 || value.runId !== state?.runId || !['standard', 'daily', 'tutorial'].includes(value.kind)) return fallback;
      if (!CONFIG.hearts[value.heartId] || !Array.isArray(value.selectedPlantIds) || value.selectedPlantIds.length !== CONFIG.runPoolSize || value.selectedPlantIds.some(id => !CONFIG.plants[id])) return fallback;
      return {
        kind: value.kind,
        heartId: value.heartId,
        selectedPlantIds: value.selectedPlantIds.slice(),
        tutorialGuideComplete: value.tutorialGuideComplete === true
      };
    } catch { return fallback; }
  }

  function utcDailySeed(date = new Date()) {
    return Number(`${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`) >>> 0;
  }

  function randomSeed() {
    try {
      const value = new Uint32Array(1);
      crypto.getRandomValues(value);
      return value[0];
    } catch {
      return (Date.now() ^ Math.floor(Math.random() * 0xffffffff) ^ profile.totalRuns) >>> 0;
    }
  }

  function nextRunSeed(kind, previousSeed = null) {
    if (kind === 'tutorial') return CONFIG.tutorialSeed;
    if (kind === 'daily') return utcDailySeed();
    let seed = randomSeed();
    if (seed === previousSeed) seed = (seed + 1) >>> 0;
    return seed;
  }

  function listen(target, type, handler, options) {
    if (!target) return;
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
    listenerCount += 1;
  }

  function announce(message, error = false) {
    const node = $('garden-message');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
  }

  function announceEvent(message) {
    const node = $('garden-event-status');
    if (node) node.textContent = message;
  }

  function effectiveReducedMotion() {
    return systemReducedMotion || userReducedMotion;
  }

  function collectPreviewData(events, state) {
    const blooms = new Set();
    const resources = new Map();
    const transfers = [];
    const transferKeys = new Set();
    const route = [];
    let collectingRoute = false;
    const addResource = (x, y, resource) => {
      if (!Number.isInteger(x) || !Number.isInteger(y)) return;
      const index = y * CONFIG.boardSize + x;
      const labels = resources.get(index) || new Set();
      labels.add(resource === 'water' ? '水' : '光');
      resources.set(index, labels);
    };
    const addTransfer = (fromX, fromY, toX, toY, resource) => {
      if (![fromX, fromY, toX, toY].every(Number.isInteger)) return;
      const id = `${fromX},${fromY}:${toX},${toY}:${resource}`;
      if (transferKeys.has(id)) return;
      transferKeys.add(id);
      transfers.push({ fromX, fromY, toX, toY, resource });
    };
    for (const item of events || []) {
      if (item.type === 'plant-bloomed') blooms.add(item.y * CONFIG.boardSize + item.x);
      if (item.type === 'resource-added') {
        addResource(item.x, item.y, item.resource);
        if (typeof item.source === 'string') {
          const source = state?.board?.find(cell => cell.plant?.instanceId === item.source);
          if (source) addTransfer(source.x, source.y, item.x, item.y, item.resource);
        }
      }
      if (item.type === 'resource-transferred') {
        addResource(item.toX, item.toY, item.resource);
        addTransfer(item.fromX, item.fromY, item.toX, item.toY, item.resource);
      }
      if (item.type === 'pollination-started' && !item.returnFlight && !route.length) {
        collectingRoute = true;
        continue;
      }
      if (collectingRoute && item.type === 'mosswing-visited' && !item.returnFlight) route.push({ x: item.x, y: item.y });
      if (collectingRoute && item.type === 'chain-completed' && !item.returnFlight) collectingRoute = false;
    }
    return {
      blooms: [...blooms],
      resources: [...resources].map(([index, labels]) => ({ index, label: [...labels].join('+') })),
      transfers,
      route
    };
  }

  function svgLine(kind, from, to) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    node.setAttribute('class', kind === 'route' ? 'garden-route-line' : 'garden-resource-line');
    node.setAttribute('x1', String((from.x + .5) * 20));
    node.setAttribute('y1', String((from.y + .5) * 20));
    node.setAttribute('x2', String((to.x + .5) * 20));
    node.setAttribute('y2', String((to.y + .5) * 20));
    return node;
  }

  function renderPaths(data = previewData) {
    const group = $('garden-route-paths');
    if (!group) return;
    group.replaceChildren();
    if (!data) return;
    const routePoints = [{ x: 2, y: 2 }, ...data.route, ...(data.route.length ? [{ x: 2, y: 2 }] : [])];
    for (let index = 1; index < routePoints.length; index++) group.append(svgLine('route', routePoints[index - 1], routePoints[index]));
    data.transfers.forEach(item => group.append(svgLine(
      item.resource === 'water' ? 'resource' : 'route',
      { x: item.fromX, y: item.fromY },
      { x: item.toX, y: item.toY }
    )));
  }

  function decoratePreviewBoard() {
    if (!previewData) return;
    const buttons = $('garden-board')?.querySelectorAll('[data-cell-index]');
    if (!buttons) return;
    previewData.blooms.forEach(index => buttons[index]?.classList.add('preview-bloom'));
    previewData.resources.forEach(item => {
      const button = buttons[item.index];
      if (!button) return;
      button.classList.add('preview-resource');
      button.dataset.previewResource = item.label;
    });
    previewData.route.forEach((pos, index) => {
      const button = buttons[pos.y * CONFIG.boardSize + pos.x];
      if (button) button.dataset.routeOrder = String(index + 1);
    });
  }

  function setMosswingToken(x, y, visible = true) {
    const token = $('garden-mosswing-token');
    if (!token) return;
    token.hidden = !visible;
    token.classList.toggle('reduced', effectiveReducedMotion());
    token.style.left = `${(x + .5) * 20}%`;
    token.style.top = `${(y + .5) * 20}%`;
  }

  function syncMotionControls() {
    document.body.classList.toggle('garden-reduced-motion', effectiveReducedMotion());
    document.querySelectorAll('[data-garden-speed]').forEach(button => {
      const selected = Number(button.dataset.gardenSpeed) === playbackSpeed;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const reducedButton = $('garden-reduced-motion');
    if (reducedButton) {
      reducedButton.disabled = systemReducedMotion;
      reducedButton.classList.toggle('selected', effectiveReducedMotion());
      reducedButton.setAttribute('aria-pressed', String(effectiveReducedMotion()));
      reducedButton.textContent = systemReducedMotion ? '系统减少动效' : effectiveReducedMotion() ? '减少动效：开' : '减少动效';
    }
    view?.setReducedMotion(effectiveReducedMotion());
  }

  function clearPreviewPresentation() {
    previewEvents = [];
    previewData = null;
    dangerConfirmArmed = false;
    renderPaths(null);
    setMosswingToken(2, 2, false);
    view?.clearTransient?.();
  }

  function summariesMatch(summary, report) {
    if (!summary || !report) return false;
    return summary.prosperity === report.prosperity &&
      summary.totalProsperity === report.totalProsperity &&
      summary.blooms === report.blooms &&
      summary.chain === report.chain &&
      summary.heartDamage === report.heartDamage &&
      summary.blightAdded === report.blightAdded;
  }

  function setLifecycle(next) {
    lifecycle = next;
    const setup = $('garden-setup');
    const game = $('garden-mode');
    const report = $('garden-report');
    const choice = $('garden-choice-overlay');
    const result = $('garden-result-overlay');
    if (setup) setup.hidden = next !== 'setup';
    if (game) game.hidden = !['running', 'resolving', 'paused', 'report', 'choice', 'result'].includes(next);
    if (report) {
      report.hidden = next !== 'report';
      report.setAttribute('aria-hidden', String(next !== 'report'));
    }
    if (choice) {
      choice.hidden = next !== 'choice';
      choice.setAttribute('aria-hidden', String(next !== 'choice'));
    }
    if (result) {
      result.hidden = next !== 'result';
      result.setAttribute('aria-hidden', String(next !== 'result'));
    }
    document.body.classList.toggle('garden-setup', next === 'setup');
    document.body.classList.toggle('garden-running', next === 'running');
    document.body.classList.toggle('garden-resolving', next === 'resolving');
    document.body.classList.toggle('garden-paused', next === 'paused');
    document.body.classList.toggle('garden-reporting', next === 'report');
    document.body.classList.toggle('garden-choice-open', next === 'choice');
    document.body.classList.toggle('garden-result-open', next === 'result');
    if (game) game.inert = ['paused', 'report', 'choice', 'result'].includes(next);
  }

  function setupLabel() {
    const saved = loadRun();
    const summary = $('garden-continue-summary');
    const homeSummary = $('garden-home-summary');
    const button = $('garden-continue');
    if (summary) {
      summary.textContent = saved
        ? `已有进度：第 ${saved.day}/12 天 · ${CONFIG.hearts[saved.heart.id].name}`
        : setupNotice || (!profile?.tutorialComplete ? `首局教学 · 固定种子 ${CONFIG.tutorialSeed} · 教学目标 ${CONFIG.tutorialTargetProsperity}` : '新的花园将从第1天开始');
      summary.classList.toggle('error', !saved && !!setupNotice);
    }
    if (homeSummary) homeSummary.textContent = saved
      ? `继续第 ${saved.day}/12 天的${CONFIG.hearts[saved.heart.id].name}，或重新选择花园构筑。`
      : !profile?.tutorialComplete ? '先完成四步渐进教学，再自由选择花园构筑。' : '选择心芽和4种植物，打造你的浮岛生态。';
    if (button) button.hidden = !saved;
  }

  function renderSetup() {
    const tutorialRequired = !profile.tutorialComplete;
    if (tutorialRequired) {
      selectedHeartId = 'balanced';
      selectedPlantIds = CONFIG.basePlants.slice();
    }
    selectedPlantIds = selectedPlantIds.filter(id => profile.unlockedPlantIds.includes(id));
    if (!selectedPlantIds.length) selectedPlantIds = CONFIG.basePlants.slice();
    if (!profile.unlockedHeartIds.includes(selectedHeartId)) selectedHeartId = 'balanced';
    document.querySelectorAll('[data-garden-run-kind]').forEach(button => {
      const selected = button.dataset.gardenRunKind === selectedRunKind;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = tutorialRequired;
    });
    const dailyLabel = $('garden-daily-seed-label');
    if (dailyLabel) dailyLabel.textContent = `UTC 今日种子 ${utcDailySeed()}`;
    document.querySelectorAll('[data-garden-heart]').forEach(button => {
      const id = button.dataset.gardenHeart;
      const unlocked = profile.unlockedHeartIds.includes(id);
      button.hidden = !unlocked;
      button.disabled = !unlocked || tutorialRequired;
      button.classList.toggle('selected', id === selectedHeartId);
      button.setAttribute('aria-pressed', String(id === selectedHeartId));
      button.querySelector('.garden-lock')?.replaceChildren(document.createTextNode(unlocked ? '已解锁' : '待解锁'));
    });
    document.querySelectorAll('[data-garden-plant]').forEach(button => {
      const id = button.dataset.gardenPlant;
      const unlocked = profile.unlockedPlantIds.includes(id);
      const selected = selectedPlantIds.includes(id);
      button.hidden = !unlocked;
      button.disabled = !unlocked || tutorialRequired;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      const hint = button.querySelector('small');
      if (hint) hint.textContent = unlocked ? PLANT_SETUP_HINTS[id] : '待解锁';
    });
    const count = $('garden-pool-count');
    if (count) count.textContent = `${selectedPlantIds.length}/${CONFIG.runPoolSize}`;
    const begin = $('garden-begin');
    if (begin) {
      begin.disabled = selectedPlantIds.length !== CONFIG.runPoolSize;
      begin.textContent = tutorialRequired ? '开始四步教学' : '开始造境';
    }
    const tutorialNote = $('garden-tutorial-setup-note');
    if (tutorialNote) tutorialNote.hidden = !tutorialRequired;
    const seeds = $('garden-memory-seeds');
    if (seeds) seeds.textContent = profile.memorySeeds;
    const setupStats = $('garden-profile-summary');
    if (setupStats) setupStats.textContent = `游玩 ${profile.totalRuns} · 胜利 ${profile.wins} · 最长连锁 ${profile.longestChain} · 最高繁荣 ${profile.highestProsperity}`;
    setupLabel();
  }

  function resetPresentation() {
    resolution = null;
    choiceKind = null;
    selectedChoiceId = null;
    selectedDiscardCardId = null;
    clearPreviewPresentation();
    document.body.classList.remove('garden-previewing');
    ['garden-report', 'garden-choice-overlay', 'garden-result-overlay', 'garden-compendium-overlay'].forEach(id => {
      const overlay = $(id);
      if (overlay) overlay.hidden = true;
    });
    const progress = $('garden-resolution-progress');
    if (progress) {
      progress.hidden = true;
      progress.querySelector('i')?.style.setProperty('width', '0%');
    }
    $('garden-board')?.querySelectorAll('.event-active').forEach(node => node.classList.remove('event-active'));
    syncMotionControls();
  }

  function restorePreviewPresentation() {
    if (run?.phase !== 'preview') return;
    const simulation = MODEL.preview(run);
    previewEvents = clone(simulation.events);
    previewData = collectPreviewData(previewEvents, run);
    render();
    view?.showPreview(run, previewEvents);
  }

  function reportAcknowledgement() {
    let stored = null;
    try { stored = localStorage.getItem(REPORT_ACK_KEY); }
    catch {
      markStorageUnavailable();
      return null;
    }
    try { return stored ? JSON.parse(stored) : null; }
    catch { return null; }
  }

  function reportIsAcknowledged(report = run?.lastReport) {
    const value = reportAcknowledgement();
    return !!report && value?.schemaVersion === 1 && value.runId === run?.runId && value.day === report.day;
  }

  function acknowledgeReport(report = run?.lastReport) {
    if (!report || !run) return;
    try { localStorage.setItem(REPORT_ACK_KEY, JSON.stringify({ schemaVersion: 1, runId: run.runId, day: report.day })); }
    catch { markStorageUnavailable(); }
  }

  function clearReportAcknowledgement() {
    try { localStorage.removeItem(REPORT_ACK_KEY); }
    catch { markStorageUnavailable(); }
  }

  function clearPresentationJournal() {
    try { localStorage.removeItem(PRESENTATION_KEY); }
    catch { markStorageUnavailable(); }
  }

  function savePresentationJournal(sourceState, finalState, events) {
    try {
      localStorage.setItem(PRESENTATION_KEY, JSON.stringify({
        schemaVersion: 1,
        runId: finalState.runId,
        day: sourceState.day,
        source: MODEL.serialize(sourceState),
        final: MODEL.serialize(finalState),
        events: clone(events)
      }));
    } catch { markStorageUnavailable(); }
  }

  function restoreResolutionJournal() {
    let stored = null;
    try { stored = localStorage.getItem(PRESENTATION_KEY); }
    catch {
      markStorageUnavailable();
      return false;
    }
    let journal;
    try { journal = stored ? JSON.parse(stored) : null; }
    catch {
      clearPresentationJournal();
      return false;
    }
    if (!journal) return false;
    try {
      if (journal.schemaVersion !== 1 || journal.runId !== run?.runId || !Array.isArray(journal.events)) throw new Error('invalid-presentation-journal');
      const sourceState = MODEL.restore(journal.source);
      const savedFinal = MODEL.restore(journal.final);
      if (sourceState.phase !== 'preview' || sourceState.runId !== run.runId || sourceState.day !== journal.day) throw new Error('invalid-presentation-source');
      if (MODEL.serialize(savedFinal) !== MODEL.serialize(run)) throw new Error('stale-presentation-final');
      const replay = MODEL.dispatch(sourceState, { type: 'confirm-night' });
      if (!replay.accepted || MODEL.serialize(replay.state) !== journal.final || JSON.stringify(replay.events) !== JSON.stringify(journal.events)) throw new Error('non-deterministic-presentation-replay');
      const expectedEvents = clone(MODEL.preview(sourceState).events);
      previewEvents = expectedEvents;
      previewData = collectPreviewData(expectedEvents, sourceState);
      resolution = {
        sourceState,
        events: clone(replay.events),
        expectedEvents,
        previewSummary: clone(sourceState.previewSummary),
        index: 0,
        elapsed: 0,
        trace: [],
        speedHistory: [playbackSpeed],
        dispatchCount: 0,
        restored: true,
        error: null
      };
      recoveredResolutionCount += 1;
      setLifecycle('resolving');
      render();
      view.startResolution(sourceState, resolution.events);
      setMosswingToken(2, 2, true);
      announce('已从当日确定性快照恢复，正在重放生态结算。');
      return true;
    } catch {
      clearPresentationJournal();
      return false;
    }
  }

  function recoverOrRoute() {
    if (!run) return;
    if (restoreResolutionJournal()) return;
    setLifecycle('running');
    render();
    if (run.phase === 'preview') {
      restorePreviewPresentation();
      $('garden-confirm-night')?.focus({ preventScroll: true });
      return;
    }
    if (run.phase === 'planning') {
      $('garden-board')?.querySelector('button')?.focus({ preventScroll: true });
      return;
    }
    if (run.lastReport && !reportIsAcknowledged(run.lastReport)) {
      openReport(run.lastReport);
      return;
    }
    routePostReport();
  }

  function enter(options = {}) {
    if (!mounted) throw new Error('GardenMode.mount must be called before enter');
    lastResolution = null;
    resolutionDispatchCount = 0;
    $('garden-pause-overlay').hidden = true;
    resetPresentation();
    view.setVisible(true);
    context.setFlightPresentationVisible(false);
    document.body.classList.add('game-family-garden');
    const saved = loadRun();
    run = saved;
    if (saved) {
      const meta = loadRunMeta(saved);
      currentRunKind = meta.kind;
      selectedRunKind = meta.kind === 'tutorial' ? 'standard' : meta.kind;
      selectedHeartId = meta.heartId;
      selectedPlantIds = meta.selectedPlantIds.slice();
      tutorialGuideComplete = meta.tutorialGuideComplete;
      tutorialCompletionNotice = false;
    }
    if (options.resume && saved) {
      selectedCardId = null;
      selectedCellIndex = -1;
      moveFromIndex = -1;
      recoverOrRoute();
      return;
    }
    setLifecycle('setup');
    renderSetup();
    $('garden-begin')?.focus({ preventScroll: true });
  }

  function createAndStartRun(kind = selectedRunKind, previousSeed = null) {
    const tutorial = kind === 'tutorial';
    if (tutorial) {
      selectedHeartId = 'balanced';
      selectedPlantIds = CONFIG.basePlants.slice();
    }
    if (selectedPlantIds.length !== CONFIG.runPoolSize) {
      announce(`请选择恰好 ${CONFIG.runPoolSize} 种植物`, true);
      return;
    }
    const seed = nextRunSeed(kind, previousSeed);
    try {
      run = MODEL.createRun({
        seed,
        runId: `garden-${seed}-${profile.totalRuns + 1}`,
        heartId: selectedHeartId,
        unlockedPlantIds: profile.unlockedPlantIds,
        selectedPlantIds,
        tutorial
      });
    } catch (error) {
      announce(error.message || '无法创建花园', true);
      return;
    }
    profile = PROFILE_MODEL.startRun(profile);
    currentRunKind = kind;
    if (!tutorial) selectedRunKind = kind;
    tutorialGuideComplete = !tutorial;
    tutorialCompletionNotice = false;
    activeProfileReward = null;
    lastResolution = null;
    resolutionDispatchCount = 0;
    recoveredResolutionCount = 0;
    setupNotice = '';
    clearPresentationJournal();
    clearReportAcknowledgement();
    saveProfile();
    saveRun();
    saveRunMeta();
    resetPresentation();
    selectedCardId = tutorial ? null : run.hand[0]?.cardId || null;
    selectedCellIndex = -1;
    moveFromIndex = -1;
    setLifecycle('running');
    render();
    announce(tutorial
      ? '教学 1/4：选择向日葵，再种到心芽正上方的高亮格。'
      : kind === 'daily' ? `今日花园 · 固定种子 ${seed}。选一张手牌开始规划。` : '选一张手牌，再选一个空格种下。');
    $('garden-board')?.querySelector('button')?.focus({ preventScroll: true });
  }

  function startNewRun() {
    createAndStartRun(profile.tutorialComplete ? selectedRunKind : 'tutorial');
  }

  function resumeSavedRun() {
    const saved = loadRun();
    if (!saved) {
      announce('没有可继续的花园。', true);
      renderSetup();
      return;
    }
    lastResolution = null;
    resolutionDispatchCount = 0;
    run = saved;
    const meta = loadRunMeta(saved);
    currentRunKind = meta.kind;
    selectedRunKind = meta.kind === 'tutorial' ? 'standard' : meta.kind;
    selectedHeartId = meta.heartId;
    selectedPlantIds = meta.selectedPlantIds.slice();
    tutorialGuideComplete = meta.tutorialGuideComplete;
    tutorialCompletionNotice = false;
    activeProfileReward = null;
    resetPresentation();
    selectedCardId = null;
    selectedCellIndex = -1;
    moveFromIndex = -1;
    recoverOrRoute();
  }

  function exit() {
    closeCompendium();
    const finishedTutorial = run?.phase === 'result' && currentRunKind === 'tutorial';
    if (run?.phase === 'result') {
      removeStoredRun();
      run = null;
    } else {
      saveRun();
      saveRunMeta();
    }
    if (finishedTutorial) selectedRunKind = 'standard';
    setupLabel();
    $('garden-pause-overlay').hidden = true;
    resetPresentation();
    setLifecycle('idle');
    view.setVisible(false);
    context.setFlightPresentationVisible(true);
    context.onExit?.();
  }

  function pause() {
    if (!['running', 'resolving'].includes(lifecycle)) return;
    pausedFrom = lifecycle;
    setLifecycle('paused');
    $('garden-pause-overlay').hidden = false;
    $('garden-pause-overlay').setAttribute('aria-hidden', 'false');
    context?.pauseAudio?.();
    $('garden-resume')?.focus({ preventScroll: true });
  }

  function resume() {
    if (lifecycle !== 'paused') return;
    $('garden-pause-overlay').hidden = true;
    $('garden-pause-overlay').setAttribute('aria-hidden', 'true');
    context?.resumeAudio?.();
    const next = resolution && pausedFrom === 'resolving' ? 'resolving' : 'running';
    setLifecycle(next);
    if (next === 'resolving') $('garden-pause')?.focus({ preventScroll: true });
    else $('garden-board')?.querySelector(`[data-cell-index="${Math.max(0, selectedCellIndex)}"]`)?.focus({ preventScroll: true });
  }

  function dispatch(command, successMessage) {
    if (!run) return false;
    const stateBefore = run;
    const result = MODEL.dispatch(run, command);
    if (!result.accepted) {
      announce(REASONS[result.reason] || `无法操作：${result.reason}`, true);
      render();
      return false;
    }
    run = result.state;
    maybeCompleteTutorialGuide(command, stateBefore);
    saveRun();
    const cue = {
      plant: 'plant', rotate: 'arrange', move: 'arrange', clean: 'clean',
      'heart-ability': command.payload?.resource === 'water' || run.heart.id === 'reservoir' ? 'water' : 'light',
      'undo-day': 'undo'
    }[command.type];
    if (cue) playSound(cue);
    announce(successMessage || '操作已完成');
    render();
    return true;
  }

  function displayState() {
    return resolution?.sourceState || run;
  }

  function tutorialStep(state = run) {
    if (!state?.tutorial || tutorialGuideComplete) return 0;
    const sunflower = state.board?.[7]?.plant;
    if (sunflower?.type !== 'sunflower') return 1;
    const dewcup = state.board?.[2]?.plant;
    if (dewcup?.type !== 'dewcup' || dewcup.orientation !== 2) return 2;
    if (state.day === 1) return 3;
    return 4;
  }

  function completeTutorialGuide() {
    if (!run?.tutorial || tutorialGuideComplete) return;
    tutorialGuideComplete = true;
    tutorialCompletionNotice = true;
    profile = PROFILE_MODEL.completeTutorial(profile);
    saveProfile();
    saveRunMeta();
    render();
    playSound('tutorial');
    announce('四步教学完成！后续花园不再强制提示，也可随时从图鉴重新体验。');
  }

  function maybeCompleteTutorialGuide(command, stateBefore) {
    if (tutorialStep(stateBefore) !== 4 || !stateBefore.board.some(cell => cell.blight)) return;
    if (['clean', 'plant', 'rotate', 'move', 'heart-ability', 'preview-day'].includes(command.type)) completeTutorialGuide();
  }

  function renderTutorial(state) {
    const panel = $('garden-tutorial');
    if (!panel) return;
    const step = tutorialStep(state);
    panel.hidden = !step && !tutorialCompletionNotice;
    document.body.classList.toggle('garden-tutorial-active', step > 0);
    document.querySelectorAll('.tutorial-target').forEach(node => node.classList.remove('tutorial-target'));
    if (tutorialCompletionNotice && !step) {
      $('garden-tutorial-step').textContent = '教学完成';
      $('garden-tutorial-title').textContent = '现在由你决定花园的方向';
      $('garden-tutorial-copy').textContent = '四步操作已掌握。后续新局不会再强制教学，图鉴中可以随时重玩。';
      $('garden-tutorial-dismiss').hidden = false;
      return;
    }
    $('garden-tutorial-dismiss').hidden = true;
    if (!step) return;
    $('garden-tutorial-step').textContent = `教学 ${step}/4`;
    const content = {
      1: ['种下向日葵', '选择向日葵手牌，再种到心芽正上方的高亮格。晴空会为它提供光。'],
      2: ['让露水流向花朵', '把露杯草种到向日葵上方，再选中它旋转一次，让箭头朝下。'],
      3: ['预演并进入夜晚', '先预演光、水、开花与 Mosswing 路线；确认后才会真正结算。'],
      4: ['处理第一格污染', state.board.some(cell => cell.blight)
        ? '污染已经出现。你可以花2行动清理，也可以继续扩张；做出选择后教学结束。'
        : '第2夜会出现第一格污染。第4步起已完全自由，继续规划并观察它的到来。']
    }[step];
    $('garden-tutorial-title').textContent = content[0];
    $('garden-tutorial-copy').textContent = content[1];
    if (step === 1) {
      $('garden-hand')?.querySelector('[data-plant-type="sunflower"]')?.classList.add('tutorial-target');
      $('garden-board')?.querySelector('[data-cell-index="7"]')?.classList.add('tutorial-target');
    } else if (step === 2) {
      if (state.board[2]?.plant?.type === 'dewcup') {
        $('garden-board')?.querySelector('[data-cell-index="2"]')?.classList.add('tutorial-target');
        $('garden-rotate')?.classList.add('tutorial-target');
      } else {
        $('garden-hand')?.querySelector('[data-plant-type="dewcup"]')?.classList.add('tutorial-target');
        $('garden-board')?.querySelector('[data-cell-index="2"]')?.classList.add('tutorial-target');
      }
    } else if (step === 3) {
      (state.phase === 'preview' ? $('garden-confirm-night') : $('garden-preview-button'))?.classList.add('tutorial-target');
    } else if (step === 4 && state.board.some(cell => cell.blight)) {
      state.board.forEach((cell, index) => {
        if (cell.blight) $('garden-board')?.querySelector(`[data-cell-index="${index}"]`)?.classList.add('tutorial-target');
      });
    }
  }

  function cellLabel(cell, state) {
    if (cell.x === 2 && cell.y === 2) {
      const condition = state.heart.hp <= 1 ? '危急' : state.heart.hp < state.heart.maxHp ? '受损' : '稳定';
      return `${CONFIG.hearts[state.heart.id].name}，生命 ${state.heart.hp}/${state.heart.maxHp}，状态${condition}`;
    }
    const parts = [`第 ${cell.y + 1} 行第 ${cell.x + 1} 列`];
    if (cell.plant) {
      parts.push(CONFIG.plants[cell.plant.type].name, `朝向 ${DIRECTION_LABELS[cell.plant.orientation]}`, cell.plant.stage === 'mature' ? '成熟' : cell.plant.stage === 'seedling' ? '幼苗' : '凋零');
      if (cell.plant.mutation) parts.push(CONFIG.mutations[cell.plant.mutation].name);
    } else if (!cell.blight) parts.push('空格');
    if (cell.blight) {
      const blight = BLIGHT_PRESENTATION[cell.blight.behavior];
      parts.push(blight?.name || '污染', blight?.detail || '有污染');
    }
    return parts.join('，');
  }

  function renderBoard(state) {
    const board = $('garden-board');
    if (!board || !state) return;
    const buttons = board.querySelectorAll('[data-cell-index]');
    const interactive = lifecycle === 'running' && state.phase === 'planning' && !resolution;
    const guideStep = tutorialStep(state);
    state.board.forEach((cell, index) => {
      const button = buttons[index];
      if (!button) return;
      const heart = cell.x === 2 && cell.y === 2;
      button.className = 'garden-cell';
      button.classList.toggle('heart', heart);
      button.classList.toggle('occupied', !!cell.plant);
      button.classList.toggle('blighted', !!cell.blight);
      button.classList.toggle('selected', index === selectedCellIndex);
      button.classList.toggle('move-source', index === moveFromIndex);
      if (cell.plant) {
        button.dataset.plant = cell.plant.type;
        button.dataset.stage = cell.plant.stage;
      } else {
        delete button.dataset.plant;
        delete button.dataset.stage;
      }
      if (cell.plant?.mutation) button.dataset.mutation = cell.plant.mutation;
      else delete button.dataset.mutation;
      if (cell.blight) button.dataset.blight = cell.blight.behavior;
      else delete button.dataset.blight;
      delete button.dataset.previewResource;
      delete button.dataset.routeOrder;
      const tutorialBlocked = guideStep === 1 ? index !== 7 : guideStep === 2 ? index !== 2 : guideStep === 3;
      button.disabled = !interactive || tutorialBlocked;
      button.setAttribute('aria-label', cellLabel(cell, state));
      button.setAttribute('aria-pressed', String(index === selectedCellIndex));
      if (heart) {
        button.dataset.heart = state.heart.id;
        button.dataset.health = state.heart.hp <= 1 ? 'critical' : state.heart.hp < state.heart.maxHp ? 'hurt' : 'stable';
        button.innerHTML = `<span class="cell-symbol" aria-hidden="true">${HEART_SYMBOLS[state.heart.id] || '♦'}</span><span class="cell-name">${CONFIG.hearts[state.heart.id].name}</span>`;
      } else if (cell.plant) {
        delete button.dataset.heart;
        delete button.dataset.health;
        const plant = CONFIG.plants[cell.plant.type];
        button.innerHTML = `<span class="cell-symbol plant-${cell.plant.type}" aria-hidden="true">${PLANT_SYMBOLS[cell.plant.type] || '✿'}</span><span class="cell-name">${plant.name}${cell.plant.stage === 'seedling' ? '苗' : cell.plant.stage === 'withered' ? '·凋' : ''}</span><span class="cell-direction" aria-hidden="true">${DIRECTION_LABELS[cell.plant.orientation]}</span>`;
      } else {
        delete button.dataset.heart;
        delete button.dataset.health;
        const blight = cell.blight ? BLIGHT_PRESENTATION[cell.blight.behavior] : null;
        button.innerHTML = `<span class="cell-symbol" aria-hidden="true">${blight?.symbol || '·'}</span><span class="cell-name">${blight?.name || '空格'}</span>`;
      }
    });
  }

  function renderHand(state) {
    const hand = $('garden-hand');
    if (!hand || !state) return;
    const interactive = lifecycle === 'running' && state.phase === 'planning' && !resolution;
    hand.replaceChildren(...state.hand.map(card => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'garden-card';
      button.dataset.cardId = card.cardId;
      button.dataset.plantType = card.plantType;
      const guideStep = tutorialStep(state);
      const tutorialBlocked = guideStep === 1 ? card.plantType !== 'sunflower' : guideStep === 2 ? card.plantType !== 'dewcup' || state.board[2]?.plant?.type === 'dewcup' : guideStep === 3;
      button.disabled = !interactive || tutorialBlocked;
      button.classList.toggle('selected', card.cardId === selectedCardId);
      button.setAttribute('aria-pressed', String(card.cardId === selectedCardId));
      button.innerHTML = `<span class="card-mark plant-${card.plantType}" aria-hidden="true">${PLANT_SYMBOLS[card.plantType] || '✿'}</span><strong>${CONFIG.plants[card.plantType].name}</strong><small>种植 ·1行动</small>`;
      return button;
    }));
  }

  function renderSelection(state) {
    const interactive = lifecycle === 'running' && state.phase === 'planning' && !resolution;
    const guideStep = tutorialStep(state);
    const cell = selectedCellIndex >= 0 ? state.board[selectedCellIndex] : null;
    const details = $('garden-selection');
    if (details) {
      if (!cell) details.textContent = selectedCardId ? '已选手牌，请选一个空格。' : '选择手牌或棋盘上的植物。';
      else if (cell.plant) details.textContent = `${CONFIG.plants[cell.plant.type].name} · 朝向 ${DIRECTION_LABELS[cell.plant.orientation]} · ${cell.plant.stage === 'mature' ? '成熟' : '幼苗'}`;
      else details.textContent = cell.x === 2 && cell.y === 2 ? `${CONFIG.hearts[state.heart.id].name} · 生命 ${state.heart.hp}/${state.heart.maxHp}` : '空格';
    }
    const rotate = $('garden-rotate');
    const move = $('garden-move');
    const clean = $('garden-clean');
    const plant = cell?.plant;
    if (rotate) rotate.disabled = !interactive || !plant || plant.stage !== 'mature' || !CONFIG.plants[plant.type].rotatable || state.actionPoints < 1 || (guideStep > 0 && (guideStep !== 2 || selectedCellIndex !== 2));
    if (move) {
      move.disabled = !interactive || !plant || plant.stage !== 'mature' || state.actionPoints < 1 || (guideStep > 0 && guideStep < 4);
      move.classList.toggle('selected', moveFromIndex >= 0);
      move.textContent = moveFromIndex >= 0 ? '取消移动' : '移动';
    }
    if (clean) clean.disabled = !interactive || !cell?.blight || state.actionPoints < 2 || (guideStep > 0 && guideStep < 4);
    const lightAbility = $('garden-heart-light');
    const waterAbility = $('garden-heart-water');
    const unused = interactive && !state.heart.dailyAbilityUsed;
    const heart = state.heart.id;
    const adjacent = !!plant && plant.stage === 'mature' && Math.abs(cell.x - 2) + Math.abs(cell.y - 2) === 1;
    const aligned = !!plant && plant.stage === 'mature' && (cell.x === 2 || cell.y === 2);
    const moonTarget = plant?.stage === 'mature' && plant.type === 'moonflower';
    if (lightAbility) {
      lightAbility.hidden = heart !== 'balanced';
      lightAbility.disabled = !unused || !adjacent || state.actionPoints < CONFIG.hearts[heart].actionCost || (guideStep > 0 && guideStep < 4);
      lightAbility.textContent = `${CONFIG.hearts[heart].name}供光 ·${CONFIG.hearts[heart].actionCost}`;
    }
    if (waterAbility) {
      waterAbility.hidden = false;
      waterAbility.textContent = heart === 'balanced' ? `${CONFIG.hearts[heart].name}供水 ·${CONFIG.hearts[heart].actionCost}` : heart === 'reservoir' ? `潮心供水 ·1（水 ${state.heart.water}/2）` : '月心催放 ·0';
      waterAbility.disabled = !unused || state.actionPoints < CONFIG.hearts[heart].actionCost || (guideStep > 0 && guideStep < 4) ||
        (heart === 'balanced' && !adjacent) ||
        (heart === 'reservoir' && (!aligned || state.heart.water < 1)) ||
        (heart === 'moon' && !moonTarget);
    }
    const undo = $('garden-undo');
    if (undo) undo.disabled = !interactive || !state.undoSnapshot;
  }

  function render() {
    if (!run) return;
    const state = displayState();
    document.body.classList.toggle('garden-previewing', lifecycle === 'running' && state.phase === 'preview' && !resolution);
    const weather = state.weather[state.day - 1];
    const tomorrow = state.weather[state.day];
    const weatherInfo = WEATHER_PRESENTATION[weather.id];
    $('garden-day').textContent = `第 ${state.day}/12 天`;
    $('garden-weather').textContent = `${CONFIG.weather[weather.id].name}${weather.windDirection ? ` ${DIRECTION_LABELS[CONFIG.directions.findIndex(item => item.id === weather.windDirection)]}` : ''}`;
    $('garden-weather').dataset.weatherIcon = weatherInfo.icon;
    $('garden-weather').title = `${weatherInfo.detail}${weather.windDirection ? ` 当前风向${DIRECTION_NAMES[weather.windDirection]}。` : ''}`;
    $('garden-tomorrow').textContent = tomorrow ? `${CONFIG.weather[tomorrow.id].name}${tomorrow.windDirection ? ` ${DIRECTION_LABELS[CONFIG.directions.findIndex(item => item.id === tomorrow.windDirection)]}` : ''}` : '—';
    Object.keys(WEATHER_PRESENTATION).forEach(id => document.body.classList.toggle(`garden-weather-${id}`, id === weather.id));
    $('garden-prosperity').textContent = `${state.prosperity}/${state.tutorial ? CONFIG.tutorialTargetProsperity : CONFIG.targetProsperity}`;
    const heartHp = $('garden-heart-hp');
    const heartCondition = state.heart.hp <= 1 ? '危急' : state.heart.hp < state.heart.maxHp ? '受损' : '稳定';
    heartHp.textContent = `${state.heart.hp}/${state.heart.maxHp}`;
    heartHp.parentElement.dataset.state = heartCondition;
    heartHp.parentElement.setAttribute('aria-label', `${CONFIG.hearts[state.heart.id].name}生命 ${state.heart.hp}/${state.heart.maxHp}，${heartCondition}`);
    $('garden-blight-count').textContent = `${state.board.filter(cell => cell.blight).length}/${CONFIG.blightLossCount}`;
    $('garden-actions').textContent = state.actionPoints;
    $('garden-task').textContent = state.tasks.map(task => `${task.completed ? '✓ ' : ''}${task.kind === 'main' ? '主任务' : '支线'}：${CONFIG.tasks[task.id].name}${task.completed ? `（第${task.completedDay}天完成）` : ''}`).join(' · ');
    $('garden-phase').textContent = resolution ? PHASE_LABELS.resolving : PHASE_LABELS[state.phase] || state.phase;
    renderBoard(state);
    renderHand(state);
    renderSelection(state);

    const summary = resolution?.previewSummary || state.previewSummary;
    const showingPreview = !!summary && (state.phase === 'preview' || !!resolution);
    const panel = $('garden-preview-panel');
    if (panel) panel.hidden = !showingPreview;
    if (showingPreview) {
      $('garden-preview-prosperity').textContent = `+${summary.prosperity}`;
      $('garden-preview-blooms').textContent = summary.blooms;
      $('garden-preview-chain').textContent = summary.chain;
      $('garden-preview-route').textContent = previewData?.route.length
        ? `授粉路线：心芽 → ${previewData.route.map(pos => `(${pos.x + 1},${pos.y + 1})`).join(' → ')} → 心芽`
        : '未形成可连接的开花路线。';
      const warning = $('garden-preview-warning');
      const fatal = ['heart-lost', 'blight-overrun', 'target-missed'].includes(summary.result);
      warning.hidden = !fatal && summary.heartDamage === 0;
      warning.textContent = fatal
        ? (dangerConfirmArmed ? '再次确认将执行这个危险结果。' : '警告：本次结算会结束本局，需二次确认。')
        : summary.heartDamage > 0 ? `心芽将受到 ${summary.heartDamage} 点伤害。` : '';
    }

    const planning = lifecycle === 'running' && state.phase === 'planning' && !resolution;
    const previewing = lifecycle === 'running' && state.phase === 'preview' && !resolution;
    $('garden-preview-button').hidden = !planning;
    $('garden-preview-button').disabled = planning && [1, 2].includes(tutorialStep(state));
    $('garden-return-planning').hidden = !previewing;
    $('garden-confirm-night').hidden = !previewing;
    $('garden-confirm-night').textContent = dangerConfirmArmed ? '仍然确认入夜' : '确认入夜';
    $('garden-exit').disabled = !!resolution;
    $('garden-playback').hidden = !showingPreview;
    const progress = $('garden-resolution-progress');
    if (progress) progress.hidden = !resolution;
    syncMotionControls();
    renderPaths(previewData);
    decoratePreviewBoard();
    view.render(state, { selectedIndex: state.phase === 'planning' && !resolution ? selectedCellIndex : -1 });
    renderTutorial(state);
  }

  function previewDay() {
    if (lifecycle !== 'running' || run?.phase !== 'planning' || resolution) return;
    const guideStep = tutorialStep(run);
    if (guideStep === 1 || guideStep === 2) {
      announce('先完成当前高亮的教学操作，再预演生态。', true);
      return;
    }
    const stateBefore = run;
    const result = MODEL.dispatch(run, { type: 'preview-day' });
    if (!result.accepted) {
      announce(REASONS[result.reason] || '无法预演今夜生态。', true);
      return;
    }
    run = result.state;
    maybeCompleteTutorialGuide({ type: 'preview-day' }, stateBefore);
    previewEvents = clone(result.events);
    previewData = collectPreviewData(previewEvents, run);
    selectedCardId = null;
    selectedCellIndex = -1;
    moveFromIndex = -1;
    dangerConfirmArmed = false;
    saveRun();
    render();
    view.showPreview(run, previewEvents);
    playSound('preview');
    announce(`预演完成：预计开花 ${run.previewSummary.blooms} 株，授粉连锁 ${run.previewSummary.chain}。`);
    $('garden-confirm-night')?.focus({ preventScroll: true });
  }

  function returnToPlanning() {
    if (lifecycle !== 'running' || run?.phase !== 'preview' || resolution) return;
    const result = MODEL.dispatch(run, { type: 'return-to-planning' });
    if (!result.accepted) {
      announce(REASONS[result.reason] || '无法返回规划。', true);
      return;
    }
    run = result.state;
    clearPreviewPresentation();
    saveRun();
    render();
    announce('已返回规划，你可以继续调整花园。');
    $('garden-preview-button')?.focus({ preventScroll: true });
  }

  function confirmNight() {
    if (lifecycle !== 'running' || run?.phase !== 'preview' || resolution) return;
    const previewSummary = clone(run.previewSummary);
    const fatal = ['heart-lost', 'blight-overrun', 'target-missed'].includes(previewSummary?.result);
    if (fatal && !dangerConfirmArmed) {
      dangerConfirmArmed = true;
      render();
      announce('这次入夜会结束本局。请再次确认，或返回修改。', true);
      return;
    }

    const sourceState = clone(run);
    const expectedEvents = clone(previewEvents);
    const result = MODEL.dispatch(run, { type: 'confirm-night' });
    if (!result.accepted) {
      announce(REASONS[result.reason] || '无法开始生态结算。', true);
      return;
    }

    resolutionDispatchCount += 1;
    savePresentationJournal(sourceState, result.state, result.events);
    clearReportAcknowledgement();
    run = result.state;
    saveRun();
    saveRunMeta();
    selectedCardId = null;
    selectedCellIndex = -1;
    moveFromIndex = -1;
    resolution = {
      sourceState,
      events: clone(result.events),
      expectedEvents,
      previewSummary,
      index: 0,
      elapsed: 0,
      trace: [],
      speedHistory: [playbackSpeed],
      dispatchCount: 1,
      restored: false,
      error: null
    };
    setLifecycle('resolving');
    render();
    view.startResolution(sourceState, resolution.events);
    setMosswingToken(2, 2, true);
    announce('Mosswing 从心芽起飞，正在按事件顺序结算。');
  }

  function eventDuration(item) {
    if (effectiveReducedMotion()) return .012;
    if (item.type === 'mosswing-visited') return .2;
    if (item.type === 'plant-bloomed') return .14;
    if (item.type === 'pollination-started' || item.type === 'chain-completed') return .16;
    if (item.type === 'resource-added' || item.type === 'resource-transferred') return .08;
    if (item.type === 'blight-spawned' || item.type === 'blight-spread' || item.type === 'heart-damaged') return .14;
    return .055;
  }

  function applyAnimationEvent(item) {
    const board = $('garden-board');
    board?.querySelectorAll('.event-active').forEach(node => node.classList.remove('event-active'));
    const x = Number.isInteger(item.x) ? item.x : item.toX;
    const y = Number.isInteger(item.y) ? item.y : item.toY;
    if (Number.isInteger(x) && Number.isInteger(y)) board?.querySelector(`[data-cell-index="${y * CONFIG.boardSize + x}"]`)?.classList.add('event-active');
    if (item.type === 'mosswing-visited') setMosswingToken(item.x, item.y, true);
    else if (item.type === 'pollination-started') setMosswingToken(2, 2, true);
    else if (item.type === 'chain-completed') setMosswingToken(2, 2, true);
    view.applyEvent(item);
    if (item.type === 'resource-added' || item.type === 'resource-transferred') playSound(item.resource === 'water' ? 'water' : 'light');
    else if (item.type === 'plant-bloomed') playSound('bloom');
    else if (item.type === 'mosswing-visited') playSound('pollination', { index: resolution?.index || 0 });
    else if (item.type === 'chain-completed') playSound('chain');
    else if (item.type === 'blight-spawned' || item.type === 'blight-spread') playSound('blight');
    else if (item.type === 'heart-damaged') playSound('heart');
    const eventMessages = {
      'plant-bloomed': '植物开花。',
      'mosswing-visited': `Mosswing 访问第 ${Number(item.x) + 1} 列、第 ${Number(item.y) + 1} 行的花朵。`,
      'chain-completed': `授粉连锁完成，长度 ${item.length ?? item.chainLength ?? ''}。`,
      'blight-spawned': '新的污染已出现。',
      'blight-spread': '污染向相邻土地扩散。',
      'heart-damaged': `心芽受到 ${item.amount || 1} 点伤害。`
    };
    if (eventMessages[item.type]) announceEvent(eventMessages[item.type]);
    resolution.trace.push({ seq: item.seq, type: item.type });
    const progress = (resolution.index + 1) / Math.max(1, resolution.events.length) * 100;
    $('garden-resolution-progress')?.querySelector('i')?.style.setProperty('width', `${progress}%`);
    announce(`${EVENT_LABELS[item.type] || '生态反应继续'} · ${resolution.index + 1}/${resolution.events.length}`);
  }

  function choiceButton(id, title, detail, symbol = '✦') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'garden-choice-option';
    button.dataset.gardenChoiceId = id;
    button.classList.toggle('selected', id === selectedChoiceId);
    button.setAttribute('aria-pressed', String(id === selectedChoiceId));
    button.innerHTML = `<span aria-hidden="true">${symbol}</span><strong>${title}</strong><small>${detail}</small>`;
    return button;
  }

  function renderChoiceOverlay() {
    if (!run || !choiceKind) return;
    const options = $('garden-choice-options');
    const discardSection = $('garden-discard');
    const discardOptions = $('garden-discard-options');
    const confirm = $('garden-choice-confirm');
    const buttons = [];
    if (choiceKind === 'draft') {
      $('garden-choice-title').textContent = `第 ${run.day} 天 · 晨间选种`;
      $('garden-choice-subtitle').textContent = '从3张提案中选择1张加入手牌。其余提案会回到风中。';
      run.offer.forEach(card => buttons.push(choiceButton(card.cardId, CONFIG.plants[card.plantType].name, '加入手牌 · 不消耗行动点', PLANT_SYMBOLS[card.plantType])));
      const requiresDiscard = run.hand.length >= CONFIG.maxHand;
      discardSection.hidden = !requiresDiscard;
      if (requiresDiscard) {
        discardOptions.replaceChildren(...run.hand.map(card => {
          const button = choiceButton(card.cardId, CONFIG.plants[card.plantType].name, '堆肥', PLANT_SYMBOLS[card.plantType]);
          delete button.dataset.gardenChoiceId;
          button.dataset.gardenDiscardId = card.cardId;
          button.classList.toggle('selected', card.cardId === selectedDiscardCardId);
          button.setAttribute('aria-pressed', String(card.cardId === selectedDiscardCardId));
          return button;
        }));
      } else discardOptions.replaceChildren();
      confirm.disabled = !selectedChoiceId || (requiresDiscard && !selectedDiscardCardId);
      confirm.textContent = requiresDiscard ? '选种并堆肥' : '确认选种';
    } else if (choiceKind === 'reward') {
      $('garden-choice-title').textContent = `第 ${run.day} 天 · 生态祝福`;
      $('garden-choice-subtitle').textContent = '选择1个祝福，它会持续到本局结束。';
      run.pending.blessingOffer.forEach(id => buttons.push(choiceButton(id, CONFIG.blessings[id].name, BLESSING_DETAILS[id], '❋')));
      discardSection.hidden = true;
      discardOptions.replaceChildren();
      confirm.disabled = !selectedChoiceId;
      confirm.textContent = '接受祝福';
    } else if (choiceKind === 'mutation') {
      const target = run.board.find(cell => cell.plant?.instanceId === run.pending.mutationInstanceId);
      $('garden-choice-title').textContent = '一株植物回应了花园';
      $('garden-choice-subtitle').textContent = `${target ? CONFIG.plants[target.plant.type].name : '植物'}累计开花3次，请选择本局唯一的突变。`;
      Object.keys(CONFIG.mutations).forEach(id => buttons.push(choiceButton(id, CONFIG.mutations[id].name, MUTATION_DETAILS[id], id === 'vigorous' ? '✦' : '⌾')));
      discardSection.hidden = true;
      discardOptions.replaceChildren();
      confirm.disabled = !selectedChoiceId;
      confirm.textContent = '确认突变';
    }
    options.replaceChildren(...buttons);
  }

  function openChoice(kind = run?.phase) {
    if (!['draft', 'reward', 'mutation'].includes(kind)) return;
    choiceKind = kind;
    selectedChoiceId = null;
    selectedDiscardCardId = null;
    renderChoiceOverlay();
    setLifecycle('choice');
    $('garden-choice-options')?.querySelector('button')?.focus({ preventScroll: true });
  }

  function selectOverlayChoice(id) {
    if (lifecycle !== 'choice') return;
    const valid = choiceKind === 'draft'
      ? run.offer.some(card => card.cardId === id)
      : choiceKind === 'reward'
        ? run.pending.blessingOffer.includes(id)
        : !!CONFIG.mutations[id];
    if (!valid) return;
    selectedChoiceId = id;
    renderChoiceOverlay();
  }

  function selectDiscardChoice(id) {
    if (lifecycle !== 'choice' || choiceKind !== 'draft' || !run.hand.some(card => card.cardId === id)) return;
    selectedDiscardCardId = id;
    renderChoiceOverlay();
  }

  function confirmChoice() {
    if (lifecycle !== 'choice' || !selectedChoiceId) return;
    let command;
    if (choiceKind === 'draft') command = { type: 'choose-draft', cardId: selectedChoiceId, discardCardId: selectedDiscardCardId };
    else if (choiceKind === 'reward') command = { type: 'choose-blessing', blessingId: selectedChoiceId };
    else if (choiceKind === 'mutation') command = { type: 'choose-mutation', mutationId: selectedChoiceId };
    if (!command) return;
    const result = MODEL.dispatch(run, command);
    if (!result.accepted) {
      $('garden-choice-subtitle').textContent = REASONS[result.reason] || `无法选择：${result.reason}`;
      return;
    }
    run = result.state;
    playSound('choice');
    saveRun();
    saveRunMeta();
    choiceKind = null;
    selectedChoiceId = null;
    selectedDiscardCardId = null;
    setLifecycle('running');
    render();
    routePostReport();
  }

  function continueAfterReport() {
    if (lifecycle !== 'report' || !run?.lastReport) return;
    acknowledgeReport(run.lastReport);
    setLifecycle('running');
    render();
    routePostReport();
  }

  function settleResultProfile() {
    const settlement = PROFILE_MODEL.settleRun(profile, run);
    if (!settlement.accepted) return null;
    profile = settlement.profile;
    activeProfileReward = settlement.reward;
    if (settlement.changed) saveProfile();
    return activeProfileReward;
  }

  function contentName(id) {
    return CONFIG.plants[id]?.name || CONFIG.hearts[id]?.name || CONFIG.blessings[id]?.name || id;
  }

  function compendiumCard(id, kind, unlocked, detail) {
    const article = document.createElement('article');
    article.className = `garden-compendium-card${unlocked ? ' unlocked' : ' locked'}`;
    article.dataset.compendiumId = id;
    const symbol = kind === 'plant' ? PLANT_SYMBOLS[id] || '✿' : kind === 'heart' ? '♦' : '✦';
    article.innerHTML = `<span class="garden-compendium-symbol" aria-hidden="true">${unlocked ? symbol : '？'}</span><div><strong>${unlocked ? contentName(id) : '未解锁'}</strong><small>${unlocked ? detail : `固定节点 · ${CONFIG.unlocks[id]?.cost || 0} 枚记忆种子`}</small></div>`;
    return article;
  }

  function renderCompendium() {
    if (!$('garden-compendium-overlay')) return;
    $('garden-compendium-seeds').textContent = profile.memorySeeds;
    $('garden-compendium-footer-seeds').textContent = profile.memorySeeds;
    $('garden-profile-total-runs').textContent = profile.totalRuns;
    $('garden-profile-wins').textContent = profile.wins;
    $('garden-profile-longest').textContent = profile.longestChain;
    $('garden-profile-highest').textContent = profile.highestProsperity;

    const plants = Object.keys(CONFIG.plants).map(id => compendiumCard(id, 'plant', profile.unlockedPlantIds.includes(id), PLANT_DETAILS[id]));
    $('garden-compendium-plants').replaceChildren(...plants);
    const hearts = Object.keys(CONFIG.hearts).map(id => compendiumCard(id, 'heart', profile.unlockedHeartIds.includes(id), HEART_DETAILS[id]));
    $('garden-compendium-hearts').replaceChildren(...hearts);
    const blessings = Object.keys(CONFIG.blessings).map(id => compendiumCard(id, 'blessing', true, BLESSING_DETAILS[id]));
    $('garden-compendium-blessings').replaceChildren(...blessings);

    const unlockNodes = Object.entries(CONFIG.unlocks).map(([id, node]) => {
      const unlocked = PROFILE_MODEL.contentUnlocked(profile, id);
      const prerequisiteMet = !node.prerequisite || PROFILE_MODEL.contentUnlocked(profile, node.prerequisite);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `garden-unlock-node${unlocked ? ' unlocked' : ''}`;
      button.dataset.gardenUnlockId = id;
      button.disabled = unlocked || !prerequisiteMet || profile.memorySeeds < node.cost;
      const status = unlocked
        ? '已解锁'
        : !prerequisiteMet ? `需要先解锁${contentName(node.prerequisite)}`
          : profile.memorySeeds < node.cost ? `还差 ${node.cost - profile.memorySeeds} 枚`
            : '可以解锁';
      button.innerHTML = `<strong>${contentName(id)}</strong><span>${node.cost} 枚</span><small>${status}</small>`;
      return button;
    });
    $('garden-unlock-grid').replaceChildren(...unlockNodes);

    const taskItems = Object.keys(CONFIG.tasks).map(id => {
      const item = document.createElement('li');
      const complete = profile.completedTaskIds.includes(id);
      item.className = complete ? 'complete' : '';
      item.textContent = `${complete ? '✓' : '○'} ${CONFIG.tasks[id].name}`;
      return item;
    });
    $('garden-compendium-tasks').replaceChildren(...taskItems);
    const replay = $('garden-tutorial-replay');
    const unfinished = !!run && run.phase !== 'result';
    replay.disabled = unfinished;
    replay.textContent = unfinished ? '先完成当前花园再重玩教学' : '重新体验四步教学';
    $('garden-compendium-message').textContent = '';
  }

  function openCompendium(trigger = null) {
    compendiumReturnFocus = trigger || document.activeElement;
    renderCompendium();
    const overlay = $('garden-compendium-overlay');
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    const shell = overlay.querySelector('.garden-compendium-card-shell');
    if (shell) shell.scrollTop = 0;
    ['garden-setup', 'garden-mode', 'garden-result-overlay'].forEach(id => {
      const node = $(id);
      if (node) node.inert = true;
    });
    $('garden-compendium-close')?.focus({ preventScroll: true });
  }

  function closeCompendium() {
    const overlay = $('garden-compendium-overlay');
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    $('garden-setup').inert = false;
    $('garden-result-overlay').inert = false;
    $('garden-mode').inert = ['paused', 'report', 'choice', 'result'].includes(lifecycle);
    compendiumReturnFocus?.focus?.({ preventScroll: true });
    compendiumReturnFocus = null;
  }

  function unlockFromCompendium(id) {
    const result = PROFILE_MODEL.unlock(profile, id);
    if (!result.accepted) {
      $('garden-compendium-message').textContent = PROFILE_REASONS[result.reason] || '暂时无法解锁。';
      return;
    }
    profile = result.profile;
    saveProfile();
    playSound('unlock');
    renderSetup();
    renderCompendium();
    $('garden-compendium-message').textContent = `${contentName(id)}已加入收藏；正在进行的花园卡池保持不变。`;
  }

  function replayTutorial() {
    if (run && run.phase !== 'result') return;
    closeCompendium();
    selectedHeartId = 'balanced';
    selectedPlantIds = CONFIG.basePlants.slice();
    createAndStartRun('tutorial');
  }

  function openResult() {
    if (!run || run.phase !== 'result') return;
    const reward = settleResultProfile();
    const messages = {
      win: ['花园与风达成了平衡。', `你在第12天达到 ${run.prosperity} 繁荣。`],
      'heart-lost': ['心芽沉入了长夜。', '污染抵达心芽附近，生命降到了0。'],
      'blight-overrun': ['污染覆盖了浮岛。', `污染达到 ${CONFIG.blightLossCount} 格；下一次要更早腾出行动清理。`],
      'target-missed': ['花园还差一点回应。', `第12天结束时需要 ${run.tutorial ? CONFIG.tutorialTargetProsperity : CONFIG.targetProsperity} 繁荣，本局达到 ${run.prosperity}。`]
    };
    const [title, message] = messages[run.result] || ['本局结束', '花园已完成结算。'];
    const titleNode = $('garden-result-title');
    titleNode.textContent = title;
    titleNode.className = run.result === 'win' ? 'garden-result-win' : 'garden-result-loss';
    $('garden-result-message').textContent = message;
    $('garden-result-prosperity').textContent = `${run.prosperity}/${run.tutorial ? CONFIG.tutorialTargetProsperity : CONFIG.targetProsperity}`;
    $('garden-result-days').textContent = run.stats.daysResolved;
    $('garden-result-chain').textContent = run.longestChain;
    $('garden-result-blooms').textContent = run.stats.totalBlooms;
    $('garden-result-cleared').textContent = run.stats.blightCleared;
    $('garden-result-hp').textContent = `${run.heart.hp}/${run.heart.maxHp}`;
    $('garden-result-build').textContent = `本局构筑：${CONFIG.hearts[run.heart.id].name} · ${run.runPoolSnapshot.map(id => CONFIG.plants[id].name).join(' / ')}`;
    $('garden-result-blessings').textContent = `生态祝福：${run.blessings.length ? run.blessings.map(id => CONFIG.blessings[id].name).join(' / ') : '无'}`;
    const taskRewardNames = reward?.taskIds?.map(id => CONFIG.tasks[id].name) || [];
    $('garden-result-reward').textContent = reward
      ? `本局获得记忆种子 +${reward.totalReward}（结局 ${reward.baseReward}${reward.taskReward ? ` · 首次任务 ${reward.taskReward}` : ''}）`
      : '本局没有发放记忆种子。';
    $('garden-result-unlocks').textContent = taskRewardNames.length
      ? `首次完成：${taskRewardNames.join(' / ')}。前往图鉴选择固定解锁节点。`
      : '本局没有自动解锁；可在图鉴使用记忆种子选择节点。';
    setLifecycle('result');
    if (resultCueRunId !== run.runId) {
      playSound(run.result === 'win' ? 'victory' : 'defeat');
      resultCueRunId = run.runId;
    }
    $('garden-result-retry')?.focus({ preventScroll: true });
  }

  function routePostReport() {
    if (!run) return;
    if (run.phase === 'draft' || run.phase === 'reward' || run.phase === 'mutation') {
      openChoice(run.phase);
      return;
    }
    if (run.phase === 'result') {
      openResult();
      return;
    }
    setLifecycle('running');
    render();
    if (run.phase === 'preview') restorePreviewPresentation();
    $('garden-board')?.querySelector('button')?.focus({ preventScroll: true });
  }

  function retryRun() {
    if (!run || run.phase !== 'result') return;
    const previousSeed = run.seed;
    selectedHeartId = run.heart.id;
    selectedPlantIds = run.runPoolSnapshot.slice();
    createAndStartRun(currentRunKind, previousSeed);
  }

  function openReport(report = run?.lastReport) {
    if (!report) return;
    $('garden-report-title').textContent = run?.result ? '本局的花园已完成结算。' : '今夜，花园醒来了。';
    $('garden-report-subtitle').textContent = `第${report.day}天生态日报`;
    $('garden-report-gained').textContent = `+${report.prosperity}`;
    $('garden-report-total').textContent = report.totalProsperity;
    $('garden-report-blooms').textContent = report.blooms;
    $('garden-report-chain').textContent = report.chain;
    $('garden-report-damage').textContent = report.heartDamage;
    $('garden-report-blight').textContent = report.blightAdded;
    $('garden-report-note').textContent = lastResolution?.error
      ? '个别动画事件显示失败，已使用完整的模型结果进入日报。'
      : report.heartDamage > 0 ? '心芽受到了伤害；下一天可优先清理相邻污染。' : report.blightAdded > 0 ? '污染正在扩张；清除一格污染需要2行动点。' : '生态结果已安全保存，可以继续下一阶段。';
    const continueButton = $('garden-report-continue');
    continueButton.textContent = run?.phase === 'result' ? '查看本局结果' : run?.phase === 'reward' ? '选择生态祝福' : run?.phase === 'mutation' ? '选择植物突变' : `进入第 ${run?.day || report.day + 1} 天`;
    setLifecycle('report');
    continueButton.focus({ preventScroll: true });
  }

  function finalizeResolution(error = null) {
    if (!resolution) return;
    const snapshot = resolution;
    snapshot.error = error ? String(error.message || error) : null;
    const actual = snapshot.trace;
    const expected = snapshot.expectedEvents.map(item => ({ seq: item.seq, type: item.type }));
    const report = run.lastReport;
    lastResolution = {
      previewSummary: clone(snapshot.previewSummary),
      report: clone(report),
      summaryMatches: summariesMatch(snapshot.previewSummary, report),
      expectedTrace: expected,
      actualTrace: clone(actual),
      eventOrderMatches: JSON.stringify(expected) === JSON.stringify(actual),
      dispatchCount: snapshot.dispatchCount,
      totalDispatchCount: resolutionDispatchCount,
      speedHistory: snapshot.speedHistory.slice(),
      reducedMotion: effectiveReducedMotion(),
      restored: snapshot.restored === true,
      error: snapshot.error,
      finalState: clone(run)
    };
    resolution = null;
    clearPresentationJournal();
    clearPreviewPresentation();
    $('garden-board')?.querySelectorAll('.event-active').forEach(node => node.classList.remove('event-active'));
    render();
    view.finishResolution(run);
    setMosswingToken(2, 2, true);
    openReport(report);
  }

  function advanceResolution(dt) {
    if (!resolution) return;
    resolution.elapsed += Math.max(0, dt) * playbackSpeed;
    try {
      while (resolution && resolution.index < resolution.events.length) {
        const item = resolution.events[resolution.index];
        const duration = eventDuration(item);
        if (resolution.elapsed < duration) break;
        resolution.elapsed -= duration;
        applyAnimationEvent(item);
        resolution.index += 1;
      }
      if (resolution && resolution.index >= resolution.events.length) finalizeResolution();
    } catch (error) {
      finalizeResolution(error);
    }
  }

  function setPlaybackSpeed(speed) {
    if (![1, 3].includes(speed)) return;
    if (playbackSpeed !== speed) {
      playbackSpeed = speed;
      if (resolution) resolution.speedHistory.push(speed);
    }
    syncMotionControls();
  }

  function toggleReducedMotion() {
    if (systemReducedMotion) return;
    userReducedMotion = !userReducedMotion;
    syncMotionControls();
  }

  function selectCard(cardId) {
    if (lifecycle !== 'running' || run?.phase !== 'planning' || resolution || !run.hand.some(card => card.cardId === cardId)) return;
    const card = run.hand.find(item => item.cardId === cardId);
    const guideStep = tutorialStep(run);
    if ((guideStep === 1 && card.plantType !== 'sunflower') || (guideStep === 2 && card.plantType !== 'dewcup') || guideStep === 3) {
      announce('请先完成当前高亮的教学操作。', true);
      return;
    }
    selectedCardId = selectedCardId === cardId ? null : cardId;
    moveFromIndex = -1;
    selectedCellIndex = -1;
    announce(selectedCardId ? '已选手牌，现在选一个空格。' : '已取消手牌选择。');
    render();
  }

  function selectCell(index) {
    if (lifecycle !== 'running' || run?.phase !== 'planning' || resolution || index < 0 || index >= run.board.length) return;
    const cell = run.board[index];
    if (moveFromIndex >= 0) {
      const from = run.board[moveFromIndex];
      if (index === moveFromIndex) {
        moveFromIndex = -1;
        announce('已取消移动。');
        render();
        return;
      }
      const moved = dispatch({ type: 'move', fromX: from.x, fromY: from.y, toX: cell.x, toY: cell.y }, '植物已移动。');
      if (moved) {
        moveFromIndex = -1;
        selectedCellIndex = index;
      }
      render();
      return;
    }
    if (selectedCardId) {
      const guideStep = tutorialStep(run);
      if ((guideStep === 1 && index !== 7) || (guideStep === 2 && index !== 2) || guideStep === 3) {
        announce('请把当前教学植物种到高亮格。', true);
        return;
      }
      const planted = dispatch({ type: 'plant', cardId: selectedCardId, x: cell.x, y: cell.y }, '植物已种下。');
      if (planted) {
        selectedCardId = null;
        selectedCellIndex = index;
      }
      render();
      return;
    }
    selectedCellIndex = selectedCellIndex === index ? -1 : index;
    render();
  }

  function rotateSelected() {
    if (lifecycle !== 'running' || run?.phase !== 'planning' || resolution) return;
    const guideStep = tutorialStep(run);
    if (guideStep > 0 && (guideStep !== 2 || selectedCellIndex !== 2)) return announce('请先选中高亮的露杯草并旋转一次。', true);
    const cell = run?.board[selectedCellIndex];
    if (!cell) return announce('请先选中一株可旋转的植物。', true);
    dispatch({ type: 'rotate', x: cell.x, y: cell.y }, '植物已顺时针旋转 90°。');
  }

  function toggleMove() {
    if (lifecycle !== 'running' || run?.phase !== 'planning' || resolution) return;
    if ([1, 2, 3].includes(tutorialStep(run))) return announce('完成前三步教学后即可自由移动植物。', true);
    const cell = run?.board[selectedCellIndex];
    if (!cell?.plant) return announce('请先选中一株植物。', true);
    moveFromIndex = moveFromIndex >= 0 ? -1 : selectedCellIndex;
    selectedCardId = null;
    announce(moveFromIndex >= 0 ? '请选择一个正交相邻的空格。' : '已取消移动。');
    render();
  }

  function cleanSelected() {
    if (lifecycle !== 'running' || run?.phase !== 'planning' || resolution) return;
    if ([1, 2, 3].includes(tutorialStep(run))) return announce('第一格污染出现后，教学会开放清理。', true);
    const cell = run?.board[selectedCellIndex];
    if (!cell?.blight) return announce('请先选中一格污染。', true);
    if (dispatch({ type: 'clean', x: cell.x, y: cell.y }, '污染已清除，花园恢复了一块土地。')) {
      selectedCellIndex = -1;
      render();
    }
  }

  function useSelectedHeartAbility(resource = null) {
    if (lifecycle !== 'running' || run?.phase !== 'planning' || resolution) return;
    if ([1, 2, 3].includes(tutorialStep(run))) return announce('完成前三步教学后即可自由使用心芽能力。', true);
    const cell = run?.board[selectedCellIndex];
    if (!cell?.plant) return announce('请先选择心芽能力要影响的成熟植物。', true);
    const payload = { x: cell.x, y: cell.y };
    if (run.heart.id === 'balanced') payload.resource = resource;
    dispatch({ type: 'heart-ability', payload }, `${CONFIG.hearts[run.heart.id].name}的能力已作用于${CONFIG.plants[cell.plant.type].name}。`);
  }

  function undo() {
    if (lifecycle !== 'running' || run?.phase !== 'planning' || resolution) return;
    if (dispatch({ type: 'undo-day' }, '已回到当日黎明状态。')) {
      selectedCardId = null;
      selectedCellIndex = -1;
      moveFromIndex = -1;
      render();
    }
  }

  function handleClick(event) {
    const runKind = event.target.closest('[data-garden-run-kind]');
    if (runKind) {
      selectedRunKind = runKind.dataset.gardenRunKind;
      renderSetup();
      return;
    }
    const heart = event.target.closest('[data-garden-heart]');
    if (heart) {
      selectedHeartId = heart.dataset.gardenHeart;
      renderSetup();
      return;
    }
    const plant = event.target.closest('[data-garden-plant]');
    if (plant) {
      const id = plant.dataset.gardenPlant;
      if (selectedPlantIds.includes(id)) selectedPlantIds = selectedPlantIds.filter(item => item !== id);
      else if (selectedPlantIds.length < CONFIG.runPoolSize) selectedPlantIds.push(id);
      else announce(`已选满 ${CONFIG.runPoolSize} 种，请先取消一种。`, true);
      renderSetup();
      return;
    }
    const speed = event.target.closest('[data-garden-speed]');
    if (speed) return setPlaybackSpeed(Number(speed.dataset.gardenSpeed));
    const choice = event.target.closest('[data-garden-choice-id]');
    if (choice) return selectOverlayChoice(choice.dataset.gardenChoiceId);
    const discard = event.target.closest('[data-garden-discard-id]');
    if (discard) return selectDiscardChoice(discard.dataset.gardenDiscardId);
    const card = event.target.closest('[data-card-id]');
    if (card) return selectCard(card.dataset.cardId);
    const cell = event.target.closest('[data-cell-index]');
    if (cell) return selectCell(Number(cell.dataset.cellIndex));
  }

  function handleCompendiumClick(event) {
    const unlock = event.target.closest('[data-garden-unlock-id]');
    if (unlock) unlockFromCompendium(unlock.dataset.gardenUnlockId);
  }

  function dismissTutorialNotice() {
    tutorialCompletionNotice = false;
    render();
    $('garden-preview-button')?.focus({ preventScroll: true });
  }

  function activeModal() {
    if (!$('garden-compendium-overlay')?.hidden) return $('garden-compendium-overlay');
    if (!$('garden-pause-overlay')?.hidden) return $('garden-pause-overlay');
    if (lifecycle === 'report') return $('garden-report');
    if (lifecycle === 'choice') return $('garden-choice-overlay');
    if (lifecycle === 'result') return $('garden-result-overlay');
    return null;
  }

  function trapModalFocus(event, modal) {
    if (event.code !== 'Tab' || !modal) return false;
    const focusable = [...modal.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(node => !node.hidden && node.getClientRects().length && !node.closest('[inert]'));
    if (!focusable.length) return false;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
      return true;
    }
    if (!modal.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }

  function handleKeydown(event) {
    const modal = activeModal();
    if (trapModalFocus(event, modal)) return;
    if (!$('garden-compendium-overlay')?.hidden) {
      if (event.code === 'Escape') {
        event.preventDefault();
        closeCompendium();
      }
      return;
    }
    if (!['setup', 'running', 'resolving', 'paused'].includes(lifecycle)) return;
    if (lifecycle === 'paused') {
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        resume();
      }
      return;
    }
    if (lifecycle === 'resolving') {
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        pause();
      }
      return;
    }
    if (lifecycle === 'setup') {
      if (event.code === 'Escape') {
        event.preventDefault();
        exit();
      }
      return;
    }
    if (run?.phase === 'preview' && event.code === 'Escape') {
      event.preventDefault();
      returnToPlanning();
      return;
    }
    if (run?.phase === 'preview' && event.code === 'KeyP') {
      event.preventDefault();
      pause();
      return;
    }
    if (run?.phase !== 'planning') return;
    if (event.code === 'KeyZ' && !event.repeat) {
      event.preventDefault();
      undo();
    } else if (event.code === 'KeyR' && !event.repeat) {
      event.preventDefault();
      rotateSelected();
    } else if (event.code === 'Escape' || event.code === 'KeyP') {
      event.preventDefault();
      pause();
    } else if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.code)) {
      const active = document.activeElement?.closest?.('[data-cell-index]');
      if (!active) return;
      event.preventDefault();
      const index = Number(active.dataset.cellIndex);
      const delta = { ArrowUp: -5, ArrowRight: 1, ArrowDown: 5, ArrowLeft: -1 }[event.code];
      const target = index + delta;
      if (target < 0 || target >= 25 || (event.code === 'ArrowRight' && index % 5 === 4) || (event.code === 'ArrowLeft' && index % 5 === 0)) return;
      $('garden-board')?.querySelector(`[data-cell-index="${target}"]`)?.focus({ preventScroll: true });
    }
  }

  function buildBoard() {
    const board = $('garden-board');
    if (!board || board.children.length) return;
    for (let index = 0; index < 25; index++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'garden-cell';
      button.dataset.cellIndex = String(index);
      board.append(button);
    }
  }

  function mount(nextContext) {
    if (mounted) return;
    if (!MODEL || !CONFIG || !PROFILE_MODEL || !VIEW) throw new Error('Garden modules failed to load');
    context = nextContext;
    profile = loadProfile();
    selectedPlantIds = CONFIG.basePlants.slice();
    buildBoard();
    view = VIEW.create(context);
    listen($('garden-setup'), 'click', handleClick);
    listen($('garden-mode'), 'click', handleClick);
    listen($('garden-choice-overlay'), 'click', handleClick);
    listen($('garden-compendium-overlay'), 'click', handleCompendiumClick);
    listen(document, 'keydown', handleKeydown);
    listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        saveRun();
        saveRunMeta();
      }
    });
    listen($('garden-begin'), 'click', startNewRun);
    listen($('garden-continue'), 'click', resumeSavedRun);
    listen($('garden-setup-back'), 'click', exit);
    listen($('garden-exit'), 'click', exit);
    listen($('garden-rotate'), 'click', rotateSelected);
    listen($('garden-move'), 'click', toggleMove);
    listen($('garden-clean'), 'click', cleanSelected);
    listen($('garden-heart-light'), 'click', () => useSelectedHeartAbility('light'));
    listen($('garden-heart-water'), 'click', () => useSelectedHeartAbility('water'));
    listen($('garden-undo'), 'click', undo);
    listen($('garden-preview-button'), 'click', previewDay);
    listen($('garden-return-planning'), 'click', returnToPlanning);
    listen($('garden-confirm-night'), 'click', confirmNight);
    listen($('garden-reduced-motion'), 'click', toggleReducedMotion);
    listen($('garden-pause'), 'click', pause);
    listen($('garden-resume'), 'click', resume);
    listen($('garden-pause-home'), 'click', exit);
    listen($('garden-report-home'), 'click', exit);
    listen($('garden-report-continue'), 'click', continueAfterReport);
    listen($('garden-choice-confirm'), 'click', confirmChoice);
    listen($('garden-choice-home'), 'click', exit);
    listen($('garden-result-retry'), 'click', retryRun);
    listen($('garden-result-home'), 'click', exit);
    listen($('garden-compendium-open'), 'click', event => openCompendium(event.currentTarget));
    listen($('garden-result-compendium'), 'click', event => openCompendium(event.currentTarget));
    listen($('garden-compendium-close'), 'click', closeCompendium);
    listen($('garden-tutorial-replay'), 'click', replayTutorial);
    listen($('garden-tutorial-dismiss'), 'click', dismissTutorialNotice);
    mounted = true;
    setupLabel();
    syncMotionControls();
  }

  function update(dt) {
    if (lifecycle === 'running' || lifecycle === 'resolving') view?.update(dt, playbackSpeed);
    if (lifecycle === 'resolving') advanceResolution(dt);
  }

  function resize(worldWidth, worldHeight) {
    view?.resize(worldWidth, worldHeight);
  }

  function destroy() {
    if (!mounted) return;
    saveRun();
    saveRunMeta();
    $('garden-pause-overlay').hidden = true;
    closeCompendium();
    resetPresentation();
    while (listeners.length) listeners.pop()();
    listenerCount = 0;
    view?.destroy();
    view = null;
    context = null;
    run = null;
    mounted = false;
    setLifecycle('idle');
  }

  function getDebugState() {
    return Object.freeze({
      mounted,
      lifecycle,
      listenerCount,
      selectedHeartId,
      selectedPlantIds: selectedPlantIds.slice(),
      selectedRunKind,
      currentRunKind,
      tutorialStep: tutorialStep(),
      tutorialGuideComplete,
      compendiumOpen: !$('garden-compendium-overlay')?.hidden,
      profile: clone(profile),
      profileReward: clone(activeProfileReward),
      selectedCardId,
      selectedCellIndex,
      moveFromIndex,
      playbackSpeed,
      reducedMotion: effectiveReducedMotion(),
      preview: run?.phase === 'preview' ? {
        summary: clone(run.previewSummary),
        eventTrace: previewEvents.map(item => ({ seq: item.seq, type: item.type })),
        routeLength: previewData?.route.length || 0
      } : null,
      resolution: resolution ? {
        index: resolution.index,
        total: resolution.events.length,
        trace: clone(resolution.trace),
        speedHistory: resolution.speedHistory.slice(),
        dispatchCount: resolution.dispatchCount,
        restored: resolution.restored === true
      } : null,
      choice: choiceKind ? { kind: choiceKind, selectedChoiceId, selectedDiscardCardId } : null,
      lastResolution: clone(lastResolution),
      resolutionDispatchCount,
      recoveredResolutionCount,
      storageAvailable,
      muted: context?.isMuted?.() === true,
      audio: context?.getAudioDebug?.() || null,
      reportAcknowledged: reportIsAcknowledged(),
      view: view?.getDebugState?.() || null,
      run: clone(run)
    });
  }

  globalThis.GardenMode = Object.freeze({ mount, enter, pause, resume, exit, destroy, update, resize, getDebugState });
})();
