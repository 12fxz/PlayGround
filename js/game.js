/* ============================================================
   ROOMS — игровой цикл, события, интерфейс
   ============================================================ */
import { AudioEngine } from './audio.js';
import { Renderer } from './renderer.js';
import { makeRoom } from './world.js';

const $ = (sel) => document.querySelector(sel);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pad3 = (n) => String(Math.max(0, Math.round(n))).padStart(3, '0');
const smooth = (t) => t * t * (3 - 2 * t);

const SETTINGS_KEY = 'rooms.settings.v1';
const RECORDS_KEY = 'rooms.records.v1';

const DEFAULT_SETTINGS = { volume: 70, sensitivity: 100, brightness: 100, muted: false };

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
function loadRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (raw && typeof raw === 'object') {
      return {
        best: Number(raw.best) || 0,
        runs: Array.isArray(raw.runs) ? raw.runs.slice(0, 8) : []
      };
    }
  } catch { /* ignore */ }
  return { best: 0, runs: [] };
}
function storeRecords(rec) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(rec)); } catch { /* ignore */ }
}

const settings = loadSettings();
const audio = new AudioEngine();
const scene = $('#scene');
const renderer = new Renderer(scene);

const G = {
  mode: 'lobby',
  phase: 'play',
  room: 1,
  maxRoom: 1,
  hp: 100,
  battery: 100,
  batteries: 0,
  flashlight: true,
  roomData: makeRoom(1),
  z: 0.8,
  yaw: 0,
  doorOpen: 0,
  bobY: 0,
  time: 0,
  lampFlicker: 1,
  brightness: 1,
  sens: 1,
  paused: false,
  inventoryOpen: false,
  hidden: false,
  event: null,
  scare: null,
  fade: 0,
  damage: 0,
  shake: 0,
  transition: null,
  pendingA60: null,
  scheduledEvent: null,
  lastEventRoom: -20,
  roomEnterTimer: 0,
  roomRollPending: false,
  roomToken: 0,
  keyState: new Set(),
  touchLook: 0,
  frozen: false,
  subtitleTimer: 0,
  toastTimer: 0,
  creakTimer: 12,
  heartbeatTimer: 0,
  battWarn: 0,
  runSaved: false,
  deathReason: '',
  settingsReturnToPause: false,
  inventoryReturnToPause: false,
  drag: null
};

/* ============================================================
   УТИЛИТЫ ИНТЕРФЕЙСА
   ============================================================ */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showToast(text, ms = 2300) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  G.toastTimer = ms / 1000;
}

function showSubtitle(text, seconds = 3.4) {
  const el = $('#subtitle');
  el.textContent = text;
  el.classList.add('show');
  G.subtitleTimer = seconds;
}

function setHint(text, cls = '') {
  const el = $('#hintBar');
  if (el.textContent !== text) el.textContent = text;
  el.classList.toggle('danger', cls === 'danger');
  el.classList.toggle('safe', cls === 'safe');
}

function showBanner(kicker, title, sub) {
  const el = $('#eventBanner');
  $('#eventKicker').textContent = kicker;
  $('#eventTitle').textContent = title;
  $('#eventSub').textContent = sub || '';
  el.hidden = false;
  const toast = $('#toast');
  if (toast) {
    toast.classList.remove('show');
    G.toastTimer = 0;
  }
}
function hideBanner() { $('#eventBanner').hidden = true; }
function showFreeze(on) { $('#freezeText').hidden = !on; }
function showHideBadge(on) { $('#hideBadge').hidden = !on; }

function damageFlash() {
  const el = $('#damageFlash');
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function anyMoveKeyHeld() {
  return ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some(k => G.keyState.has(k));
}

function updateRecordsUI() {
  const rec = loadRecords();
  $('#bestRoom').textContent = pad3(rec.best);
  const list = $('#recordsList');
  if (!rec.runs.length) {
    list.innerHTML = '<li class="empty">Пока никто не вернулся.</li>';
    return;
  }
  const top = rec.runs.slice().sort((a, b) => b.room - a.room).slice(0, 5);
  list.innerHTML = top.map((r, i) => `
    <li>
      <span class="r-pos">${String(i + 1).padStart(2, '0')}</span>
      <span class="r-room">КОМН. ${pad3(r.room)}</span>
      <span class="r-cause">${escapeHtml(r.won ? 'ВЫХОД' : (r.cause || 'ТЬМА'))}</span>
    </li>`).join('');
}

function saveRun(cause, won = false) {
  if (G.runSaved) return;
  G.runSaved = true;
  if (!won && G.maxRoom <= 1) return;
  const rec = loadRecords();
  rec.best = Math.max(rec.best || 0, won ? 300 : G.maxRoom);
  rec.runs.unshift({
    room: won ? 300 : G.maxRoom,
    cause: won ? 'ВЫХОД' : cause,
    won,
    date: Date.now()
  });
  rec.runs.sort((a, b) => b.room - a.room);
  rec.runs = rec.runs.slice(0, 8);
  storeRecords(rec);
  updateRecordsUI();
}

function updateHud() {
  $('#roomNow').textContent = pad3(G.room);
  $('#roomProgress').style.width = `${clamp(G.room / 300 * 100, 0, 100)}%`;
  const hp = clamp(G.hp, 0, 100);
  $('#hpBar').style.width = `${hp}%`;
  $('#hpBar').parentElement.classList.toggle('low', hp <= 40);
  $('#hpVal').textContent = Math.ceil(hp);
  const b = clamp(G.battery, 0, 100);
  $('#battBar').style.width = `${b}%`;
  $('#battBar').parentElement.classList.toggle('low', b <= 20);
  $('#battVal').textContent = `${Math.round(b)}%`;
  $('#flashLine').classList.toggle('off', !G.flashlight || G.battery <= 0);
  $('#flashText').textContent = G.battery <= 0 ? 'ФОНАРИК МЁРТВ' : G.flashlight ? 'ФОНАРИК ВКЛ' : 'ФОНАРИК ВЫКЛ';
  $('#btnPause').textContent = 'II';

  if (G.phase === 'dying') {
    setHint('...', 'danger');
    return;
  }
  if (G.phase === 'transition') {
    setHint('Шаги в темноте...');
    return;
  }
  if (G.event) {
    const e = G.event;
    if (e.type === 'a60' && e.phase === 'warning') {
      if (G.battery <= 0) {
        setHint('ФОНАРИК МЁРТВ · R — ВСТАВИТЬ БАТАРЕЙКУ · E — ШКАФ', 'danger');
      } else if (!G.flashlight) {
        setHint('F — ВКЛЮЧИТЬ ФОНАРИК, ЗАТЕМ E — СПРЯТАТЬСЯ', 'danger');
      } else {
        setHint('E — СПРЯТАТЬСЯ В ШКАФ. БЫСТРО.', 'danger');
      }
      return;
    }
    if (e.type === 'a60' && e.phase === 'hidden') {
      setHint('НЕ ДВИГАЙСЯ. ДАЙ ЕМУ ПРОЙТИ.', 'safe');
      return;
    }
    if (e.type === 'a90' && e.phase === 'gaze') {
      setHint('НЕ ДВИГАЙСЯ. ВООБЩЕ.', 'danger');
      return;
    }
    if (e.type === 'a90' && e.phase === 'after') {
      setHint('ТЫ ШЕВЕЛЬНУЛСЯ. ОНО ЗАПОМНИЛО.', 'danger');
      return;
    }
    if (e.type === 'a120' && e.phase === 'approach') {
      setHint('ЗАМРИ. НЕ НАЖИМАЙ W. ОНО ИДЁТ НАВСТРЕЧУ.', 'danger');
      return;
    }
    if (e.type === 'a120' && e.phase === 'hidden') {
      setHint('НЕ ДЫШИ. ОНО РЯДОМ.', 'safe');
      return;
    }
    if (e.type === 'a120' && e.phase === 'passed') {
      setHint('НЕ ОБОРАЧИВАЙСЯ.', 'safe');
      return;
    }
    setHint('...', 'safe');
    return;
  }
  if (G.hidden) {
    setHint('В ШКАФУ. НЕ ДВИГАЙСЯ.', 'safe');
    return;
  }
  if (G.battery <= 0) {
    setHint('ТЕМНОТА. R — БАТАРЕЙКА · F — СВЕТ · E — ДВЕРЬ', 'danger');
    return;
  }
  if (!G.flashlight) {
    setHint('ФОНАРИК ВЫКЛЮЧЕН · F — ВКЛЮЧИТЬ · В ТЕМНОТЕ ШКАФ НЕ НАЙТИ', 'danger');
    return;
  }
  if (G.roomData.battery && !G.roomData.batteryPicked) {
    setHint('ВПЕРЕДИ НА ПОЛУ ЧТО-ТО БЛЕСТИТ · W — ПОДОЙТИ', 'safe');
    return;
  }
  if (G.battery < 20) {
    setHint('ЗАРЯД НИЗКИЙ · R — БАТАРЕЙКА · TAB — РЮКЗАК', 'danger');
    return;
  }
  if (G.room < 30) {
    setHint('W — ВПЕРЁД · A/D — ОСМОТРЕТЬСЯ · F — ФОНАРИК');
  } else {
    setHint('W — ВПЕРЁД · E — ДВЕРЬ / ШКАФ · F — СВЕТ · SHIFT — ЗАМЕРЕТЬ');
  }
}

function updateInventoryUI() {
  const b = clamp(G.battery, 0, 100);
  $('#invBattBar').style.width = `${b}%`;
  $('#invBattText').textContent = `Заряд ${Math.round(b)}%`;
  $('#invBattPct').textContent = `${Math.round(b)}%`;
  $('#invBatteryCount').textContent = `x${G.batteries}`;
  $('#invHp').textContent = Math.ceil(clamp(G.hp, 0, 100));
  $('#invRoom').textContent = pad3(G.room);
  const btn = $('#useBattery');
  btn.disabled = G.batteries <= 0 || G.battery >= 99.5;
  btn.textContent = G.batteries <= 0
    ? 'НЕТ БАТАРЕЕК'
    : G.battery >= 99.5 ? 'ЗАРЯД ПОЛОН' : 'ВСТАВИТЬ БАТАРЕЙКУ  [R]';
}

/* ============================================================
   НАСТРОЙКИ
   ============================================================ */
function applySettings() {
  audio.setVolume(settings.volume / 100);
  audio.setMuted(settings.muted);
  G.brightness = settings.brightness / 100;
  G.sens = settings.sensitivity / 100;
  $('#volume').value = settings.volume;
  $('#sensitivity').value = settings.sensitivity;
  $('#brightness').value = settings.brightness;
  $('#volumeOut').textContent = `${settings.volume}%`;
  $('#sensitivityOut').textContent = `${settings.sensitivity}%`;
  $('#brightnessOut').textContent = `${settings.brightness}%`;
  $('#muteToggle').textContent = settings.muted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ';
}
function persistSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

function openSettings(fromPause = false) {
  G.settingsReturnToPause = fromPause;
  if (fromPause) $('#pauseModal').hidden = true;
  $('#settingsModal').hidden = false;
  audio.click(true);
}
function closeSettings() {
  $('#settingsModal').hidden = true;
  if (G.settingsReturnToPause && G.paused) $('#pauseModal').hidden = false;
  G.settingsReturnToPause = false;
  audio.click();
}

/* ============================================================
   СТАРТ / ЛОББИ / ЭКРАНЫ
   ============================================================ */
function hideAllScreens() {
  $('#gameover').hidden = true;
  $('#victory').hidden = true;
  $('#exitScreen').hidden = true;
}

function startRun() {
  audio.resume();
  hideAllScreens();
  $('#settingsModal').hidden = true;
  $('#pauseModal').hidden = true;
  $('#inventoryModal').hidden = true;
  $('#lobby').hidden = true;
  $('#game').hidden = false;

  Object.assign(G, {
    mode: 'playing',
    phase: 'play',
    room: 1,
    maxRoom: 1,
    hp: 100,
    battery: 100,
    batteries: 0,
    flashlight: true,
    z: 0.8,
    yaw: 0,
    doorOpen: 0,
    bobY: 0,
    time: 0,
    paused: false,
    inventoryOpen: false,
    hidden: false,
    event: null,
    scare: null,
    fade: 1,
    damage: 0,
    shake: 0,
    transition: null,
    pendingA60: null,
    scheduledEvent: null,
    lastEventRoom: -20,
    roomEnterTimer: 0,
    roomRollPending: false,
    roomToken: 0,
    touchLook: 0,
    frozen: false,
    subtitleTimer: 0,
    toastTimer: 0,
    creakTimer: 8,
    heartbeatTimer: 0,
    battWarn: 0,
    runSaved: false,
    deathReason: '',
    inventoryReturnToPause: false
  });
  G.keyState.clear();
  hideBanner();
  showFreeze(false);
  showHideBadge(false);

  renderer.resize(window.innerWidth, window.innerHeight);
  enterRoom(1, true);
  showSubtitle('Сектор R. Комната 1. Дверь за спиной захлопнулась.', 4.5);
  showToast('ЦЕЛЬ: КОМНАТА 300');
  audio.startAmbient();
  updateHud();
  updateInventoryUI();
  audio.click(true);
}

function showLobby() {
  saveRunIfNeeded('ПОБЕГ');
  audio.stopAmbient();
  G.mode = 'lobby';
  G.paused = false;
  G.inventoryOpen = false;
  G.event = null;
  G.scare = null;
  G.phase = 'play';
  $('#game').hidden = true;
  $('#lobby').hidden = false;
  $('#settingsModal').hidden = true;
  $('#pauseModal').hidden = true;
  $('#inventoryModal').hidden = true;
  hideAllScreens();
  updateRecordsUI();
  audio.click();
}

function showExit() {
  audio.resume();
  $('#lobby').hidden = true;
  hideAllScreens();
  $('#exitScreen').hidden = false;
  G.mode = 'exit';
  audio.click();
}

function backFromExit() {
  $('#exitScreen').hidden = true;
  $('#lobby').hidden = false;
  G.mode = 'lobby';
  updateRecordsUI();
  audio.click();
}

function saveRunIfNeeded(cause) {
  if (G.mode === 'playing' && G.phase !== 'dying') {
    if (!G.runSaved && G.maxRoom > 1) saveRun(cause, false);
  }
}

/* ============================================================
   ПЕРЕХОДЫ МЕЖДУ КОМНАТАМИ
   ============================================================ */
function enterRoom(n, initial = false) {
  G.room = n;
  G.maxRoom = Math.max(G.maxRoom, n);
  G.roomToken++;
  G.roomData = makeRoom(n);
  G.z = 0.8;
  G.yaw = 0;
  G.doorOpen = 0;
  G.bobY = 0;
  G.hidden = false;
  G.event = null;
  G.scare = null;
  G.phase = 'play';
  G.roomRollPending = true;
  G.roomEnterTimer = 0.8 + Math.random() * 0.9;
  hideBanner();
  showFreeze(false);
  showHideBadge(false);

  if (G.pendingA60) {
    if (G.pendingA60.room === n) {
      G.scheduledEvent = { type: 'a60', timer: 0.5 };
      G.pendingA60 = null;
      G.roomRollPending = false;
    } else if (G.pendingA60.room === n + 1) {
      audio.distantRoar();
      showSubtitle('Рёв совсем близко. Он идёт за тобой.', 3.2);
    }
  }
  if (G.roomData.battery && !G.roomData.batteryPicked) {
    setTimeout(() => {
      if (G.room === n && G.mode === 'playing' && !G.event) showSubtitle('На полу что-то блестит. Батарейка?', 3);
    }, 500);
  }
  if (initial) {
    showSubtitle('Сектор R. Комната 1. Дверь за спиной захлопнулась.', 4.5);
  }
  updateHud();
}

function stepForward() {
  if (G.mode !== 'playing' || G.phase !== 'play') return;
  if (G.transition) return;
  if (G.hidden) { showToast('Сначала выйди из шкафа.'); return; }
  if (G.roomData.battery && !G.roomData.batteryPicked) collectBattery();
  G.phase = 'transition';
  G.transition = { dir: 1, t: 0, dur: 0.82, startZ: G.z, startDoor: G.doorOpen, lastStep: -1 };
  G.roomRollPending = false;
  G.scheduledEvent = null;
  audio.door();
  hideBanner();
  updateHud();
}

function stepBack() {
  if (G.mode !== 'playing' || G.phase !== 'play') return;
  if (G.transition) return;
  if (G.room <= 1) { showToast('Позади — только тьма.'); audio.static(0.2, 0.05); return; }
  G.phase = 'transition';
  G.transition = { dir: -1, t: 0, dur: 0.58, startZ: G.z, lastStep: -1 };
  G.roomRollPending = false;
  G.scheduledEvent = null;
  audio.step();
  updateHud();
}

function collectBattery() {
  if (!G.roomData.battery || G.roomData.batteryPicked) return;
  G.roomData.batteryPicked = true;
  G.batteries += 1;
  updateInventoryUI();
  audio.pickup();
  showToast('+1 БАТАРЕЙКА · TAB — РЮКЗАК');
  showSubtitle('Ты кладёшь батарейку в рюкзак.', 2.6);
}

function updateTransition(dt) {
  const tr = G.transition;
  if (!tr) return;
  tr.t += dt;
  const p = clamp(tr.t / tr.dur, 0, 1);
  const stepIdx = Math.floor(p * 4);
  if (stepIdx > tr.lastStep) {
    tr.lastStep = stepIdx;
    if (p > 0.04) audio.step();
  }
  if (tr.dir > 0) {
    const e = smooth(p);
    G.z = tr.startZ + (5.9 - tr.startZ) * e;
    G.doorOpen = clamp(p * 2.8, 0, 1);
    G.bobY = Math.sin(p * Math.PI * 7) * 2.4;
    G.fade = p > 0.84 ? (p - 0.84) / 0.16 : 0;
    if (p >= 1) {
      G.transition = null;
      G.fade = 1;
      if (G.room + 1 >= 300) {
        G.room = 300;
        G.maxRoom = 300;
        winGame();
      } else {
        enterRoom(G.room + 1);
      }
    }
  } else {
    G.bobY = Math.sin(p * Math.PI * 5) * 1.6;
    G.fade = clamp(p / 0.5, 0, 1);
    if (p >= 1) {
      G.transition = null;
      G.fade = 1;
      enterRoom(G.room - 1);
    }
  }
}

/* ============================================================
   МОНСТРЫ
   ============================================================ */
function startEvent(type) {
  if (G.mode !== 'playing' || G.phase === 'dying') return;
  G.phase = 'event';
  G.roomRollPending = false;
  G.lastEventRoom = G.room;
  G.scheduledEvent = null;
  G.hidden = false;
  G.transition = null;
  G.doorOpen = 0;

  if (type === 'a60') {
    G.event = { type: 'a60', phase: 'warning', t: 0, dur: 2.85 };
    G.shake = 0.75;
    G.lampFlicker = 0.35;
    audio.roar();
    showBanner('A-60 · ШУМ', 'ОН БЕЖИТ СЗАДИ', 'E — СПРЯТАТЬСЯ В ШКАФ');
    showSubtitle('Оглушительный рёв. Скрежет металла. ОН УЖЕ ЗДЕСЬ.', 4);
  } else if (type === 'a90') {
    G.event = { type: 'a90', phase: 'silence', t: 0, dur: 0.72, violated: false };
    audio.static(0.3, 0.05);
    showBanner('A-90 · ВЗГЛЯД', 'ТИШИНА', 'НЕ ДВИГАЙСЯ');
    showSubtitle('Звук пропал. Что-то смотрит.', 2.5);
  } else if (type === 'a120') {
    G.event = { type: 'a120', phase: 'approach', t: 0, dur: 4.3, z: 5.85, whispered: false };
    audio.hum(4.5);
    showBanner('A-120 · ОБРАТНЫЙ', 'НЕ ИДИ ВПЕРЁД', 'ЗАМРИ. НЕ НАЖИМАЙ W');
    showSubtitle('Низкий гул и шёпот. Оно идёт навстречу.', 3.5);
  }
  updateHud();
}

function tryHide() {
  if (!G.flashlight || G.battery <= 0) {
    audio.static(0.22, 0.08);
    showToast('Слишком темно — шкаф не найти.');
    showSubtitle('Включи фонарик (F), иначе ты покойник.', 3);
    return;
  }
  const usable = G.roomData.lockers.some(l => l.usable);
  if (!usable) {
    audio.static(0.2, 0.06);
    showToast('Шкаф сломан. Дверцы не открыть.');
    return;
  }
  G.hidden = true;
  G.event.phase = 'hidden';
  G.event.t = 0;
  if (G.event.type === 'a120') G.event.z = null;
  audio.hide();
  G.shake = 0.2;
  showBanner('A-60 · ШУМ', 'НЕ ДЫШИ', 'ДАЙ ЕМУ ПРОЙТИ');
  showHideBadge(true);
  showFreeze(false);
  showSubtitle('Ты в шкафу. Металл пахнет ржавчиной.', 3);
  updateHud();
}

function markA90Violation() {
  const e = G.event;
  if (!e || e.type !== 'a90' || e.phase !== 'gaze' || e.violated) return;
  e.violated = true;
  e.phase = 'after';
  e.t = 0;
  e.dur = 1.05;
  G.scare = null;
  showFreeze(false);
  showBanner('A-90 · ВЗГЛЯД', 'ТЫ ДВИНУЛСЯ', '-90 HP');
  audio.sting();
  takeDamage(90, 'a90');
  if (G.phase !== 'dying') showSubtitle('Лицо исчезло. В ушах звенит.', 3);
  updateHud();
}

function endEvent() {
  G.event = null;
  G.hidden = false;
  G.phase = 'play';
  G.scare = null;
  G.lastEventRoom = G.room;
  G.roomRollPending = false;
  hideBanner();
  showFreeze(false);
  showHideBadge(false);
  G.roomEnterTimer = 99;
  updateHud();
}

function maybeSpawnEvent() {
  if (G.mode !== 'playing' || G.phase !== 'play' || !G.roomRollPending) return;
  G.roomRollPending = false;
  if (G.room < 30) return;
  if (G.room - G.lastEventRoom < 2) return;

  if (!G.pendingA60 && G.room <= 296 && Math.random() < 0.15) {
    G.pendingA60 = { room: G.room + 3 };
    audio.distantRoar();
    showToast('ДАЛЕКАЯ СИРЕНА · ОН ИДЁТ ЗА ТОБОЙ');
    showSubtitle('Где-то в глубине коридора взвыла сирена. Она приближается.', 4);
    return;
  }
  if (G.room >= 90 && Math.random() < 0.10) { startEvent('a120'); return; }
  if (G.room >= 60 && Math.random() < 0.12) { startEvent('a90'); return; }
}

function updateEvent(dt) {
  const e = G.event;
  if (!e) return;
  e.t += dt;

  if (e.type === 'a60') {
    if (e.phase === 'warning') {
      G.shake = Math.max(G.shake, 0.16 + 0.1 * Math.abs(Math.sin(e.t * 17)));
      if (e.t >= e.dur) die('a60');
    } else if (e.phase === 'hidden') {
      if (e.t >= 1.9) {
        endEvent();
        showToast('A-60 УШЁЛ');
        showSubtitle('Оно прошло. Не оборачивайся.', 3.2);
      }
    } else if (e.phase === 'after' && e.t >= 0.8) {
      endEvent();
    }
    return;
  }

  if (e.type === 'a90') {
    if (e.phase === 'silence') {
      if (e.t >= e.dur) {
        e.phase = 'gaze';
        e.t = 0;
        e.dur = 1.5;
        G.scare = { type: 'a90', mode: 'gaze', t: 0 };
        showFreeze(true);
        showBanner('A-90 · ВЗГЛЯД', 'НЕ ДВИГАЙСЯ', 'ОН СМОТРИТ');
        audio.sting();
        G.shake = 0.18;
        if (anyMoveKeyHeld()) markA90Violation();
      }
    } else if (e.phase === 'gaze') {
      if (G.scare) G.scare.t = e.t;
      G.shake = Math.max(G.shake, 0.1 + 0.06 * Math.abs(Math.sin(e.t * 26)));
      if (e.t >= e.dur) {
        endEvent();
        showSubtitle('Оно исчезло. Ты не двинулся.', 3.4);
      }
    } else if (e.phase === 'after' && e.t >= e.dur) {
      endEvent();
    }
    return;
  }

  if (e.type === 'a120') {
    if (e.phase === 'approach') {
      const p = clamp(e.t / e.dur, 0, 1);
      e.z = 5.85 + (0.12 - 5.85) * p;
      G.shake = Math.max(G.shake, 0.05 + p * 0.2);
      if (e.t > 1.1 && !e.whispered) {
        e.whispered = true;
        audio.whisper();
      }
      if (e.t >= e.dur) {
        e.phase = 'passed';
        e.t = 0;
        e.dur = 0.95;
        e.z = null;
        G.shake = 0.25;
        audio.whisper();
        showBanner('A-120 · ОБРАТНЫЙ', 'ОНО ПРОШЛО', 'НЕ ОБОРАЧИВАЙСЯ');
        showSubtitle('Оно прошло сквозь тебя. Холод остался.', 3.8);
      }
    } else if (e.phase === 'hidden') {
      if (e.t >= 2.2) {
        endEvent();
        showToast('A-120 УШЁЛ');
        showSubtitle('Шаги стихли. Оно ушло.', 3);
      }
    } else if (e.phase === 'passed' && e.t >= e.dur) {
      endEvent();
    }
  }
}

/* ============================================================
   УРОН / СМЕРТЬ / ПОБЕДА
   ============================================================ */
const DEATH_TEXT = {
  a60: 'A-60 «Шум» догнал тебя. Шкаф был слишком далеко.',
  a90: 'A-90 «Взгляд» заметил движение. Ты не должен был шевелиться.',
  a120: 'A-120 «Обратный» прошёл сквозь тебя. Ты шагнул вперёд.',
  dark: 'Темнота и тишина. Никто не найдёт тебя.'
};
const DEATH_CAUSE = { a60: 'A-60', a90: 'A-90', a120: 'A-120', dark: 'ТЬМА' };

function takeDamage(amount, source) {
  if (G.phase === 'dying') return;
  G.hp = Math.max(0, G.hp - amount);
  G.damage = 1;
  G.shake = Math.max(G.shake, 0.8);
  damageFlash();
  audio.hit();
  updateHud();
  if (G.hp <= 0) die(source);
}

function die(type) {
  if (G.mode !== 'playing' || G.phase === 'dying') return;
  G.phase = 'dying';
  G.event = null;
  G.hidden = false;
  G.scare = { type: type in { a60: 1, a90: 1, a120: 1 } ? type : 'a60', mode: 'death', t: 0 };
  G.shake = 1.2;
  G.deathReason = type;
  hideBanner();
  showFreeze(false);
  showHideBadge(false);
  G.transition = null;
  G.doorOpen = 0;
  saveRun(DEATH_CAUSE[type] || 'ТЬМА', false);
  if (type === 'a60') {
    audio.roar();
    showSubtitle('ОНО ЗА СПИНОЙ.', 2);
  } else if (type === 'a120') {
    audio.whisper();
    audio.hit();
    showSubtitle('Ты сделал шаг вперёд.', 2);
  } else {
    audio.sting();
    audio.hit();
    showSubtitle('Ты пошевелился.', 2);
  }
  updateHud();
}

function showGameover() {
  G.mode = 'dead';
  const rec = loadRecords();
  $('#deathRoom').textContent = pad3(G.maxRoom);
  $('#deathBest').textContent = pad3(rec.best);
  $('#deathCause').textContent = DEATH_TEXT[G.deathReason] || DEATH_TEXT.dark;
  $('#deathKicker').textContent = G.room < 30 ? 'СИГНАЛ ПОТЕРЯН' : `СИГНАЛ ПОТЕРЯН · КОМНАТА ${pad3(G.room)}`;
  $('#gameover').hidden = false;
  $('#pauseModal').hidden = true;
  $('#inventoryModal').hidden = true;
  updateRecordsUI();
}

function winGame() {
  if (G.mode !== 'playing') return;
  G.mode = 'won';
  G.hp = Math.max(1, G.hp);
  saveRun('ВЫХОД', true);
  audio.stopAmbient();
  audio.win();
  $('#winHp').textContent = Math.ceil(G.hp);
  $('#winBatteries').textContent = G.batteries;
  $('#victory').hidden = false;
  $('#game').hidden = false;
  showToast('ТЫ ВЫШЕЛ');
  updateRecordsUI();
}

/* ============================================================
   ФОНАРИК / ИНВЕНТАРЬ
   ============================================================ */
function toggleFlashlight() {
  if (G.mode !== 'playing' || G.phase === 'dying') return;
  if (G.battery <= 0) {
    audio.static(0.12, 0.04);
    showToast('Нет заряда. R — вставить батарейку.');
    return;
  }
  G.flashlight = !G.flashlight;
  audio.flashlight();
  updateHud();
}

function useBattery() {
  if (G.mode !== 'playing' || G.phase === 'dying') return;
  if (G.batteries <= 0) {
    showToast('В рюкзаке нет батареек.');
    return;
  }
  if (G.battery >= 99.5) {
    showToast('Заряд уже полон.');
    return;
  }
  G.batteries -= 1;
  G.battery = Math.min(100, G.battery + 35);
  G.battWarn = 0;
  audio.pickup();
  showToast('+35% ЗАРЯДА');
  updateInventoryUI();
  updateHud();
}

function toggleInventory(fromPause = false) {
  if (G.mode !== 'playing') return;
  if (!G.inventoryOpen) {
    if (G.phase === 'event' || G.phase === 'transition' || G.phase === 'dying') {
      showToast('Не сейчас.');
      return;
    }
    G.inventoryInput = fromPause;
    G.inventoryReturnToPause = fromPause;
    if (fromPause) $('#pauseModal').hidden = true;
    G.inventoryOpen = true;
    $('#inventoryModal').hidden = false;
    updateInventoryUI();
    audio.click(true);
  } else {
    closeInventory();
  }
}

function closeInventory() {
  if (!G.inventoryOpen) return;
  G.inventoryOpen = false;
  $('#inventoryModal').hidden = true;
  if (G.paused && G.inventoryReturnToPause) $('#pauseModal').hidden = false;
  G.inventoryReturnToPause = false;
  audio.click();
}

/* ============================================================
   ПАУЗА
   ============================================================ */
function togglePause() {
  if (G.mode !== 'playing') return;
  if (G.inventoryOpen) { closeInventory(); return; }
  if (!G.paused) {
    if (G.phase !== 'play') {
      showToast('Не сейчас.');
      return;
    }
    G.paused = true;
    $('#pauseRoom').textContent = pad3(G.room);
    $('#pauseModal').hidden = false;
    audio.click(true);
  } else {
    G.paused = false;
    $('#pauseModal').hidden = true;
    audio.click();
  }
}

/* ============================================================
   ВВОД
   ============================================================ */
function handleForward() {
  if (G.mode !== 'playing' || G.paused || G.inventoryOpen) return;
  if (G.phase === 'event' && G.event) {
    const e = G.event;
    if (e.type === 'a90' && e.phase === 'gaze') { markA90Violation(); return; }
    if (e.type === 'a120' && e.phase === 'approach') { die('a120'); return; }
    if (e.phase === 'hidden') { showToast('Не двигайся.'); return; }
    showToast('Дверь заблокирована.');
    return;
  }
  if (G.phase === 'transition' || G.phase === 'dying') return;
  stepForward();
}

function handleBack() {
  if (G.mode !== 'playing' || G.paused || G.inventoryOpen) return;
  if (G.phase === 'event' && G.event) {
    const e = G.event;
    if (e.type === 'a90' && e.phase === 'gaze') { markA90Violation(); return; }
    showToast('Назад нельзя.');
    return;
  }
  if (G.phase === 'transition' || G.phase === 'dying') return;
  stepBack();
}

function handleAction() {
  if (G.mode !== 'playing' || G.paused || G.inventoryOpen) return;
  if (G.phase === 'event' && G.event) {
    const e = G.event;
    if (e.type === 'a60' && e.phase === 'warning') { tryHide(); return; }
    if (e.type === 'a120' && e.phase === 'approach') { tryHide(); return; }
    if (e.type === 'a90' && e.phase === 'gaze') { markA90Violation(); return; }
    showToast('Не сейчас.');
    return;
  }
  if (G.phase === 'transition' || G.phase === 'dying') return;
  stepForward();
}

function onKeyDown(e) {
  const code = e.code;
  const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code);
  if (code === 'Tab' || code === 'Space' || isArrow) e.preventDefault();
  if (e.target instanceof HTMLInputElement) return;

  if (G.mode === 'lobby') {
    if ((code === 'Enter' || code === 'Space') && $('#settingsModal').hidden) startRun();
    if (code === 'Escape') {
      $('#settingsModal').hidden = true;
      G.settingsReturnToPause = false;
    }
    return;
  }
  if (G.mode === 'exit') {
    if (code === 'Escape') backFromExit();
    return;
  }
  if (G.mode !== 'playing') {
    if (G.mode === 'dead' || G.mode === 'won') {
      if (code === 'Escape') showLobby();
    }
    return;
  }

  if (code === 'Escape') {
    if (!$('#settingsModal').hidden) { closeSettings(); return; }
    if (G.inventoryOpen) { closeInventory(); return; }
    togglePause();
    return;
  }
  if (!$('#settingsModal').hidden) return;

  if (code === 'Tab') {
    if (G.phase === 'event' && G.event && G.event.type === 'a90' && G.event.phase === 'gaze') {
      markA90Violation();
      return;
    }
    if (!G.paused && !G.inventoryOpen && G.phase === 'event') { showToast('Не сейчас.'); return; }
    if (G.paused) { toggleInventory(true); return; }
    toggleInventory(false);
    return;
  }

  if (G.paused) {
    if (code === 'KeyR') return;
    return;
  }
  if (G.inventoryOpen) {
    if (code === 'KeyR') useBattery();
    return;
  }

  if (code === 'KeyR') { useBattery(); return; }
  if (code === 'KeyF') { toggleFlashlight(); return; }

  if (code === 'KeyE') {
    if (G.event && G.event.type === 'a90' && G.event.phase === 'gaze') { markA90Violation(); return; }
    if (e.repeat) return;
    handleAction();
    return;
  }

  if (code === 'ShiftLeft' || code === 'ShiftRight') {
    G.frozen = true;
    return;
  }

  if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
    G.keyState.add(code);
    if (G.event && G.event.type === 'a90' && G.event.phase === 'gaze') {
      markA90Violation();
      return;
    }
    if (code === 'KeyW' || code === 'ArrowUp') {
      if (!e.repeat) handleForward();
    } else if (code === 'KeyS' || code === 'ArrowDown') {
      if (!e.repeat) handleBack();
    }
  }
}

function onKeyUp(e) {
  G.keyState.delete(e.code);
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.frozen = false;
}

/* ---------- сенсорное управление ---------- */
function setupTouch() {
  const controls = $('#touchControls');
  const updateVisibility = () => {
    const show = (navigator.maxTouchPoints || 0) > 0 || window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
    controls.hidden = !show;
  };
  updateVisibility();
  window.addEventListener('resize', updateVisibility);

  controls.querySelectorAll('[data-tap]').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      const action = btn.dataset.tap;
      if (G.mode !== 'playing') return;
      if (action === 'forward') handleForward();
      else if (action === 'back') handleBack();
      else if (action === 'action') handleAction();
      else if (action === 'flash') toggleFlashlight();
      else if (action === 'inventory') toggleInventory(false);
    });
    const up = () => btn.classList.remove('pressed');
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });

  controls.querySelectorAll('[data-hold]').forEach(btn => {
    const dir = btn.dataset.hold === 'lookLeft' ? -1 : 1;
    const down = (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      G.touchLook = dir;
      if (G.event && G.event.type === 'a90' && G.event.phase === 'gaze') markA90Violation();
    };
    const up = () => {
      btn.classList.remove('pressed');
      G.touchLook = 0;
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });

  // замереть (удержание)
  const freezeBtn = controls.querySelector('[data-tap="freeze"]');
  if (freezeBtn) {
    freezeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      G.frozen = true;
      freezeBtn.classList.add('pressed');
    });
    const up = () => {
      G.frozen = false;
      freezeBtn.classList.remove('pressed');
    };
    freezeBtn.addEventListener('pointerup', up);
    freezeBtn.addEventListener('pointercancel', up);
    freezeBtn.addEventListener('pointerleave', up);
  }
}

function setupPointerLook() {
  scene.addEventListener('pointerdown', (e) => {
    if (G.mode !== 'playing' || G.paused || G.inventoryOpen) return;
    if (e.button !== undefined && e.button !== 0) return;
    scene.setPointerCapture?.(e.pointerId);
    G.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
  });
  scene.addEventListener('pointermove', (e) => {
    if (!G.drag || e.pointerId !== G.drag.id) return;
    if (G.mode !== 'playing' || G.paused || G.inventoryOpen || G.hidden || G.phase === 'dying') return;
    const dx = e.clientX - G.drag.x;
    G.drag.x = e.clientX;
    G.drag.moved += Math.abs(dx);
    if (G.event && G.event.type === 'a90' && G.event.phase === 'gaze') {
      if (G.drag.moved > 7) markA90Violation();
      return;
    }
    G.yaw += dx * 0.0048 * G.sens;
    if (G.yaw > Math.PI) G.yaw -= Math.PI * 2;
    if (G.yaw < -Math.PI) G.yaw += Math.PI * 2;
  });
  const up = () => { G.drag = null; };
  scene.addEventListener('pointerup', up);
  scene.addEventListener('pointercancel', up);
  scene.addEventListener('pointerleave', (e) => { if (G.drag && e.pointerId === G.drag.id && e.pointerType === 'touch') G.drag = null; });
  scene.addEventListener('contextmenu', e => e.preventDefault());
}

/* ============================================================
   ОБНОВЛЕНИЕ
   ============================================================ */
function updateLook(dt) {
  let axis = 0;
  if (G.keyState.has('KeyA') || G.keyState.has('ArrowLeft')) axis -= 1;
  if (G.keyState.has('KeyD') || G.keyState.has('ArrowRight')) axis += 1;
  axis += G.touchLook;
  if (!axis) return;
  if (G.hidden || G.phase === 'dying' || G.mode !== 'playing') return;
  if (G.event && G.event.type === 'a90' && G.event.phase === 'gaze') {
    markA90Violation();
    return;
  }
  G.yaw += axis * dt * 1.72 * G.sens;
  if (G.yaw > Math.PI) G.yaw -= Math.PI * 2;
  if (G.yaw < -Math.PI) G.yaw += Math.PI * 2;
}

function updateLamp() {
  const r = G.roomData;
  const t = G.time + r.lamp.phase;
  let v = 0.7 + 0.22 * Math.sin(t * 6.7) + 0.08 * Math.sin(t * 27.1);
  if (r.lamp.broken) {
    const k = Math.sin(t * 1.9 + Math.cos(t * 4.3));
    if (k > 0.76) v *= 0.14;
    else if (k > 0.54) v *= 0.55;
  }
  G.lampFlicker = clamp(v, 0.08, 1.05);
}

function updateBattery(dt) {
  if (!G.flashlight || G.battery <= 0) return;
  const before = G.battery;
  G.battery = Math.max(0, G.battery - dt * 0.1);
  if (before > 25 && G.battery <= 25) {
    showToast('ЗАРЯД 25% · R — БАТАРЕЙКА');
    audio.static(0.15, 0.04);
  }
  if (before > 10 && G.battery <= 10) {
    showToast('ЗАРЯД 10% · ФОНАРИК САДИТСЯ');
    audio.flashlight();
  }
  if (G.battery <= 0) {
    G.flashlight = false;
    showToast('ФОНАРИК ПОГАС');
    showSubtitle('Темнота смыкается. Ты почти слеп.', 4);
    audio.static(0.35, 0.09);
  }
}

function updateTimers(dt) {
  if (G.subtitleTimer > 0) {
    G.subtitleTimer -= dt;
    if (G.subtitleTimer <= 0) $('#subtitle').classList.remove('show');
  }
  if (G.toastTimer > 0) {
    G.toastTimer -= dt;
    if (G.toastTimer <= 0) $('#toast').classList.remove('show');
  }
  G.creakTimer -= dt;
  if (G.creakTimer <= 0) {
    G.creakTimer = 13 + Math.random() * 26;
    if (!G.event && G.mode === 'playing') audio.creak();
  }
  const tension = (G.event && G.event.type !== 'a90') || G.hp < 42;
  if (tension) {
    G.heartbeatTimer -= dt;
    if (G.heartbeatTimer <= 0) {
      G.heartbeatTimer = G.hp < 30 ? 0.75 : 1.15;
      audio.heartbeat(G.hp < 30 ? 1.25 : 0.8);
    }
  } else {
    G.heartbeatTimer = 0;
  }
}

function update(dt) {
  if (G.phase === 'dying') {
    G.time += dt;
    if (G.scare) G.scare.t += dt;
    G.shake = Math.max(0, G.shake - dt * 0.7);
    if (G.scare && G.scare.t >= 1.25 && G.mode === 'playing') showGameover();
    return;
  }
  if (G.mode !== 'playing' || G.paused || G.inventoryOpen) return;

  G.time += dt;
  updateLamp();
  updateLook(dt);
  updateBattery(dt);
  updateTimers(dt);

  G.shake = Math.max(0, G.shake - dt * 1.6);
  G.damage = Math.max(0, G.damage - dt * 1.8);
  G.fade = Math.max(0, G.fade - dt * 4.6);

  if (G.phase === 'transition' && G.transition) {
    updateTransition(dt);
    return;
  }

  if (G.phase === 'event' && G.event) {
    updateEvent(dt);
    return;
  }

  if (G.scheduledEvent) {
    G.scheduledEvent.timer -= dt;
    if (G.scheduledEvent.timer <= 0) {
      const type = G.scheduledEvent.type;
      G.scheduledEvent = null;
      startEvent(type);
      return;
    }
  }

  if (G.roomEnterTimer > 0) {
    G.roomEnterTimer -= dt;
    if (G.roomEnterTimer <= 0) maybeSpawnEvent();
  }
}

/* ============================================================
   РЕНДЕР-СОСТОЯНИЕ
   ============================================================ */
function renderState() {
  return {
    room: G.roomData,
    position: { x: 0 },
    z: G.z,
    yaw: G.yaw,
    time: G.time,
    flashlight: G.flashlight,
    battery: G.battery,
    brightness: G.brightness,
    lampFlicker: G.lampFlicker,
    doorOpen: G.doorOpen,
    bobY: G.bobY,
    event: G.event,
    hidden: G.hidden,
    scare: G.scare,
    fade: G.fade,
    damage: G.damage,
    shake: G.shake
  };
}

/* ============================================================
   ЦИКЛ
   ============================================================ */
let last = performance.now();
let hudAccum = 0;
function loop(now) {
  const dt = clamp((now - last) / 1000, 0, 0.35);
  last = now;
  if (G.mode === 'playing') {
    update(dt);
    hudAccum += dt;
    if (hudAccum >= 0.08) {
      updateHud();
      hudAccum = 0;
    }
    const stage = $('#stage');
    stage.classList.toggle('in-scare', !!G.scare || G.phase === 'dying');
    renderer.render(renderState());
  }
  requestAnimationFrame(loop);
}

/* ============================================================
   ПЫЛЬ В ЛОББИ
   ============================================================ */
function spawnDust() {
  const dust = $('#dust');
  if (!dust) return;
  for (let i = 0; i < 34; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${45 + Math.random() * 55}%`;
    p.style.animationDuration = `${7 + Math.random() * 12}s`;
    p.style.animationDelay = `${-Math.random() * 16}s`;
    p.style.opacity = String(0.1 + Math.random() * 0.35);
    const s = Math.random() < 0.8 ? 1 : 2;
    p.style.width = `${s}px`;
    p.style.height = `${s}px`;
    dust.appendChild(p);
  }
}

/* ============================================================
   ПОДПИСКИ
   ============================================================ */
function bindUI() {
  $('#btnStart').addEventListener('click', startRun);
  $('#doorBtn').addEventListener('click', startRun);
  $('#btnSettings').addEventListener('click', () => openSettings(false));
  $('#btnExit').addEventListener('click', showExit);
  $('#btnExitBack').addEventListener('click', backFromExit);

  $('#btnPause').addEventListener('click', togglePause);
  $('#btnResume').addEventListener('click', togglePause);
  $('#btnPauseSettings').addEventListener('click', () => openSettings(true));
  $('#btnPauseInventory').addEventListener('click', () => toggleInventory(true));
  $('#btnLeaveRun').addEventListener('click', () => { saveRunIfNeeded('ПОБЕГ'); showLobby(); });

  $('#settingsDone').addEventListener('click', closeSettings);
  $('#muteToggle').addEventListener('click', () => {
    settings.muted = !settings.muted;
    applySettings();
    persistSettings();
    audio.click();
  });

  $('#useBattery').addEventListener('click', useBattery);
  $('#btnRetry').addEventListener('click', startRun);
  $('#btnDeathLobby').addEventListener('click', showLobby);
  $('#btnWinAgain').addEventListener('click', startRun);
  $('#btnWinLobby').addEventListener('click', showLobby);

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.close;
      if (id === 'settingsModal') closeSettings();
      else if (id === 'inventoryModal') closeInventory();
      else $('#' + id).hidden = true;
    });
  });

  const volume = $('#volume');
  const sensitivity = $('#sensitivity');
  const brightness = $('#brightness');
  volume.addEventListener('input', () => {
    settings.volume = Number(volume.value);
    applySettings();
    persistSettings();
  });
  sensitivity.addEventListener('input', () => {
    settings.sensitivity = Number(sensitivity.value);
    applySettings();
    persistSettings();
  });
  brightness.addEventListener('input', () => {
    settings.brightness = Number(brightness.value);
    applySettings();
    persistSettings();
  });

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    G.keyState.clear();
    G.touchLook = 0;
    G.frozen = false;
  });
  window.addEventListener('resize', () => {
    if (G.mode !== 'lobby') renderer.resize(window.innerWidth, window.innerHeight);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.mode === 'playing' && G.phase === 'play' && !G.paused) togglePause();
  });
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */
function init() {
  bindUI();
  setupTouch();
  setupPointerLook();
  spawnDust();
  applySettings();
  updateRecordsUI();
  updateInventoryUI();
  G.brightness = settings.brightness / 100;
  G.sens = settings.sensitivity / 100;
  requestAnimationFrame(loop);
}

init();

/* ---------- отладочный доступ (для тестов и превью) ---------- */
window.__ROOMS__ = {
  get game() { return G; },
  start: startRun,
  setRoom(n) {
    if (G.mode !== 'playing') startRun();
    enterRoom(clamp(Math.round(n), 1, 299));
    G.fade = 0;
  },
  forceEvent(type) {
    if (G.mode !== 'playing') startRun();
    G.phase = 'play';
    G.paused = false;
    G.inventoryOpen = false;
    G.roomEnterTimer = 99;
    startEvent(type);
  },
  forceHide() { if (G.event) tryHide(); },
  die: (type = 'a60') => die(type),
  damage: (n = 90) => takeDamage(n, 'a90'),
  setFlashlight(on) { G.flashlight = !!on; },
  setBattery(v) { G.battery = clamp(Number(v) || 0, 0, 100); },
  setState(patch) { Object.assign(G, patch); },
  renderer
};
