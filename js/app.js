/* app.js — H.ui 工具 + 主入口 + 主动行为调度 */
window.H = window.H || {};

/* ===== 通用 UI 工具 ===== */
H.ui = (function(){
  function modal(title, html, onMount){
    document.getElementById('modalTitle').textContent = title;
    const body = document.getElementById('modalBody');
    body.innerHTML = html;
    document.getElementById('modalMask').hidden = false;
    if(onMount) onMount(body);
  }
  function prompt(title, html, onConfirm){
    modal(title, html + `<div style="text-align:right;margin-top:16px"><button class="btn-ghost" id="_ui_cancel">取消</button> <button class="btn-primary" id="_ui_ok">确定</button></div>`, (box)=>{
      box.querySelector('#_ui_cancel').onclick = closeModal;
      box.querySelector('#_ui_ok').onclick = ()=> onConfirm(box);
    });
  }
  function actionSheet(items){
    const html = items.map((it,i)=>`<button class="btn-ghost" data-i="${i}" style="width:100%;margin-bottom:8px;${it.danger?'color:#c00':''}">${it.label}</button>`).join('');
    modal('请选择', html, (box)=>{
      box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ closeModal(); items[+b.dataset.i].fn(); });
    });
  }
  let toastT=null;
  function toast(msg){
    const t=document.getElementById('toast');
    t.textContent=msg; t.hidden=false;
    clearTimeout(toastT);
    toastT=setTimeout(()=>t.hidden=true, 2000);
  }
  function previewImg(url){
    modal('图片', `<img src="${url}" style="width:100%;border-radius:8px">`, ()=>{});
  }
  function closeModal(){ document.getElementById('modalMask').hidden = true; }
  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('modalClose').onclick = closeModal;
    document.getElementById('modalMask').addEventListener('click',(e)=>{ if(e.target.id==='modalMask') closeModal(); });
  });
  return { modal, prompt, actionSheet, toast, previewImg, closeModal };
})();

/* ===== 主应用 ===== */
H.app = (function(){

  async function applyTheme(){
    const s = await H.store.getSettings();
    document.body.setAttribute('data-theme', s.theme||'wechat');
  }
  async function applyChatBg(){
    const s = await H.store.getSettings();
    const area = document.getElementById('chatArea');
    if(s.chatBg){ area.style.backgroundImage=`url("${s.chatBg}")`; area.style.backgroundSize='cover'; area.style.backgroundPosition='center'; }
    else { area.style.backgroundImage=''; }
  }

  async function init(){
    await H.store.init();
    await applyTheme();
    await applyChatBg();
    await H.statusbar.render();
    H.statusbar.startStatusRotate();
    H.statusbar.startMottoRotate();
    await H.chat.load();
    await H.chat.render();
    H.call.initDrag();
    bindEvents();
    startScheduler();
    // PWA 注册 + 后台调度
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js').then(async(reg)=>{
        // 等待 SW 激活
        const sw = reg.installing || reg.waiting || reg.active;
        if(sw){
          if(sw.state !== 'activated'){
            await new Promise(r=>sw.addEventListener('statechange',()=>{if(sw.state==='activated')r()}));
          }
        }
        //发送初始状态
        if(navigator.serviceWorker.controller){
          navigator.serviceWorker.controller.postMessage(document.hidden?'startBg':'stopBg');
        }
        // 监听 SW 消息
        navigator.serviceWorker.addEventListener('message',e=>{
          if(e.data && e.data.type==='sw:newMessages'){
            H.chat.load().then(()=>H.chat.render());
          }
        });
      });
    }
    if('Notification' in window && Notification.permission==='default'){
      Notification.requestPermission();
    }
    // 后台切换：通知 SW 接管/归还调度
    document.addEventListener('visibilitychange',()=>{
      if(navigator.serviceWorker && navigator.serviceWorker.controller){
        navigator.serviceWorker.controller.postMessage(document.hidden?'startBg':'stopBg');
      }
    });
  }

  function bindEvents(){
    // 状态栏
    document.getElementById('otherAvatar').onclick = ()=> H.poke.openPanel();
    document.getElementById('partnerName').onclick = ()=> H.poke.openPanel();
    document.getElementById('meAvatar').onclick = ()=> H.avatar.openEditor('me');
    document.getElementById('meName').onclick = ()=> H.avatar.openEditor('me');
    document.getElementById('meStatus').onclick = ()=> H.settings.open('status');
    document.getElementById('otherStatus').onclick = ()=> H.settings.open('status');
    // 中间按钮
    document.getElementById('btnVoiceCall').onclick = ()=> H.call.start('voice');
    document.getElementById('btnVideoCall').onclick = ()=> H.call.start('video');
    document.getElementById('btnSettings').onclick = ()=> H.settings.open();
    // 输入栏
    const input = document.getElementById('messageInput');
    document.getElementById('btnSend').onclick = ()=>{ H.chat.sendText(input.value); input.value=''; autoGrow(input); };
    input.addEventListener('keydown',(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); H.chat.sendText(input.value); input.value=''; autoGrow(input); } });
    input.addEventListener('input', ()=>autoGrow(input));
    document.getElementById('btnImage').onclick = ()=> document.getElementById('imageFile').click();
    document.getElementById('imageFile').onchange = (e)=>{ const f=e.target.files[0]; if(!f) return; if(f.size>2*1024*1024){H.ui.toast('图片不能超过2MB');return;} const r=new FileReader(); r.onload=()=>H.chat.sendImage(r.result); r.readAsDataURL(f); e.target.value=''; };
    document.getElementById('btnSticker').onclick = ()=> H.sticker.togglePopover();
    H.voice.bind(document.getElementById('btnVoice'));
    // 引用关闭
    document.getElementById('replyClose').onclick = ()=> H.chat.clearReply();
    // combo
    document.querySelectorAll('.combo-tab').forEach(t=> t.onclick=()=> H.sticker.setTab(t.dataset.tab));
    document.getElementById('comboAdd').onclick = ()=> H.sticker.addCurrent();
    document.getElementById('comboManage').onclick = ()=>{
      const tab = H.sticker.curTab;
      if(tab==='poke') H.poke.openPanel();
      else if(tab==='mine' || tab==='other') H.sticker.openEmojiManager();
      else H.ui.toast('请先选择一个 tab');
    };
    // 点击消息流空白关闭 combo
    document.getElementById('chatArea').addEventListener('click', ()=>{ document.getElementById('comboPopover').hidden=true; });
  }
  function autoGrow(el){ el.style.height='auto'; el.style.height=Math.min(120, el.scrollHeight)+'px'; }

  /* 主动行为调度器：每分钟检查 */
  function startScheduler(){
    // 主动来电、拍一拍：只留概率，每分钟检查
    setInterval(async ()=>{
      const s = await H.store.getSettings();
      if(Math.random()*100 < (s.activeCallChance||0)){
        if(H.call.state==='idle') H.call.incoming(Math.random()<0.5?'voice':'video');
      }
      if(Math.random()*100 < (s.activePokeChance||0)){
        H.poke.otherPokeMe();
      }
    }, 60000);
    // 主动发消息：区间随机间隔 setTimeout 链，到点必发
    scheduleMsg();
  }
  function scheduleMsg(){
    H.store.getSettings().then(s=>{
      const min=(s.activeMsgMin||5)*60000;
      const max=(s.activeMsgMax||30)*60000;
      const delay=min+Math.random()*(max-min);
      setTimeout(()=>{ H.chat.triggerReply(); scheduleMsg(); }, delay);
    });
  }

  return { init, applyTheme, applyChatBg };
})();

document.addEventListener('DOMContentLoaded', ()=> H.app.init());
