/* sticker.js — 表情包：combo弹窗/图片上传/emoji选择与管理/随机附带 */
H.sticker = (function(){
  let curTab='mine';

  async function togglePopover(){
    const p=document.getElementById('comboPopover');
    if(!p.hidden){ p.hidden=true; return; }
    p.hidden=false;
    await renderPane(curTab);
  }
  function setTab(tab){
    curTab=tab;
    document.querySelectorAll('.combo-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
    document.querySelectorAll('.combo-pane').forEach(pn=>pn.classList.toggle('active',pn.dataset.pane===tab));
    renderPane(tab);
  }
  async function renderPane(tab){
    const content=document.querySelector(`.combo-pane[data-pane="${tab}"]`);
    if(tab==='poke'){
      const actions=await H.store.getPokeActions();
      content.innerHTML = actions.length
        ? `<div class="combo-grid">${actions.map(a=>`<div class="combo-item" data-poke="${a.id}" title="${esc(a.action)}">${a.emoji||''}<div style="font-size:9px;margin-top:2px">${esc(a.action)}</div></div>`).join('')}</div>`
        : '<div class="combo-empty">还没有动作，点右上 ＋ 添加</div>';
      content.querySelectorAll('[data-poke]').forEach(el=>el.onclick=async ()=>{
        const actions=await H.store.getPokeActions();
        const a=actions.find(x=>x.id===el.dataset.poke);
        if(a){ H.poke.openPanel(); }
      });
      return;
    }
    const who=tab==='mine'?'mine':'other';
    const imgs=await H.store.getStickers(who);
    let html='<div class="combo-grid">';
    let customEmoji=[];
    if(who==='mine'){
      customEmoji=await H.store.getEmojiCustom();
      html += customEmoji.map(e=>`<div class="combo-item" data-emoji="${esc(e)}">${e}</div>`).join('');
    }
    html += imgs.map(s=>`<div class="combo-item" data-img="${s.id}"><img src="${s.data}"></div>`).join('');
    html+='</div>';
    if(!imgs.length && !customEmoji.length && who==='mine') html='<div class="combo-empty">还没有表情，点右上 ＋ 添加</div>';
    else if(!imgs.length && who==='other') html='<div class="combo-empty">还没有表情，点右上 ＋ 上传图片</div>';
    content.innerHTML=html;
    content.querySelectorAll('[data-emoji]').forEach(el=>el.onclick=()=>{ H.chat.sendStickerEmoji(el.dataset.emoji); togglePopover(); });
    content.querySelectorAll('[data-img]').forEach(el=>el.onclick=async ()=>{
      const ss=await H.store.getStickers(who);
      const s=ss.find(x=>x.id===el.dataset.img);
      if(s){ H.chat.sendStickerImg(s.data); togglePopover(); }
    });
  }
  async function randomAttach(){
    const custom=await H.store.getEmojiCustom();
    const all=[...H.store.EMOJI_BUILTIN.flatMap(c=>c.items), ...custom];
    return all.length ? all[Math.floor(Math.random()*all.length)] : null;
  }
  async function uploadSticker(who, file){
    if(file.size>500*1024){ H.ui.toast('单张不能超过 500KB'); return; }
    const r=new FileReader();
    r.onload=async ()=>{
      const arr=await H.store.getStickers(who);
      arr.push({id:H.store.uid(), data:r.result});
      await H.store.saveStickers(who, arr);
      H.ui.toast('已添加');
      renderPane(curTab);
    };
    r.readAsDataURL(file);
  }
  function addCurrent(){
    if(curTab==='poke'){ H.poke.addAction(); return; }
    if(curTab==='mine' || curTab==='other'){
      const who=curTab;
      const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.hidden=true;
      inp.onchange=()=>{ if(inp.files[0]) uploadSticker(who, inp.files[0]); inp.remove(); };
      document.body.appendChild(inp); inp.click();
      return;
    }
  }
  async function openEmojiManager(){
    const builtin=H.store.EMOJI_BUILTIN;
    const custom=await H.store.getEmojiCustom();
    let html=`<div style="font-size:13px;margin-bottom:8px;color:var(--text-sub)">内置 emoji（共 ${builtin.reduce((n,c)=>n+c.items.length,0)} 个，可在表情面板直接用）</div>`;
    builtin.forEach(c=>{
      html+=`<div style="font-size:12px;margin:10px 0 4px;color:var(--text-sub)">${c.cat}（${c.items.length}）</div><div class="emoji-grid">${c.items.map(e=>`<div class="emoji-cell">${e}</div>`).join('')}</div>`;
    });
    html+=`<div style="font-size:12px;margin:14px 0 4px;color:var(--text-sub)">我的自定义 emoji（${custom.length}）</div><div class="emoji-grid" id="customGrid">${custom.length?custom.map((e,i)=>`<div class="emoji-cell custom" data-i="${i}">${e}<span class="rm">×</span></div>`).join(''):'<div class="combo-empty" style="grid-column:1/-1">还没有自定义</div>'}</div>`;
    html+=`<div style="margin-top:12px"><button class="btn-ghost" id="addEmoji">＋ 添加自定义 emoji</button></div>`;
    H.ui.modal('Emoji 管理', html, (box)=>{
      box.querySelector('#addEmoji').onclick=()=>{
        H.ui.prompt('添加 emoji', `<input id="p_e" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:20px" placeholder="粘贴或输入一个 emoji">`, async (b2)=>{
          const v=b2.querySelector('#p_e').value.trim();
          if(v){ const arr=await H.store.getEmojiCustom(); arr.push(v); await H.store.saveEmojiCustom(arr); }
          H.ui.closeModal(); openEmojiManager();
        });
      };
      box.querySelectorAll('#customGrid .custom').forEach(c=>{
        c.querySelector('.rm').onclick=async (e)=>{
          e.stopPropagation();
          const arr=await H.store.getEmojiCustom();
          arr.splice(+c.dataset.i,1);
          await H.store.saveEmojiCustom(arr);
          openEmojiManager();
        };
      });
    });
  }
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  return { togglePopover, setTab, randomAttach, uploadSticker, addCurrent, openEmojiManager, get curTab(){return curTab;} };
})();
