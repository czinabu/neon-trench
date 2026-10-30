"use strict";
/* Web Audio: engine drone, procedural synthwave music, sound effects. */

/* ============================ AUDIO ============================ */
let engSub,engWhine,engWhineG,engNoiseG,engNoiseF;
let AC=null,engGain,engOsc1,engOsc2,engFilt,padGain,masterGain,musicBus=null,sfxBus=null,reverbIn=null;
let musicMood='patrol',musicGain=null,musicStep=0,musicNextT=0,musicIntent=0;
const masterLevel=()=>S.muted?0:.55*SETTINGS.master;
function audioInit(){
  if(AC)return;AC=new (window.AudioContext||window.webkitAudioContext)();
  // master → limiter → speakers: a pile-up of explosions squashes instead of clipping
  const lim=AC.createDynamicsCompressor();
  lim.threshold.value=-10;lim.knee.value=6;lim.ratio.value=12;lim.attack.value=.003;lim.release.value=.25;
  lim.connect(AC.destination);
  const master=AC.createGain();master.gain.value=masterLevel();master.connect(lim);
  masterGain=master;
  // two buses under the master: music (score + ambient pad) and sfx (engine + effects), each with its own volume
  musicBus=AC.createGain();musicBus.connect(master);
  sfxBus=AC.createGain();sfxBus.connect(master);
  // shared reverb: a generated hall tail that effects (and a little of the music) send into, so
  // blasts and shots ring off the trench walls instead of stopping dead
  const verb=AC.createConvolver();verb.buffer=reverbImpulse(2.2,2.6);
  const verbOut=AC.createGain();verbOut.gain.value=.5;verb.connect(verbOut);verbOut.connect(sfxBus);
  reverbIn=AC.createGain();reverbIn.connect(verb);
  const musicSend=AC.createGain();musicSend.gain.value=.3;musicBus.connect(musicSend);musicSend.connect(verb);
  applyAudioLevels();
  engOsc1=AC.createOscillator();engOsc1.type='sawtooth';engOsc1.frequency.value=42;
  engOsc2=AC.createOscillator();engOsc2.type='sawtooth';engOsc2.frequency.value=42.7;
  engFilt=AC.createBiquadFilter();engFilt.type='lowpass';engFilt.frequency.value=240;
  engGain=AC.createGain();engGain.gain.value=.0;
  engOsc1.connect(engFilt);engOsc2.connect(engFilt);engFilt.connect(engGain);engGain.connect(sfxBus);
  engOsc1.start();engOsc2.start();
  // sub rumble, a turbine whine and airy intake noise ride on the same gain so silenceEngine() mutes them too
  engSub=AC.createOscillator();engSub.type='sine';engSub.frequency.value=30;
  const subG=AC.createGain();subG.gain.value=.9;engSub.connect(subG);subG.connect(engGain);engSub.start();
  engWhine=AC.createOscillator();engWhine.type='triangle';engWhine.frequency.value=420;
  engWhineG=AC.createGain();engWhineG.gain.value=.0;engWhine.connect(engWhineG);engWhineG.connect(engGain);engWhine.start();
  const nb=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate),nd=nb.getChannelData(0);
  for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const ns=AC.createBufferSource();ns.buffer=nb;ns.loop=true;
  engNoiseF=AC.createBiquadFilter();engNoiseF.type='bandpass';engNoiseF.Q.value=.8;engNoiseF.frequency.value=700;
  engNoiseG=AC.createGain();engNoiseG.gain.value=0;ns.connect(engNoiseF);engNoiseF.connect(engNoiseG);engNoiseG.connect(engGain);ns.start();
  // slow throb so the drone breathes
  const lfo=AC.createOscillator(),lg=AC.createGain();lfo.frequency.value=5.5;lg.gain.value=30;lfo.connect(lg);lg.connect(engFilt.frequency);lfo.start();
  padGain=AC.createGain();padGain.gain.value=.05;padGain.connect(musicBus);
  [55,82.4,110].forEach((f,i)=>{const o=AC.createOscillator();o.type='sine';o.frequency.value=f;
    const g=AC.createGain();g.gain.value=.25/(i+1);o.connect(g);g.connect(padGain);o.start();});
  // start the synthwave music bed (lookahead scheduler, independent of the render loop)
  musicGain=AC.createGain();musicGain.gain.value=.0;musicGain.connect(musicBus);
  musicNextT=AC.currentTime+.1;musicStep=0;
  setInterval(musicSchedule,25);
}
/* ---- procedural cinematic score: strings, low brass, choir, taiko and a horn theme, intensity-driven ----
   Slow harmony (one chord a bar, eight bars to a cycle) with long swelling voices. Calm flying and the menus
   get pads, choir and sparse hits; combat adds taiko and a driving string ostinato; danger and capital
   fights swap in darker progressions. */
const MIN=[0,3,7,12],MAJ=[0,4,7,12];                // triad+oct semitone offsets
/* trench = Dm Bb F C Dm Bb Gm A · arena = Cm Ab Eb Bb Cm Ab Fm G · danger = Dm Dm Bb A Dm Db Bb A (low hull or incoming missiles)
   · capital = Dm Eb Dm Eb Bb C Eb A (heavy, phrygian colour). Roots are bass notes in Hz. */
const MUS_MOODS={
  trench:{root:[73.42,58.27,87.31,65.41,73.42,58.27,49.00,55.00],ch:[MIN,MAJ,MAJ,MAJ,MIN,MAJ,MIN,MAJ],bpm:[70,100]},
  arena:{root:[65.41,51.91,77.78,58.27,65.41,51.91,87.31,49.00],ch:[MIN,MAJ,MAJ,MAJ,MIN,MAJ,MIN,MAJ],bpm:[68,98]},
  danger:{root:[73.42,73.42,58.27,55.00,73.42,69.30,58.27,55.00],ch:[MIN,MIN,MAJ,MAJ,MIN,MAJ,MAJ,MAJ],bpm:[104,120]},
  capital:{root:[73.42,77.78,73.42,77.78,58.27,65.41,77.78,55.00],ch:[MIN,MAJ,MIN,MAJ,MAJ,MAJ,MAJ,MAJ],bpm:[76,92]},
};
const MENU_BPM=62;
/* horn theme: semitones over each bar's root (null = rest), one entry per half bar; used in the menus and quiet flying */
const THEME=[[7,12],[10,9],[12,17],[16,14],[12,15],[14,10],[7,null],[11,12]];
const mnote=(base,semi)=>base*Math.pow(2,semi/12);
/* shared noise buffer for drums and breath */
let mNoise=null;
function noiseBuf(){
  if(mNoise)return mNoise;
  mNoise=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);
  const d=mNoise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  return mNoise;
}
/* a sustained voice with a slow swell: attack is a fraction of the length, the tail rings out; cutoff opens during the swell */
function mswell(freq,t,dur,type,gain,cut,att,det){
  const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();
  o.type=type;o.frequency.value=freq;if(det)o.detune.value=det;
  f.type='lowpass';f.frequency.setValueAtTime(cut*.45,t);f.frequency.linearRampToValueAtTime(cut,t+dur*att);f.frequency.linearRampToValueAtTime(cut*.6,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain,t+dur*att);g.gain.linearRampToValueAtTime(gain*.7,t+dur*.8);g.gain.linearRampToValueAtTime(.0001,t+dur);
  o.connect(f);f.connect(g);g.connect(musicGain);o.start(t);o.stop(t+dur+.05);
}
/* choir: detuned triangle/saw voices through two vowel-like formant bands, slow attack */
function mchoir(freq,t,dur,gain){
  const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain,t+dur*.4);
  g.gain.linearRampToValueAtTime(gain*.8,t+dur*.75);g.gain.linearRampToValueAtTime(.0001,t+dur);g.connect(musicGain);
  const fm=[[700,1.0],[1150,.6]].map(([hz,q])=>{const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=hz;f.Q.value=4;
    const fg=AC.createGain();fg.gain.value=q;f.connect(fg);fg.connect(g);return f;});
  [-9,0,9].forEach((c,i)=>{const o=AC.createOscillator();o.type=i===1?'sawtooth':'triangle';o.frequency.value=freq;o.detune.value=c;
    fm.forEach(f=>o.connect(f));o.start(t);o.stop(t+dur+.05);});
}
/* plucked or bowed single note: horn, string stab or bell, chosen by type */
function mnoteVoice(freq,t,dur,type,gain,cut){
  const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();
  o.type=type;o.frequency.value=freq;f.type='lowpass';f.frequency.value=cut;
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain,t+Math.min(.18,dur*.3));g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(f);f.connect(g);g.connect(musicGain);o.start(t);o.stop(t+dur+.05);
}
/* taiko / war drum: pitched body drop plus a skin slap; size 0..1 */
function mtaiko(t,size){
  const o=AC.createOscillator(),g=AC.createGain();o.type='sine';
  o.frequency.setValueAtTime(95+size*20,t);o.frequency.exponentialRampToValueAtTime(38,t+.35);
  g.gain.setValueAtTime(.45+size*.35,t);g.gain.exponentialRampToValueAtTime(.001,t+.7+size*.5);
  o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+1.3);
  const src=AC.createBufferSource();src.buffer=noiseBuf();const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=900;f.Q.value=.8;
  const ng=AC.createGain();ng.gain.setValueAtTime(.18,t);ng.gain.exponentialRampToValueAtTime(.001,t+.12);
  src.connect(f);f.connect(ng);ng.connect(musicGain);src.start(t,Math.random(),.15);
}
/* quick roll hit for crescendos and ticking tension */
function mtick(t,gain){
  const src=AC.createBufferSource();src.buffer=noiseBuf();const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=2200;f.Q.value=1.2;
  const g=AC.createGain();g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+.07);
  src.connect(f);f.connect(g);g.connect(musicGain);src.start(t,Math.random(),.1);
}
function musicSchedule(){
  if(!AC||!musicGain)return;
  if(musicNextT<AC.currentTime-.2)musicNextT=AC.currentTime+.05; // resync after a stall
  const calm=S.mode!=='play'&&S.mode!=='paused';     // menus, debrief and end screens get the stately theme
  const M=MUS_MOODS[calm?'trench':musicMood]||MUS_MOODS.trench;
  const bpm=calm?MENU_BPM:M.bpm[0]+(M.bpm[1]-M.bpm[0])*musicIntent;
  const stepDur=(60/bpm)/4;                          // 16th note; tempo drifts up gently with intensity
  const barDur=stepDur*16;
  if(calm)musicGain.gain.value=.24;
  while(musicNextT<AC.currentTime+.12){
    const t=musicNextT, step=musicStep%16, bar=Math.floor(musicStep/16)%8;
    const root=M.root[bar], chord=M.ch[bar], I=calm?.25:musicIntent, mood=calm?'calm':musicMood;
    const fight=!calm&&(mood==='danger'||mood==='capital'||I>.2);   // quiet patrol flying stays ambient
    if(step===0){
      // string pad: five detuned saws spread over the chord, swelling in over the bar
      for(const sm of chord.slice(0,3)){const f=mnote(root*2,sm);
        mswell(f,t,barDur*1.15,'sawtooth',.03,1300+I*900,.45,-7);mswell(f,t,barDur*1.15,'sawtooth',.03,1300+I*900,.45,7);}
      mswell(root,t,barDur*1.2,'sine',.14,300,.3);                         // sub drone
      mswell(root*2,t,barDur*1.1,'sawtooth',.045+.04*I,500+I*600,.5);      // cello line
      // choir pad on the upper chord tones, louder as the fight grows
      if(calm||mood==='capital'||I>.45||bar%2===0)for(const sm of [chord[1],chord[2]])mchoir(mnote(root*4,sm),t,barDur*1.1,calm?.05:.025+.04*I);
      // low brass chord on the bar in a capital fight or a hard fight
      if(mood==='capital'||I>.6)for(const sm of chord.slice(0,3))mswell(mnote(root*2,sm),t,barDur*.9,'sawtooth',.05,900,.3);
    }
    // horn theme in the calm and in quiet patrol, one note every half bar
    if((calm||(!fight&&mood!=='danger'))&&step%8===0){
      const n=THEME[bar][step/8];if(n!=null)mnoteVoice(mnote(root*4,n),t,barDur*.55,'sawtooth',calm?.07:.045,1500);
    }
    // sparse high bell plucks give the ambient some air
    if(!fight&&(step===6||step===14)&&(bar%2===1||calm))mnoteVoice(mnote(root*8,chord[(bar+step)%chord.length]),t,barDur*.5,'sine',.035,3500);
    if(calm){   // menu: stately taiko every other bar, a rising roll into the loop
      if(step===0&&bar%2===0)mtaiko(t,bar===0?1:.4);
      if(bar===7&&step>=8&&step%2===0)mtick(t,.04+.02*(step-8));
      if(bar===7&&step===14)mtaiko(t,.8);
    }else if(fight){   // combat: driving string ostinato and taiko, thicker with intensity
      if(step%2===0)mnoteVoice(step%4===0?root*2:mnote(root*2,chord[2]),t,stepDur*1.6,'sawtooth',.035+.045*I,900+I*900);   // root/fifth pulse
      if(step===0||(step===8&&I>.35))mtaiko(t,.5+.4*I);
      if(I>.5&&(step===6||step===14))mtaiko(t,.3);
      if(I>.7&&step%4===2)mtick(t,.03);
      if(mood==='danger'){                               // tension: fast tremolo ticks and a tritone sting
        mtick(t,.025);
        if(step===0)mswell(mnote(root*4,6),t,barDur*.9,'sawtooth',.04,1600,.6);
      }
    }
    musicStep++;musicNextT+=stepDur;
  }
}
function setMuted(m){
  S.muted=m;try{localStorage.setItem('neonTrench.mute',m?'1':'0');}catch(e){}
  applyAudioLevels();
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
const SFX_WET={mslboom:.6,win:.3,boost:.1,boom:.45,bigboom:.6,laser:.18,msl:.3,elaunch:.3,ezap:.25,flyby:.2,hit:.15,shieldhit:.15};
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
    // punchy twin-oscillator "pew" with a filtered sweep, a body thump and a noise crack; pitch varies a little per shot
    const r=.92+Math.random()*.16;
    const o=AC.createOscillator(),o2=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();
    o.type='sawtooth';o2.type='square';f.type='lowpass';
    o.frequency.setValueAtTime(1900*r,t);o.frequency.exponentialRampToValueAtTime(210*r,t+.11);
    o2.frequency.setValueAtTime(2850*r,t);o2.frequency.exponentialRampToValueAtTime(150*r,t+.13);
    f.frequency.setValueAtTime(3800,t);f.frequency.exponentialRampToValueAtTime(600,t+.12);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.15,t+.003);
    g.gain.exponentialRampToValueAtTime(.001,t+.14);
    o.connect(f);o2.connect(f);f.connect(g);g.connect(out);
    o.start(t);o2.start(t);o.stop(t+.15);o2.stop(t+.15);
    const th=AC.createOscillator(),tg=AC.createGain();th.type='sine';
    th.frequency.setValueAtTime(260*r,t);th.frequency.exponentialRampToValueAtTime(60,t+.09);
    tg.gain.setValueAtTime(.22,t);tg.gain.exponentialRampToValueAtTime(.001,t+.1);
    th.connect(tg);tg.connect(out);th.start(t);th.stop(t+.11);
    const nd=.03,nbuf=AC.createBuffer(1,AC.sampleRate*nd,AC.sampleRate),dd=nbuf.getChannelData(0);
    for(let k=0;k<dd.length;k++)dd[k]=(Math.random()*2-1)*(1-k/dd.length);
    const ns=AC.createBufferSource();ns.buffer=nbuf;const nf=AC.createBiquadFilter();nf.type='highpass';nf.frequency.value=3000;
    const ng=AC.createGain();ng.gain.value=.12;ns.connect(nf);nf.connect(ng);ng.connect(out);ns.start(t);
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
  }else if(type==='msl'){             // launch: rail clunk, ignition crack, then a rising motor roar
    const th=AC.createOscillator(),tg=AC.createGain();th.type='sine';
    th.frequency.setValueAtTime(160,t);th.frequency.exponentialRampToValueAtTime(45,t+.2);
    tg.gain.setValueAtTime(.5,t);tg.gain.exponentialRampToValueAtTime(.001,t+.25);
    th.connect(tg);tg.connect(out);th.start(t);th.stop(t+.26);
    const dur=1.3,buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.3);
    const src=AC.createBufferSource();src.buffer=buf;
    const f=AC.createBiquadFilter();f.type='bandpass';f.Q.value=1.1;
    f.frequency.setValueAtTime(350,t);f.frequency.exponentialRampToValueAtTime(3200,t+1.0);
    const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.45,t+.06);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    src.connect(f);f.connect(g);g.connect(out);src.start(t);
    const cb=AC.createBuffer(1,AC.sampleRate*.05,AC.sampleRate),cd=cb.getChannelData(0);
    for(let i=0;i<cd.length;i++)cd[i]=(Math.random()*2-1)*(1-i/cd.length);
    const cs=AC.createBufferSource();cs.buffer=cb;const cf=AC.createBiquadFilter();cf.type='highpass';cf.frequency.value=2500;
    const cg=AC.createGain();cg.gain.value=.4;cs.connect(cf);cf.connect(cg);cg.connect(out);cs.start(t+.03);
  }else if(type==='mslboom'){         // missile impact: bright crack, deep sub drop, rumbling debris tail
    const dur=1.4,buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.2);
    const src=AC.createBufferSource();src.buffer=buf;
    const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(2400,t);f.frequency.exponentialRampToValueAtTime(70,t+dur);
    const g=AC.createGain();g.gain.value=.85;src.connect(f);f.connect(g);g.connect(out);src.start(t);
    const o=AC.createOscillator(),og=AC.createGain();o.type='sine';
    o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(28,t+.6);
    og.gain.setValueAtTime(.8,t);og.gain.exponentialRampToValueAtTime(.001,t+.7);
    o.connect(og);og.connect(out);o.start(t);o.stop(t+.72);
    const cb=AC.createBuffer(1,AC.sampleRate*.08,AC.sampleRate),cd=cb.getChannelData(0);
    for(let i=0;i<cd.length;i++)cd[i]=(Math.random()*2-1)*Math.pow(1-i/cd.length,1.2);
    const cs=AC.createBufferSource();cs.buffer=cb;const cf=AC.createBiquadFilter();cf.type='highpass';cf.frequency.value=1800;
    const cg=AC.createGain();cg.gain.value=.5;cs.connect(cf);cf.connect(cg);cg.connect(out);cs.start(t);
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
  }else if(type==='boost'){           // afterburner kick: rising noise whoosh with a low thump
    const dur=.7,buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const src=AC.createBufferSource();src.buffer=buf;
    const f=AC.createBiquadFilter();f.type='bandpass';f.Q.value=1.2;
    f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(2200,t+.5);
    const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+.12);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    src.connect(f);f.connect(g);g.connect(out);src.start(t);
    const o=AC.createOscillator(),og=AC.createGain();o.type='sine';
    o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(40,t+.25);
    og.gain.setValueAtTime(.3,t);og.gain.exponentialRampToValueAtTime(.001,t+.3);
    o.connect(og);og.connect(out);o.start(t);o.stop(t+.32);
  }else if(type==='ui'){              // menu button click
    const o=AC.createOscillator(),g=AC.createGain();o.type='sine';
    o.frequency.setValueAtTime(700,t);o.frequency.exponentialRampToValueAtTime(1100,t+.04);
    g.gain.setValueAtTime(.08,t);g.gain.exponentialRampToValueAtTime(.001,t+.07);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+.08);
  }else if(type==='win'){             // mission-complete stinger: rising major arpeggio
    [0,4,7,12,16].forEach((s,i)=>{
      const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';o.frequency.value=mnote(330,s);
      const t0=t+.5+i*.11;g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.16,t0+.02);g.gain.exponentialRampToValueAtTime(.001,t0+.9);
      o.connect(g);g.connect(out);o.start(t0);o.stop(t0+.95);});
  }else if(type==='killping'){        // kill confirmed: a bright two-note rise, a step higher for each kill in the combo
    const k=Math.min(8,S.combo||0),f0=880*Math.pow(2,k/12);
    [0,7].forEach((st,i)=>{
      const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';o.frequency.value=f0*Math.pow(2,st/12);
      const t0=t+i*.05;g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.12,t0+.008);g.gain.exponentialRampToValueAtTime(.001,t0+.16);
      o.connect(g);g.connect(out);o.start(t0);o.stop(t0+.18);});
  }else if(type==='whiz'){            // an enemy bolt passing close: a short falling hiss
    const dur=.22,buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.4);
    const src=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();src.buffer=buf;
    f.type='bandpass';f.Q.value=3;f.frequency.setValueAtTime(3200,t);f.frequency.exponentialRampToValueAtTime(700,t+dur);
    g.gain.setValueAtTime(.16,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    src.connect(f);f.connect(g);g.connect(out);src.start(t);src.stop(t+dur);
  }else if(type==='tick'){            // hit confirmed (not a kill) — sharp, short, unobtrusive
    const o=AC.createOscillator(),g=AC.createGain();o.type='square';
    o.frequency.setValueAtTime(1500,t);
    g.gain.setValueAtTime(.10,t);g.gain.exponentialRampToValueAtTime(.001,t+.045);
    o.connect(g);g.connect(out);o.start(t);o.stop(t+.05);
  }
}
/* hit confirmation: a quick on-screen marker + sfx the instant a shot connects (a kill adds a rising ping to the explosion) */
function hitMarker(kind){S.hitMarkKind=kind;S.hitMarkT=kind==='kill'?.35:.22;sfx(kind==='kill'?'killping':'tick');}

/* browsers keep audio locked until the first click or key, so start it then: the menu theme plays before any run */
function audioWake(){audioInit();if(AC.state==='suspended')AC.resume();}
['pointerdown','keydown'].forEach(ev=>addEventListener(ev,audioWake,{once:true,capture:true}));
/* soft click on any menu button */
document.addEventListener('click',e=>{if(AC&&e.target.closest&&e.target.closest('button'))sfx('ui');});
