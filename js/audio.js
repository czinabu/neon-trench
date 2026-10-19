"use strict";
/* Web Audio: engine drone, procedural synthwave music, sound effects. */

/* ============================ AUDIO ============================ */
let AC=null,engGain,engOsc1,engOsc2,engFilt,padGain,masterGain,musicBus=null,sfxBus=null,reverbIn=null;
let musicGain=null,musicStep=0,musicNextT=0,musicIntent=0;
function audioInit(){
  if(AC)return;AC=new (window.AudioContext||window.webkitAudioContext)();
  // master → limiter → speakers: a pile-up of explosions squashes instead of clipping
  const lim=AC.createDynamicsCompressor();
  lim.threshold.value=-10;lim.knee.value=6;lim.ratio.value=12;lim.attack.value=.003;lim.release.value=.25;
  lim.connect(AC.destination);
  const master=AC.createGain();master.gain.value=S.muted?0:.55;master.connect(lim);
  masterGain=master;
  // two buses under the master: music (score + ambient pad) and sfx (engine + effects), each with its own volume
  musicBus=AC.createGain();musicBus.connect(master);
  sfxBus=AC.createGain();sfxBus.connect(master);
  // shared reverb: a generated hall tail that effects (and a little of the music) send into, so
  // blasts and shots ring off the trench walls instead of stopping dead
  const verb=AC.createConvolver();verb.buffer=reverbImpulse(2.2,2.6);
  const verbOut=AC.createGain();verbOut.gain.value=.5;verb.connect(verbOut);verbOut.connect(sfxBus);
  reverbIn=AC.createGain();reverbIn.connect(verb);
  const musicSend=AC.createGain();musicSend.gain.value=.12;musicBus.connect(musicSend);musicSend.connect(verb);
  applyAudioLevels();
  engOsc1=AC.createOscillator();engOsc1.type='sawtooth';engOsc1.frequency.value=42;
  engOsc2=AC.createOscillator();engOsc2.type='sawtooth';engOsc2.frequency.value=42.7;
  engFilt=AC.createBiquadFilter();engFilt.type='lowpass';engFilt.frequency.value=240;
  engGain=AC.createGain();engGain.gain.value=.0;
  engOsc1.connect(engFilt);engOsc2.connect(engFilt);engFilt.connect(engGain);engGain.connect(sfxBus);
  engOsc1.start();engOsc2.start();
  padGain=AC.createGain();padGain.gain.value=.05;padGain.connect(musicBus);
  [55,82.4,110].forEach((f,i)=>{const o=AC.createOscillator();o.type='sine';o.frequency.value=f;
    const g=AC.createGain();g.gain.value=.25/(i+1);o.connect(g);g.connect(padGain);o.start();});
  // start the synthwave music bed (lookahead scheduler, independent of the render loop)
  musicGain=AC.createGain();musicGain.gain.value=.0;musicGain.connect(musicBus);
  musicNextT=AC.currentTime+.1;musicStep=0;
  setInterval(musicSchedule,25);
}
/* ---- procedural synthwave music: bass + arp + lead + drums, intensity-driven ---- */
const MUS_ROOT=[55.00,43.65,65.41,49.00];           // Am · F · C · G  (bass roots, Hz)
const MUS_CHORD=[[0,3,7,12],[0,4,7,12],[0,4,7,12],[0,4,7,12]]; // triad+oct semitone offsets
const mnote=(base,semi)=>base*Math.pow(2,semi/12);
function mvoice(freq,t,dur,type,gain,cut){
  const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();
  o.type=type;o.frequency.value=freq;f.type='lowpass';f.frequency.value=cut||1800;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.012);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(f);f.connect(g);g.connect(musicGain);o.start(t);o.stop(t+dur+.02);
}
function mdrum(t,kind){
  if(kind==='kick'){const o=AC.createOscillator(),g=AC.createGain();o.type='sine';
    o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(45,t+.12);
    g.gain.setValueAtTime(.5,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);
    o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+.18);return;}
  // hat / snare = filtered noise burst
  const dur=kind==='snare'?.18:.04;
  const buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.5);
  const src=AC.createBufferSource();src.buffer=buf;
  const f=AC.createBiquadFilter();f.type='highpass';f.frequency.value=kind==='snare'?1400:7000;
  const g=AC.createGain();g.gain.value=kind==='snare'?.28:.16;
  src.connect(f);f.connect(g);g.connect(musicGain);src.start(t);
}
function musicSchedule(){
  if(!AC||!musicGain)return;
  if(musicNextT<AC.currentTime-.2)musicNextT=AC.currentTime+.05; // resync after a stall
  const stepDur=(60/126)/4;                          // 16th note @ 126 BPM
  while(musicNextT<AC.currentTime+.12){
    const t=musicNextT, step=musicStep%16, bar=Math.floor(musicStep/16)%4;
    const root=MUS_ROOT[bar], chord=MUS_CHORD[bar], I=musicIntent;
    if(step%4===0){mvoice(root,t,.34,'sawtooth',.16,500+I*400);mdrum(t,'kick');}   // bass + kick on beats
    mvoice(mnote(root*4,chord[musicStep%chord.length]),t,.11,'square',.035+.05*I,1200+I*1800); // arp
    if(step%2===1)mdrum(t,'hat');
    if(step===8)mdrum(t,'snare');
    if(I>.4&&step%2===0)mvoice(mnote(root*8,chord[(step/2)%chord.length]),t,.18,'sawtooth',.03*I,2600); // lead
    musicStep++;musicNextT+=stepDur;
  }
}
function setMuted(m){
  S.muted=m;try{localStorage.setItem('neonTrench.mute',m?'1':'0');}catch(e){}
  if(masterGain)masterGain.gain.value=m?0:.55;
  if(window.csSnd)csSnd.textContent=m?'OFF':'ON';
}
function reverbImpulse(sec,decay){
  const n=AC.sampleRate*sec,b=AC.createBuffer(2,n,AC.sampleRate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay);}
  return b;
}
/* Where a sound plays from. With a world position it is panned left/right by where the source sits
   relative to the camera and quietened with distance; every route also feeds the reverb. */
const audV=new THREE.Vector3();
const SFX_WET={boom:.45,bigboom:.6,laser:.18,msl:.3,elaunch:.3,ezap:.25,flyby:.2,hit:.15,shieldhit:.15};
function sfxRoute(type,pos){
  const g=AC.createGain();let out=g;
  if(pos){
    audV.copy(pos).applyMatrix4(camera.matrixWorldInverse);
    const d=audV.length();
    g.gain.value=1/(1+d/160);
    if(AC.createStereoPanner){const pn=AC.createStereoPanner();
      pn.pan.value=Math.max(-.9,Math.min(.9,audV.x/Math.max(25,d)*1.4));g.connect(pn);out=pn;}
  }
  out.connect(sfxBus);
  const w=SFX_WET[type];if(w){const s=AC.createGain();s.gain.value=w;out.connect(s);s.connect(reverbIn);}
  return g;
}
function sfx(type,pos){
  if(!AC)return;const t=AC.currentTime;
  if(pos&&pos.distanceTo(camera.position)>1400)return;   // too far away to hear
  const out=sfxRoute(type,pos);
  if(type==='laser'){
    // punchy twin-oscillator "pew" with a filtered sweep
    const o=AC.createOscillator(),o2=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();
    o.type='sawtooth';o2.type='square';f.type='lowpass';
    o.frequency.setValueAtTime(1800,t);o.frequency.exponentialRampToValueAtTime(240,t+.10);
    o2.frequency.setValueAtTime(2700,t);o2.frequency.exponentialRampToValueAtTime(170,t+.12);
    f.frequency.setValueAtTime(3400,t);f.frequency.exponentialRampToValueAtTime(650,t+.11);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.15,t+.004);
    g.gain.exponentialRampToValueAtTime(.001,t+.13);
    o.connect(f);o2.connect(f);f.connect(g);g.connect(out);
    o.start(t);o2.start(t);o.stop(t+.14);o2.stop(t+.14);
  }else if(type==='hit'){
    const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';
    o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(60,t+.2);
    g.gain.setValueAtTime(.3,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+.26);
  }else if(type==='boom'||type==='bigboom'){
    const dur=type==='bigboom'?1.6:.6;
    const buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate);const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
    const src=AC.createBufferSource();src.buffer=buf;
    const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(900,t);
    f.frequency.exponentialRampToValueAtTime(60,t+dur);
    const g=AC.createGain();g.gain.value=type==='bigboom'?.9:.45;
    src.connect(f);f.connect(g);g.connect(out);src.start(t);
  }else if(type==='msl'){
    const buf=AC.createBuffer(1,AC.sampleRate*.5,AC.sampleRate);const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.4);
    const src=AC.createBufferSource();src.buffer=buf;
    const f=AC.createBiquadFilter();f.type='bandpass';f.Q.value=1.4;
    f.frequency.setValueAtTime(500,t);f.frequency.exponentialRampToValueAtTime(2600,t+.4);
    const g=AC.createGain();g.gain.setValueAtTime(.35,t);g.gain.exponentialRampToValueAtTime(.001,t+.5);
    src.connect(f);f.connect(g);g.connect(out);src.start(t);
  }else if(type==='lock'){            // lock acquired — two quick confirm beeps
    const o=AC.createOscillator(),g=AC.createGain();o.type='sine';
    o.frequency.setValueAtTime(900,t);o.frequency.setValueAtTime(1300,t+.08);
    g.gain.setValueAtTime(.16,t);g.gain.setValueAtTime(.16,t+.08);g.gain.exponentialRampToValueAtTime(.001,t+.22);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+.24);
  }else if(type==='acquire'){         // soft low growl when acquisition begins
    const o=AC.createOscillator(),g=AC.createGain();o.type='sawtooth';
    o.frequency.setValueAtTime(220,t);o.frequency.linearRampToValueAtTime(330,t+.18);
    g.gain.setValueAtTime(.07,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+.22);
  }else if(type==='near'){            // close-call: quick rising tick
    const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';
    o.frequency.setValueAtTime(1500,t);o.frequency.exponentialRampToValueAtTime(2500,t+.05);
    g.gain.setValueAtTime(.10,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+.13);
  }else if(type==='alarm'){           // low-hull klaxon: two-tone descending beep
    const o=AC.createOscillator(),g=AC.createGain();o.type='square';
    o.frequency.setValueAtTime(760,t);o.frequency.setValueAtTime(560,t+.12);
    g.gain.setValueAtTime(.12,t);g.gain.setValueAtTime(.12,t+.1);g.gain.exponentialRampToValueAtTime(.001,t+.24);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+.26);
  }else if(type==='mslwarn'){         // incoming-missile tone: short high square chirp, repeats faster as it closes
    const o=AC.createOscillator(),g=AC.createGain();o.type='square';
    o.frequency.setValueAtTime(1240,t);
    g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.001,t+.06);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+.07);
  }else if(type==='elaunch'){         // enemy missile off the rail: falling sawtooth whoosh
    const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();o.type='sawtooth';f.type='lowpass';f.frequency.value=900;
    o.frequency.setValueAtTime(420,t);o.frequency.exponentialRampToValueAtTime(110,t+.35);
    g.gain.setValueAtTime(.08,t);g.gain.exponentialRampToValueAtTime(.001,t+.38);
    o.connect(f);f.connect(g);g.connect(out);o.start(t);o.stop(t+.4);
  }else if(type==='ezap'){            // hostile gunfire: lower, buzzier than the player's laser
    const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();o.type='square';f.type='lowpass';
    o.frequency.setValueAtTime(900,t);o.frequency.exponentialRampToValueAtTime(160,t+.12);
    f.frequency.setValueAtTime(2200,t);f.frequency.exponentialRampToValueAtTime(400,t+.12);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.1,t+.005);g.gain.exponentialRampToValueAtTime(.001,t+.14);
    o.connect(f);f.connect(g);g.connect(out);o.start(t);o.stop(t+.15);
  }else if(type==='flyby'){           // close pass: band-passed noise that swells and drops in pitch
    const dur=.75,buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const src=AC.createBufferSource();src.buffer=buf;
    const f=AC.createBiquadFilter();f.type='bandpass';f.Q.value=2.2;
    f.frequency.setValueAtTime(2400,t);f.frequency.exponentialRampToValueAtTime(380,t+dur);
    const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.42,t+.28);
    g.gain.exponentialRampToValueAtTime(.001,t+dur);
    src.connect(f);f.connect(g);g.connect(out);src.start(t);src.stop(t+dur);
  }else if(type==='shieldhit'){       // hit soaked by the shield: bright ringing zap instead of a hull thud
    const o=AC.createOscillator(),o2=AC.createOscillator(),g=AC.createGain();o.type='sine';o2.type='triangle';
    o.frequency.setValueAtTime(1400,t);o.frequency.exponentialRampToValueAtTime(520,t+.2);
    o2.frequency.setValueAtTime(2100,t);o2.frequency.exponentialRampToValueAtTime(900,t+.16);
    g.gain.setValueAtTime(.16,t);g.gain.exponentialRampToValueAtTime(.001,t+.24);
    o.connect(g);o2.connect(g);g.connect(out);o.start(t);o2.start(t);o.stop(t+.25);o2.stop(t+.25);
  }else if(type==='flare'){           // flare salvo: a sharp pop and a bright fizzing hiss
    const dur=.5,buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.8);
    const src=AC.createBufferSource();src.buffer=buf;
    const f=AC.createBiquadFilter();f.type='highpass';f.frequency.value=1800;
    const g=AC.createGain();g.gain.setValueAtTime(.32,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    src.connect(f);f.connect(g);g.connect(out);src.start(t);
    const o=AC.createOscillator(),og=AC.createGain();o.type='triangle';
    o.frequency.setValueAtTime(320,t);o.frequency.exponentialRampToValueAtTime(90,t+.08);
    og.gain.setValueAtTime(.25,t);og.gain.exponentialRampToValueAtTime(.001,t+.1);
    o.connect(og);og.connect(out);o.start(t);o.stop(t+.11);
  }else if(type==='lockwarn'){        // an enemy is locking you up: steady mid tone, slower than the inbound chirp
    const o=AC.createOscillator(),g=AC.createGain();o.type='square';
    o.frequency.setValueAtTime(820,t);
    g.gain.setValueAtTime(.045,t);g.gain.setValueAtTime(.045,t+.14);g.gain.exponentialRampToValueAtTime(.001,t+.17);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+.18);
  }else if(type==='tick'){            // hit confirmed (not a kill) — sharp, short, unobtrusive
    const o=AC.createOscillator(),g=AC.createGain();o.type='square';
    o.frequency.setValueAtTime(1500,t);
    g.gain.setValueAtTime(.10,t);g.gain.exponentialRampToValueAtTime(.001,t+.045);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+.05);
  }
}
/* hit confirmation: a quick on-screen marker + sfx the instant a shot connects (kills
   reuse the existing 'boom' from killEnemy, so this only sounds for non-lethal hits) */
function hitMarker(kind){S.hitMarkKind=kind;S.hitMarkT=kind==='kill'?.35:.22;if(kind!=='kill')sfx('tick');}
