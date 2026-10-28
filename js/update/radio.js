"use strict";
/* Radio chatter: campaign ops play the timed lines in STORY[id].radio (js/data/story.js), plus reactive ones from
   RADIO_GENERIC (hull low, a wingman shot down, a capital ship destroyed). One line shows at a time over the HUD; the rest queue.
   voxHtml() also renders the voiced lines on the briefing, debrief and promotion screens. */
const RADIO_SHOW=4.6;   // seconds a line stays up
const voxHtml=lines=>(lines||[]).filter(Boolean).map(([w,t])=>'<div><b style="color:'+CAST[w].col+'">'+CAST[w].name+'</b> '+t+'</div>').join('');
function radioSay(who,text){S.radio.q.push([who,text]);}
function radioPick(a){return a[(Math.random()*a.length)|0];}
function updateRadio(fr){
  const R=S.radio,m=S.mission;
  fleetTipsFrame(fr);   // first-time fleet battle tips (js/fleettips.js)
  if(!m||S.school)return;
  const st=STORY[m.id];
  while(st&&R.i<st.radio.length&&S.time>=st.radio[R.i][0]){radioSay(st.radio[R.i][1],st.radio[R.i][2]);R.i++;}
  if(!R.low&&S.hull<30&&S.hull>0){R.low=true;const [w,t]=radioPick(RADIO_GENERIC.lowhull.filter(l=>wingmen.length||l[0]==='reyes'));radioSay(w,t);}
  if(S.wingDowned.length>R.downs){const c=S.wingDowned[S.wingDowned.length-1];R.downs=S.wingDowned.length;
    const [w,t]=radioPick(RADIO_GENERIC.wingDown);radioSay(w,t.replace('{c}',c.toUpperCase()));}
  if(!R.cap&&S.capDown){R.cap=true;const [w,t]=radioPick(RADIO_GENERIC.capDown);radioSay(w,t);}
  if(R.t>0){R.t-=fr.rdt||fr.dt;if(R.t<=0)radioBox.style.opacity=0;}
  if(R.t<=0&&R.q.length){const [w,t]=R.q.shift();
    radioWho.textContent=CAST[w].name;radioWho.style.color=CAST[w].col;radioTxt.textContent=t;
    radioBox.style.opacity=1;R.t=RADIO_SHOW;}
}
