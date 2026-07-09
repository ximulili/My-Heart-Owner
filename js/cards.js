/* cards.js — 字卡系统：抽取/过滤/组合回复/分组管理 */
H.cards = (function(){
  const COLORS = ['#07C160','#8B5CF6','#7B9EA8','#D4A0A0','#F4A261','#E08A8A','#6D28D9','#3ECFCF'];
  function colorFor(name){ let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))%997; return COLORS[h%COLORS.length]; }

  async function getPool(){
    const cards = await H.store.getCards();
    const groups = await H.store.getGroups();
    const disabledGroups = new Set(groups.filter(g=>g.disabled).map(g=>g.id));
    return cards.filter(c=>!c.disabled && !disabledGroups.has(c.groupId));
  }
  function pickN(arr, n){
    const copy=[...arr], res=[];
    for(let i=0;i<n && copy.length;i++){ const idx=Math.floor(Math.random()*copy.length); res.push(copy.splice(idx,1)[0]); }
    return res;
  }
  // 衰减加权：偏向 min
  function weightedBetween(min, max){
    min=Math.max(1,Math.min(min,max)); max=Math.max(min,max);
    let v=min; while(v<max && Math.random()<0.45) v++; return v;
  }

  // 生成一组回复消息（连发），每条由若干字卡空格拼接
  async function generateReply(){
    const pool = await getPool();
    if(!pool.length) return [];
    const s = await H.store.getSettings();
    const burst = weightedBetween(s.burstMin, Math.min(s.burstMax, s.burstCap));
    const msgs=[];
    for(let i=0;i<burst;i++){
      const cardN = Math.min(weightedBetween(s.cardMin, Math.min(s.cardMax, s.cardCap)), pool.length);
      const picks = pickN(pool, cardN);
      let text = picks.map(p=>p.text).join(' ');
      if(Math.random()*100 < (s.attachStickerChance||0)){
        const st = await H.sticker.randomAttach();
        if(st) text += ' ' + st;
      }
      msgs.push(text);
    }
    return msgs;
  }

  // ---- CRUD ----
  async function addCard(text, groupId){
    const cards = await H.store.getCards();
    const c = { id: H.store.uid(), groupId: groupId||'', text, disabled:false };
    cards.push(c); await H.store.saveCards(cards); return c;
  }
  async function updateCard(id, patch){
    const cards = await H.store.getCards();
    const c = cards.find(x=>x.id===id); if(c){ Object.assign(c, patch); await H.store.saveCards(cards); }
  }
  async function deleteCard(id){
    let cards = await H.store.getCards();
    cards = cards.filter(x=>x.id!==id); await H.store.saveCards(cards);
  }
  async function addGroup(name){
    const groups = await H.store.getGroups();
    const g = { id: H.store.uid(), name, color: colorFor(name), disabled:false };
    groups.push(g); await H.store.saveGroups(groups); return g;
  }
  async function deleteGroup(id){
    let groups = await H.store.getGroups(); groups = groups.filter(g=>g.id!==id); await H.store.saveGroups(groups);
    const cards = await H.store.getCards();
    cards.forEach(c=>{ if(c.groupId===id) c.groupId=''; });
    await H.store.saveCards(cards);
  }
  async function renameGroup(id, name){
    const groups = await H.store.getGroups();
    const g = groups.find(x=>x.id===id); if(g){ g.name=name; g.color=colorFor(name); await H.store.saveGroups(groups); }
  }
  async function toggleGroup(id){
    const groups = await H.store.getGroups();
    const g = groups.find(x=>x.id===id); if(g){ g.disabled=!g.disabled; await H.store.saveGroups(groups); }
  }

  // ---- 管理 UI ----
  let curFilter = 'all'; // all | groupId | ungrouped
  let kw = '';

  async function openManager(){
    await renderManager();
  }
  async function renderManager(){
    const groups = await H.store.getGroups();
    const cards = await H.store.getCards();
    let shown = cards;
    if(curFilter==='ungrouped') shown = shown.filter(c=>!c.groupId);
    else if(curFilter!=='all') shown = shown.filter(c=>c.groupId===curFilter);
    if(kw) shown = shown.filter(c=>c.text.includes(kw));

    const groupTabs = groups.map(g=>`<button class="group-tab ${curFilter===g.id?'active':''}" data-gid="${g.id}" style="${curFilter===g.id?'background:'+g.color:''}"><span class="group-dot" style="background:${g.color}"></span>${esc(g.name)}${g.disabled?' (禁)':''}</button>`).join('');
    const list = shown.length ? shown.map(c=>{
      const g = groups.find(x=>x.id===c.groupId);
      return `<div class="card-item"><span class="group-dot" style="background:${g?g.color:'#ccc'}"></span><span class="ctext" title="${esc(c.text)}">${esc(c.text)}</span><button class="cbtn" data-act="toggle" data-id="${c.id}">${c.disabled?'启用':'屏蔽'}</button><button class="cbtn" data-act="edit" data-id="${c.id}">改</button><button class="cbtn" data-act="del" data-id="${c.id}">删</button></div>`;
    }).join('') : '<div class="combo-empty">还没有字卡，点「新建字卡」添加</div>';

    H.ui.modal('字卡管理', `
      <div class="card-toolbar">
        <input class="card-search" id="cardKw" placeholder="搜索字卡..." value="${esc(kw)}">
        <button class="btn-ghost" id="newGroup">新建分组</button>
        <button class="btn-primary" id="newCard">新建字卡</button>
        <button class="btn-ghost" id="importCards">导入字卡</button>
        <button class="btn-ghost" id="exportCards">导出字卡</button>
      </div>
      <div class="card-group-tabs">
        <button class="group-tab ${curFilter==='all'?'active':''}" data-gid="all" style="${curFilter==='all'?'background:var(--primary);color:#fff':''}">全部</button>
        <button class="group-tab ${curFilter==='ungrouped'?'active':''}" data-gid="ungrouped" style="${curFilter==='ungrouped'?'background:var(--primary);color:#fff':''}">未分组</button>
        ${groupTabs}
      </div>
      <div class="card-list">${list}</div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        ${groups.map(g=>`<button class="btn-ghost" data-mg="${g.id}">${esc(g.name)}:改名/删/禁</button>`).join('')}
      </div>
    `, bindManager);
  }
  function bindManager(box){
    box.querySelector('#cardKw').oninput = (e)=>{ kw=e.target.value; };
    box.querySelector('#cardKw').onkeydown = (e)=>{ if(e.key==='Enter') renderManager(); };
    box.querySelectorAll('[data-gid]').forEach(b=>b.onclick=()=>{ curFilter=b.dataset.gid; renderManager(); });
    box.querySelector('#importCards').onclick=()=>H.imexport.openImport();
    box.querySelector('#exportCards').onclick=()=>H.imexport.openExport();
    box.querySelector('#newCard').onclick = async ()=>{
      const groups = await H.store.getGroups();
      const opts = '<option value="">未分组</option>' + groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');
      H.ui.prompt('新建字卡', `<textarea id="p_text" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:14px" placeholder="字卡内容"></textarea><div style="margin-top:8px"><label style="font-size:13px">分组：</label><select id="p_grp" style="padding:4px;border:1px solid var(--border);border-radius:6px">${opts}</select></div>`, async (b2)=>{
        const t = b2.querySelector('#p_text').value.trim();
        if(!t){ H.ui.toast('内容不能为空'); return; }
        await addCard(t, b2.querySelector('#p_grp').value);
        H.ui.closeModal(); renderManager();
      });
    };
    box.querySelector('#newGroup').onclick = ()=>{
      H.ui.prompt('新建分组', `<input id="p_name" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:14px" placeholder="分组名">`, async (b2)=>{
        const n = b2.querySelector('#p_name').value.trim();
        if(!n){ H.ui.toast('名称不能为空'); return; }
        await addGroup(n); H.ui.closeModal(); renderManager();
      });
    };
    box.querySelectorAll('[data-act]').forEach(b=>b.onclick=async ()=>{
      const id=b.dataset.id, act=b.dataset.act;
      if(act==='del'){ await deleteCard(id); renderManager(); }
      else if(act==='toggle'){ await updateCard(id,{disabled: !(await H.store.getCards()).find(c=>c.id===id).disabled}); renderManager(); }
      else if(act==='edit'){
        const cards=await H.store.getCards(); const c=cards.find(x=>x.id===id);
        const groups=await H.store.getGroups();
        const opts='<option value="">未分组</option>'+groups.map(g=>`<option value="${g.id}" ${g.id===c.groupId?'selected':''}>${esc(g.name)}</option>`).join('');
        H.ui.prompt('编辑字卡', `<textarea id="p_text" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:14px">${esc(c.text)}</textarea><div style="margin-top:8px"><label style="font-size:13px">分组：</label><select id="p_grp" style="padding:4px;border:1px solid var(--border);border-radius:6px">${opts}</select></div>`, async (b2)=>{
          const t=b2.querySelector('#p_text').value.trim();
          if(!t){ H.ui.toast('内容不能为空'); return; }
          await updateCard(id,{text:t, groupId:b2.querySelector('#p_grp').value});
          H.ui.closeModal(); renderManager();
        });
      }
    });
    box.querySelectorAll('[data-mg]').forEach(b=>b.onclick=async ()=>{
      const gid=b.dataset.mg;
      const groups=await H.store.getGroups(); const g=groups.find(x=>x.id===gid);
      H.ui.prompt('管理分组：'+g.name, `<button class="btn-ghost" id="g_rename" style="width:100%;margin-bottom:8px">改名</button><button class="btn-ghost" id="g_toggle" style="width:100%;margin-bottom:8px">${g.disabled?'启用分组':'禁用分组'}</button><button class="btn-ghost" id="g_del" style="width:100%;color:#c00">删除分组（字卡变未分组）</button>`, async (b2)=>{
        if(b2.querySelector('#g_rename')) b2.querySelector('#g_rename').onclick=()=>{
          H.ui.prompt('改名', `<input id="p_name" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px" value="${esc(g.name)}">`, async (b3)=>{
            const n=b3.querySelector('#p_name').value.trim(); if(n){ await renameGroup(gid,n); }
            H.ui.closeModal(); renderManager();
          });
        };
        b2.querySelector('#g_toggle').onclick=async ()=>{ await toggleGroup(gid); H.ui.closeModal(); renderManager(); };
        b2.querySelector('#g_del').onclick=async ()=>{ await deleteGroup(gid); H.ui.closeModal(); renderManager(); };
      });
    });
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  return { generateReply, getPool, addCard, updateCard, deleteCard, addGroup, deleteGroup, renameGroup, toggleGroup, openManager, colorFor };
})();
