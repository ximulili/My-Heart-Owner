/* settings.js — 设置面板（6 分页） */
H.settings = (function(){
  let curPage='chat';
  const THEMES=[
    {id:'wechat',name:'微信白绿',bg:'#FFFFFF',p:'#07C160',s:'#95EC69'},
    {id:'purple',name:'黄紫撞色',bg:'#FAF9F6',p:'#8B5CF6',s:'#FCD34D'},
    {id:'blue',name:'莫兰迪雾霾蓝',bg:'#F5F6F7',p:'#7B9EA8',s:'#D4B5B0'},
    {id:'watercolor',name:'水彩',bg:'#FFFFFF',p:'#D4A0A0',s:'#7BB8D4'},
    {id:'pink',name:'粉白',bg:'#FFFBFC',p:'#FF7BA9',s:'#FFD6E0'}
  ];

  async function open(){
    const s=await H.store.getSettings();
    H.ui.modal('设置', await html(s), (box)=>bind(box,s));
  }
  async function html(s){
    return `
    <div class="settings-tabs">
      ${['chat:聊天行为','cards:字卡','call:通话','look:外观','status:状态格言','data:数据'].map(p=>{const [id,nm]=p.split(':');return `<button class="settings-tab ${curPage===id?'active':''}" data-pg="${id}">${nm}</button>`;}).join('')}
    </div>
    <div class="settings-page ${curPage==='chat'?'active':''}" data-pg="chat">${chatPage(s)}</div>
    <div class="settings-page ${curPage==='cards'?'active':''}" data-pg="cards">${await cardsPage()}</div>
    <div class="settings-page ${curPage==='call'?'active':''}" data-pg="call">${callPage(s)}</div>
    <div class="settings-page ${curPage==='look'?'active':''}" data-pg="look">${await lookPage(s)}</div>
    <div class="settings-page ${curPage==='status'?'active':''}" data-pg="status">${await statusPage()}</div>
    <div class="settings-page ${curPage==='data'?'active':''}" data-pg="data">${dataPage()}</div>`;
  }
  function row(label, sub, ctrl){ return `<div class="setting-row"><div class="setting-label">${label}${sub?`<small>${sub}</small>`:''}</div><div class="setting-ctrl">${ctrl}</div></div>`; }
  function num(id,v){ return `<input type="number" id="${id}" value="${v}">`; }

  function chatPage(s){
    return row('已读不回概率','%，已读后不回复的概率',num('noReplyChance',s.noReplyChance))
      + row('已读延迟','毫秒，送达→已读的最短时间',`<input type="number" id="readDelayMin" value="${s.readDelayMin}">`)
      + row('已读延迟','毫秒，送达→已读的最长时间',`<input type="number" id="readDelayMax" value="${s.readDelayMax}">`)
      + row('正在输入时长','秒，区间',`${num('typingMin',s.typingMin)}${num('typingMax',s.typingMax)}`)
      + row('连发条数','min / max / 上限',`${num('burstMin',s.burstMin)}${num('burstMax',s.burstMax)}${num('burstCap',s.burstCap)}`)
      + row('每条内字卡张数','min / max / 上限',`${num('cardMin',s.cardMin)}${num('cardMax',s.cardMax)}${num('cardCap',s.cardCap)}`)
      + row('附带表情概率','%，回复时附带emoji的概率',num('attachStickerChance',s.attachStickerChance));
  }
  async function cardsPage(){
    const cards=await H.store.getCards(); const groups=await H.store.getGroups();
    return `<p style="font-size:13px;color:var(--text-sub);margin-bottom:10px">当前 ${cards.length} 张字卡，${groups.length} 个分组。</p>
      <button class="btn-primary" id="openCardMgr" style="width:100%;margin-bottom:8px">打开字卡管理</button>
      <p style="font-size:11px;color:var(--text-sub)">字卡为空时对方不会回复。组合回复：连发 ${'<span>'}min~max 条，每条内拼 min~max 张，均受上限约束。</p>`;
  }
  function callPage(s){
    return row('接通率','%',num('callAnswerRate',s.callAnswerRate))
      + row('忙线率','%',num('callBusyRate',s.callBusyRate))
      + row('拒绝率','%',num('callRejectRate',s.callRejectRate))
      + row('对方主动挂断概率','%，接通后对方随机挂断',num('hangupChance',s.hangupChance))
      + row('最短通话时长','秒，挂断至少在此之后',num('hangupMinSec',s.hangupMinSec))
      + '<div style="font-size:12px;color:var(--text-sub);margin:10px 0 4px">对方主动行为（概率 %）</div>'
      + row('主动来电',`${num('activeCallChance',s.activeCallChance)}`)
      + row('主动发消息','最快/最慢 分钟，随机间隔必发',`${num('activeMsgMin',s.activeMsgMin)}${num('activeMsgMax',s.activeMsgMax)}`)
      + row('主动拍一拍',`${num('activePokeChance',s.activePokeChance)}`);
  }
  async function lookPage(s){
    const themeCards=THEMES.map(t=>`<div class="theme-card ${s.theme===t.id?'active':''}" data-theme="${t.id}"><div class="theme-swatches"><i style="background:${t.bg}"></i><i style="background:${t.p}"></i><i style="background:${t.s}"></i></div><div class="theme-name">${t.name}</div></div>`).join('');
    const bgPrev = s.chatBg ? `url("${s.chatBg}")` : 'var(--surface-2)';
    return `<div style="font-size:14px;margin-bottom:8px">主题</div><div class="theme-grid">${themeCards}</div>
      <div style="font-size:14px;margin:16px 0 8px">聊天背景（仅消息流区，独立于主题）</div>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:64px;height:64px;border-radius:8px;background:${bgPrev};background-size:cover;background-position:center;border:1px solid var(--border)"></div>
        <div><button class="btn-ghost" id="bgUpload">上传图片</button> <button class="btn-ghost" id="bgClear">清除背景</button></div>
      </div>
      <input type="file" id="bgFile" accept="image/*" hidden>
      <div style="font-size:14px;margin:16px 0 8px">角色</div>
      ${row('对方名字','',`<input type="text" id="partnerName" value="${esc(s.partnerName)}">`)}
      ${row('我的名字','',`<input type="text" id="meName" value="${esc(s.meName)}">`)}
      ${row('对方头像','','<button class="btn-ghost" id="editOtherAv">编辑</button>')}
      ${row('我的头像','','<button class="btn-ghost" id="editMeAv">编辑</button>')}`;
  }
  async function statusPage(){
    const pool=await H.store.getStatusPool(); const motto=await H.store.getMottoPool(); const me=await H.store.getMeStatus();
    return `<div style="font-size:14px;margin-bottom:6px">我的状态（手动编辑，不轮换）</div>
      ${row('心情','',`<input type="text" id="me_mood" value="${esc(me.mood)}" style="width:140px">`)}
      ${row('天气','',`<input type="text" id="me_weather" value="${esc(me.weather)}" style="width:140px">`)}
      ${row('在做什么','',`<input type="text" id="me_doing" value="${esc(me.doing)}" style="width:140px">`)}
      <div style="font-size:14px;margin:14px 0 6px">对方状态池（心情/天气/在做什么，随机轮换）</div>
      <div id="statusPoolList">${pool.length?pool.map(p=>`<div class="card-item"><span class="group-dot" style="background:var(--primary)"></span><span class="ctext">[${typeLabel(p.type)}] ${esc(p.text)}</span><button class="cbtn" data-sdel="${p.id}">删</button></div>`).join(''):'<div class="combo-empty">池子为空，对方状态显示占位</div>'}</div>
      <button class="btn-ghost" id="addStatus" style="width:100%;margin-top:8px">+ 添加状态</button>
      <div style="font-size:14px;margin:14px 0 6px">格言池（motto 标语条，随机轮换）</div>
      <div id="mottoPoolList">${motto.length?motto.map((t,i)=>`<div class="card-item"><span class="ctext">${esc(t)}</span><button class="cbtn" data-mdel="${i}">删</button></div>`).join(''):'<div class="combo-empty">格言池为空，显示 Heart</div>'}</div>
      <button class="btn-ghost" id="addMotto" style="width:100%;margin-top:8px">+ 添加格言</button>
      ${row('池子轮换频率','分钟',num('statusRotateMin',(await H.store.getSettings()).statusRotateMin))}`;
  }
  function dataPage(){
    return `<button class="btn-primary" id="doExport" style="width:100%;margin-bottom:8px">导出数据</button>
      <button class="btn-ghost" id="doImport" style="width:100%;margin-bottom:8px">导入数据</button>
      <button class="btn-ghost" id="openEmojiMgr" style="width:100%;margin-bottom:8px">Emoji 管理</button>
      <button class="btn-ghost" id="clearAll" style="width:100%;color:#c00">清空所有数据</button>`;
  }
  function typeLabel(t){ return {mood:'心情',weather:'天气',doing:'在做'}[t]||t; }

  async function bind(box, s){
    // 数字/文本字段 onblur 即时保存
    const numMap={noReplyChance:'noReplyChance',readDelayMin:'readDelayMin',readDelayMax:'readDelayMax',typingMin:'typingMin',typingMax:'typingMax',burstMin:'burstMin',burstMax:'burstMax',burstCap:'burstCap',cardMin:'cardMin',cardMax:'cardMax',cardCap:'cardCap',attachStickerChance:'attachStickerChance',callAnswerRate:'callAnswerRate',callBusyRate:'callBusyRate',callRejectRate:'callRejectRate',hangupChance:'hangupChance',hangupMinSec:'hangupMinSec',activeCallChance:'activeCallChance',activeMsgMin:'activeMsgMin',activeMsgMax:'activeMsgMax',activePokeChance:'activePokeChance'};
    for(const id in numMap){ const el=box.querySelector('#'+id); if(el) el.onblur=async ()=>{ await H.store.saveSettings({[numMap[id]]:+el.value||0}); }; }
    ['partnerName','meName'].forEach(id=>{ const el=box.querySelector('#'+id); if(el) el.onblur=async ()=>{ await H.store.saveSettings({[id]:el.value||''}); H.statusbar.render(); }; });

    box.querySelectorAll('.settings-tab').forEach(t=>t.onclick=()=>{ curPage=t.dataset.pg; open(); });
    // 聊天页保存
    // 通话页保存
    // 外观页
    box.querySelectorAll('[data-theme]').forEach(c=>c.onclick=async ()=>{
      await H.store.saveSettings({theme:c.dataset.theme}); H.app.applyTheme(); open();
    });
    box.querySelector('#bgUpload')&&(box.querySelector('#bgUpload').onclick=()=>box.querySelector('#bgFile').click());
    box.querySelector('#bgFile')&&(box.querySelector('#bgFile').onchange=async (e)=>{
      const f=e.target.files[0]; if(!f) return;
      if(f.size>2*1024*1024){ H.ui.toast('图片不能超过 2MB'); return; }
      const r=new FileReader(); r.onload=async ()=>{ await H.store.saveSettings({chatBg:r.result}); H.app.applyChatBg(); H.ui.toast('已设置背景'); open(); }; r.readAsDataURL(f);
    });
    box.querySelector('#bgClear')&&(box.querySelector('#bgClear').onclick=async ()=>{ await H.store.saveSettings({chatBg:''}); H.app.applyChatBg(); open(); });
    box.querySelector('#editOtherAv')&&(box.querySelector('#editOtherAv').onclick=()=>H.avatar.openEditor('other'));
    box.querySelector('#editMeAv')&&(box.querySelector('#editMeAv').onclick=()=>H.avatar.openEditor('me'));
    // 字卡页
    if(box.querySelector('#openCardMgr')) box.querySelector('#openCardMgr').onclick=()=>H.cards.openManager();
    // 状态页
    bindStatus(box);
    // 数据页
    if(box.querySelector('#doExport')) box.querySelector('#doExport').onclick=()=>H.imexport.openExport();
    if(box.querySelector('#doImport')) box.querySelector('#doImport').onclick=()=>H.imexport.openImport();
    if(box.querySelector('#openEmojiMgr')) box.querySelector('#openEmojiMgr').onclick=()=>H.sticker.openEmojiManager();
    if(box.querySelector('#clearAll')) box.querySelector('#clearAll').onclick=()=>{
      H.ui.actionSheet([{label:'确认清空所有数据',danger:true,fn:async ()=>{
        await H.store.set(H.store.KEYS.messages,[]); await H.store.set(H.store.KEYS.cards,[]); await H.store.set(H.store.KEYS.groups,[]); await H.store.set(H.store.KEYS.stickersMine,[]); await H.store.set(H.store.KEYS.stickersOther,[]); await H.store.set(H.store.KEYS.pokeActions,[]); await H.store.set(H.store.KEYS.statusPool,[]); await H.store.set(H.store.KEYS.mottoPool,[]); await H.store.set(H.store.KEYS.emojiCustom,[]);
        H.ui.closeModal(); H.chat.render(); H.statusbar.render(); H.ui.toast('已清空');
      }}]);
    };
  }
  async function bindStatus(box){
    if(!box.querySelector('#me_mood')) return;
    const saveMe=async ()=>{ await H.store.saveMeStatus({ mood:box.querySelector('#me_mood').value, weather:box.querySelector('#me_weather').value, doing:box.querySelector('#me_doing').value }); H.statusbar.render(); };
    ['me_mood','me_weather','me_doing'].forEach(id=>{ const el=box.querySelector('#'+id); el&&(el.onblur=saveMe); });
    box.querySelector('#addStatus')&&(box.querySelector('#addStatus').onclick=()=>{
      H.ui.prompt('添加状态', `<select id="p_type" style="padding:6px;border:1px solid var(--border);border-radius:6px"><option value="mood">心情</option><option value="weather">天气</option><option value="doing">在做什么</option></select><input id="p_text" style="width:100%;padding:8px;margin-top:8px;border:1px solid var(--border);border-radius:6px" placeholder="内容">`, async (b)=>{
        const t=b.querySelector('#p_type').value, x=b.querySelector('#p_text').value.trim();
        if(!x){ H.ui.toast('内容不能为空'); return; }
        const arr=await H.store.getStatusPool(); arr.push({id:H.store.uid(),type:t,text:x}); await H.store.saveStatusPool(arr);
        H.ui.closeModal(); open();
      });
    });
    box.querySelectorAll('[data-sdel]').forEach(b=>b.onclick=async ()=>{ let arr=await H.store.getStatusPool(); arr=arr.filter(p=>p.id!==b.dataset.sdel); await H.store.saveStatusPool(arr); open(); });
    box.querySelector('#addMotto')&&(box.querySelector('#addMotto').onclick=()=>{
      H.ui.prompt('添加格言', `<input id="p_text" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px" placeholder="一句格言/标语">`, async (b)=>{
        const x=b.querySelector('#p_text').value.trim(); if(!x){H.ui.toast('不能为空');return;}
        const arr=await H.store.getMottoPool(); arr.push(x); await H.store.saveMottoPool(arr); H.ui.closeModal(); open();
      });
    });
    box.querySelectorAll('[data-mdel]').forEach(b=>b.onclick=async ()=>{ let arr=await H.store.getMottoPool(); arr.splice(+b.dataset.mdel,1); await H.store.saveMottoPool(arr); open(); });
    box.querySelector('#statusRotateMin')&&(box.querySelector('#statusRotateMin').onblur=async ()=>{ await H.store.saveSettings({statusRotateMin:+box.querySelector('#statusRotateMin').value||15}); H.statusbar.stopStatusRotate(); H.statusbar.startStatusRotate(); H.statusbar.startMottoRotate(); });
  }
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  // 通用：保存当前页输入的数字字段
  async function saveNumFields(box, map){
    const patch={};
    for(const id in map){ const el=box.querySelector('#'+id); if(el) patch[map[id]]=+el.value||0; }
    await H.store.saveSettings(patch);
  }
  // 在 bind 末尾加一个保存按钮监听：这里简化为各 input onblur 保存
  // 为简洁，聊天页/通话页统一在关闭时保存
  const _origClose=()=>{};
  return { open };
})();
