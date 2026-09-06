'use strict';

// Chapter data is shared by the browser build and the deterministic physics checks.
// Visual fields are intentionally data-only; decorative scenery never enters collision.
const MOSSWING_CHAPTERS = [
  {
    id: 'garden', name: '浮岛花园', subtitle: '天空花海', swatch: '#e99b63', seed: 1101,
    palette: { sky: ['#f7c798', '#f8e2b6', '#b6caa3'], fog: 0xd9d9b6, sun: 0xffe8af, hemiSky: 0xfff5df, hemiGround: 0x6f9271, key: 0xffe1b5, fill: 0xe8f3c5, pillar: 0x739675, pillarTop: 0xabc27b, island: 0x7d9b78, islandTop: 0xaac27c, accent: 0xf4b36c, leaf: 0x8eaa5e, particle: [0xffedb1, 0xfff3cf] },
    scenery: { mode: 'garden', count: 84, direction: [-.2, .06], density: 1 },
    physics: { speed: 2.48, speedRamp: .01, gravity: 17.6, flap: 5.95, wind: .04, gapMin: 1.68, gapMax: 1.9, moveAmplitude: .18, moveFrequency: .34, pulseMin: 1.68, pulseAmount: .08, centerRange: 1.2, pattern: ['standard', 'standard', 'bonus', 'moving', 'standard', 'bonus', 'standard', 'standard'], duration: 45, gateCount: 24 }
  },
  {
    id: 'canyon', name: '风之峡谷', subtitle: '风蚀石壁', swatch: '#c97843', seed: 2202,
    palette: { sky: ['#9c795f', '#c69a72', '#6c7d84'], fog: 0x88949a, sun: 0xffc783, hemiSky: 0xffd4a5, hemiGround: 0x445762, key: 0xffbd79, fill: 0x8fa3a8, pillar: 0x8e6959, pillarTop: 0xc08a5b, island: 0x735d59, islandTop: 0xa97755, accent: 0xd58a4e, leaf: 0x777b6d, particle: [0xf0bd82, 0xb77d5d] },
    scenery: { mode: 'canyon', count: 110, direction: [-1.05, .02], density: 1.15 },
    physics: { speed: 2.7, speedRamp: .012, gravity: 18.2, flap: 6.08, wind: .16, gapMin: 1.6, gapMax: 1.82, moveAmplitude: .3, moveFrequency: .42, pulseMin: 1.6, pulseAmount: .06, centerRange: 1.25, pattern: ['standard', 'wind', 'bonus', 'moving', 'wind', 'standard', 'bonus', 'standard'], duration: 60, gateCount: 34 }
  },
  {
    id: 'rainforest', name: '雨林温室', subtitle: '潮湿荧光', swatch: '#29a99a', seed: 3303,
    palette: { sky: ['#0a4b50', '#126c68', '#123b42'], fog: 0x1f6a68, sun: 0x8fe1c2, hemiSky: 0x9fe9d0, hemiGround: 0x102f34, key: 0x78d9b5, fill: 0x3a9f8e, pillar: 0x236e68, pillarTop: 0x51a88a, island: 0x174d4a, islandTop: 0x37866f, accent: 0x6ce4bd, leaf: 0x277f67, particle: [0x9ee9df, 0xd0fff1] },
    scenery: { mode: 'rainforest', count: 132, direction: [-.12, -1.4], density: 1.45 },
    physics: { speed: 2.58, speedRamp: .011, gravity: 18.1, flap: 6.02, wind: .06, gapMin: 1.54, gapMax: 1.76, moveAmplitude: .2, moveFrequency: .55, pulseMin: 1.54, pulseAmount: .1, centerRange: 1.2, pattern: ['standard', 'pulse', 'bonus', 'moving', 'wind', 'pulse', 'bonus', 'standard'], duration: 75, gateCount: 42 }
  },
  {
    id: 'ruins', name: '月光遗迹', subtitle: '古代石构', swatch: '#8399c7', seed: 4404,
    palette: { sky: ['#141d4d', '#29366d', '#4a5874'], fog: 0x5e6680, sun: 0xdce6ff, hemiSky: 0xaabcf0, hemiGround: 0x202841, key: 0xc8d7ff, fill: 0x738bb4, pillar: 0x737889, pillarTop: 0xa3a8af, island: 0x4e596b, islandTop: 0x89909b, accent: 0x8fc8b3, leaf: 0x527d78, particle: [0xdce7ff, 0x9fc8d4] },
    scenery: { mode: 'ruins', count: 72, direction: [-.08, .03], density: .9 },
    physics: { speed: 2.26, speedRamp: .008, gravity: 17.1, flap: 5.82, wind: .025, gapMin: 1.84, gapMax: 2.04, moveAmplitude: .16, moveFrequency: .22, pulseMin: 1.84, pulseAmount: .04, centerRange: .98, pattern: ['moving', 'bonus', 'standard', 'moving', 'wind', 'standard', 'bonus', 'standard'], duration: 90, gateCount: 46 }
  }
];

MOSSWING_CHAPTERS.endless = {
  id: 'endless', name: '无限天空', subtitle: '自由飞行', swatch: '#88a895', seed: 9909,
  palette: { sky: ['#f8cca9', '#f7dfb8', '#8da89b'], fog: 0xd0d8c2, sun: 0xfff5d1, hemiSky: 0xfff5e9, hemiGround: 0x658c83, key: 0xffebd8, fill: 0xf3fff0, pillar: 0x719389, pillarTop: 0x8c9e66, island: 0x6e8d7e, islandTop: 0x8eaa7a, accent: 0xd8aa50, leaf: 0x829b53, particle: [0xffedbc, 0xbac985] },
  scenery: { mode: 'garden', count: 84, direction: [-.2, .06], density: 1 },
  physics: { speed: 2.65, speedRamp: .012, gravity: 18.5, flap: 6.05, wind: 0, gapMin: 1.52, gapMax: 1.52, moveAmplitude: 0, moveFrequency: 0, pulseMin: 1.52, pulseAmount: 0, centerRange: 1.25, pattern: ['standard', 'standard', 'bonus', 'moving', 'standard', 'standard', 'bonus'], duration: Infinity, gateCount: Infinity }
};

if (typeof globalThis !== 'undefined') globalThis.MOSSWING_CHAPTERS = MOSSWING_CHAPTERS;
if (typeof module !== 'undefined') module.exports = MOSSWING_CHAPTERS;
