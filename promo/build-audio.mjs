// Original 20s score for the promo, synthesized from scratch (no samples).
// Warm ambient-electronic bed timed to the six scenes. Writes track.wav.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SR = 44100, DUR = 20.0, N = Math.round(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);   // dry master
const WET = new Float32Array(N);                          // reverb send (mono)

const nf = (m) => 440 * Math.pow(2, (m - 69) / 12);       // midi -> Hz
const NOTE = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };
function m(name){ const mt = name.match(/^([A-G][b#]?)(-?\d)$/); return 12*(parseInt(mt[2])+1)+NOTE[mt[1]]; }
const f = (name) => nf(m(name));

const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function adsr(t, dur, a, d, sl, r){
  if (t < 0) return 0;
  if (t < a) return t/a;
  if (t < a+d) return 1 - (1-sl)*((t-a)/d);
  if (t < dur) return sl;
  const rt = t-dur; return rt < r ? sl*(1 - rt/r) : 0;
}
function saw(p){ p -= Math.floor(p); return 2*p - 1; }
function tri(p){ p -= Math.floor(p); return 2*Math.abs(2*p-1) - 1; }

// add a voice into dry buffers (+optional wet send)
function add(t0, dur, freq, gain, opts={}){
  const { type='sine', a=0.01, d=0.1, sl=0.7, r=0.3, pan=0, wet=0, detune=0, vib=0, vibrate=5, sub=0 } = opts;
  const life = dur + r;
  const s0 = Math.floor(t0*SR), s1 = Math.min(N, Math.floor((t0+life)*SR));
  const gl = gain*Math.cos((pan+1)*Math.PI/4), gr = gain*Math.sin((pan+1)*Math.PI/4);
  for (let i=s0;i<s1;i++){
    const t=(i-s0)/SR, e=adsr(t,dur,a,d,sl,r);
    if (e<=0) continue;
    const vf = vib ? (1 + vib*Math.sin(2*Math.PI*vibrate*t)) : 1;
    const ph = freq*vf*t;
    let s;
    if (type==='sine') s = Math.sin(2*Math.PI*ph);
    else if (type==='saw') s = 0.5*(saw(ph) + saw((freq*(1+detune))*t)*0.6);
    else if (type==='tri') s = tri(ph);
    else if (type==='supersaw') s = (saw(ph)+saw((freq*(1+detune))*t)+saw((freq*(1-detune))*t))/3;
    else s = Math.sin(2*Math.PI*ph);
    if (sub) s += sub*Math.sin(2*Math.PI*ph*0.5);
    const v = s*e;
    L[i]+=v*gl; R[i]+=v*gr;
    if (wet) WET[i]+=v*gain*wet;
  }
}
// noise-based hat / riser
function noise(t0, dur, gain, opts={}){
  const { hp=0.5, r=0.05, pan=0, rise=false } = opts;
  const s0=Math.floor(t0*SR), s1=Math.min(N, Math.floor((t0+dur+r)*SR));
  const gl=gain*Math.cos((pan+1)*Math.PI/4), gr=gain*Math.sin((pan+1)*Math.PI/4);
  let prev=0;
  for(let i=s0;i<s1;i++){
    const t=(i-s0)/SR;
    let e = rise ? clamp(t/dur,0,1) : adsr(t,dur,0.002,dur,0.0,r);
    if (rise) e = e*e * (t<dur?1:Math.max(0,1-(t-dur)/r));
    const w=Math.random()*2-1;
    const hpv = w - prev; prev = w*0.5+prev*0.5; // crude highpass
    const v=(hp*hpv + (1-hp)*w)*e;
    L[i]+=v*gl; R[i]+=v*gr;
  }
}
// kick: pitch-dropping sine
function kick(t0, gain=0.9){
  const dur=0.18, s0=Math.floor(t0*SR), s1=Math.min(N,Math.floor((t0+dur)*SR));
  for(let i=s0;i<s1;i++){
    const t=(i-s0)/SR;
    const fr=120*Math.pow(0.0006,t/dur)+45;
    const e=Math.pow(1-t/dur,2.2);
    const v=Math.sin(2*Math.PI*fr*t)*e*gain;
    L[i]+=v; R[i]+=v;
  }
}

// ---------------- arrangement ----------------
// chords per scene (root-position-ish voicings)
const CH = {
  F:   ['F3','A3','C4','G4'],     // Fmaj9
  Dm:  ['D3','F3','A3','E4'],     // Dm9
  Bb:  ['Bb3','D4','F4','C5'],    // Bbmaj9
  C:   ['C4','E4','G4','D5'],     // Cadd9
  Am:  ['A3','C4','E4','B4'],     // Am9
};
const ROOT = { F:'F2', Dm:'D2', Bb:'Bb2', C:'C2', Am:'A2' };
// scene -> chord, with overlap crossfades
const PAD = [
  ['F',  0.0, 3.8],
  ['Dm', 3.2, 6.9],
  ['Bb', 6.4, 10.2],
  ['C',  9.7, 11.9],
  ['Am', 11.7,13.8],
  ['Bb', 13.3,15.7],
  ['C',  15.5,17.5],
  ['F',  17.3,20.4],
];
for (const [c,t0,t1] of PAD){
  for (const nm of CH[c]) add(t0, t1-t0, f(nm), 0.07, {type:'supersaw', a:0.6, d:0.5, sl:0.85, r:1.0, detune:0.006, wet:0.5, pan:(Math.random()*0.5-0.25)});
  add(t0, t1-t0, f(ROOT[c]), 0.16, {type:'sine', a:0.2, d:0.3, sl:0.8, r:0.6, sub:0.3}); // sub bass
}

// arpeggio: eighth notes through current chord, enters S2, fuller S3-S5, sparse S6
const beat = 0.6; // 100 bpm
function chordAt(t){ let cur='F'; for(const [c,t0] of PAD){ if (t>=t0) cur=c; } return CH[cur]; }
for (let t=3.2; t<17.3; t+=beat/2){
  const ch = chordAt(t);
  const dense = (t>=6.4 && t<17.3);
  const step = Math.round((t-3.2)/(beat/2));
  if (!dense && step%2!==0) continue;            // sparser in S2
  const seq = [0,2,1,3,2,1];
  const idx = seq[step % seq.length];
  const nm = ch[idx % ch.length];
  const oct = (step % 4 < 2) ? 0 : 12;
  add(t, beat*0.9, f(nm)*Math.pow(2,oct/12), 0.05, {type:'tri', a:0.005, d:0.25, sl:0.0, r:0.3, wet:0.55, pan:(idx%2?0.35:-0.35)});
}

// bell accents: on "57" reveal and on CTA
add(4.8, 1.4, f('C6'), 0.10, {type:'sine', a:0.002, d:1.2, sl:0.0, r:0.6, wet:0.7});
add(4.8, 1.4, f('G5'), 0.06, {type:'sine', a:0.002, d:1.0, sl:0.0, r:0.6, wet:0.7});
add(17.4, 2.2, f('F5'), 0.10, {type:'sine', a:0.002, d:1.6, sl:0.0, r:1.0, wet:0.7});
add(17.4, 2.2, f('A5'), 0.07, {type:'sine', a:0.002, d:1.6, sl:0.0, r:1.0, wet:0.7});
add(17.4, 2.4, f('C6'), 0.06, {type:'sine', a:0.002, d:1.8, sl:0.0, r:1.0, wet:0.7});

// drums: kick on beats from S3 to S6 start; hats on offbeats; drop for CTA
for (let t=6.4; t<17.3; t+=beat){ kick(t, 0.55); }
for (let t=6.4+beat/2; t<17.3; t+=beat){ noise(t, 0.04, 0.06, {hp:0.85, r:0.03, pan:0.2}); }

// risers into S2 and S6
noise(2.0, 1.3, 0.10, {hp:0.7, r:0.1, rise:true});
noise(16.0, 1.3, 0.10, {hp:0.7, r:0.1, rise:true});

// ---------------- reverb (Schroeder) on WET send ----------------
function comb(inp, ds, fb){ const o=new Float32Array(inp.length), b=new Float32Array(ds); let x=0; for(let i=0;i<inp.length;i++){ const d=b[x]; o[i]=d; b[x]=inp[i]+d*fb; x=(x+1)%ds; } return o; }
function allpass(inp, ds, fb){ const o=new Float32Array(inp.length), b=new Float32Array(ds); let x=0; for(let i=0;i<inp.length;i++){ const bo=b[x]; o[i]=-inp[i]+bo; b[x]=inp[i]+bo*fb; o[i]=o[i]; x=(x+1)%ds; } return o; }
const combs=[1557,1617,1491,1422,1277,1356];
let rv=new Float32Array(N);
for (const c of combs){ const o=comb(WET,c,0.80); for(let i=0;i<N;i++) rv[i]+=o[i]/combs.length; }
rv = allpass(rv, 225, 0.5); rv = allpass(rv, 556, 0.5);
// mix reverb in stereo (slight offset for width)
const off=Math.floor(0.013*SR);
for (let i=0;i<N;i++){ const w=rv[i]*0.55; L[i]+=w; R[i]+= (i+off<N?rv[i+off]:0)*0.55; }

// ---------------- master: fades, soft limit, normalize ----------------
const fin=Math.floor(0.15*SR), fout=Math.floor(1.6*SR);
for (let i=0;i<N;i++){
  let g=1;
  if (i<fin) g=i/fin;
  if (i>N-fout) g=Math.min(g,(N-i)/fout);
  L[i]*=g; R[i]*=g;
}
let peak=0; for(let i=0;i<N;i++){ peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i])); }
const norm = peak>0 ? (0.89/peak) : 1;
for (let i=0;i<N;i++){ L[i]=Math.tanh(L[i]*norm*1.05); R[i]=Math.tanh(R[i]*norm*1.05); }

// ---------------- write WAV (16-bit PCM stereo) ----------------
const bytes = N*2*2;
const buf = Buffer.alloc(44 + bytes);
buf.write('RIFF',0); buf.writeUInt32LE(36+bytes,4); buf.write('WAVE',8);
buf.write('fmt ',12); buf.writeUInt32LE(16,16); buf.writeUInt16LE(1,20); buf.writeUInt16LE(2,22);
buf.writeUInt32LE(SR,24); buf.writeUInt32LE(SR*4,28); buf.writeUInt16LE(4,32); buf.writeUInt16LE(16,34);
buf.write('data',36); buf.writeUInt32LE(bytes,40);
let o=44;
for (let i=0;i<N;i++){
  buf.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(L[i]*32767))),o); o+=2;
  buf.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(R[i]*32767))),o); o+=2;
}
fs.writeFileSync(path.join(__dirname,'track.wav'), buf);
console.log('Wrote track.wav (%ds, peak %s)', DUR, peak.toFixed(3));
