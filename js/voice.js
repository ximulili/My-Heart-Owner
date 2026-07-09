/* voice.js — 语音录制（MediaRecorder）+ 播放 */
H.voice = (function(){
  let mediaRec=null, chunks=[], startT=0, recording=false, curStream=null;

  function bind(btn){
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
  }
  async function start(){
    if(recording) return;
    try{ curStream = await navigator.mediaDevices.getUserMedia({audio:true}); }
    catch(e){ H.ui.toast('无法访问麦克风，请检查权限'); return; }
    chunks=[];
    mediaRec = new MediaRecorder(curStream);
    mediaRec.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
    mediaRec.start();
    startT = Date.now();
    recording = true;
    H.ui.toast('录音中…松开发送');
  }
  function stop(){
    if(!recording) return;
    recording = false;
    mediaRec.onstop = async () => {
      const dur = Math.min(60, Math.round((Date.now()-startT)/1000));
      curStream.getTracks().forEach(t=>t.stop());
      if(dur < 1){ H.ui.toast('录音太短'); return; }
      const blob = new Blob(chunks, {type:'audio/webm'});
      const r = new FileReader();
      r.onload = () => H.chat.sendVoice(r.result, dur);
      r.readAsDataURL(blob);
    };
    mediaRec.stop();
  }
  function play(dataUrl){
    try{ new Audio(dataUrl).play(); }catch(e){ H.ui.toast('播放失败'); }
  }
  return { bind, start, stop, play };
})();
