import {
  NIGHT_SECONDS,
  BASE_HP,
  maxEnergy,
  speedMultiplier,
  bushStageTime,
  bushDamage,
  bushNoiseDuration,
  forgottenTimer,
  forgottenDamage,
  ransomJamDuration,
  ransomInterval,
  ransomAngerLimit,
  features,
} from './formulas.js';
import { drawOffice, drawCamera, camName } from './render.js';

const BASE_DRAIN = 0.2;
const TABLET_DRAIN = 0.35;
const FLASH_DRAIN = 0.7;
const DOOR_DRAIN = 1.2;
const COIN_INTERVAL = 10;
const DOOR_COOLDOWN = 0.25;

export class NightGame {
  constructor({ night, save, audio, canvas, camCanvas, callbacks }) {
    this.night = night;
    this.save = save;
    this.upgrades = save.upgrades;
    this.audio = audio;
    this.canvas = canvas;
    this.camCanvas = camCanvas;
    this.cb = callbacks;
    this.feat = features(night);
    this.speed = speedMultiplier(night);

    this.maxEnergy = maxEnergy(this.upgrades);
    this.energy = this.maxEnergy;
    this.hp = BASE_HP;
    this.elapsed = 0;
    this.duration = NIGHT_SECONDS;
    this.coins = 0;
    this.coinTimer = 0;

    this.doorClosed = false;
    this.doorCooldown = 0;
    this.flashlight = false;
    this.tabletOpen = false;
    this.selectedCam = 0;
    this.freeze = 0;
    this.anger = 0;
    this.noise = 0;
    this.blackout = false;
    this.blackoutTimer = 0;
    this.blackoutCount = 0;
    this.antiNoiseLeft = this.upgrades.antiNoise ? 1 : 0;
    this.ended = false;
    this.paused = false;
    this.lastTs = 0;
    this.hudTimer = 0;
    this.tensionTimer = 0;
    this.staticTimer = 0;
    this.shake = 0;

    this.broken = [0, 0, 0, 0];
    this.ransomOnCam = -1;

    const chaos = this.feat.chaos;
    this.bush = {
      phase: 'waiting',
      stage: 0,
      timer: 0,
      delay: chaos ? 0.8 : 5 + Math.random() * 2,
      doorWindow: 0,
      pendingDouble: 0,
      hits: 0,
    };
    this.forgotten = {
      active: false,
      cams: [],
      timer: 0,
      max: 0,
      find: 0,
      next: chaos ? 1.6 : 12 + Math.random() * 5,
      attacks: 0,
    };
    this.ransom = {
      timer: chaos ? 2.2 : 9 + Math.random() * 4,
      interval: ransomInterval(night),
    };

    this._loop = this._loop.bind(this);
    this._raf = null;
  }

  start() {
    this.audio.startAmbience('office');
    this.lastTs = performance.now();
    this.emitHud(true);
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  setPaused(paused) {
    this.paused = paused;
    this.lastTs = performance.now();
    if (paused) this.audio.setTension(0.1);
  }

  _loop(ts) {
    if (this.ended) return;
    const dt = Math.min(0.05, Math.max(0, (ts - this.lastTs) / 1000));
    this.lastTs = ts;
    if (!this.paused) this.update(dt);
    this.draw(ts);
    this._raf = requestAnimationFrame(this._loop);
  }

  get clock() {
    const totalMinutes = (this.elapsed / this.duration) * 360;
    const hour = Math.min(6, Math.floor(totalMinutes / 60));
    const minute = Math.floor(totalMinutes % 60);
    const h = hour === 0 ? 12 : hour;
    return `${h}:${String(minute).padStart(2, '0')} AM`;
  }

  get alive() {
    return !this.ended && this.hp > 0;
  }

  emitHud(force = false) {
    if (!this.cb.hud) return;
    this.cb.hud({
      night: this.night,
      clock: this.clock,
      energy: this.energy,
      maxEnergy: this.maxEnergy,
      hp: this.hp,
      coins: this.coins,
      doorClosed: this.doorClosed,
      flashlight: this.flashlight,
      tabletOpen: this.tabletOpen,
      freeze: this.freeze,
      anger: this.anger / ransomAngerLimit(this.night),
      warnings: {
        door: this.bush.phase === 'door' || this.bush.pendingDouble > 0,
        forgotten: this.forgotten.active,
        ransom: this.anger / ransomAngerLimit(this.night) > 0.65 || this.freeze > 0,
        blackout: this.blackout,
      },
      broken: [...this.broken],
      selectedCam: this.selectedCam,
      camStatus: camName(this.selectedCam),
    });
  }

  update(dt) {
    this.elapsed += dt;
    this.doorCooldown = Math.max(0, this.doorCooldown - dt);
    this.freeze = Math.max(0, this.freeze - dt);
    this.noise = Math.max(0, this.noise - dt);
    this.anger = Math.max(0, this.anger - 0.45 * dt);
    this.shake = Math.max(0, this.shake - dt * 2);

    // drip coins while surviving
    this.coinTimer += dt;
    while (this.coinTimer >= COIN_INTERVAL) {
      this.coinTimer -= COIN_INTERVAL;
      this.coins += 1;
      if (this.cb.pulseCoins) this.cb.pulseCoins();
    }

    if (this.blackout) {
      this.blackoutTimer -= dt;
      if (this.blackoutTimer <= 0) this.endBlackout();
      if (this.elapsed >= this.duration) return this.win();
      this.tickHud(dt);
      return;
    }

    // energy
    let drain = BASE_DRAIN;
    if (this.doorClosed) drain += this.upgrades.quietDoor ? DOOR_DRAIN * 0.7 : DOOR_DRAIN;
    if (this.tabletOpen) drain += TABLET_DRAIN;
    if (this.flashlight) drain += FLASH_DRAIN;
    this.energy = Math.max(0, this.energy - drain * dt);

    // doors auto cooldown
    if (this.energy <= 0) {
      this.beginBlackout();
      this.tickHud(dt);
      return;
    }

    this.updateBush(dt);
    this.updateForgotten(dt);
    this.updateRansom(dt);

    // broken camera timers
    for (let i = 0; i < 4; i++) {
      if (this.broken[i] > 0) {
        this.broken[i] = Math.max(0, this.broken[i] - dt);
        if (this.broken[i] === 0 && this.ransomOnCam === i) this.ransomOnCam = -1;
      }
    }

    if (this.elapsed >= this.duration) return this.win();
    this.tickHud(dt);
    this.tickTension(dt);
  }

  tickHud(dt) {
    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.emitHud();
    }
  }

  tickTension(dt) {
    this.tensionTimer += dt;
    if (this.tensionTimer < 0.4) return;
    this.tensionTimer = 0;
    let tension = 0.08;
    if (this.bush.phase === 'moving') tension += this.bush.stage * 0.12;
    if (this.bush.phase === 'door') tension = 0.95;
    if (this.bush.pendingDouble > 0) tension = 1;
    if (this.forgotten.active) tension = Math.max(tension, 0.65);
    if (this.freeze > 0) tension = 1;
    if (this.blackout) tension = 0.4;
    if (this.hp < 35) tension = Math.max(tension, 0.8);
    this.audio.setTension(tension);
  }

  /* ---------------- actions ---------------- */

  toggleDoor() {
    if (!this.alive || this.blackout || this.doorCooldown > 0) return;
    this.doorClosed = !this.doorClosed;
    this.doorCooldown = DOOR_COOLDOWN;
    this.audio.sfx(this.doorClosed ? 'doorDown' : 'open');
    this.emitHud();
  }

  toggleFlashlight() {
    if (!this.alive || this.blackout) return;
    if (!this.upgrades.flashlight) {
      this.cb.toast?.('ФОНАРИК НЕ КУПЛЕН. ЗАГЛЯНИ В АВТОМАТ.', 'danger');
      this.audio.sfx('error');
      return;
    }
    this.flashlight = !this.flashlight;
    this.audio.sfx('click');
    this.emitHud();
  }

  openTablet() {
    if (!this.alive) return;
    if (this.blackout) {
      this.cb.toast?.('НЕТ ПИТАНИЯ. ПЛАНШЕТ МЁРТВ.', 'danger');
      return;
    }
    if (this.freeze > 0) {
      this.cb.toast?.('RANSOM ЕЩЁ ДЕРЖИТ КАНАЛ.', 'danger');
      this.audio.sfx('error');
      return;
    }
    if (this.tabletOpen) return;
    this.tabletOpen = true;
    this.anger += 0.7;
    this.audio.sfx('open');
    this.cb.tablet?.(true);
    this.emitHud();
  }

  closeTablet(silent = false) {
    if (!this.tabletOpen) return;
    this.tabletOpen = false;
    this.forgotten.find = Math.max(0, this.forgotten.find - 0.2);
    if (!silent) this.audio.sfx('close');
    this.cb.tablet?.(false);
    this.emitHud();
  }

  toggleTablet() {
    if (this.tabletOpen) this.closeTablet();
    else this.openTablet();
  }

  selectCamera(index) {
    if (!this.alive || index < 0 || index > 3) return;
    if (this.blackout) return;
    if (this.freeze > 0) return;
    if (!this.tabletOpen) {
      this.openTablet();
      if (!this.tabletOpen) return;
    }
    if (this.selectedCam !== index) {
      this.anger += 1.05;
      this.audio.sfx('camera');
    }
    this.selectedCam = index;
    this.forgotten.find = Math.max(0, this.forgotten.find - 0.08);
    if (this.broken[index] > 0) this.audio.sfx('static');
    this.emitHud();
  }

  onPointerMotion(amount) {
    if (!this.tabletOpen || this.freeze > 0) return;
    this.anger += Math.min(0.35, amount * 0.0009);
    if (this.anger >= ransomAngerLimit(this.night)) this.triggerRansomFreeze();
  }

  /* ---------------- monsters ---------------- */

  updateBush(dt) {
    const b = this.bush;

    if (b.pendingDouble > 0) {
      b.pendingDouble -= dt;
      if (b.pendingDouble <= 0) {
        b.pendingDouble = 0;
        b.phase = 'door';
        b.stage = 4;
        b.doorWindow = 1.9;
        this.cb.toast?.('ОН ВОЗВРАЩАЕТСЯ. ДЕРЖИ ДВЕРЬ.', 'danger');
        this.audio.sfx('bang');
      }
      return;
    }

    if (b.phase === 'waiting') {
      b.delay -= dt;
      if (b.delay <= 0) {
        b.phase = 'moving';
        b.stage = 0;
        b.timer = 0;
        this.audio.sfx('step');
      }
      return;
    }

    if (b.phase === 'moving') {
      b.timer += dt;
      const stepTime = bushStageTime(this.night);
      if (b.timer >= stepTime) {
        b.timer -= stepTime;
        b.stage += 1;
        this.audio.sfx('step');
        if (b.stage >= 4) {
          b.phase = 'door';
          b.stage = 4;
          b.doorWindow = 2.35;
          this.cb.toast?.('BUSH У ДВЕРИ. ЗАКРОЙ.', 'danger');
          this.audio.sfx('alarm');
        }
      }
      return;
    }

    if (b.phase === 'door') {
      if (this.doorClosed) {
        // blocked
        b.phase = 'waiting';
        b.stage = 0;
        b.delay = 2.6 + Math.random() * 1.5;
        b.doorWindow = 0;
        this.audio.sfx('bang');
        this.cb.toast?.('ДВЕРЬ ВЫДЕРЖАЛА. ОН УХОДИТ.', 'good');
        return;
      }
      b.doorWindow -= dt;
      if (b.doorWindow <= 0) this.bushHit();
    }
  }

  bushHit() {
    const b = this.bush;
    const dmg = bushDamage(this.night);
    this.hp = Math.max(0, this.hp - dmg);
    b.hits += 1;
    this.shake = 1;
    this.audio.sfx('hurt');
    this.audio.sfx('bang');

    if (this.antiNoiseLeft > 0) {
      this.antiNoiseLeft -= 1;
      this.cb.toast?.('АНТИ-ШУМ: ЗВОН ПОГЛОЩЁН.', 'good');
    } else {
      const ring = bushNoiseDuration(this.night);
      this.noise = ring;
      this.audio.sfx('ring', { duration: Math.min(2.5, ring) });
      this.cb.toast?.(`УДАР: −${dmg} HP. ЗВОН В УШАХ ${Math.round(ring)} СЕК.`, 'danger');
    }
    if (this.cb.shake) this.cb.shake(1);
    this.cb.flashRed?.();

    b.phase = 'waiting';
    b.stage = 0;
    b.doorWindow = 0;
    b.delay = 3.4 + Math.random() * 1.6;

    if (this.feat.doubleBush && b.hits % 2 === 1 && this.hp > 0) {
      b.delay = 0.4;
      b.pendingDouble = 1.7;
    }

    this.emitHud();
    if (this.hp <= 0) this.die('bush');
  }

  updateForgotten(dt) {
    const f = this.forgotten;
    if (!f.active) {
      f.next -= dt;
      if (f.next <= 0) this.spawnForgotten();
      return;
    }

    const brokenHere = this.broken[this.selectedCam] > 0;
    if (this.tabletOpen && f.cams.includes(this.selectedCam) && !brokenHere) {
      f.find += dt;
      this.staticTimer += dt;
      if (this.staticTimer > 0.18) {
        this.staticTimer = 0;
        this.audio.sfx('static');
      }
      if (f.find >= 0.5) {
        this.resolveForgotten();
        return;
      }
    } else {
      f.find = Math.max(0, f.find - dt * 1.5);
    }

    f.timer -= dt;
    if (f.timer <= 0) this.forgottenHit();
  }

  spawnForgotten() {
    const f = this.forgotten;
    f.active = true;
    f.timer = forgottenTimer(this.night);
    f.max = f.timer;
    f.find = 0;
    const brokenCams = this.broken.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
    let first;
    if (this.feat.hideBehindBroken && brokenCams.length && Math.random() < 0.72) {
      first = brokenCams[Math.floor(Math.random() * brokenCams.length)];
    } else {
      first = Math.floor(Math.random() * 4);
    }
    f.cams = [first];
    if (this.feat.twoForgotten) {
      let second = Math.floor(Math.random() * 4);
      let guard = 0;
      while (second === first && guard++ < 10) second = Math.floor(Math.random() * 4);
      if (second !== first) {
        if (this.feat.hideBehindBroken && brokenCams.length && Math.random() < 0.6) {
          const candidate = brokenCams.find((i) => i !== first);
          if (candidate !== undefined) second = candidate;
        }
        f.cams.push(second);
      }
    }
    this.audio.sfx('whisper');
    this.emitHud();
  }

  resolveForgotten() {
    const f = this.forgotten;
    f.active = false;
    f.find = 0;
    f.attacks += 0;
    f.next = Math.max(7, 17 - this.night * 0.04 + Math.random() * 7);
    this.energy = Math.min(this.maxEnergy, this.energy + 4);
    this.coins += 1;
    this.audio.sfx('found');
    this.cb.toast?.('FORGOTTEN НАЙДЕН. +1 МОНЕТА · +4% ЭНЕРГИИ', 'good');
    this.emitHud();
  }

  forgottenHit() {
    const f = this.forgotten;
    const dmg = Math.round(forgottenDamage(this.night));
    f.active = false;
    f.find = 0;
    f.attacks += 1;
    f.next = Math.max(8, 16 - this.night * 0.05 + Math.random() * 6);
    this.hp = Math.max(0, this.hp - dmg);
    this.noise = Math.max(this.noise, 5);
    this.shake = 1;
    this.audio.sfx('hurt');
    this.audio.sfx('static');
    this.cb.toast?.(`FORGOTTEN НАШЁЛ ТЕБЯ: −${dmg} HP`, 'danger');
    this.cb.flashRed?.();
    if (this.cb.shake) this.cb.shake(1);
    this.emitHud();
    if (this.hp <= 0) this.die('forgotten');
  }

  updateRansom(dt) {
    if (this.freeze > 0) return;
    this.ransom.timer -= dt;
    if (this.ransom.timer <= 0) {
      this.sabotage();
      this.ransom.timer = ransomInterval(this.night) * (0.82 + Math.random() * 0.36);
    }
    const limit = ransomAngerLimit(this.night);
    if (this.anger >= limit) this.triggerRansomFreeze();
  }

  sabotage() {
    const open = [0, 1, 2, 3].filter((i) => this.broken[i] <= 0);
    if (!open.length) open.push(Math.floor(Math.random() * 4));
    const first = open[Math.floor(Math.random() * open.length)];
    const jam = ransomJamDuration(this.night);
    this.broken[first] = jam;
    this.ransomOnCam = first;
    this.audio.sfx('jam');
    if (this.feat.doubleJam && Math.random() < 0.58) {
      const secondCandidates = [0, 1, 2, 3].filter((i) => i !== first && this.broken[i] <= 0);
      if (secondCandidates.length) {
        const second = secondCandidates[Math.floor(Math.random() * secondCandidates.length)];
        this.broken[second] = jam * 1.1;
        this.audio.sfx('jam');
      }
    }
    if (this.tabletOpen && (this.selectedCam === first || this.broken[this.selectedCam] > 0)) {
      this.audio.sfx('static');
      this.cb.toast?.('ПОМЕХИ В КАНАЛЕ. ПЕРЕКЛЮЧИ КАМЕРУ.', 'danger');
    }
    this.emitHud();
  }

  triggerRansomFreeze() {
    if (this.freeze > 0) return;
    this.anger = 0;
    const duration = this.feat.tabletFreeze ? 2 : 1.25;
    this.freeze = duration;
    this.energy = Math.max(0, this.energy - 3);
    this.audio.sfx('freeze');
    this.cb.freeze?.(duration);
    if (this.tabletOpen) this.closeTablet(true);
    this.cb.toast?.('RANSOM ЗАМОРОЗИЛ ПЛАНШЕТ.', 'danger');
    this.emitHud();
  }

  beginBlackout() {
    this.blackout = true;
    this.blackoutTimer = 3.4;
    this.blackoutCount += 1;
    this.doorClosed = false;
    this.flashlight = false;
    if (this.tabletOpen) this.closeTablet(true);
    this.audio.sfx('blackout');
    this.cb.toast?.('ЭНЕРГИЯ НОЛЬ. ДВЕРЬ ОТКРЫТА.', 'danger');
    this.emitHud();
  }

  endBlackout() {
    this.blackout = false;
    this.energy = 12;
    const dmg = 24 + Math.min(12, this.night * 0.25);
    this.hp = Math.max(0, this.hp - Math.round(dmg));
    this.noise = Math.max(this.noise, 8);
    this.audio.sfx('hurt');
    this.audio.sfx('bang');
    this.cb.toast?.(`ОН ВОШЁЛ В ТЕМНОТЕ: −${Math.round(dmg)} HP`, 'danger');
    this.cb.flashRed?.();
    if (this.cb.shake) this.cb.shake(1.4);
    this.emitHud();
    if (this.hp <= 0) this.die('ransom');
  }

  /* ---------------- endings ---------------- */

  win() {
    if (this.ended) return;
    this.ended = true;
    this.stop();
    this.audio.stopAmbience();
    this.audio.sfx('success');
    if (this.cb.end) {
      this.cb.end({
        type: 'win',
        night: this.night,
        coins: this.coins,
        hp: this.hp,
        energy: this.energy,
      });
    }
  }

  die(killer = 'bush') {
    if (this.ended) return;
    this.ended = true;
    this.stop();
    this.audio.stopAmbience();
    this.audio.sfx('jumpscare');
    if (this.cb.end) {
      this.cb.end({
        type: 'death',
        night: this.night,
        coins: this.coins,
        hp: 0,
        elapsed: this.elapsed,
        killer,
      });
    }
  }

  /* ---------------- drawing ---------------- */

  draw(ts) {
    drawOffice(this.canvas, {
      doorClosed: this.doorClosed,
      flashlight: this.flashlight,
      blackout: this.blackout,
      bushAtDoor: this.bush.phase === 'door',
      bushStage: this.bush.stage,
      skinOld: this.save.skinOldGuard,
      energy: this.energy,
      hp: this.hp,
      noise: this.noise,
      night: this.night,
      elapsed: this.elapsed,
    }, ts);

    if (this.tabletOpen) {
      drawCamera(this.camCanvas, {
        selectedCam: this.selectedCam,
        broken: this.broken,
        bush: {
          active: this.bush.phase === 'moving' || this.bush.phase === 'door',
          atDoor: this.bush.phase === 'door',
          stage: this.bush.stage,
          phase: this.bush.phase,
        },
        forgotten: this.forgotten,
        ransomOnCam: this.ransomOnCam,
        features: this.feat,
        night: this.night,
        elapsed: this.elapsed,
      }, ts);
    }
  }
}
