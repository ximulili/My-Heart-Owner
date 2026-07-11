/* poke.js — 拍一拍：面板/抖动/自定义动作/对方主动拍 */
H.poke = (function(){
  let currentTarget='other'; // 'other' 或 'me'
  async function openPanel(target){
    currentTarget=target||'other';
    const overlay=document.getElementById('pokeOverlay');
    const actions=await H.store.getPokeActions();
    const s=await H.store.getSettings();
    const big=document.getElementById('pokeBigAvatar');
    const avatarSrc = currentTarget==='me' ? (s.meAvatar||'assets/default-avatar.svg') : (s.otherAvatar||'assets/default-avatar.svg');
    big.style.backgroundImage=`url('${avatarSrc}')`;
    const scroll=document.getElementById('pokeActionsScroll');
    scroll.innerHTML = actions.length
      ? actions.map(a=>`<button class="poke-action-btn" data-id="${a.id}">${a.emoji||''} ${esc(a.action)}<span class="del" data-del="${a.id}">×</span></button>`).join('')
      : '<span style="color:var(--text-sub);font-size:12px">还没有动作，点 + 添加</span>';
    overlay.hidden=false;
    bindPanel();
  }
  function bindPanel(){
    const overlay=document.getElementById('pokeOverlay');
    overlay.onclick=(e)=>{ if(e.target===overlay) closePanel(); };
    document.getElementById('pokeBigAvatar').onclick=async ()=>{
      const actions=await H.store.getPokeActions();
      if(!actions.length){ H.ui.toast('先添加拍一拍动作'); return; }
      doAction(actions[Math.floor(Math.random()*actions.length)], currentTarget);
    };
    document.querySelectorAll('#pokeActionsScroll [data-id]').forEach(b=>b.onclick=async (e)=>{
      if(e.target.dataset.del){ e.stopPropagation(); await delAction(e.target.dataset.del); openPanel(currentTarget); return; }
      const actions=await H.store.getPokeActions();
      doAction(actions.find(x=>x.id===b.dataset.id), currentTarget);
    });
    document.getElementById('pokeAddBtn').onclick=addAction;
  }
  function closePanel(){ document.getElementById('pokeOverlay').hidden=true; }
  function shake(target){
    const big=document.getElementById('pokeBigAvatar');
    big.classList.remove('shaking'); void big.offsetWidth; big.classList.add('shaking');
    setTimeout(()=>big.classList.remove('shaking'),600);
    const avId = target==='me' ? 'meAvatar' : 'otherAvatar';
    const av=document.getElementById(avId);
    if(av){ av.classList.remove('avatar-shaking'); void av.offsetWidth; av.classList.add('avatar-shaking'); setTimeout(()=>av.classList.remove('avatar-shaking'),600); }
  }
  async function doAction(a, target){
    shake(target||'other');
    const s=await H.store.getSettings();
    const actorName = target==='me' ? (s.meName||'我') : (s.meName||'我');
    const targetName = target==='me' ? (s.meName||'我') : (s.partnerName||'TA');
    H.chat.appendSystem(`${actorName} ${a.action} ${targetName}${a.emoji||''}`);
    closePanel();
  }
  function addAction(){
    H.ui.prompt('添加拍一拍动作', `<div style="display:flex;gap:8px"><input id="p_emoji" style="width:64px;padding:8px;border:1px solid var(--border);border-radius:6px;text-align:center;font-size:18px" placeholder="😊" maxlength="2"><input id="p_action" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:6px" placeholder="动作文案，如 摸了摸头"></div>`, async (b)=>{
      const emoji=b.querySelector('#p_emoji').value.trim();
      const action=b.querySelector('#p_action').value.trim();
      if(!action){ H.ui.toast('文案不能为空'); return; }
      const actions=await H.store.getPokeActions();
      actions.push({id:H.store.uid(), label:action, action, emoji});
      await H.store.savePokeActions(actions);
      H.ui.closeModal(); openPanel();
    });
  }
  async function delAction(id){
    let actions=await H.store.getPokeActions();
    actions=actions.filter(a=>a.id!==id);
    await H.store.savePokeActions(actions);
  }
  async function otherPokeMe(){
    const actions=await H.store.getPokeActions();
    if(!actions.length) return;
    const a=actions[Math.floor(Math.random()*actions.length)];
    const s=await H.store.getSettings();
    H.chat.appendSystem(`${s.partnerName||'TA'} ${a.action} ${s.meName||'我'}${a.emoji||''}`);
    const meAv=document.getElementById('meAvatar');
    meAv.classList.remove('avatar-shaking'); void meAv.offsetWidth; meAv.classList.add('avatar-shaking');
    setTimeout(()=>meAv.classList.remove('avatar-shaking'),600);
  }
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  return { openPanel, otherPokeMe, addAction };
})();
