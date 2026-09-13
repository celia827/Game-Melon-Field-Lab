'use strict';

// Pure profile progression. This module intentionally has no DOM, storage,
// clock, or ambient randomness so rewards and unlocks stay deterministic.
(() => {
  const CONFIG = globalThis.MOSSWING_GARDEN_CONFIG || (typeof require !== 'undefined' ? require('./garden-config.js') : null);
  const SETTLEMENT_HISTORY_LIMIT = 64;
  const RESULT_IDS = new Set(['win', 'heart-lost', 'blight-overrun', 'target-missed']);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function nonNegativeInteger(value, fallback = 0) {
    return Number.isInteger(value) && value >= 0 ? value : fallback;
  }

  function defaultProfile() {
    return {
      schemaVersion: 1,
      unlockedPlantIds: CONFIG.basePlants.slice(),
      unlockedHeartIds: ['balanced'],
      memorySeeds: 0,
      totalRuns: 0,
      wins: 0,
      highestProsperity: 0,
      longestChain: 0,
      completedTaskIds: [],
      tutorialComplete: false,
      settledRuns: []
    };
  }

  function normalizeSettlement(value) {
    if (!value || typeof value !== 'object' || typeof value.runId !== 'string' || !value.runId.trim()) return null;
    if (!RESULT_IDS.has(value.result)) return null;
    const taskIds = [...new Set((Array.isArray(value.taskIds) ? value.taskIds : []).filter(id => CONFIG.tasks[id]))];
    const baseReward = nonNegativeInteger(value.baseReward);
    const taskReward = nonNegativeInteger(value.taskReward);
    const totalReward = nonNegativeInteger(value.totalReward);
    if (taskReward !== taskIds.length || totalReward !== baseReward + taskReward) return null;
    return {
      runId: value.runId,
      result: value.result,
      daysResolved: nonNegativeInteger(value.daysResolved),
      baseReward,
      taskReward,
      totalReward,
      taskIds
    };
  }

  function normalize(value) {
    if (!value || value.schemaVersion !== 1) return defaultProfile();
    const profile = defaultProfile();
    profile.unlockedPlantIds = [...new Set((Array.isArray(value.unlockedPlantIds) ? value.unlockedPlantIds : []).filter(id => CONFIG.plants[id]))];
    CONFIG.basePlants.forEach(id => {
      if (!profile.unlockedPlantIds.includes(id)) profile.unlockedPlantIds.push(id);
    });
    profile.unlockedHeartIds = [...new Set((Array.isArray(value.unlockedHeartIds) ? value.unlockedHeartIds : []).filter(id => CONFIG.hearts[id]))];
    if (!profile.unlockedHeartIds.includes('balanced')) profile.unlockedHeartIds.unshift('balanced');
    let removedInvalidUnlock = true;
    while (removedInvalidUnlock) {
      removedInvalidUnlock = false;
      for (const id of [...profile.unlockedPlantIds, ...profile.unlockedHeartIds]) {
        const prerequisite = CONFIG.unlocks[id]?.prerequisite;
        const prerequisiteUnlocked = !prerequisite || profile.unlockedPlantIds.includes(prerequisite) || profile.unlockedHeartIds.includes(prerequisite);
        if (prerequisiteUnlocked || CONFIG.basePlants.includes(id) || id === 'balanced') continue;
        profile.unlockedPlantIds = profile.unlockedPlantIds.filter(candidate => candidate !== id);
        profile.unlockedHeartIds = profile.unlockedHeartIds.filter(candidate => candidate !== id);
        removedInvalidUnlock = true;
      }
    }
    profile.memorySeeds = nonNegativeInteger(value.memorySeeds);
    profile.totalRuns = nonNegativeInteger(value.totalRuns);
    profile.wins = Math.min(nonNegativeInteger(value.wins), profile.totalRuns);
    profile.highestProsperity = nonNegativeInteger(value.highestProsperity);
    profile.longestChain = nonNegativeInteger(value.longestChain);
    profile.completedTaskIds = [...new Set((Array.isArray(value.completedTaskIds) ? value.completedTaskIds : []).filter(id => CONFIG.tasks[id]))];
    profile.tutorialComplete = value.tutorialComplete === true;
    const settlements = [];
    const seenRunIds = new Set();
    for (const item of Array.isArray(value.settledRuns) ? value.settledRuns : []) {
      const settlement = normalizeSettlement(item);
      if (!settlement || seenRunIds.has(settlement.runId)) continue;
      seenRunIds.add(settlement.runId);
      settlements.push(settlement);
    }
    profile.settledRuns = settlements.slice(-SETTLEMENT_HISTORY_LIMIT);
    return profile;
  }

  function startRun(value) {
    const profile = normalize(value);
    profile.totalRuns += 1;
    return profile;
  }

  function completeTutorial(value) {
    const profile = normalize(value);
    profile.tutorialComplete = true;
    return profile;
  }

  function contentUnlocked(profile, id) {
    return !!CONFIG.plants[id]
      ? profile.unlockedPlantIds.includes(id)
      : !!CONFIG.hearts[id] && profile.unlockedHeartIds.includes(id);
  }

  function unlock(value, id) {
    const profile = normalize(value);
    const node = CONFIG.unlocks[id];
    if (!node || (!CONFIG.plants[id] && !CONFIG.hearts[id])) return { accepted: false, reason: 'unknown-unlock', profile };
    if (contentUnlocked(profile, id)) return { accepted: false, reason: 'already-unlocked', profile };
    if (node.prerequisite && !contentUnlocked(profile, node.prerequisite)) {
      return { accepted: false, reason: 'prerequisite-locked', prerequisite: node.prerequisite, profile };
    }
    if (profile.memorySeeds < node.cost) return { accepted: false, reason: 'not-enough-memory-seeds', profile };
    profile.memorySeeds -= node.cost;
    if (CONFIG.plants[id]) profile.unlockedPlantIds.push(id);
    else profile.unlockedHeartIds.push(id);
    return { accepted: true, reason: null, profile };
  }

  function settleRun(value, run) {
    const profile = normalize(value);
    if (!run || run.phase !== 'result' || !RESULT_IDS.has(run.result) || typeof run.runId !== 'string' || !run.runId.trim()) {
      return { accepted: false, changed: false, reason: 'run-not-finished', profile, reward: null };
    }
    const existing = profile.settledRuns.find(item => item.runId === run.runId);
    if (existing) return { accepted: true, changed: false, reason: null, profile, reward: clone(existing) };

    const daysResolved = nonNegativeInteger(run.stats?.daysResolved);
    const completedInRun = [...new Set((Array.isArray(run.tasks) ? run.tasks : [])
      .filter(task => task?.completed === true && CONFIG.tasks[task.id])
      .map(task => task.id))];
    const firstTaskIds = completedInRun.filter(id => !profile.completedTaskIds.includes(id));
    const baseReward = run.result === 'win' ? 3 : daysResolved >= 6 ? 1 : 0;
    const reward = {
      runId: run.runId,
      result: run.result,
      daysResolved,
      baseReward,
      taskReward: firstTaskIds.length,
      totalReward: baseReward + firstTaskIds.length,
      taskIds: firstTaskIds
    };

    profile.memorySeeds += reward.totalReward;
    if (run.result === 'win') profile.wins += 1;
    profile.highestProsperity = Math.max(profile.highestProsperity, nonNegativeInteger(run.prosperity));
    profile.longestChain = Math.max(profile.longestChain, nonNegativeInteger(run.longestChain));
    profile.completedTaskIds.push(...firstTaskIds);
    profile.completedTaskIds = [...new Set(profile.completedTaskIds)];
    profile.settledRuns.push(reward);
    profile.settledRuns = profile.settledRuns.slice(-SETTLEMENT_HISTORY_LIMIT);
    return { accepted: true, changed: true, reason: null, profile, reward: clone(reward) };
  }

  const GardenProfile = Object.freeze({
    defaultProfile,
    normalize,
    startRun,
    completeTutorial,
    unlock,
    settleRun,
    contentUnlocked
  });

  if (typeof globalThis !== 'undefined') globalThis.MosswingGardenProfile = GardenProfile;
  if (typeof module !== 'undefined') module.exports = GardenProfile;
})();
