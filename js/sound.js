// Web Audio の環境音。既定OFF・自動再生なし・ユーザーが押したときだけ鳴らす。音声ファイルは使わない。
const ROOTS = [110, 130.81, 146.83, 164.81];
let ctx = null, master = null, oscs = [], on = false, scene = 0, stopTimer = null;

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 720; filter.Q.value = 0.4;
  const trem = ctx.createGain(); trem.gain.value = 0.8;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
  const depth = ctx.createGain(); depth.gain.value = 0.2;
  lfo.connect(depth); depth.connect(trem.gain); lfo.start();
  const mk = (type, mult, gain) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = ROOTS[scene] * mult;
    const g = ctx.createGain(); g.gain.value = gain; o.connect(g); g.connect(trem); o.start();
    oscs.push({ o, mult });
  };
  mk('sine', 1, 0.5); mk('sine', 1.5, 0.28); mk('triangle', 2, 0.1);
  trem.connect(filter); filter.connect(master); master.connect(ctx.destination);
  return true;
}

function ping(freq) {
  if (!ctx || !on) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.7);
}

export function isOn() { return on; }

export async function setOn(next) {
  // 戻り値：'unsupported'（Web Audio 非対応）／それ以外は現在のON/OFF
  if (next === on) return on;
  if (next) {
    if (!ctx && !build()) return 'unsupported';
    clearTimeout(stopTimer);
    await ctx.resume();
    on = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.07, ctx.currentTime, 0.6);
  } else {
    on = false;
    if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      stopTimer = setTimeout(() => { if (!on) ctx.suspend(); }, 1200);
    }
  }
  return on;
}

export function setScene(i) {
  if (i === scene) return;
  scene = i;
  if (!ctx || !on) return;
  const t = ctx.currentTime;
  oscs.forEach(({ o, mult }) => o.frequency.setTargetAtTime(ROOTS[i] * mult, t, 0.9));
  ping(ROOTS[i] * 4);
}

export function bindToggle(btn) {
  if (!btn) return;
  const state = btn.querySelector('.state');
  btn.addEventListener('click', async () => {
    const ok = await setOn(!on);
    if (ok === 'unsupported') { btn.disabled = true; btn.title = 'このブラウザは音の再生に対応していません'; return; }
    btn.setAttribute('aria-pressed', String(on));
    if (state) state.textContent = on ? 'ON' : 'OFF';
  });
}
