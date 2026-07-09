/* storage.js — localforage 封装 + 默认数据 */
window.H = window.H || {};
H.store = (function(){
  const db = localforage.createInstance({ name: 'Heart' });

  // 80 个内置 emoji，按类别
  const EMOJI_BUILTIN = [
    { cat:'表情', items:['😀','😁','😂','🤣','😊','😍','😘','🤔','😐','😢','😡','😴','🤤','😎','🥳','😱','🤯','😇','🤗','🥺'] },
    { cat:'手势', items:['👍','👎','👏','🙌','🙏','💪','✌️','🤞','🤟','👌','🤙','👋','🤚'] },
    { cat:'爱心', items:['❤️','💔','💕','💖','💗','💙','💚','💛','🧡','💜','🖤','💯'] },
    { cat:'动物', items:['🐶','🐱','🐰','🐻','🐼','🦊','🐨','🦁','🐯','🐸','🐵'] },
    { cat:'食物', items:['🍎','🍊','🍓','🍔','🍕','🍜','🍰','☕','🍻'] },
    { cat:'自然', items:['🌸','🌹','🌻','🌈','☀️','🌙','⭐','🔥','💧'] },
    { cat:'物品', items:['🎁','🎈','🎉','📚','✏️','💻','📱','⏰'] }
  ];

  const DEFAULT_SETTINGS = {
    theme: 'purple',
    partnerName: '白厄',
    meName: '晓晓',
    otherAvatar: '',   // 空字符串=默认图标
    meAvatar: '',
    otherShape: 'circle',
    meShape: 'circle',
    chatBg: '',           // 聊天背景图片 dataURL，空=无背景，仅消息流区，独立于主题
    // 已读状态机
    noReplyChance: 30,      // 已读不回概率 %
    readDelayMin: 1000,     // ms
    readDelayMax: 3000,
    typingMin: 1, typingMax: 3,   // 正在输入时长区间（秒）
    // 字卡组合
    burstMin: 1, burstMax: 3, burstCap: 10,   // 连发条数
    cardMin: 1, cardMax: 3, cardCap: 10,      // 每条内字卡张数
    attachStickerChance: 20,
    // 通话
    callAnswerRate: 60, callBusyRate: 25, callRejectRate: 15,
    hangupChance: 20,       // 对方主动挂断概率 %
    hangupMinSec: 15,
    // 主动行为（概率% + 最小间隔分钟）
    activeCallChance: 8,
    activeMsgMin: 5, activeMsgMax: 30,   // 主动发消息区间（分钟），随机间隔必发
    activePokeChance: 12,
    // 状态栏轮换
    statusRotateMin: 15
  };

  const DEFAULT_ME_STATUS = { mood:'', weather:'', doing:'' };

  const KEYS = {
    settings: PREFIX('settings'),
    messages: PREFIX('messages'),
    cards: PREFIX('cards'),
    groups: PREFIX('groups'),
    stickersMine: PREFIX('stickers_mine'),
    stickersOther: PREFIX('stickers_other'),
    emojiCustom: PREFIX('emoji_custom'),
    pokeActions: PREFIX('poke_actions'),
    statusPool: PREFIX('status_pool'),
    mottoPool: PREFIX('motto_pool'),
    meStatus: PREFIX('me_status')
  };
  function PREFIX(k){ return 'heart_' + k; }

  async function get(key, fallback){
    const v = await db.getItem(key);
    return v === null ? fallback : v;
  }
  async function set(key, val){ await db.setItem(key, val); return val; }

  async function init(){
    const settings = await get(KEYS.settings, null);
    if(!settings){ await set(KEYS.settings, DEFAULT_SETTINGS); }
    await get(KEYS.messages, []);
    await get(KEYS.cards, []);
    await get(KEYS.groups, []);
    await get(KEYS.stickersMine, []);
    await get(KEYS.stickersOther, []);
    await get(KEYS.emojiCustom, []);
    await get(KEYS.pokeActions, []);
    await get(KEYS.statusPool, []);
    await get(KEYS.mottoPool, []);
    await get(KEYS.meStatus, DEFAULT_ME_STATUS);
  }

  // 配置便捷读写
  async function getSettings(){ const raw=await get(KEYS.settings,{}); const merged={...DEFAULT_SETTINGS}; for(const k in raw){ if(k in DEFAULT_SETTINGS) merged[k]=raw[k]; } return merged; }
  async function saveSettings(obj){ const cur = await getSettings(); const next = Object.assign({}, cur, obj); await set(KEYS.settings, next); return next; }

  return {
    KEYS, EMOJI_BUILTIN, DEFAULT_SETTINGS,
    get, set, init,
    getSettings, saveSettings,
    getMessages: () => get(KEYS.messages, []),
    saveMessages: (m) => set(KEYS.messages, m),
    getCards: () => get(KEYS.cards, []),
    saveCards: (c) => set(KEYS.cards, c),
    getGroups: () => get(KEYS.groups, []),
    saveGroups: (g) => set(KEYS.groups, g),
    getStickers: (who) => get(who==='mine'?KEYS.stickersMine:KEYS.stickersOther, []),
    saveStickers: (who, v) => set(who==='mine'?KEYS.stickersMine:KEYS.stickersOther, v),
    getEmojiCustom: () => get(KEYS.emojiCustom, []),
    saveEmojiCustom: (v) => set(KEYS.emojiCustom, v),
    getPokeActions: () => get(KEYS.pokeActions, []),
    savePokeActions: (v) => set(KEYS.pokeActions, v),
    getStatusPool: () => get(KEYS.statusPool, []),
    saveStatusPool: (v) => set(KEYS.statusPool, v),
    getMottoPool: () => get(KEYS.mottoPool, []),
    saveMottoPool: (v) => set(KEYS.mottoPool, v),
    getMeStatus: () => get(KEYS.meStatus, DEFAULT_ME_STATUS),
    saveMeStatus: (v) => set(KEYS.meStatus, v),
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2,7)
  };
})();
