/* imexport.js — 字卡/数据导入导出 */
H.imexport = (function(){
  async function exportAll(modules){
    const data={ _type:'heart-full', version:1, exportedAt:new Date().toISOString() };
    if(modules.cards){ data.cards=await H.store.getCards(); data.groups=await H.store.getGroups(); }
    if(modules.stickers){ data.stickersMine=await H.store.getStickers('mine'); data.stickersOther=await H.store.getStickers('other'); data.emojiCustom=await H.store.getEmojiCustom(); }
    if(modules.poke){ data.pokeActions=await H.store.getPokeActions(); }
    if(modules.status){ data.statusPool=await H.store.getStatusPool(); data.meStatus=await H.store.getMeStatus(); }
    if(modules.motto){ data.mottoPool=await H.store.getMottoPool(); }
    return JSON.stringify(data,null,2);
  }
  async function exportGroup(groupId){
    const groups=await H.store.getGroups();
    const g=groups.find(x=>x.id===groupId);
    const cards=(await H.store.getCards()).filter(c=>c.groupId===groupId);
    return JSON.stringify({ _type:'heart-group', version:1, group:g, cards },null,2);
  }
  async function importData(jsonStr, mode){
    let data; try{ data=JSON.parse(jsonStr); }catch(e){ throw new Error('JSON 格式错误，请检查文件'); }
    if(data._type==='heart-full'){
      if(mode==='overwrite'){
        if(data.cards!==undefined){ await H.store.saveCards(data.cards||[]); await H.store.saveGroups(data.groups||[]); }
        if(data.stickersMine!==undefined){ await H.store.saveStickers('mine',data.stickersMine||[]); await H.store.saveStickers('other',data.stickersOther||[]); await H.store.saveEmojiCustom(data.emojiCustom||[]); }
        if(data.pokeActions!==undefined) await H.store.savePokeActions(data.pokeActions||[]);
        if(data.statusPool!==undefined){ await H.store.saveStatusPool(data.statusPool||[]); if(data.meStatus) await H.store.saveMeStatus(data.meStatus); }
        if(data.mottoPool!==undefined) await H.store.saveMottoPool(data.mottoPool||[]);
      } else {
        if(data.cards){ const c=await H.store.getCards(); await H.store.saveCards([...c,...data.cards]); }
        if(data.groups){ const g=await H.store.getGroups(); const names=new Set(g.map(x=>x.name)); await H.store.saveGroups([...g,...(data.groups||[]).filter(x=>!names.has(x.name))]); }
        if(data.pokeActions){ const p=await H.store.getPokeActions(); await H.store.savePokeActions([...p,...data.pokeActions]); }
        if(data.stickersMine){ const m=await H.store.getStickers('mine'); await H.store.saveStickers('mine',[...m,...data.stickersMine]); }
        if(data.stickersOther){ const o=await H.store.getStickers('other'); await H.store.saveStickers('other',[...o,...data.stickersOther]); }
        if(data.emojiCustom){ const e=await H.store.getEmojiCustom(); await H.store.saveEmojiCustom([...e,...data.emojiCustom]); }
        if(data.statusPool){ const s=await H.store.getStatusPool(); await H.store.saveStatusPool([...s,...data.statusPool]); }
        if(data.mottoPool){ const m=await H.store.getMottoPool(); await H.store.saveMottoPool([...m,...data.mottoPool]); }
      }
    } else if(data._type==='heart-group'){
      let gid;
      if(data.group){ const g=await H.store.getGroups(); if(!g.find(x=>x.name===data.group.name)){ const ng={...data.group,id:H.store.uid()}; g.push(ng); await H.store.saveGroups(g); gid=ng.id; } else { gid=g.find(x=>x.name===data.group.name).id; } }
      if(data.cards){ const c=await H.store.getCards(); const newCards=data.cards.map(x=>({...x,id:H.store.uid(),groupId:gid||x.groupId})); await H.store.saveCards([...c,...newCards]); }
    } else if(Array.isArray(data)){
      // SN 格式：[{groupId, replyText, id}...]，按 groupId 字符串建分组
      const groups=await H.store.getGroups();
      const gMap={};
      for(const it of data){
        const gn=it.groupId||''; if(gn && !(gn in gMap)){
          let eg=groups.find(g=>g.name===gn);
          if(!eg){ eg={id:H.store.uid(),name:gn,color:H.cards.colorFor(gn),disabled:false}; groups.push(eg); }
          gMap[gn]=eg.id;
        }
      }
      const cards=data.map(it=>({id:H.store.uid(),groupId:gMap[it.groupId||'']||'',text:it.replyText||'',disabled:false}));
      await H.store.saveGroups(groups);
      if(mode==='overwrite') await H.store.saveCards(cards);
      else { const c=await H.store.getCards(); await H.store.saveCards([...c,...cards]); }
    } else throw new Error('无法识别的数据格式（缺少 _type）');
  }
  function download(filename, text){
    const blob=new Blob([text],{type:'application/json'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  }

  async function openExport(){
    const groups=await H.store.getGroups();
    const groupOpts = groups.length ? groups.map(g=>`<button class="btn-ghost" data-eg="${g.id}" style="margin:4px">导出「${esc(g.name)}」组</button>`).join('') : '<span style="color:var(--text-sub);font-size:12px">还没有分组</span>';
    H.ui.modal('导出数据', `
      <div style="font-size:14px;margin-bottom:8px">全量导出（勾选模块）</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        <label><input type="checkbox" id="m_cards" checked> 字卡与分组</label>
        <label><input type="checkbox" id="m_stickers" checked> 表情包（图片+自定义emoji）</label>
        <label><input type="checkbox" id="m_poke" checked> 拍一拍动作</label>
        <label><input type="checkbox" id="m_status" checked> 状态池与我方状态</label>
        <label><input type="checkbox" id="m_motto" checked> 格言池</label>
      </div>
      <button class="btn-primary" id="doExport" style="width:100%;margin-bottom:16px">导出 JSON 文件</button>
      <div style="border-top:1px solid var(--border);padding-top:12px">
        <div style="font-size:14px;margin-bottom:8px">按分组导出字卡</div>
        ${groupOpts}
      </div>
    `, (box)=>{
      box.querySelector('#doExport').onclick=async ()=>{
        const modules={ cards:box.querySelector('#m_cards').checked, stickers:box.querySelector('#m_stickers').checked, poke:box.querySelector('#m_poke').checked, status:box.querySelector('#m_status').checked, motto:box.querySelector('#m_motto').checked };
        const json=await exportAll(modules);
        download('heart-export-'+Date.now()+'.json', json);
        H.ui.toast('已导出'); H.ui.closeModal();
      };
      box.querySelectorAll('[data-eg]').forEach(b=>b.onclick=async ()=>{
        const json=await exportGroup(b.dataset.eg);
        const g=groups.find(x=>x.id===b.dataset.eg);
        download('heart-group-'+(g.name)+'.json', json);
        H.ui.toast('已导出该分组'); H.ui.closeModal();
      });
    });
  }
  async function openImport(){
    H.ui.modal('导入数据', `
      <div style="font-size:14px;margin-bottom:8px">选择 JSON 文件</div>
      <input type="file" id="impFile" accept="application/json" style="width:100%;margin-bottom:16px">
      <div style="font-size:14px;margin-bottom:8px">导入策略</div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <label><input type="radio" name="mode" value="merge" checked> 合并（追加，不删原有）</label>
        <label><input type="radio" name="mode" value="overwrite"> 覆盖（替换原有）</label>
      </div>
      <button class="btn-primary" id="doImport" style="width:100%">导入</button>
      <p style="font-size:11px;color:var(--text-sub);margin-top:12px">覆盖会清空对应模块的原有数据，请谨慎。</p>
    `, (box)=>{
      box.querySelector('#doImport').onclick=async ()=>{
        const f=box.querySelector('#impFile').files[0];
        if(!f){ H.ui.toast('请先选择文件'); return; }
        const mode=box.querySelector('input[name="mode"]:checked').value;
        const text=await f.text();
        try{ await importData(text, mode); H.ui.toast('导入成功'); H.ui.closeModal(); H.chat.render(); H.statusbar.render(); }
        catch(e){ H.ui.toast(e.message); }
      };
    });
  }
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  return { exportAll, exportGroup, importData, download, openExport, openImport };
})();
