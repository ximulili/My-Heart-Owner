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

  // 应用内悬浮 Banner 通知
  let bannerTimer=null;
  function showBanner(title, body, onClick){
    // 移除旧 Banner
    const old=document.querySelector('.notification-banner');
    if(old) old.remove();

    const banner=document.createElement('div');
    banner.className='notification-banner';
    banner.innerHTML=`
      <div class="banner-content">
        <div class="banner-title">${title}</div>
        <div class="banner-body">${body}</div>
      </div>
      <button class="banner-close">×</button>
    `;
    document.body.appendChild(banner);

    // 点击关闭
    banner.querySelector('.banner-close').onclick=()=>banner.remove();
    // 点击整个 Banner
    banner.onclick=(e)=>{
      if(e.target.closest('.banner-close')) return;
      banner.remove();
      if(onClick) onClick();
    };

    // 5秒后自动消失
    clearTimeout(bannerTimer);
    bannerTimer=setTimeout(()=>{ if(banner.parentNode) banner.remove(); }, 5000);
  }

  // 浏览器原生通知
  function showNotification(title, body){
    if(document.hidden && 'Notification' in window && Notification.permission==='granted'){
      try{
        const n=new Notification(title,{body,tag:'heart-msg',renotify:true});
        n.onclick=()=>{ window.focus(); n.close(); };
      }catch(e){}
    }
  }
  function closeModal(){ document.getElementById('modalMask').hidden = true; }
  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('modalClose').onclick = closeModal;
    document.getElementById('modalMask').addEventListener('click',(e)=>{ if(e.target.id==='modalMask') closeModal(); });
  });
  return { modal, prompt, actionSheet, toast, previewImg, closeModal, showBanner, showNotification };
})();

/* ===== 主应用 ===== */
H.app = (function(){

  // 图片压缩函数（参考 SN）
  function compressImage(file, maxSize=1000, quality=0.72){
    return new Promise((resolve)=>{
      const img = new Image();
      img.onload = ()=>{
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        // 缩放
        if(w > maxSize || h > maxSize){
          const ratio = Math.min(maxSize/w, maxSize/h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        // 转换为 DataURL
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // 如果压缩后仍大于 2MB，弹警告
        if(dataUrl.length > 2*1024*1024){
          H.ui.toast('图片较大，可能占用较多空间');
        }
        resolve(dataUrl);
      };
      img.onerror = ()=>{
        // 如果不是图片，直接读取原文件
        const r = new FileReader();
        r.onload = ()=>resolve(r.result);
        r.readAsDataURL(file);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  // 判断聊天界面是否可见（没有被挡住）
  function isChatVisible(){
    // 如果页面在后台，聊天界面不可见
    if(document.hidden) return false;
    
    // 检查是否有覆盖层挡住聊天界面
    const callOverlay = document.getElementById('callOverlay');
    const pokeOverlay = document.getElementById('pokeOverlay');
    const modalMask = document.getElementById('modalMask');
    
    // 如果任何一个覆盖层可见，聊天界面就被挡住
    if(callOverlay && !callOverlay.hidden) return false;
    if(pokeOverlay && !pokeOverlay.hidden) return false;
    if(modalMask && !modalMask.hidden) return false;
    
    // 聊天界面可见
    return true;
  }

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
    // 初始化后台保活
    H.keepalive.init();
    // 请求通知权限
    if('Notification' in window && Notification.permission==='default'){
      Notification.requestPermission();
    }
    // 后台切换：页面可见时恢复保活
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'){
        H.keepalive.tryPlay();
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
    document.getElementById('imageFile').onchange = async (e)=>{
      const f=e.target.files[0];
      if(!f) return;
      e.target.value='';
      // 压缩图片
      const compressed = await compressImage(f, 1000, 0.72);
      H.chat.sendImage(compressed);
    };
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

  return { init, applyTheme, applyChatBg, compressImage, isChatVisible };
})();

document.addEventListener('DOMContentLoaded', ()=> H.app.init());
