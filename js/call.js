/* call.js — 通话模拟：语音/视频/主动来电/对方主动挂断/浮动窗拖拽 */
H.call = (function(){
  let state='idle'; // idle|calling|incoming|connected
  let type='voice';
  let timer=null, seconds=0, hangupT=null, callStart=0, incomingTimer=null;

  const HANGUP_SVG='<svg viewBox="0 0 24 24" class="icon"><path d="M12 9c-1.6 0-3.1.3-4.5.8v3c0 .5-.4 1-1 1H4.5c-.5 0-1-.4-1-1V9.8C5.5 7.8 8.6 6.5 12 6.5s6.5 1.3 8.5 3.3v3c0 .5-.4 1-1 1h-2c-.5 0-1-.4-1-1v-3C15.1 9.3 13.6 9 12 9z" fill="currentColor"/></svg>';

  function fmt(n){ const m=Math.floor(n/60),s=n%60; return (m<10?'0':'')+m+':'+(s<10?'0':'')+s; }
  function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

  async function start(t){
    if(state!=='idle') return;
    type=t; state='calling';
    showWindow('calling');
    await delay(2000+Math.random()*2000);
    if(state!=='calling') return;
    const s=await H.store.getSettings();
    const r=Math.random()*100;
    if(r < s.callAnswerRate){ connect(); }
    else if(r < s.callAnswerRate + s.callBusyRate){ H.chat.appendSystem(`${s.partnerName||'TA'}正在忙，未接听来电`); reset(); }
    else { H.chat.appendSystem(`${s.partnerName||'TA'}拒绝了通话`); reset(); }
  }
  async function incoming(t){
    if(state!=='idle') return;
    type=t; state='incoming';
    showWindow('incoming');
    incomingTimer=setTimeout(()=>{ if(state==='incoming'){ H.store.getSettings().then(s=>H.chat.appendSystem(`📞${s.meName||'我'}未接听${s.partnerName||'TA'}的来电`)); reset(); } },20000);
  }
  function connect(){
    state='connected'; seconds=0; callStart=Date.now();
    document.getElementById('callStatusDot').classList.add('connected');
    document.getElementById('callStatusText').textContent='通话中';
    const ctrl=document.querySelector('.call-controls');
    ctrl.innerHTML=`<button class="call-hangup" id="callHangup">${HANGUP_SVG}</button>`;
    document.getElementById('callHangup').onclick=hangup;
    if(type==='video') showVideoPane();
    timer=setInterval(()=>{ seconds=Math.floor((Date.now()-callStart)/1000); document.getElementById('callTimer').textContent=fmt(seconds); },1000);
    H.store.getSettings().then(s=>{
      if(Math.random()*100 < (s.hangupChance||0)){
        const after=(s.hangupMinSec||15)*1000 + Math.random()*10000;
        hangupT=setTimeout(()=>{
          if(state==='connected'){ H.chat.appendSystem(`${s.partnerName||'TA'} 挂断了通话`); hangup(); }
        }, after);
      }
    });
  }
  function hangup(){
    if(state==='idle') return;
    const cur=Math.floor((Date.now()-callStart)/1000), curType=type;
    clearInterval(timer); timer=null; clearTimeout(hangupT); hangupT=null;
    H.store.getSettings().then(s=>{
      if(state==='connected' && cur>0){
        H.chat.appendSystem(`📞 ${curType==='video'?'视频':'语音'}通话 ${fmt(cur)}`);
      }
      reset();
    });
  }
  function answer(){ if(state==='incoming'){ clearTimeout(incomingTimer); incomingTimer=null; connect(); } }
  function rejectIncoming(){ if(state==='incoming'){ clearTimeout(incomingTimer); incomingTimer=null; reset(); H.store.getSettings().then(s=>H.chat.appendSystem((s.meName||'我')+'拒绝了通话')); } }

  function reset(){
    state='idle'; seconds=0; callStart=0; clearInterval(timer); timer=null; clearTimeout(hangupT); hangupT=null; clearTimeout(incomingTimer); incomingTimer=null;
    const w=document.getElementById('callWindow'); w.hidden=true; w.classList.remove('minimized','call-fullscreen'); w.style.left='';w.style.top='';w.style.right='';w.style.bottom='';
    document.getElementById('callStatusDot').classList.remove('connected');
    document.getElementById('callTimer').textContent='00:00';
    document.getElementById('callStatusText').textContent='呼叫中...';
    document.getElementById('callBody').querySelector('.call-video-pane')?.remove();
  }
  function showWindow(st){
    const w=document.getElementById('callWindow'); w.hidden=false; w.classList.remove('minimized');
    if(st==='incoming') w.classList.add('call-fullscreen'); else w.classList.remove('call-fullscreen');
    document.getElementById('callStatusDot').classList.remove('connected');
    H.store.getSettings().then(s=>{
      document.getElementById('callName').textContent=s.partnerName||'TA';
      document.getElementById('callAvatar').style.backgroundImage=`url('${s.otherAvatar||'assets/default-avatar.svg'}')`;
    });
    const statusEl=document.getElementById('callStatusText');
    const ctrl=document.querySelector('.call-controls');
    if(st==='calling'){ statusEl.textContent='呼叫中...'; ctrl.innerHTML=`<button class="call-hangup" id="callHangup">${HANGUP_SVG}</button>`; document.getElementById('callHangup').onclick=hangup; }
    else if(st==='incoming'){ statusEl.textContent='来电...'; ctrl.innerHTML=`<button class="call-hangup" id="callAnswer" style="background:#3ecf8e">${HANGUP_SVG}</button><button class="call-hangup" id="callRejectBtn" style="margin-left:20px">${HANGUP_SVG}</button>`; document.getElementById('callAnswer').onclick=answer; document.getElementById('callRejectBtn').onclick=rejectIncoming; }
  }
  function showVideoPane(){
    const body=document.getElementById('callBody');
    if(!body.querySelector('.call-video-pane')){
      const pane=document.createElement('div'); pane.className='call-video-pane'; pane.textContent='对方画面';
      body.insertBefore(pane, body.firstChild);
    }
  }

  function initDrag(){
    const w=document.getElementById('callWindow'), h=document.getElementById('callHeader');
    let dx,dy,dragging=false,startX=0,startY=0;
    h.addEventListener('pointerdown',(e)=>{ if(e.target.closest('#callMinimize,#callCloseBtn')) return; dragging=true; startX=e.clientX;startY=e.clientY; dx=e.clientX-w.offsetLeft; dy=e.clientY-w.offsetTop; h.setPointerCapture(e.pointerId); });
    h.addEventListener('pointermove',(e)=>{ if(dragging){ w.style.left=(e.clientX-dx)+'px'; w.style.top=(e.clientY-dy)+'px'; w.style.right='auto'; w.style.bottom='auto'; } });
    h.addEventListener('pointerup',()=>dragging=false);
    document.getElementById('callMinimize').onclick=()=>w.classList.toggle('minimized');
    h.addEventListener('click',(e)=>{
      if(e.target.closest('#callMinimize,#callCloseBtn')) return;
      if(w.classList.contains('minimized') && Math.abs(e.clientX-startX)<5 && Math.abs(e.clientY-startY)<5) w.classList.remove('minimized');
    });
    document.getElementById('callCloseBtn').onclick=hangup;
  }
  return { start, incoming, hangup, answer, initDrag, get state(){return state;} };
})();
