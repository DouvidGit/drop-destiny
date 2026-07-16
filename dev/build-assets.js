const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const wavetableSelections = [
  { id: 'distorted', label: 'RIOT SAW', category: 'distorted', key: 'AKWF_distorted_0025' },
  { id: 'fmRazor', label: 'FM RAZOR', category: 'fmsynth', key: 'AKWF_fmsynth_0026' },
  { id: 'granite', label: 'GRANITE', category: 'granular', key: 'AKWF_granular_0008' },
  { id: 'bitCore', label: 'BIT CORE', category: 'bitreduced', key: 'AKWF_bitreduced_0002' },
  { id: 'vocal', label: 'VOCAL', category: 'hvoice', key: 'AKWF_hvoice_0050' }
];

const sampleSelections = {
  kickClean: {
    title: 'Dubstep Kick 4 - Clean', author: 'mrbossosity', freesoundId: 774957,
    url: 'https://cdn.freesound.org/previews/774/774957_5004340-hq.mp3'
  },
  kickTearout: {
    title: 'tearout_kick.wav', author: 'bl31gt0', freesoundId: 559234,
    url: 'https://cdn.freesound.org/previews/559/559234_12551140-hq.mp3'
  },
  snareBeefy: {
    title: 'Dubstep Snare #2 - Beefy', author: 'mrbossosity', freesoundId: 774955,
    url: 'https://cdn.freesound.org/previews/774/774955_5004340-hq.mp3'
  },
  snareWide: {
    title: 'Brostep - Wide Punchy Snare', author: 'Hybrid_V', freesoundId: 319613,
    url: 'https://cdn.freesound.org/previews/319/319613_5436764-hq.mp3'
  },
  hatRiddim: {
    title: 'Sabian fake 1', author: 'Logicogonist', freesoundId: 810397,
    url: 'https://cdn.freesound.org/previews/810/810397_3797507-hq.mp3'
  },
  hatBrostep: {
    title: '[Drums] hat 0', author: 'waveplaySFX', freesoundId: 197237,
    url: 'https://cdn.freesound.org/previews/197/197237_1676145-hq.mp3'
  },
  hatTrap: {
    title: 'FD808A HiHat closed.wav', author: 'Uberproduktion', freesoundId: 455639,
    url: 'https://cdn.freesound.org/previews/455/455639_3677139-hq.mp3'
  },
  hatHouse: {
    title: 'Hi-Hat Closed Hit - Clean', author: 'TheEndOfACycle', freesoundId: 674296,
    url: 'https://cdn.freesound.org/previews/674/674296_3130497-hq.mp3'
  },
  hatMelodic: {
    title: 'Dry Hat.wav', author: 'CrushedLoops', freesoundId: 626906,
    url: 'https://cdn.freesound.org/previews/626/626906_13483597-hq.mp3'
  },
  hatFusion: {
    title: 'Closed Hi Hat.wav', author: 'karolist', freesoundId: 378377,
    url: 'https://cdn.freesound.org/previews/378/378377_6399962-hq.mp3'
  },
  hatOpenHouse: {
    title: 'SwarajiwaTH Open Hihat.wav', author: 'jack126guy', freesoundId: 371696,
    url: 'https://cdn.freesound.org/previews/371/371696_5506271-hq.mp3'
  },
  hatOpenSoft: {
    title: 'Hi Hat Open to Closed Soft Hit Sticks.wav', author: 'captain k man', freesoundId: 125039,
    url: 'https://cdn.freesound.org/previews/125/125039_2272910-hq.mp3'
  },
  hatOpenTrap: {
    title: 'FD808A HiHat open.wav', author: 'Uberproduktion', freesoundId: 455638,
    url: 'https://cdn.freesound.org/previews/455/455638_3677139-hq.mp3'
  },
  clapFat: {
    title: 'Fat clap', author: 'deleted_user_2906614', freesoundId: 239906,
    url: 'https://cdn.freesound.org/previews/239/239906_2906614-hq.mp3'
  },
  impactDeep: {
    title: 'DSGNImpt_Deep Cinematic Impact 4_ZAZZ', author: 'zazz.sound.design', freesoundId: 754423,
    url: 'https://cdn.freesound.org/previews/754/754423_726853-hq.mp3'
  },
  riser140: {
    title: 'riser_05_140bpm', author: 'vekoN', freesoundId: 719845,
    url: 'https://cdn.freesound.org/previews/719/719845_11045610-hq.mp3'
  }
};

async function buildWavetables() {
  const categoryCache = {};
  const tables = {};
  const metadata = {};

  for (const selection of wavetableSelections) {
    if (!categoryCache[selection.category]) {
      const url = `https://raw.githubusercontent.com/KristofferKarlAxelEkstrand/AKWF-FREE/main/AKWF-js/AKWF_${selection.category}.json`;
      categoryCache[selection.category] = await (await fetch(url)).json();
    }
    tables[selection.id] = categoryCache[selection.category][selection.key];
    metadata[selection.id] = { label: selection.label, source: selection.key };
  }

  const source = `/** Generated from Adventure Kid Wave Forms (CC0). */\n` +
    `(function (global) {\n  'use strict';\n  global.DropDestinyWavetables = ${JSON.stringify({ tables, metadata })};\n` +
    `})(typeof window !== 'undefined' ? window : global);\n`;
  fs.writeFileSync(path.join(root, 'wavetables.js'), source);
}

async function buildAudioAssets() {
  const assets = {};
  for (const [id, item] of Object.entries(sampleSelections)) {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error(`Unable to download ${id}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assets[id] = {
      title: item.title,
      author: item.author,
      freesoundId: item.freesoundId,
      license: 'CC0-1.0',
      mime: 'audio/mpeg',
      base64: bytes.toString('base64')
    };
  }

  const source = `/** Generated CC0 audio assets. See ASSET_LICENSES.md. */\n` +
    `(function (global) {\n  'use strict';\n  global.DropDestinyAudioAssets = ${JSON.stringify(assets)};\n` +
    `})(typeof window !== 'undefined' ? window : global);\n`;
  fs.writeFileSync(path.join(root, 'audio-assets.js'), source);
}

Promise.all([buildWavetables(), buildAudioAssets()]).catch(error => {
  console.error(error);
  process.exit(1);
});
