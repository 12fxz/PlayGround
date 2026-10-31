import { drawReverse } from './render.js';

const CHARACTERS = {
  ransom: {
    name: 'RANSOM',
    tagline: 'Ты — RANSOM. Один раз за попытку помехи скроют твой шаг.',
    color: '#ff5a3a',
    passive: 'jam',
  },
  bush: {
    name: 'BUSH',
    tagline: 'Ты — BUSH. Тебя можно заметить четыре раза, а не три. Дверь всё равно придётся подождать.',
    color: '#ffd276',
    passive: 'tank',
  },
  forgotten: {
    name: 'FORGOTTEN',
    tagline: 'Ты — FORGOTTEN. Иногда охранник смотрит прямо на тебя — и не видит.',
    color: '#dbeaff',
    passive: 'blink',
  },
};

export class ReverseGame {
  constructor({ audio, els }) {
    this.audio = audio;
    this.els = els;
    this.raf = null;
    this.lastTs = 0;
    this.time = 0;
    this.ended = false;
    this.won = false;
    this.started = false;
    this.reset();
  }

  reset() {
    this.character = Object.keys(CHARACTERS)[Math.floor(Math.random() * 3)];
    this.def = CHARACTERS[this.character];
    this.lives = 3;
    this.suspicion = 0;
    this.suspicionLimit = this.character === 'bush' ? 4 : 3;
    this.pos = 0;
    this.guardCam = 1;
    this.doorClosed = Math.random() < 0.4;
    this.turns = 0;
    this.distraction = 0;
    this.noiseCooldown = 0;
    this.passiveUsed = false;
    this.detected = 0;
    this.logLines = [];
    this.ended = false;
    this.won = false;
    this.hideResult();
    this.addLog(`Ты — ${this.def.name}. ${this.def.tagline}`);
    this.addLog('Начни с Камеры 1. Смотри, куда смотрит охрана.');
    this.updateUI();
  }

  start() {
    this.started = true;
    this.audio.startAmbience('office');
    this.lastTs = performance.now();
    this.updateUI();
    const loop = (ts) => {
      if (!this.started) return;
      const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      this.time += dt;
      this.detected = Math.max(0, this.detected - dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.started = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.audio.stopAmbience();
  }

  draw() {
    if (!this.els.canvas) return;
    drawReverse(this.els.canvas, {
      pos: this.pos,
      guardCam: this.guardCam,
      doorClosed: this.doorClosed,
      character: this.character,
      detected: this.detected,
      lives: this.lives,
      turns: this.turns,
    }, performance.now());
  }

  addLog(line, kind = '') {
    this.logLines.push({ line, kind });
    if (this.logLines.length > 7) this.logLines.shift();
    if (this.els.log) {
      this.els.log.innerHTML = this.logLines
        .map((l) => `<p class="${l.kind}">▸ ${l.line}</p>`)
        .join('');
      this.els.log.scrollTop = this.els.log.scrollHeight;
    }
  }

  act(action) {
    if (this.ended) return;
    this.turns += 1;
    this.noiseCooldown = Math.max(0, this.noiseCooldown - 1);
    let usedTurn = true;

    switch (action) {
      case 'sneak':
        usedTurn = this.sneak();
        break;
      case 'wait':
        this.wait();
        break;
      case 'noise':
        usedTurn = this.noise();
        break;
      case 'attack':
        usedTurn = this.attack();
        break;
      default:
        usedTurn = false;
    }

    if (!usedTurn || this.ended) {
      if (!usedTurn) this.turns -= 1;
      this.updateUI();
      return;
    }

    this.updateGuard();
    this.checkDanger();

    if (!this.ended) {
      this.suspicion = Math.max(0, Math.min(this.suspicion, this.suspicionLimit));
      this.updateUI();
    }
  }

  sneak() {
    if (this.pos >= 5) {
      this.addLog('Ты уже у двери. Осталось только войти.', '');
      return false;
    }
    this.pos += 1;
    this.audio.sfx('step');
    const target = this.pos;
    let spotted = target <= 4 && this.guardCam === target;

    if (spotted && this.character === 'ransom' && !this.passiveUsed) {
      this.passiveUsed = true;
      spotted = false;
      this.addLog('RANSOM: помехи перекрыли камеру. Шаг остался незамеченным.', 'good');
      this.audio.sfx('jam');
    } else if (spotted && this.character === 'forgotten' && Math.random() < 0.5) {
      spotted = false;
      this.addLog('FORGOTTEN: охранник смотрит прямо сквозь тебя.', 'good');
      this.audio.sfx('whisper');
    }

    if (target === 5) {
      this.addLog('Ты у двери офиса. Если она открыта — атакуй.', 'good');
      this.audio.sfx('bang');
      return true;
    }

    this.addLog(`Ты пробрался на Камеру ${target}.`, '');
    if (spotted) {
      this.addSuspicion('Охранник заметил движение на камере.');
    } else {
      this.audio.sfx('click');
    }
    return true;
  }

  wait() {
    if (this.guardCam === this.pos && this.pos >= 1) {
      this.suspicion = Math.max(0, this.suspicion - 1);
      this.addLog('Ты затаился в тени. Охранник не уверен, что видел тебя.', 'good');
      this.audio.sfx('whisper');
    } else {
      this.addLog('Ты ждёшь. Шум стихает. Охранник меняет камеру.', '');
    }
  }

  noise() {
    if (this.noiseCooldown > 0) {
      this.addLog(`Шум ещё не затих. Подожди ${this.noiseCooldown} ход(а).`, '');
      return false;
    }
    this.noiseCooldown = 3;
    this.distraction = 2;
    this.suspicion = Math.max(0, this.suspicion - 1);
    this.addLog('Ты сбрасываешь стул на Камере 3. Охранник отвлекается.', 'good');
    this.audio.sfx('bang');
    this.audio.sfx('alarm');
    return true;
  }

  attack() {
    if (this.pos < 5) {
      this.addLog('Ты ещё не у двери.', '');
      return false;
    }
    if (this.doorClosed) {
      this.pos = 3;
      this.addSuspicion('Дверь выдержала. Тебя отбросило на Камеру 3.');
      this.audio.sfx('bang');
      return true;
    }
    this.finish(true, 'Дверь открылась. Охранник не успел обернуться.');
    this.audio.sfx('jumpscare');
    return true;
  }

  addSuspicion(reason) {
    this.suspicion += 1;
    this.detected = 1;
    this.audio.sfx('alarm');
    this.addLog(`${reason} Шум ${this.suspicion}/${this.suspicionLimit}.`, 'hot');
    if (this.suspicion >= this.suspicionLimit) this.loseSignal();
  }

  loseSignal() {
    this.lives -= 1;
    this.suspicion = 0;
    this.pos = 1;
    this.guardCam = 1 + Math.floor(Math.random() * 4);
    this.doorClosed = Math.random() < 0.5;
    this.distraction = 0;
    this.audio.sfx('freeze');
    if (this.lives <= 0) {
      this.finish(false, 'Охранник перекрыл канал. Твой сигнал стёрт.');
    } else {
      this.addLog(`ОХРАННИК ЗАСЁК ТЕБЯ. Сигнал восстановлен. Попыток: ${this.lives}.`, 'hot');
    }
  }

  updateGuard() {
    if (this.distraction > 0) {
      this.distraction -= 1;
      this.guardCam = 1 + Math.floor(Math.random() * 4);
      this.doorClosed = Math.random() < 0.08;
      this.addLog(`Охранник проверяет Камеру ${this.guardCam}. Он отвлечён.`, '');
      return;
    }

    const change = Math.random() < 0.62;
    if (change) {
      const next = 1 + Math.floor(Math.random() * 4);
      if (next !== this.guardCam) {
        this.guardCam = next;
        this.addLog(`Охранник переключился на Камеру ${next}.`, '');
      }
    } else if (Math.random() < 0.18) {
      this.guardCam = 0;
      this.addLog('Охранник смотрит на мониторы в офисе.', '');
    }

    if (this.doorClosed) {
      const openChance = 0.35 + this.suspicion * 0.08 + (this.distraction > 0 ? 0.2 : 0);
      if (Math.random() < openChance) {
        this.doorClosed = false;
        this.addLog('Слышен лязг: дверь офиса открылась.', 'good');
      }
    } else {
      const closeChance = 0.14 + this.suspicion * 0.11 + (this.pos === 5 ? 0.22 : 0);
      if (Math.random() < closeChance) {
        this.doorClosed = true;
        this.addLog('Дверь офиса захлопнулась. Придётся ждать.', 'hot');
      }
    }
  }

  checkDanger() {
    if (this.ended) return;
    if (this.pos >= 1 && this.pos <= 4 && this.guardCam === this.pos) {
      this.detected = Math.max(this.detected, 0.5);
    }
  }

  finish(won, text) {
    this.ended = true;
    this.won = won;
    this.started = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.audio.stopAmbience();
    this.showResult(won, text);
    this.updateUI();
  }

  showResult(won, text) {
    const { result, resultTitle, resultText, resultEyebrow } = this.els;
    if (!result) return;
    result.classList.remove('hidden', 'defeat');
    if (!won) result.classList.add('defeat');
    resultEyebrow.textContent = won ? 'СИГНАЛ ПЕРЕХВАЧЕН' : 'СИГНАЛ СТЁРТ';
    resultTitle.textContent = won ? 'ОХРАННИК ПРОИГРАЛ' : 'ТЕБЯ СТЁРЛИ';
    resultText.innerHTML = `${text}<br />Ты — <b>${this.def.name}</b>. Ходов: <b>${this.turns}</b>. ${
      won ? 'Смена официально не существует.' : 'Попробуй ещё раз. Охранник тоже ошибается.'
    }`;
  }

  hideResult() {
    this.els.result?.classList.add('hidden');
  }

  updateUI() {
    const e = this.els;
    if (!e) return;
    if (e.guard) {
      e.guard.textContent = this.guardCam === 0 ? 'МОНИТОРЫ' : `КАМЕРА ${this.guardCam}`;
      e.guard.style.color = this.guardCam === this.pos && this.pos >= 1 && this.pos <= 4 ? '#ff5a42' : '#e6b45a';
    }
    if (e.door) {
      e.door.textContent = this.doorClosed ? 'ДВЕРЬ ЗАКРЫТА' : 'ДВЕРЬ ОТКРЫТА';
      e.door.classList.toggle('closed', this.doorClosed);
    }
    if (e.lives) {
      e.lives.innerHTML = Array.from({ length: 3 }, (_, i) => `<span class="${i < this.lives ? '' : 'lost'}">◆</span>`).join('');
    }
    if (e.nodes) {
      e.nodes.innerHTML = Array.from({ length: 6 }, (_, i) => {
        let cls = '';
        if (i < this.pos) cls = 'done';
        if (i === this.pos) cls = 'here';
        return `<i class="${cls}" title="${i === 5 ? 'ДВЕРЬ' : `КАМЕРА ${i + 1}`}"></i>`;
      }).join('');
    }
    if (e.status) {
      const place = this.pos === 0 ? 'СНАРУЖИ' : this.pos === 5 ? 'У ДВЕРИ' : `КАМЕРА ${this.pos}`;
      const seen = this.pos >= 1 && this.pos <= 4 && this.guardCam === this.pos;
      e.status.innerHTML = `ТЫ: <b>${this.def.name}</b> · ${place} · ШУМ ${this.suspicion}/${this.suspicionLimit} · ХОД ${this.turns}${
        seen ? ' · <span style="color:#ff5a42">ТЫ В КАДРЕ</span>' : ''
      }`;
    }
    if (e.help) {
      e.help.textContent = `${this.def.name}: ${this.def.tagline} ${this.noiseCooldown > 0 ? `Шум будет доступен через ${this.noiseCooldown}.` : ''}`;
    }
    if (e.actions) {
      e.actions.querySelectorAll('button').forEach((btn) => {
        const action = btn.dataset.action;
        if (action === 'sneak') btn.disabled = this.pos >= 5 || this.ended;
        if (action === 'attack') btn.disabled = this.pos < 5 || this.ended;
        if (action === 'noise') btn.disabled = this.noiseCooldown > 0 || this.ended;
        if (action === 'wait') btn.disabled = this.ended;
        if (action === 'attack') btn.classList.toggle('ready', this.pos >= 5 && !this.doorClosed);
      });
    }
    if (e.result && this.ended) e.result.classList.remove('hidden');
  }
}
