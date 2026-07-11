/* keepalive.js — 后台保活：静音音频循环 + 心跳检测 */
H.keepalive = (function(){
  let audio = null;
  let audioCtx = null;
  let oscillator = null;
  let heartbeatTimer = null;
  let isActive = false;

  // 生成静音音频的 base64（极短的静音 WAV）
  const SILENCE_SRC = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';

  function init(){
    // 创建静音音频
    audio = new Audio(SILENCE_SRC);
    audio.loop = true;
    audio.volume = 0.001;
    audio.muted = false;

    // 创建 Web Audio API 备用
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.00001;
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
    } catch(e){}

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 启动心跳检测
    startHeartbeat();

    // 尝试播放（需要用户交互后才能自动播放）
    tryPlay();
  }

  function tryPlay(){
    if(audio && audio.paused){
      audio.play().catch(()=>{});
    }
    if(audioCtx && audioCtx.state === 'suspended'){
      audioCtx.resume().catch(()=>{});
    }
  }

  function onVisibilityChange(){
    if(document.visibilityState === 'visible'){
      // 页面可见时恢复音频
      tryPlay();
    }
  }

  function startHeartbeat(){
    if(heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(()=>{
      if(audio && audio.paused){
        audio.play().catch(()=>{});
      }
      if(audioCtx && audioCtx.state === 'suspended'){
        audioCtx.resume().catch(()=>{});
      }
    }, 25000); // 每25秒检测一次
  }

  function stop(){
    if(audio){ audio.pause(); audio = null; }
    if(oscillator){ oscillator.stop(); oscillator = null; }
    if(audioCtx){ audioCtx.close(); audioCtx = null; }
    if(heartbeatTimer){ clearInterval(heartbeatTimer); heartbeatTimer = null; }
    isActive = false;
  }

  return { init, tryPlay, stop };
})();
