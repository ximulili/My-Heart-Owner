/* statusbar.js — 状态栏：motto格言/左右状态/池子轮换 */
H.statusbar = (function(){
  let rotateTimer = null;
  let mottoTimer = null;

  async function render(){
    const s = await H.store.getSettings();
    const meStatus = await H.store.getMeStatus();
    // 角色名
    el('partnerName').textContent = s.partnerName || '白厄';
    el('meName').textContent = s.meName || '晓晓';
    // 头像
    H.avatar.apply(el('otherAvatar'), 'other');
    H.avatar.apply(el('meAvatar'), 'me');
    // 我方状态（手动）
    el('meStatus').textContent = formatMeStatus(meStatus) || '点击设置';
    // 对方状态（池子取一条）
    const pool = await H.store.getStatusPool();
    el('otherStatus').textContent = pool.length ? pool[0].text : '——';
    // motto
    const motto = await H.store.getMottoPool();
    el('mottoText').textContent = motto.length ? motto[0] : 'Heart';
    // typing hint 名字
    document.getElementById('typingHint').firstChild.textContent = (s.partnerName||'白厄') + '正在输入';
  }

  function formatMeStatus(st){
    return [st.mood, st.weather, st.doing].filter(Boolean).join(' · ');
  }

  function el(id){ return document.getElementById(id); }

  // 轮换：状态池随机抽一条显示
  function startStatusRotate(){
    stopStatusRotate();
    H.store.getSettings().then(s=>{
      const min = Math.max(1, s.statusRotateMin||15);
      rotateTimer = setInterval(async ()=>{
        const pool = await H.store.getStatusPool();
        if(!pool.length) return;
        const cur = el('otherStatus').textContent;
        const others = pool.filter(p=>p.text!==cur);
        const arr = others.length ? others : pool;
        el('otherStatus').textContent = arr[Math.floor(Math.random()*arr.length)].text;
      }, min*60*1000);
    });
  }
  function stopStatusRotate(){ if(rotateTimer){ clearInterval(rotateTimer); rotateTimer=null; } }

  // motto 轮换（与状态同频即可，简化为同分钟）
  function startMottoRotate(){
    stopMottoRotate();
    H.store.getSettings().then(s=>{
      const min = Math.max(1, s.statusRotateMin||15);
      mottoTimer = setInterval(async ()=>{
        const pool = await H.store.getMottoPool();
        if(pool.length<2) return;
        const cur = el('mottoText').textContent;
        const others = pool.filter(t=>t!==cur);
        el('mottoText').textContent = others[Math.floor(Math.random()*others.length)];
      }, min*60*1000);
    });
  }
  function stopMottoRotate(){ if(mottoTimer){ clearInterval(mottoTimer); mottoTimer=null; } }

  return { render, startStatusRotate, stopStatusRotate, startMottoRotate, stopMottoRotate, formatMeStatus };
})();
