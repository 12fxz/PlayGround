import {
  NIGHT_SECONDS,
  speedMultiplier,
  speedPercent,
  bushDamage,
  forgottenTimer,
  maxEnergy,
  nightPayout,
  milestoneBonus,
  featureLabel,
  featureShort,
  tipFor,
  PREVIOUS_INTERN_BEST,
} from './formulas.js';
import { dossiers, diaryNotes, exitLines } from './lore.js';
import {
  defaultSave,
  loadSave,
  persistSave,
  SHOP_ITEMS,
  recordLabel,
} from './save.js';
import { AudioEngine } from './audio.js';
import { drawLobby, drawJumpscare, prepare } from './render.js';
import { NightGame } from './game.js';
import { ReverseGame } from './reverse.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const save = loadSave();
const audio = new AudioEngine(save.muted);

let game = null;
let currentNight = 1;
let pendingNight = 1;
let pendingUnlocks = [];
let activeUnlock = null;
let jumpscareRaf = null;
let jumpscareTimer = null;
let lockoutTimer = null;
let notesTimer = null;
let reverse = null;
let reverseAwarded = false;

const els = {
  lobby: $('#lobby'),
  game: $('#game'),
  lobbyCanvas: $('#lobby-canvas'),
  officeCanvas: $('#office-canvas'),
  camCanvas: $('#cam-canvas'),
  jumpscareCanvas: $('#jumpscare-canvas'),
  tablet: $('#tablet'),
  lockout: $('#lockout'),
  lockoutFill: $('#lockout-fill'),
  toastStack: $('#toast-stack'),
  jumpscare: $('#jumpscare'),
};

/* ============================================================
   BASIC UI
   ============================================================ */

function fmtNumber(n) {
  return new Intl.NumberFormat('ru-RU').format(n);
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function updateLobby() {
  const night = save.completed + 1;
  currentNight = night;
  const speed = speedMultiplier(night);
  $('#lobby-night').textContent = night;
  $('#lobby-speed').textContent = `+${speedPercent(night)}%`;
  $('#start-btn-sub').textContent = `НОЧЬ ${night} · ${Math.round(speed * 100)}%`;
  $('#lobby-coins').textContent = fmtNumber(save.coins);
  $('#shift-no').textContent = String(night).padStart(4, '0');
  $('#lobby-hint').textContent = featureLabel(night);
  $('#night-progress-fill').style.width = `${((save.completed % 5) / 5) * 100}%`;
  const record = recordLabel(save);
  $('#lobby-record').textContent = record.value;
  $('#lobby-record-owner').textContent = record.owner;
  $('#btn-reverse').classList.toggle('hidden', !save.reverseUnlocked);
  $('#btn-sound').classList.toggle('muted', save.muted);
  $('#btn-sound').querySelector('.sound-icon').textContent = save.muted ? '◖×' : '◖))';
  $('#shop-coins').textContent = fmtNumber(save.coins);
  $('#lobby-clock').textContent = '12:00 AM';
}

function ensureAudio() {
  if (save.muted) return;
  audio.ensure();
  if (els.lobby.classList.contains('is-active') && !els.game.classList.contains('is-active')) {
    if (!audio.ambience) audio.startAmbience('lobby');
  }
}

function toast(text, kind = '') {
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = text;
  els.toastStack.appendChild(node);
  while (els.toastStack.children.length > 4) els.toastStack.firstElementChild.remove();
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity .3s';
    setTimeout(() => node.remove(), 320);
  }, 3200);
}

function openOverlay(id) {
  const overlay = document.getElementById(`overlay-${id}`);
  if (!overlay) return;
  overlay.classList.remove('hidden');
  document.body.dataset.overlay = id;
  audio.sfx('click');
}

function closeOverlay(id) {
  const overlay = document.getElementById(`overlay-${id}`);
  if (!overlay) return;
  overlay.classList.add('hidden');
  if (document.body.dataset.overlay === id) delete document.body.dataset.overlay;
}

function closeAllOverlays(except) {
  $$('.overlay').forEach((overlay) => {
    if (except && overlay.id === `overlay-${except}`) return;
    overlay.classList.add('hidden');
  });
  delete document.body.dataset.overlay;
}

/* ============================================================
   LOBBY BUTTONS / MODALS
   ============================================================ */

$('#btn-sound').addEventListener('click', () => {
  save.muted = !save.muted;
  audio.setMuted(save.muted);
  if (!save.muted) {
    ensureAudio();
    audio.startAmbience(els.game.classList.contains('is-active') ? 'office' : 'lobby');
    audio.sfx('click');
  }
  persistSave(save);
  updateLobby();
});

$$('[data-open]').forEach((btn) => {
  btn.addEventListener('click', () => {
    ensureAudio();
    audio.sfx('click');
    const id = btn.dataset.open;
    if (id === 'diary') {
      renderDiary();
      openOverlay('diary');
    } else if (id === 'shop') {
      renderShop();
      openOverlay('shop');
    } else if (id === 'info') {
      openOverlay('info');
    } else if (id === 'exit') {
      $('#overlay-exit .exit-line').textContent = exitLines[Math.floor(Math.random() * exitLines.length)];
      openOverlay('exit');
    }
  });
});

$$('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const overlay = btn.closest('.overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      if (document.body.dataset.overlay === overlay.id.replace('overlay-', '')) delete document.body.dataset.overlay;
    }
  });
});

$$('.overlay').forEach((overlay) => {
  overlay.addEventListener('mousedown', (ev) => {
    if (ev.target === overlay) {
      overlay.classList.add('hidden');
      delete document.body.dataset.overlay;
    }
  });
});

$('#btn-stay').addEventListener('click', () => closeOverlay('exit'));
$('#btn-leave').addEventListener('click', () => {
  closeOverlay('exit');
  audio.stopAmbience();
  showCreepyExit();
});

function showCreepyExit() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.style.zIndex = '300';
  overlay.innerHTML = `
    <div class="modal exit-modal">
      <p class="eyebrow danger">СИГНАЛ ПРЕРВАН</p>
      <h2 style="color:#ff6957">ОН ЖДЁТ</h2>
      <p class="exit-line" style="animation:none">Ты закрыл вкладку. Он — нет.</p>
      <div class="exit-actions">
        <button class="ghost-btn" type="button">ВЕРНУТЬСЯ НА СМЕНУ</button>
      </div>
    </div>`;
  document.getElementById('app').appendChild(overlay);
  overlay.querySelector('button').addEventListener('click', () => {
    overlay.remove();
    ensureAudio();
  });
}

/* ============================================================
   DIARY
   ============================================================ */

let diaryTab = 'dossier';
let activeDossier = 'ransom';
let activeEntry = 0;

function renderDiary() {
  const unlocked = diaryNotes.filter((n) => n.at <= save.completed);
  $('#diary-count').textContent = `${unlocked.length} / ${diaryNotes.length} записей`;
  renderDiaryTabs();
  renderDossierTabs();
  renderDossier();
  renderDiaryList();
  renderDiaryEntry();
  renderNotesTab();
}

function renderDiaryTabs() {
  $$('.diary-modal .tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === diaryTab));
  $$('.diary-modal .pane').forEach((pane) => {
    const id = pane.id.replace('diary-', '');
    pane.classList.toggle('is-active', id === diaryTab);
  });
}

$$('.diary-modal .tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    diaryTab = tab.dataset.tab;
    renderDiaryTabs();
    if (diaryTab === 'mine') renderNotesTab();
    if (diaryTab === 'dossier') renderDossier();
  });
});

function renderDossierTabs() {
  const list = $('#diary-list');
  if (!list) return;
  if (diaryTab === 'dossier') {
    list.innerHTML = dossiers
      .map(
        (d) => `<button class="diary-item ${d.id === activeDossier ? 'is-active' : ''}" data-dossier="${d.id}">
          ${d.name}<small>${d.role}</small>
        </button>`,
      )
      .join('');
    list.querySelectorAll('[data-dossier]').forEach((btn) =>
      btn.addEventListener('click', () => {
        activeDossier = btn.dataset.dossier;
        renderDossierTabs();
        renderDossier();
        audio.sfx('click');
      }),
    );
  } else if (diaryTab === 'notes') {
    list.innerHTML = diaryNotes
      .map((entry, index) => {
        const isUnlocked = entry.at <= save.completed;
        return `<button class="diary-item ${isUnlocked ? '' : 'locked'} ${index === activeEntry && isUnlocked ? 'is-active' : ''}" data-entry="${index}" ${isUnlocked ? '' : 'disabled'}>
          ${isUnlocked ? entry.title.replace(/^ЗАПИСЬ \d+ · /, '') : '<span class="lock">▓ ЗАБЛОКИРОВАНО</span>'}
          <small>${isUnlocked ? `НОЧЬ ${entry.at}` : `ПРОЙДИТЕ НОЧЬ ${entry.at}`}</small>
        </button>`;
      })
      .join('');
    list.querySelectorAll('[data-entry]').forEach((btn) =>
      btn.addEventListener('click', () => {
        activeEntry = Number(btn.dataset.entry);
        renderDiaryList();
        renderDiaryEntry();
        audio.sfx('click');
      }),
    );
  } else {
    list.innerHTML = `<button class="diary-item is-active">МОИ ЗАМЕТКИ<small>БЛОКНОТ СТАЖЁРА</small></button>
      <div style="padding:10px;font-size:8px;line-height:1.7;color:var(--ink-faint)">Записи хранятся в памяти терминала и в скачанном файле. Если очистить кэш — останется только файл.</div>`;
  }
}

function renderDossier() {
  const d = dossiers.find((x) => x.id === activeDossier) || dossiers[0];
  const box = $('#diary-dossier');
  box.innerHTML = `
    <div class="dossier-body">
      <h3>${d.name}</h3>
      <div class="entry-meta">${d.role}</div>
      ${d.paragraphs.map((p) => `<p>${p}</p>`).join('')}
      <p class="quote" style="border-left:2px solid var(--amber-dim);padding-left:12px;color:var(--amber-2)">${d.tagline}</p>
      <div class="stat-line">${d.stats.map(([k, v]) => `<span>${k}: <b>${v}</b></span>`).join('')}</div>
    </div>`;
}

function renderDiaryList() {
  if (diaryTab === 'notes') renderDossierTabs();
}

function renderDiaryEntry() {
  const entry = diaryNotes[activeEntry];
  const box = $('#diary-notes');
  if (!entry || entry.at > save.completed) {
    box.innerHTML = `<div class="diary-entry"><h3>ЗАПИСЬ НЕДОСТУПНА</h3><p>Пройди ночь ${entry?.at ?? '?'}, чтобы открыть эту страницу. Дневник обновляется каждые 3 ночи, а особые записи — каждые 10.</p></div>`;
    return;
  }
  box.innerHTML = `<div class="diary-entry">
    <h3>${entry.title}</h3>
    <div class="entry-meta">${entry.meta}</div>
    ${entry.body.map((p) => `<p>${p}</p>`).join('')}
  </div>`;
}

function renderNotesTab() {
  const area = $('#player-notes');
  if (!area) return;
  if (area.value !== save.notes) area.value = save.notes;
}

$('#player-notes').addEventListener('input', (ev) => {
  save.notes = ev.target.value.slice(0, 4000);
  const saved = $('#notes-saved');
  saved.textContent = 'СОХРАНЯЕТСЯ...';
  saved.classList.add('unsaved');
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => {
    persistSave(save);
    saved.textContent = 'СОХРАНЕНО';
    saved.classList.remove('unsaved');
  }, 600);
});

$('#btn-download-notes').addEventListener('click', () => {
  const unlocked = diaryNotes.filter((n) => n.at <= save.completed);
  const lines = [
    'FIVE NIGHTS AT FREDDY\'S: SIGNAL LOST',
    'ДНЕВНИК СТАЖЁРА',
    `Лучший результат: ночь ${save.best || 0}`,
    `Смен пройдено: ${save.completed}`,
    `Монет: ${save.coins}`,
    '',
    '=== ДОСЬЕ ===',
    '',
  ];
  dossiers.forEach((d) => {
    lines.push(`${d.name} — ${d.role}`, d.tagline, ...d.paragraphs, '');
  });
  lines.push('=== ЗАПИСИ ===', '');
  unlocked.forEach((entry) => {
    lines.push(entry.title, entry.meta, ...entry.body.map((p) => p.replace(/<[^>]+>/g, '')), '');
  });
  lines.push('=== МОИ ЗАМЕТКИ ===', '', save.notes || '(пусто)', '');
  lines.push('НЕ ДОВЕРЯЙ ТИШИНЕ.');
  downloadFile('signal-lost-diary.txt', lines.join('\n'), 'text/plain');
  toast('Дневник сохранён в файл.', 'good');
});

$('#btn-export-save').addEventListener('click', () => {
  downloadFile('signal-lost-save.json', JSON.stringify(save, null, 2), 'application/json');
  toast('Сохранение выгружено.', 'good');
});

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ============================================================
   SHOP
   ============================================================ */

function renderShop() {
  $('#shop-coins').textContent = fmtNumber(save.coins);
  const grid = $('#shop-grid');
  grid.innerHTML = SHOP_ITEMS.map((item) => {
    const owned = Boolean(save.upgrades[item.id]);
    const affordable = save.coins >= item.price;
    return `<article class="shop-card ${owned ? 'owned' : ''}">
      <div class="item-art">${item.icon}</div>
      <h3>${item.name}</h3>
      <p>${item.desc}</p>
      <div class="buy-row">
        <span class="price">${owned ? '<span class="owned-tag">КУПЛЕНО</span>' : `<span class="coin-dot"></span>${item.price}`}</span>
        ${
          owned
            ? '<button class="buy-btn" type="button" disabled>АКТИВНО</button>'
            : `<button class="buy-btn" type="button" data-buy="${item.id}" ${affordable ? '' : 'disabled'}>${affordable ? 'КУПИТЬ' : 'НЕ ХВАТАЕТ'}</button>`
        }
      </div>
    </article>`;
  }).join('');

  grid.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => buyItem(btn.dataset.buy));
  });
}

function buyItem(id) {
  const item = SHOP_ITEMS.find((x) => x.id === id);
  if (!item || save.upgrades[id]) return;
  if (save.coins < item.price) {
    audio.sfx('error');
    return;
  }
  save.coins -= item.price;
  save.upgrades[id] = true;
  persistSave(save);
  audio.sfx('buy');
  renderShop();
  updateLobby();
  ensureAudio();
}

/* ============================================================
   BRIEFING / NIGHT START
   ============================================================ */

function showBriefing(night) {
  pendingNight = night;
  const speed = speedMultiplier(night);
  $('#brief-night').textContent = night;
  $('#brief-speed').textContent = `${Math.round(speed * 100)}%`;
  $('#brief-damage').textContent = `${bushDamage(night)} HP`;
  $('#brief-forgotten').textContent = `${forgottenTimer(night).toFixed(1)} сек`;
  $('#brief-energy').textContent = `${maxEnergy(save.upgrades)}%`;
  $('#brief-feature').textContent = featureLabel(night);
  $('#brief-tip').textContent = tipFor(night);
  $('#brief-eyebrow').textContent = night >= 50 ? 'ПОСЛЕДНЯЯ СМЕНА · ХАОС' : 'СМЕНА ПРИНЯТА';
  openOverlay('brief');
}

function beginNight(night) {
  closeAllOverlays();
  ensureAudio();
  audio.stopAmbience();
  currentNight = night;
  els.lobby.classList.remove('is-active');
  els.game.classList.add('is-active');
  els.jumpscare.classList.add('hidden');
  els.tablet.classList.add('hidden');
  els.lockout.classList.add('hidden');
  $$('.warning-pill').forEach((w) => w.classList.add('hidden'));
  $('#tablet-state').textContent = 'ЗАКРЫТ';
  $('#tablet-state').classList.remove('active');

  if (game) {
    game.stop();
    game = null;
  }

  game = new NightGame({
    night,
    save,
    audio,
    canvas: els.officeCanvas,
    camCanvas: els.camCanvas,
    callbacks: {
      hud: updateGameHud,
      toast,
      tablet: (open) => {
        els.tablet.classList.toggle('hidden', !open);
        if (open) {
          $('#tab-night').textContent = night;
        }
      },
      freeze: triggerLockout,
      shake: () => {
        els.officeCanvas.style.transform = 'translate(2px, -1px)';
        setTimeout(() => {
          els.officeCanvas.style.transform = '';
        }, 90);
      },
      flashRed: () => {
        const fx = $('#fx-red');
        fx.classList.add('on', 'hurt');
        setTimeout(() => fx.classList.remove('on', 'hurt'), 520);
      },
      pulseCoins: () => {
        const coin = $('#hud-coins');
        coin.animate?.(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', color: '#ffe6b0' }, { transform: 'scale(1)' }],
          { duration: 320 },
        );
      },
      end: handleGameEnd,
    },
  });
  game.start();
}

function updateGameHud(state) {
  if (!game) return;
  $('#hud-night').textContent = state.night;
  $('#hud-clock').textContent = state.clock;
  $('#hud-speed').textContent = `Скорость ${Math.round(speedMultiplier(state.night) * 100)}%`;
  const ePct = Math.max(0, Math.min(100, (state.energy / state.maxEnergy) * 100));
  const hPct = Math.max(0, Math.min(100, state.hp));
  $('#hud-energy-fill').style.width = `${ePct}%`;
  $('#hud-hp-fill').style.width = `${hPct}%`;
  $('#hud-energy-text').textContent = `${Math.round(state.energy)}%`;
  $('#hud-hp-text').textContent = `${Math.round(state.hp)}`;
  const eBar = $('#hud-energy-fill').parentElement;
  eBar.classList.toggle('low', ePct <= 35 && ePct > 15);
  eBar.classList.toggle('critical', ePct <= 15);
  const hBar = $('#hud-hp-fill').parentElement;
  hBar.classList.toggle('low', hPct <= 35);
  $('#hud-coins').textContent = state.coins;

  const doorBtn = $('#btn-door');
  doorBtn.classList.toggle('active', state.doorClosed);
  doorBtn.classList.toggle('danger', state.warnings.door && !state.doorClosed);
  $('#door-state').textContent = state.doorClosed ? 'ЗАКРЫТА' : 'ОТКРЫТА';

  const flashBtn = $('#btn-flash');
  flashBtn.classList.toggle('active', state.flashlight);
  $('#flash-state').textContent = state.flashlight ? 'ВКЛ' : save.upgrades.flashlight ? 'ВЫКЛ' : 'НЕТ';

  const tabBtn = $('#btn-tablet');
  tabBtn.classList.toggle('active', state.tabletOpen);
  $('#tablet-state').textContent = state.tabletOpen ? 'ОТКРЫТ' : state.freeze > 0 ? 'ЗАМОРОЖЕН' : 'ЗАКРЫТ';

  $('#warn-door').classList.toggle('hidden', !state.warnings.door);
  $('#warn-forgotten').classList.toggle('hidden', !state.warnings.forgotten);
  $('#warn-ransom').classList.toggle('hidden', !state.warnings.ransom);
  $('#warn-blackout').classList.toggle('hidden', !state.warnings.blackout);

  const anger = Math.max(0, Math.min(1, state.anger));
  $('#anger-fill').style.width = `${anger * 100}%`;
  $('.anger-wrap').classList.toggle('hot', anger > 0.65);

  $('#tab-night').textContent = state.night;
  $('#tab-clock').textContent = state.clock;
  $('#tab-signal').textContent = `${Math.round(ePct)}%`;
  $('#cam-name').textContent = state.camStatus;
  $('#cam-status').textContent = state.broken[state.selectedCam] > 0 ? 'ПОМЕХИ' : 'СИГНАЛ СТАБИЛЕН';
  $('#cam-time').textContent = `T+${fmtTime(game.elapsed)}`;
  $$('#cam-select .cam-btn').forEach((btn) => {
    const idx = Number(btn.dataset.cam);
    btn.classList.toggle('is-active', idx === state.selectedCam);
    const stateEl = btn.querySelector('.cam-btn-state');
    const broken = state.broken[idx] > 0;
    stateEl.textContent = broken ? 'ПОМЕХИ' : 'OK';
    stateEl.classList.toggle('broken', broken);
  });

  const broken = state.broken[state.selectedCam] > 0;
  $('#cam-nosignal').classList.toggle('hidden', !(state.tabletOpen && broken));
  if (broken && game) {
    $('#cam-repair').textContent = `АВТОВОССТАНОВЛЕНИЕ ${state.broken[state.selectedCam].toFixed(1)} С`;
  }
  $('#cam-freeze').classList.add('hidden');
}

/* ============================================================
   GAME END
   ============================================================ */

function handleGameEnd(result) {
  if (game) game.stop();
  els.tablet.classList.add('hidden');
  els.lockout.classList.add('hidden');
  clearTimeout(lockoutTimer);
  $$('.warning-pill').forEach((w) => w.classList.add('hidden'));

  if (result.type === 'win') {
    const base = nightPayout(result.night);
    const milestone = milestoneBonus(result.night);
    const total = result.coins + base + milestone;
    save.coins += total;
    save.completed = Math.max(save.completed, result.night);
    save.best = Math.max(save.best, result.night);
    const unlocks = [];

    if (result.night >= 25 && !save.skinOldGuard) {
      save.skinOldGuard = true;
      unlocks.push({
        icon: '▣',
        title: 'СКИН «СТАРЫЙ ОХРАННИК»',
        text: 'Офис теперь выглядит так, как его запомнил предыдущий стажёр. Куртка на крючке. Фотография на стене. Если увидишь себя на ней — не оборачивайся.',
      });
    }
    if (result.night >= 50 && !save.reverseUnlocked) {
      save.reverseUnlocked = true;
      unlocks.push({
        icon: '◈',
        title: 'SIGNAL LOST: REVERSE',
        text: 'Теперь ты можешь играть за монстра. Охранник боится. Дверь — единственное, что его спасает. Режим доступен в лобби.',
      });
    }
    persistSave(save);
    updateLobby();

    $('#win-night-label').textContent = `Ночь ${result.night}`;
    $('#win-survival').textContent = `+${result.coins}`;
    $('#win-base').textContent = `+${base}`;
    $('#win-milestone').textContent = `+${milestone}`;
    $('#win-total').textContent = `+${total}`;
    let unlockText = '';
    if (result.night % 10 === 0) unlockText += 'Новая запись в дневнике. ';
    if (result.night >= 25 && result.night < 26) unlockText += 'Скин «Старый охранник» разблокирован. ';
    if (result.night >= 50 && result.night < 51) unlockText += 'Режим Reverse разблокирован. ';
    if (result.night && result.night % 5 === 0) unlockText += `Бонус за ${result.night} ночей: +50.`;
    $('#win-unlock').textContent = unlockText.trim();
    pendingUnlocks = unlocks;

    setTimeout(() => {
      openOverlay('win');
      audio.sfx('chime');
    }, 380);
  } else {
    save.deaths += 1;
    persistSave(save);
    updateLobby();
    $('#death-night').textContent = result.night;
    $('#death-time').textContent = fmtTime(result.elapsed || 0);
    $('#death-coins').textContent = `−${result.coins}`;
    const lines = {
      bush: 'Тишина была слишком тихой.',
      forgotten: 'Ты смотрел не туда. Он смотрел на тебя.',
      ransom: 'Свет погас. Дверь открылась. Он вошёл.',
    };
    $('#death-line').textContent = lines[result.killer] || lines.bush;
    playJumpscare(result.killer || 'bush');
  }
}

function playJumpscare(kind) {
  els.jumpscare.classList.remove('hidden');
  const start = performance.now();
  const loop = (ts) => {
    drawJumpscare(els.jumpscareCanvas, ts, kind);
    if (ts - start < 1500) {
      jumpscareRaf = requestAnimationFrame(loop);
    } else {
      els.jumpscare.classList.add('hidden');
      openOverlay('death');
    }
  };
  jumpscareRaf = requestAnimationFrame(loop);
}

$('#btn-death-lobby').addEventListener('click', () => {
  closeOverlay('death');
  goLobby();
});

$('#btn-retry').addEventListener('click', () => {
  closeOverlay('death');
  showBriefing(currentNight);
});

$('#btn-win-lobby').addEventListener('click', () => {
  closeOverlay('win');
  const unlocks = pendingUnlocks;
  pendingUnlocks = [];
  showUnlocks(unlocks, () => goLobby());
});

$('#btn-next-night').addEventListener('click', () => {
  closeOverlay('win');
  const unlocks = pendingUnlocks;
  pendingUnlocks = [];
  showUnlocks(unlocks, () => showBriefing(save.completed + 1));
});

function showUnlocks(list, after) {
  if (!list || !list.length) {
    after?.();
    return;
  }
  activeUnlock = { list: [...list], index: 0, after };
  renderUnlock();
}

function renderUnlock() {
  if (!activeUnlock) return;
  const item = activeUnlock.list[activeUnlock.index];
  $('#unlock-icon').textContent = item.icon || '◈';
  $('#unlock-title').textContent = item.title;
  $('#unlock-text').innerHTML = item.text;
  openOverlay('unlock');
  audio.sfx('unlock');
}

$('#btn-unlock-ok').addEventListener('click', () => {
  if (!activeUnlock) {
    closeOverlay('unlock');
    return;
  }
  activeUnlock.index += 1;
  if (activeUnlock.index < activeUnlock.list.length) {
    renderUnlock();
    return;
  }
  closeOverlay('unlock');
  const after = activeUnlock.after;
  activeUnlock = null;
  after?.();
});

/* ============================================================
   PAUSE
   ============================================================ */

$('#btn-pause').addEventListener('click', () => {
  if (!game || game.ended) return;
  game.setPaused(true);
  openOverlay('pause');
});

$('#btn-resume').addEventListener('click', () => {
  closeOverlay('pause');
  game?.setPaused(false);
  audio.sfx('click');
});

$('#btn-abandon').addEventListener('click', () => {
  closeOverlay('pause');
  if (game) {
    game.stop();
    game = null;
  }
  goLobby();
  toast('Смена прервана. Монеты смены потеряны.', 'danger');
});

/* ============================================================
   TABLET / GAME CONTROLS
   ============================================================ */

$('#btn-door').addEventListener('click', () => {
  ensureAudio();
  game?.toggleDoor();
});
$('#btn-flash').addEventListener('click', () => game?.toggleFlashlight());
$('#btn-tablet').addEventListener('click', () => {
  ensureAudio();
  game?.toggleTablet();
});
$('#btn-close-tablet').addEventListener('click', () => game?.closeTablet());
$$('#cam-select .cam-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    ensureAudio();
    game?.selectCamera(Number(btn.dataset.cam));
  });
});

let lastPointer = null;
els.tablet.addEventListener('pointermove', (ev) => {
  if (!game) return;
  if (lastPointer) {
    const dx = ev.clientX - lastPointer.x;
    const dy = ev.clientY - lastPointer.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) game.onPointerMotion(dist);
  }
  lastPointer = { x: ev.clientX, y: ev.clientY };
});
els.tablet.addEventListener('pointerleave', () => {
  lastPointer = null;
});

function triggerLockout(duration) {
  clearTimeout(lockoutTimer);
  els.lockout.classList.remove('hidden');
  els.lockoutFill.style.transition = 'none';
  els.lockoutFill.style.width = '0%';
  requestAnimationFrame(() => {
    els.lockoutFill.style.transition = `width ${duration}s linear`;
    els.lockoutFill.style.width = '100%';
  });
  lockoutTimer = setTimeout(() => {
    els.lockout.classList.add('hidden');
  }, duration * 1000);
}

/* ============================================================
   LOBBY / NAVIGATION
   ============================================================ */

$('#btn-start').addEventListener('click', () => {
  ensureAudio();
  audio.sfx('click');
  showBriefing(save.completed + 1);
});

$('#btn-enter-office').addEventListener('click', () => {
  ensureAudio();
  audio.sfx('open');
  beginNight(pendingNight);
});

function goLobby() {
  if (game) {
    game.stop();
    game = null;
  }
  els.game.classList.remove('is-active');
  els.lobby.classList.add('is-active');
  els.tablet.classList.add('hidden');
  els.lockout.classList.add('hidden');
  els.jumpscare.classList.add('hidden');
  clearTimeout(lockoutTimer);
  closeAllOverlays();
  updateLobby();
  if (!save.muted) {
    audio.ensure();
    audio.startAmbience('lobby');
  }
}

/* ============================================================
   KEYBOARD
   ============================================================ */

document.addEventListener('keydown', (ev) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') return;

  if (ev.key === 'Escape') {
    const openOverlayEl = $$('.overlay').find((o) => !o.classList.contains('hidden'));
    if (openOverlayEl && openOverlayEl.id !== 'overlay-reverse') {
      openOverlayEl.classList.add('hidden');
      delete document.body.dataset.overlay;
      return;
    }
    if (game?.tabletOpen) {
      game.closeTablet();
      return;
    }
    if (els.game.classList.contains('is-active') && game && !game.ended) {
      game.setPaused(true);
      openOverlay('pause');
    }
    return;
  }

  if (!els.game.classList.contains('is-active') || !game || game.ended) return;
  const key = ev.key.toLowerCase();
  if (key === 'c') {
    ev.preventDefault();
    game.toggleTablet();
  } else if (key === 'd') {
    ev.preventDefault();
    game.toggleDoor();
  } else if (key === 'l') {
    ev.preventDefault();
    game.toggleFlashlight();
  } else if (key === 'p') {
    if (!game.paused) {
      game.setPaused(true);
      openOverlay('pause');
    }
  } else if (['1', '2', '3', '4'].includes(key)) {
    ev.preventDefault();
    game.selectCamera(Number(key) - 1);
  }
});

/* ============================================================
   REVERSE MODE
   ============================================================ */

$('#btn-reverse').addEventListener('click', () => {
  if (!save.reverseUnlocked) return;
  ensureAudio();
  audio.stopAmbience();
  closeAllOverlays();
  $('#overlay-reverse').classList.remove('hidden');
  startReverse();
});

function startReverse() {
  if (!reverse) {
    reverse = new ReverseGame({
      audio,
      els: {
        canvas: $('#reverse-canvas'),
        guard: $('#reverse-guard'),
        door: $('#reverse-door'),
        nodes: $('#reverse-nodes'),
        log: $('#reverse-log'),
        lives: $('#reverse-lives'),
        status: $('#reverse-status'),
        actions: $('#reverse-actions'),
        help: $('#reverse-help'),
        result: $('#reverse-result'),
        resultTitle: $('#reverse-result-title'),
        resultText: $('#reverse-result-text'),
        resultEyebrow: $('#reverse-result-eyebrow'),
      },
    });
  }
  reverseAwarded = false;
  reverse.reset();
  reverse.start();
}

$$('#reverse-actions button').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!reverse || reverse.ended) return;
    reverse.act(btn.dataset.action);
    if (reverse.ended && !reverseAwarded) {
      reverseAwarded = true;
      if (reverse.won) {
        save.coins += 25;
        save.reverseWins = (save.reverseWins || 0) + 1;
        persistSave(save);
        updateLobby();
        toast('+25 монет за перехват сигнала.', 'good');
      }
    }
  });
});

$('#btn-reverse-close').addEventListener('click', closeReverse);
$('#btn-reverse-exit').addEventListener('click', closeReverse);
$('#btn-reverse-again').addEventListener('click', () => {
  $('#reverse-result').classList.add('hidden');
  startReverse();
});

function closeReverse() {
  reverse?.stop();
  reverse = null;
  $('#overlay-reverse').classList.add('hidden');
  goLobby();
}

/* ============================================================
   ANIMATION LOOPS
   ============================================================ */

let lobbyRaf = null;
function lobbyLoop(ts) {
  if (els.lobby.classList.contains('is-active') && !document.hidden) {
    drawLobby(els.lobbyCanvas, ts);
  }
  lobbyRaf = requestAnimationFrame(lobbyLoop);
}

document.addEventListener('visibilitychange', () => {
  if (!game || game.ended) return;
  if (document.hidden) {
    game.setPaused(true);
  } else {
    game.setPaused(false);
  }
});

window.addEventListener('resize', () => {
  // canvases resize themselves on next draw
});

/* ============================================================
   BOOT
   ============================================================ */

updateLobby();
renderDiary();
renderShop();
lobbyRaf = requestAnimationFrame(lobbyLoop);
document.addEventListener('pointerdown', ensureAudio, { once: true });
$('#btn-sound').classList.toggle('muted', save.muted);
if (save.muted) audio.setMuted(true);

/* Debug handle for local balancing and automated checks. */
window.__signal = {
  get game() {
    return game;
  },
  get reverse() {
    return reverse;
  },
  save,
  startNight: beginNight,
  showBriefing,
  goLobby,
  audio,
};
