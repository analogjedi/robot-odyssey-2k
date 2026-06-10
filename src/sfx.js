// Minimal WebAudio bleeps. Fails silently anywhere audio is unavailable.
let actx = null;

const SOUNDS = {
  place:  [520, 0.06, 'square', 0.04],
  wire:   [880, 0.07, 'triangle', 0.05],
  delete: [180, 0.08, 'sawtooth', 0.04],
  pickup: [1040, 0.12, 'sine', 0.06],
  door:   [240, 0.25, 'square', 0.05],
  enter:  [660, 0.1, 'triangle', 0.05],
  exit:   [440, 0.1, 'triangle', 0.05],
  win:    [784, 0.4, 'sine', 0.07],
  burn:   [1320, 0.3, 'sine', 0.06],
  error:  [120, 0.15, 'sawtooth', 0.05],
};

export function sfx(name) {
  try {
    const def = SOUNDS[name];
    if (!def) return;
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const [freq, dur, type, vol] = def;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
    if (name === 'win' || name === 'burn') {
      const o2 = actx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = freq * 1.5;
      o2.connect(g);
      o2.start(actx.currentTime + 0.1);
      o2.stop(actx.currentTime + dur);
    }
  } catch { /* no audio — fine */ }
}
