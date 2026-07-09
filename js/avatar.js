/* avatar.js — 头像应用 + 头像编辑器 */
H.avatar = (function(){
  const DEFAULT_SVG = 'assets/default-avatar.svg';

  // 把头像设置应用到某个 DOM 元素
  async function apply(elNode, who){
    const s = await H.store.getSettings();
    const shape = who==='other' ? s.otherShape : s.meShape;
    const img = who==='other' ? s.otherAvatar : s.meAvatar;
    elNode.setAttribute('data-shape', shape||'circle');
    if(img){ elNode.style.backgroundImage = `url("${img}")`; }
    else { elNode.style.backgroundImage = `url("${DEFAULT_SVG}")`; }
  }

  // 打开头像编辑器
  function openEditor(who){
    H.store.getSettings().then(s=>{
      const shape = who==='other' ? s.otherShape : s.meShape;
      const img = who==='other' ? s.otherAvatar : s.meAvatar;
      H.ui.modal('头像设置', `
        <div class="avatar-preview" id="avPrev" data-shape="${shape||'circle'}" style="background-image:url('${img||DEFAULT_SVG}')"></div>
        <div class="shape-toggle">
          <button class="${shape==='circle'?'active':''}" data-shape="circle">圆形</button>
          <button class="${shape==='square'?'active':''}" data-shape="square">方形</button>
        </div>
        <div style="text-align:center;margin:12px 0">
          <button class="btn-ghost" id="avUpload">上传图片</button>
          <button class="btn-ghost" id="avReset">恢复默认</button>
        </div>
        <p style="font-size:11px;color:var(--text-sub);text-align:center">上传图片限制：建议正方形，小于 2MB</p>
        <input type="file" id="avFile" accept="image/*" hidden>
        <div style="text-align:right;margin-top:16px">
          <button class="btn-primary" id="avSave">保存</button>
        </div>
      `, (box)=>{
        let curShape = shape||'circle';
        let curImg = img||'';
        const prev = box.querySelector('#avPrev');
        box.querySelectorAll('.shape-toggle button').forEach(b=>{
          b.onclick = ()=>{
            curShape = b.dataset.shape;
            prev.setAttribute('data-shape', curShape);
            box.querySelectorAll('.shape-toggle button').forEach(x=>x.classList.remove('active'));
            b.classList.add('active');
          };
        });
        box.querySelector('#avUpload').onclick = ()=> box.querySelector('#avFile').click();
        box.querySelector('#avReset').onclick = ()=>{ curImg=''; prev.style.backgroundImage=`url("${DEFAULT_SVG}")`; };
        box.querySelector('#avFile').onchange = (e)=>{
          const f = e.target.files[0]; if(!f) return;
          if(f.size > 2*1024*1024){ H.ui.toast('图片不能超过 2MB'); return; }
          const r = new FileReader();
          r.onload = ()=>{ curImg = r.result; prev.style.backgroundImage=`url("${curImg}")`; };
          r.readAsDataURL(f);
        };
        box.querySelector('#avSave').onclick = async ()=>{
          const patch = who==='other' ? {otherAvatar:curImg, otherShape:curShape} : {meAvatar:curImg, meShape:curShape};
          await H.store.saveSettings(patch);
          H.ui.closeModal();
          H.statusbar.render();
          H.ui.toast('已保存');
        };
      });
    });
  }

  return { apply, openEditor };
})();
