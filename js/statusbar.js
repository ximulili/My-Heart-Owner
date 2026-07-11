/* statusbar.js — 状态栏：motto格言/左右状态组合/池子轮换 */
H.statusbar = (function(){
  let rotateTimer = null;
  let mottoTimer = null;

  async function render(){
    const s = await H.store.getSettings();
    const meStatus = await H.store.getMeStatus();
    el('partnerName').textContent = s.partnerName || '白厄';
    el('meName').textContent = s.meName || '晓晓';
    H.avatar.apply(el('otherAvatar'), 'other');
    H.avatar.apply(el('meAvatar'), 'me');
    el('otherStatus').textContent = await getComboStatus() || '——';
    el('meStatus').textContent = formatMeStatus(meStatus) || '点击设置';
    const motto = await H.store.getMottoPool();
    el('mottoText').textContent = motto.length ? motto[0] : 'Heart';
  }

  function formatMeStatus(st){
    return [st.mood, st.weather, st.doing].filter(Boolean).join(' · ');
  }

  async function getComboStatus(){
    const pool = await H.store.getStatusPool();
    if(!pool.length) return null;
    const mood = pool.filter(p=>p.type==='mood'), weather = pool.filter(p=>p.type==='weather'), doing = pool.filter(p=>p.type==='doing');
    const feeling = [...mood, ...weather];
    const parts = [];
    if(feeling.length) parts.push(feeling[Math.floor(Math.random()*feeling.length)].text);
    if(doing.length) parts.push(doing[Math.floor(Math.random()*doing.length)].text);
    return parts.length ? parts.join(' · ') : null;
  }

  function el(id){ return document.getElementById(id); }

  function startStatusRotate(){
    stopStatusRotate();
    H.store.getSettings().then(s=>{
      const min = Math.max(1, s.statusRotateMin||15);
      rotateTimer = setInterval(async ()=>{
        const combo = await getComboStatus();
        if(combo) el('otherStatus').textContent = combo;
      }, min*60*1000);
    });
  }
  function stopStatusRotate(){ if(rotateTimer){ clearInterval(rotateTimer); rotateTimer=null; } }

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
