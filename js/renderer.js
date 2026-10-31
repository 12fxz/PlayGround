/* ============================================================
   ROOMS — программный raycasting-рендерер
   ============================================================ */
import { makeLocker, makeCrate, makeLamp, makeBattery, makeA60, makeA120, makeFace90, makeFace60, makeFace120, makeGrain, canvas } from './art.js';
import { ROOM, worldHash } from './world.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function mix(base, light) {
  return [
    clamp(base[0] * light, 0, 255),
    clamp(base[1] * light, 0, 255),
    clamp(base[2] * light, 0, 255)
  ];
}
function rgb(c) {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}
function rgba(c, a) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

export class Renderer {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d', { alpha: false });
    this.W = canvasEl.width;
    this.H = canvasEl.height;
    this.h0 = this.H / 2;
    this.zbuf = new Float32Array(this.W);

    this.lockers = [makeLocker(1), makeLocker(2), makeLocker(3)];
    this.crates = [makeCrate(1), makeCrate(2), makeCrate(3), makeCrate(4)];
    this.lamp = makeLamp();
    this.battery = makeBattery();
    this.a60 = makeA60();
    this.a120 = makeA120();
    this.face90 = makeFace90();
    this.face60 = makeFace60();
    this.face120 = makeFace120();
    this.noise = makeGrain(128);
    this.pattern = null;
    this.mask = null;
    this.resize(this.canvas.clientWidth || 1280, this.canvas.clientHeight || 720);
  }

  resize(cssW, cssH) {
    const aspect = Math.max(0.35, Math.min(3.7, cssW / Math.max(1, cssH)));
    let w = Math.round(clamp(cssW * 0.82, 320, 720));
    let h = Math.round(w / aspect);
    if (h > 900) { h = 900; w = Math.round(h * aspect); }
    if (h < 260) { h = 260; w = Math.round(h * aspect); }
    w = Math.round(clamp(w, 300, 900));
    h = Math.round(clamp(h, 260, 900));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.W = w;
    this.H = h;
    this.zbuf = new Float32Array(w);
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    this.pattern = ctx.createPattern(this.noise, 'repeat');
    this.makeMask();
  }

  makeMask() {
    const { W, H } = this;
    const c = canvas(W, H);
    const x = c.getContext('2d');
    x.clearRect(0, 0, W, H);
    x.fillStyle = '#000';
    x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'destination-out';
    const left = W * 0.075;
    const width = W * 0.85;
    const gapHeight = H * 0.045;
    for (let i = 0; i < 5; i++) {
      const y = H * (0.22 + i * 0.105);
      x.fillRect(left, y, width, gapHeight);
    }
    x.globalCompositeOperation = 'source-over';
    // тёмные края и центральная стойка
    const side = x.createLinearGradient(0, 0, W, 0);
    side.addColorStop(0, 'rgba(0,0,0,.96)');
    side.addColorStop(0.075, 'rgba(0,0,0,.9)');
    side.addColorStop(0.16, 'rgba(0,0,0,0)');
    side.addColorStop(0.48, 'rgba(0,0,0,0)');
    side.addColorStop(0.52, 'rgba(0,0,0,0)');
    side.addColorStop(0.84, 'rgba(0,0,0,0)');
    side.addColorStop(0.925, 'rgba(0,0,0,.9)');
    side.addColorStop(1, 'rgba(0,0,0,.96)');
    x.fillStyle = side;
    x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,.92)';
    x.fillRect(W * 0.49, 0, W * 0.02, H);
    // рамка прорезей
    x.fillStyle = 'rgba(120,138,112,.12)';
    for (let i = 0; i < 5; i++) {
      const y = H * (0.22 + i * 0.105);
      x.fillRect(left, y + gapHeight, width, 2);
      x.fillRect(left, y - 2, width, 2);
    }
    // верхняя / нижняя тень
    const top = x.createLinearGradient(0, 0, 0, H * 0.2);
    top.addColorStop(0, 'rgba(0,0,0,.96)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = top;
    x.fillRect(0, 0, W, H * 0.2);
    const bot = x.createLinearGradient(0, H, 0, H * 0.62);
    bot.addColorStop(0, 'rgba(0,0,0,.98)');
    bot.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = bot;
    x.fillRect(0, H * 0.62, W, H * 0.38);
    this.mask = c;
  }

  render(state) {
    const ctx = this.ctx;
    const { W, H } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#020302';
    ctx.fillRect(0, 0, W, H);

    if (state.scare) {
      this.drawScare(state);
      this.drawGrain(0.055);
      if (state.fade) {
        ctx.fillStyle = `rgba(0,0,0,${clamp(state.fade, 0, 1)})`;
        ctx.fillRect(0, 0, W, H);
      }
      return;
    }

    const shake = state.shake || 0;
    this.h0 = H / 2 + (state.bobY || 0);
    const t = state.time || 0;
    let sx = 0, sy = 0;
    if (shake > 0.01) {
      sx = (Math.sin(t * 67) + Math.sin(t * 43.7)) * shake * 5;
      sy = (Math.cos(t * 59) + Math.sin(t * 37.1)) * shake * 4;
    }

    ctx.save();
    ctx.translate(sx, sy);
    this.drawBackground(state);
    this.zbuf.fill(999);
    this.drawWalls(state);
    this.drawWallMarks(state);
    this.drawSprites(state);
    ctx.restore();

    if (state.hidden) this.drawLockerView(state);
    this.drawAtmosphere(state);
    this.drawGrain(0.045);
    if (state.fade) {
      ctx.fillStyle = `rgba(0,0,0,${clamp(state.fade, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  camera(state) {
    const yaw = state.yaw || 0;
    return {
      px: state.position?.x || 0,
      pz: state.z || 0.8,
      dirX: Math.sin(yaw),
      dirZ: Math.cos(yaw),
      planeX: Math.cos(yaw) * 0.82,
      planeZ: -Math.sin(yaw) * 0.82
    };
  }

  screenY(worldY, depth) {
    return this.h0 + this.H * (ROOM.eye - worldY) / depth;
  }

  drawBackground(state) {
    const ctx = this.ctx;
    const { W, H, h0 } = this;
    const pal = state.room.palette;
    const bright = state.brightness || 1;

    const ceiling = ctx.createLinearGradient(0, 0, 0, h0 + 1);
    ceiling.addColorStop(0, rgb(mix(pal.ceil, 0.13 * bright)));
    ceiling.addColorStop(0.62, rgb(mix(pal.ceil, 0.24 * bright)));
    ceiling.addColorStop(1, rgb(mix(pal.ceil, 0.08 * bright)));
    ctx.fillStyle = ceiling;
    ctx.fillRect(0, 0, W, h0 + 1);

    const floor = ctx.createLinearGradient(0, h0, 0, H);
    floor.addColorStop(0, rgb(mix(pal.floor, 0.09 * bright)));
    floor.addColorStop(0.4, rgb(mix(pal.floor, 0.16 * bright)));
    floor.addColorStop(1, rgb(mix(pal.floor, 0.44 * bright)));
    ctx.fillStyle = floor;
    ctx.fillRect(0, h0, W, H - h0);

    // швы пола
    ctx.strokeStyle = 'rgba(190,210,185,.035)';
    ctx.lineWidth = 1;
    for (let d = 1; d < 9; d++) {
      const y = h0 + H * ROOM.eye / d;
      if (y > h0 && y < H) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(W, Math.round(y) + 0.5);
        ctx.stroke();
      }
    }

    // световое пятно фонаря на полу
    if (state.flashlight && state.battery > 0) {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.78, 4, W * 0.5, H * 0.78, W * 0.55);
      g.addColorStop(0, 'rgba(255,224,166,.10)');
      g.addColorStop(0.45, 'rgba(255,206,130,.045)');
      g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillRect(0, h0, W, H - h0);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  wallLight(t, camX, hitX, hitZ, state) {
    const room = state.room;
    const ambient = 0.145;
    const on = state.flashlight && state.battery > 0;
    const cone = Math.pow(Math.max(0, 1 - Math.abs(camX) * 0.94), 1.7);
    const flash = on ? cone * (1.95 / (1 + t * 0.15)) : 0;
    const dx = hitX - room.lamp.x;
    const dz = hitZ - room.lamp.z;
    const lamp = (state.lampFlicker ?? 1) * 0.78 / (1 + (dx * dx + dz * dz) * 1.05);
    const openLight = state.doorOpen > 0.25 && Math.abs(hitX) < 1.1 && hitZ > 5.4
      ? 0.16 * state.doorOpen : 0;
    const fog = 1 - clamp((t - 1.5) * 0.028, 0, 0.24);
    return clamp((ambient + flash + lamp + openLight) * fog * (state.brightness || 1), 0, 1.8);
  }

  drawWalls(state) {
    const ctx = this.ctx;
    const { W, H, h0 } = this;
    const cam = this.camera(state);
    const { px, pz, dirX, dirZ, planeX, planeZ } = cam;
    const room = state.room;
    const pal = room.palette;
    const bright = state.brightness || 1;
    const fakeDoorSide = (room.seed & 1) ? 1 : -1;

    for (let x = 0; x < W; x++) {
      const camX = (2 * x) / W - 1;
      const rayX = dirX + planeX * camX;
      const rayZ = dirZ + planeZ * camX;
      const tX = Math.abs(rayX) < 1e-9 ? Infinity : (rayX > 0 ? (ROOM.halfW - px) / rayX : (-ROOM.halfW - px) / rayX);
      const tZ = Math.abs(rayZ) < 1e-9 ? Infinity : (rayZ > 0 ? (ROOM.zMax - pz) / rayZ : (ROOM.zMin - pz) / rayZ);
      let t = Math.min(tX, tZ);
      if (t < 0.05) t = 0.05;
      const sideX = tX < tZ;
      const hitX = px + rayX * t;
      const hitZ = pz + rayZ * t;
      const light = this.wallLight(t, camX, hitX, hitZ, state);
      let base = pal.wall;
      let mul = 0.9;

      const u = sideX ? hitZ : hitX;
      const tile = Math.floor(u * 2.25);
      const th = worldHash(tile, sideX ? 11 : 17, room.seed);
      mul *= 0.82 + th * 0.32;
      if (sideX) mul *= 0.95;

      // выцветшие полосы
      const stripe = worldHash(Math.floor(u * 13), 5, room.seed);
      if (stripe < 0.08) mul *= 0.82;
      if (stripe > 0.94) mul *= 1.08;
      // стыки бетонных панелей
      if (u * 1.35 - Math.floor(u * 1.35) < 0.035) mul *= 0.74;
      if (u * 1.35 - Math.floor(u * 1.35) > 0.965) mul *= 1.06;

      // запечатанная боковая дверь
      const sideSign = hitX > 0 ? 1 : -1;
      if (sideX && sideSign === fakeDoorSide && hitZ > 3.42 && hitZ < 4.36) {
        base = pal.metal;
        mul = 0.72;
        if (hitZ < 3.5 || hitZ > 4.28) mul = 1.25;
        if (hitZ > 3.6 && hitZ < 3.72) mul = 0.45;
      }

      // проём / дверь впереди
      const farWall = !sideX && rayZ > 0 && hitZ > ROOM.zMax - 0.03;
      if (farWall && Math.abs(hitX) < ROOM.doorHalf + 0.16) {
        this.drawDoorColumn(x, t, hitX, state, light);
        this.zbuf[x] = t;
        continue;
      }

      const top = this.screenY(ROOM.height, t);
      const bottom = this.screenY(0, t);
      const height = bottom - top;
      ctx.fillStyle = rgb(mix(base, light * mul));
      ctx.fillRect(x, top, 1, height + 1);

      // нижняя панель
      const yBase = this.screenY(0.17, t);
      if (yBase > top + 1) {
        ctx.fillStyle = rgb(mix(base, light * mul * 0.58));
        ctx.fillRect(x, yBase, 1, bottom - yBase + 1);
      }
      // молдинг
      const yRail = this.screenY(1.12, t);
      if (yRail > top && yRail < bottom) {
        ctx.fillStyle = rgb(mix(base, light * Math.min(1.7, mul * 1.32)));
        ctx.fillRect(x, yRail, 1, Math.max(1, height * 0.012));
      }
      // труба
      const yPipe = this.screenY(2.58, t);
      if (yPipe > top && yPipe < bottom) {
        ctx.fillStyle = rgb(mix(pal.metal, light * 0.62));
        ctx.fillRect(x, yPipe, 1, Math.max(1, height * 0.016));
        ctx.fillStyle = rgb(mix(pal.metal, light * 1.2));
        ctx.fillRect(x, yPipe - 1, 1, 1);
      }
      // грязь у пола
      const yDirt = this.screenY(0.55, t);
      if (yDirt > top && yDirt < bottom) {
        ctx.fillStyle = `rgba(0,0,0,${0.12 + th * 0.12})`;
        ctx.fillRect(x, yDirt, 1, bottom - yDirt);
      }
      // трещины
      if (th < 0.045) {
        ctx.fillStyle = `rgba(0,0,0,${0.15 + th * 4})`;
        ctx.fillRect(x, top, 1, height);
      }
      this.zbuf[x] = t;
    }
  }

  drawDoorColumn(x, t, hitX, state, light) {
    const ctx = this.ctx;
    const { H } = this;
    const pal = state.room.palette;
    const absX = Math.abs(hitX);
    const top = this.screenY(ROOM.height, t);
    const bottom = this.screenY(0, t);
    const doorTop = this.screenY(ROOM.doorH, t);
    const open = clamp(state.doorOpen || 0, 0, 1);

    // стена над дверью
    ctx.fillStyle = rgb(mix(pal.wall, light * 0.9));
    ctx.fillRect(x, top, 1, doorTop - top + 1);

    // рама
    if (absX > ROOM.doorHalf) {
      ctx.fillStyle = rgb(mix(pal.metal, light * 1.15));
      ctx.fillRect(x, doorTop, 1, bottom - doorTop);
      if (absX < ROOM.doorHalf + 0.03) {
        ctx.fillStyle = rgb(mix(pal.metal, light * 1.65));
        ctx.fillRect(x, doorTop, 1, 2);
      }
      return;
    }

    // тёмный проём
    ctx.fillStyle = rgb(mix(pal.fog, 0.85));
    ctx.fillRect(x, doorTop, 1, bottom - doorTop);

    // приоткрытая щель — тёплый свет
    if (open > 0.03) {
      const glowTop = this.screenY(ROOM.doorH * open, t);
      const g = ctx.createLinearGradient(0, glowTop, 0, bottom);
      g.addColorStop(0, 'rgba(255,190,105,.03)');
      g.addColorStop(1, `rgba(255,180,90,${0.12 * open})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, glowTop, 1, bottom - glowTop);
    }

    // полотно двери, уезжающее вверх
    if (open < 0.995) {
      const panelBottomWorld = ROOM.doorH * open;
      const panelBottom = this.screenY(panelBottomWorld, t);
      const panelTop = doorTop;
      const ph = panelBottom - panelTop;
      if (ph > 0.5) {
        let mul = 0.84;
        const panelCoord = (hitX + ROOM.doorHalf) / (ROOM.doorHalf * 2);
        const seam = worldHash(Math.floor(panelCoord * 18), 23, state.room.seed);
        if (seam < 0.16) mul *= 0.8;
        const panelColor = mix(pal.door, light * mul);
        ctx.fillStyle = rgb(panelColor);
        ctx.fillRect(x, panelTop, 1, ph);

        // едва заметный блик по центру полотна
        if (hitX > -0.018 && hitX < 0.018) {
          ctx.fillStyle = rgb(mix(pal.door, light * mul * 1.14));
          ctx.fillRect(x, panelTop, 1, ph);
        }
        // поперечные рёбра
        for (const wy of [0.22, 1.06, 2.16]) {
          const yy = this.screenY(wy * (1 - open) + open * 0.02, t);
          if (yy > panelTop && yy < panelBottom) {
            ctx.fillStyle = `rgba(0,0,0,.4)`;
            ctx.fillRect(x, yy, 1, 2);
          }
        }
        // нижняя отбойная пластина с заклёпками
        const kickTop = Math.max(panelTop, this.screenY(0.36, t));
        const kickBot = Math.min(panelBottom, this.screenY(0.07, t));
        if (kickBot > kickTop) {
          ctx.fillStyle = rgb(mix(pal.metal, light * 0.44));
          ctx.fillRect(x, kickTop, 1, kickBot - kickTop);
          const rv = Math.floor((hitX + ROOM.doorHalf) * 30);
          if (rv % 4 === 0) {
            ctx.fillStyle = rgb(mix(pal.metal, light * 1.05));
            ctx.fillRect(x, kickTop + 1, 1, 1);
            ctx.fillRect(x, kickBot - 2, 1, 1);
          }
        }
        // ручка
        if (hitX > 0.53 && hitX < 0.62) {
          const hy0 = this.screenY(1.23, t);
          const hy1 = this.screenY(1.02, t);
          if (hy1 > panelTop && hy0 < panelBottom) {
            ctx.fillStyle = rgb(mix(pal.metal, light * 1.9));
            ctx.fillRect(x, Math.max(panelTop, hy0), 1, Math.max(1, Math.min(panelBottom, hy1) - Math.max(panelTop, hy0)));
          }
        }
        // порог
        const threshold = this.screenY(0.05, t);
        ctx.fillStyle = rgb(mix(pal.metal, light * 0.5));
        ctx.fillRect(x, threshold, 1, Math.max(1, bottom - threshold));
      }
    }

    // рамка поверх полотна
    if (absX > ROOM.doorHalf - 0.035) {
      ctx.fillStyle = rgb(mix(pal.metal, light * 1.45));
      ctx.fillRect(x, doorTop, 1, bottom - doorTop);
      ctx.fillStyle = rgb(mix(pal.metal, light * 0.6));
      ctx.fillRect(x, doorTop, 1, Math.max(1, (bottom - doorTop) * 0.02));
    }
    // верхняя перекладина
    ctx.fillStyle = rgb(mix(pal.metal, light * 1.2));
    ctx.fillRect(x, doorTop - 1, 1, 2);
  }

  drawWallMarks(state) {
    const ctx = this.ctx;
    const cam = this.camera(state);
    const invDet = 1 / (cam.planeX * cam.dirZ - cam.dirX * cam.planeZ);

    const project = (wx, wy, wz) => {
      const relX = wx - cam.px;
      const relZ = wz - cam.pz;
      const tx = invDet * (cam.dirZ * relX - cam.dirX * relZ);
      const ty = invDet * (-cam.planeZ * relX + cam.planeX * relZ);
      if (ty < 0.15) return null;
      const sx = this.W / 2 * (1 + tx / ty);
      const sy = this.h0 + this.H * (ROOM.eye - wy) / ty;
      return { sx, sy, ty, tx };
    };

    const checkVisible = (p) => {
      const col = Math.round(p.sx);
      if (col < 0 || col >= this.W) return false;
      return p.ty < this.zbuf[col] + 0.22;
    };

    // номер комнаты на дальней стене
    let p = project(1.44, 2.16, ROOM.zMax - 0.01);
    if (p && checkVisible(p) && Math.abs(p.tx / p.ty) < 1.25) {
      const size = clamp(this.H * 0.1 / p.ty, 5, 24);
      ctx.save();
      ctx.font = `bold ${size.toFixed(1)}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(18,22,16,${clamp(0.8 - p.ty * 0.055, 0.1, 0.5)})`;
      ctx.fillText(`R-${String(state.room.doorNumber).padStart(3, '0')}`, p.sx, p.sy);
      ctx.restore();
    }

    // номер на двери
    p = project(0, 1.86, ROOM.zMax - 0.012);
    if (p && checkVisible(p)) {
      const size = clamp(this.H * 0.12 / p.ty, 5, 26);
      ctx.save();
      ctx.font = `bold ${size.toFixed(1)}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(215,196,140,${clamp(0.6 - p.ty * 0.03, 0.12, 0.55)})`;
      ctx.fillText(String(state.room.doorNumber).padStart(3, '0'), p.sx, p.sy);
      ctx.restore();
    }

    // табличка над дверью
    p = project(0, 2.61, ROOM.zMax - 0.02);
    if (p && checkVisible(p)) {
      const size = clamp(this.H * 0.06 / p.ty, 4, 15);
      ctx.save();
      ctx.font = `bold ${size.toFixed(1)}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = 'ВЫХОД →';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(5,9,6,.62)';
      ctx.fillRect(p.sx - tw / 2 - size * 0.45, p.sy - size * 0.72, tw + size * 0.9, size * 1.44);
      ctx.fillStyle = `rgba(138,255,164,${clamp(0.72 - p.ty * 0.03, 0.2, 0.68)})`;
      ctx.shadowColor = 'rgba(110,255,140,.5)';
      ctx.shadowBlur = 7;
      ctx.fillText(label, p.sx, p.sy);
      ctx.restore();
    }
  }

  projectSprite(sx, sz, state, anchorY, worldH, img) {
    const cam = this.camera(state);
    const relX = sx - cam.px;
    const relZ = sz - cam.pz;
    const invDet = 1 / (cam.planeX * cam.dirZ - cam.dirX * cam.planeZ);
    const tx = invDet * (cam.dirZ * relX - cam.dirX * relZ);
    const ty = invDet * (-cam.planeZ * relX + cam.planeX * relZ);
    if (ty <= 0.12) return null;
    const screenX = this.W / 2 * (1 + tx / ty);
    const bottom = this.h0 + this.H * (ROOM.eye - anchorY) / ty;
    const h = this.H * worldH / ty;
    const w = h * (img.width / img.height);
    return {
      left: screenX - w / 2,
      top: bottom - h,
      w, h, screenX, bottom,
      depth: ty,
      camX: tx / ty,
      img
    };
  }

  spriteAlpha(state, depth, camX) {
    const on = state.flashlight && state.battery > 0;
    const cone = Math.pow(Math.max(0, 1 - Math.abs(camX) * 0.94), 1.5);
    const flash = on ? cone * 1.25 / (1 + depth * 0.2) : 0;
    const room = state.room;
    const lampD = Math.hypot((state.position?.x || 0) - room.lamp.x, (state.z || 0.8) - room.lamp.z);
    const lamp = (state.lampFlicker ?? 1) * 0.4 / (1 + lampD * lampD * 1.4);
    return clamp(0.045 + (flash + lamp) * (state.brightness || 1), 0.03, 1);
  }

  drawSprites(state) {
    const cam = this.camera(state);
    const room = state.room;
    const list = [];

    for (let i = 0; i < room.lockers.length; i++) {
      const l = room.lockers[i];
      const spr = this.lockers[l.variant % this.lockers.length];
      const p = this.projectSprite(l.side * (ROOM.halfW - 0.24), l.z, state, 0, spr.h, spr.img);
      if (p) list.push({ ...p, kind: 'locker', data: l, usable: l.usable, alpha: this.spriteAlpha(state, p.depth, p.camX) });
    }
    for (const c of room.crates) {
      const spr = this.crates[c.variant % this.crates.length];
      const p = this.projectSprite(c.x, c.z, state, 0, spr.h, spr.img);
      if (p) list.push({ ...p, kind: 'crate', alpha: this.spriteAlpha(state, p.depth, p.camX) });
    }
    if (room.battery && !room.batteryPicked) {
      const p = this.projectSprite(room.batterySpot.x, room.batterySpot.z, state, 0.03, this.battery.h, this.battery.img);
      if (p) list.push({ ...p, kind: 'battery', alpha: Math.max(0.5, this.spriteAlpha(state, p.depth, p.camX)) });
    }
    {
      const p = this.projectSprite(room.lamp.x, room.lamp.z, state, 2.55, this.lamp.h, this.lamp.img);
      if (p) list.push({ ...p, kind: 'lamp', alpha: 1 });
    }
    if (state.event && state.event.type === 'a120' && state.event.z != null) {
      const p = this.projectSprite(0, state.event.z, state, 0, this.a120.h, this.a120.img);
      if (p) list.push({ ...p, kind: 'a120', alpha: clamp(0.75 + Math.max(0, 1 - p.depth) * 0.25, 0.6, 1) });
    }

    list.sort((a, b) => b.depth - a.depth);

    for (const s of list) {
      if (s.kind === 'lamp') {
        this.drawLampSprite(s, state);
        continue;
      }
      if (s.kind === 'a120') {
        this.drawMonsterSprite(s, state);
        continue;
      }
      this.drawSprite(s.img, s, s.alpha);
      if (s.kind === 'locker' && s.usable && state.flashlight && state.battery > 0) {
        const col = clamp(Math.round(s.screenX), 0, this.W - 1);
        if (s.depth < this.zbuf[col] + 0.05) this.drawLockerPrompt(s, state);
      }
      if (s.kind === 'battery') this.drawBatteryGlow(s, state);
    }
  }

  drawSprite(img, p, alpha) {
    if (p.top > this.H + 4 || p.top + p.h < -4) return;
    const ctx = this.ctx;
    const x0 = Math.max(0, Math.floor(p.left));
    const x1 = Math.min(this.W, Math.ceil(p.left + p.w));
    const y0 = Math.floor(p.top);
    const hh = Math.ceil(p.h);
    if (x1 <= x0) return;
    ctx.globalAlpha = clamp(alpha, 0.02, 1);

    // если спрайт ничем не перекрыт — один вызов вместо колонок
    let occluded = false;
    for (let x = x0; x < x1; x++) {
      if (p.depth >= this.zbuf[x]) { occluded = true; break; }
    }
    if (!occluded) {
      ctx.drawImage(img, p.left, y0, p.w, hh);
    } else {
      for (let x = x0; x < x1; x++) {
        if (p.depth >= this.zbuf[x]) continue;
        const u = (x - p.left) / p.w;
        const sx = Math.floor(u * img.width);
        if (sx < 0 || sx >= img.width) continue;
        ctx.drawImage(img, sx, 0, 1, img.height, x, y0, 1, hh);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawLampSprite(p, state) {
    this.drawSprite(p.img, p, 1);
    if (p.depth >= this.zbuf[clamp(Math.round(p.screenX), 0, this.W - 1)]) return;
    const ctx = this.ctx;
    const flicker = state.lampFlicker ?? 1;
    const r = clamp(this.H * 0.55 / Math.max(0.8, p.depth), 20, this.H * 0.7);
    const cy = p.top + p.h * 0.72;
    const g = ctx.createRadialGradient(p.screenX, cy, 1, p.screenX, cy, r);
    g.addColorStop(0, `rgba(255,225,170,${0.4 * flicker})`);
    g.addColorStop(0.22, `rgba(255,205,130,${0.16 * flicker})`);
    g.addColorStop(1, 'rgba(255,190,100,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(p.screenX - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  drawBatteryGlow(p, state) {
    const ctx = this.ctx;
    const r = clamp(p.w * 1.4, 6, 90);
    const g = ctx.createRadialGradient(p.screenX, p.top + p.h * 0.4, 1, p.screenX, p.top + p.h * 0.4, r);
    g.addColorStop(0, 'rgba(255,210,120,.32)');
    g.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(p.screenX - r, p.top + p.h * 0.4 - r, r * 2, r * 2);
    ctx.restore();
  }

  drawMonsterSprite(p, state) {
    const ctx = this.ctx;
    // холодное свечение вокруг
    const r = clamp(p.w * 1.2, 10, this.W * 0.9);
    const g = ctx.createRadialGradient(p.screenX, p.top + p.h * 0.4, 2, p.screenX, p.top + p.h * 0.4, r);
    g.addColorStop(0, 'rgba(150,185,168,.09)');
    g.addColorStop(1, 'rgba(90,130,112,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(p.screenX - r, p.top + p.h * 0.4 - r, r * 2, r * 2);
    ctx.restore();
    this.drawSprite(p.img, p, p.alpha);
  }

  drawLockerPrompt(p, state) {
    const ctx = this.ctx;
    const t = state.time || 0;
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(t * 3.1));
    const s = clamp(this.H * 0.022, 6, 12);
    const bx = p.screenX;
    const by = Math.max(s * 1.6, p.top + p.h * 0.14);
    if (bx < -s * 2 || bx > this.W + s * 2) return;
    ctx.save();
    // компактный жетон «E», без огромной рамки вокруг шкафа
    ctx.fillStyle = `rgba(7,8,5,${0.7 + pulse * 0.18})`;
    ctx.fillRect(bx - s * 0.9, by - s * 0.9, s * 1.8, s * 1.8);
    ctx.strokeStyle = `rgba(255,194,102,${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - s * 0.9 + 0.5, by - s * 0.9 + 0.5, s * 1.8 - 1, s * 1.8 - 1);
    ctx.fillStyle = '#ffd18a';
    ctx.font = `bold ${s.toFixed(1)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', bx, by + 0.5);

    const fs = clamp(this.H * 0.013, 5, 9);
    ctx.font = `bold ${fs.toFixed(1)}px "Courier New", monospace`;
    ctx.fillStyle = `rgba(255,209,138,${0.45 + pulse * 0.4})`;
    ctx.fillText('ШКАФ', bx, by + s * 1.9);
    ctx.restore();
  }

  drawAtmosphere(state) {
    const ctx = this.ctx;
    const { W, H } = this;
    const bright = state.brightness || 1;

    // конус фонаря
    if (state.flashlight && state.battery > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.03, W / 2, H / 2, W * 0.52);
      g.addColorStop(0, 'rgba(255,236,190,.055)');
      g.addColorStop(0.5, 'rgba(255,220,160,.02)');
      g.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // темнота по краям
    const edge = ctx.createRadialGradient(W / 2, H * 0.46, W * 0.16, W / 2, H * 0.5, W * 0.72);
    const dark = state.flashlight && state.battery > 0 ? 0.62 : 0.82;
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(0.62, `rgba(0,0,0,${0.16 * dark * bright})`);
    edge.addColorStop(1, `rgba(0,0,0,${dark})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);

    // красная тревога
    if (state.event && (state.event.type === 'a60' || state.event.type === 'a120') && state.event.phase !== 'hidden') {
      const t = state.time || 0;
      const pulse = 0.04 + 0.06 * Math.pow(Math.abs(Math.sin(t * 4.6)), 4);
      const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.8);
      g.addColorStop(0, 'rgba(80,0,0,0)');
      g.addColorStop(0.65, `rgba(120,8,4,${pulse})`);
      g.addColorStop(1, `rgba(160,10,5,${pulse * 1.8})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // урон
    if (state.damage > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.05, W / 2, H / 2, W * 0.75);
      g.addColorStop(0, `rgba(120,0,0,${0.1 * state.damage})`);
      g.addColorStop(1, `rgba(170,4,0,${0.62 * state.damage})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // лёгкая цветокоррекция
    ctx.fillStyle = 'rgba(6,12,8,.045)';
    ctx.fillRect(0, 0, W, H);
  }

  drawLockerView(state) {
    const ctx = this.ctx;
    const { W, H } = this;
    const ev = state.event;

    // силуэт A-60 за дверцей
    if (ev && ev.type === 'a60' && ev.phase === 'hidden') {
      const p = clamp((ev.t || 0) / 1.8, 0, 1);
      const cx = W * (1.18 - p * 1.28);
      const cy = H * 0.64;
      const s = H * 0.15;
      ctx.save();
      ctx.fillStyle = 'rgba(2,2,1,.94)';
      ctx.beginPath();
      ctx.ellipse(cx, cy - s * 2.6, s * 0.55, s * 0.8, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(96,13,7,.5)';
      ctx.lineWidth = Math.max(1, s * 0.045);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.9, cy - s * 2.1);
      ctx.quadraticCurveTo(cx - s * 1.6, cy + s * 1.4, cx - s * 1.25, cy + s * 4.2);
      ctx.lineTo(cx + s * 1.25, cy + s * 4.2);
      ctx.quadraticCurveTo(cx + s * 1.6, cy + s * 1.4, cx + s * 0.9, cy - s * 2.1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(74,10,6,.34)';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(2,2,1,.94)';
      ctx.lineWidth = s * 0.28;
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + sign * s * 0.95, cy - s * 1.7);
        ctx.quadraticCurveTo(cx + sign * s * 1.9, cy + s * 1.4, cx + sign * s * 1.55, cy + s * 3.4);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,45,25,.9)';
      ctx.shadowColor = '#ff2b18';
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.ellipse(cx - s * 0.26, cy - s * 2.7, s * 0.13, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + s * 0.26, cy - s * 2.7, s * 0.13, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.drawImage(this.mask, 0, 0);
    // пыльный свет из щелей
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,192,110,.035)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawScare(state) {
    const ctx = this.ctx;
    const { W, H } = this;
    const sc = state.scare;
    const type = sc.type;
    const mode = sc.mode || 'death';
    const t = sc.t || 0;
    const face = type === 'a60' ? this.face60 : type === 'a120' ? this.face120 : this.face90;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    let scale = Math.max(W / face.width, H / face.height) * 1.03;
    if (mode === 'death') scale *= 0.82 + Math.min(1, t * 1.9) * 0.55;
    const fw = face.width * scale;
    const fh = face.height * scale;
    const jitter = mode === 'gaze' ? 2.2 : 4 + t * 8;
    const dx = (Math.random() - 0.5) * jitter;
    const dy = (Math.random() - 0.5) * jitter;
    const x = W / 2 - fw / 2 + dx;
    const y = H * 0.48 - fh / 2 + dy;

    ctx.save();
    ctx.globalAlpha = mode === 'death' ? Math.min(1, 0.25 + t * 3) : 1;
    ctx.drawImage(face, x, y, fw, fh);

    // глитч-полосы
    ctx.globalAlpha = 1;
    for (let i = 0; i < 14; i++) {
      const sy = Math.random();
      const sh = Math.random() * 18 + 2;
      const off = (Math.random() - 0.5) * (mode === 'gaze' ? 20 : 46);
      const srcY = sy * face.height;
      try {
        ctx.drawImage(face, 0, srcY, face.width, sh, x + off, y + srcY * scale, fw, sh * scale);
      } catch { /* ignore */ }
    }
    // статика
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${Math.random() * 0.16})` : `rgba(0,0,0,${Math.random() * 0.4})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * W * 0.18, 1 + Math.random() * 2);
    }
    // красная вспышка
    if (mode === 'death' && type !== 'a120' && t < 0.22) {
      ctx.fillStyle = `rgba(255,20,10,${(0.22 - t) * 2.2})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    // виньетка
    const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.12, W / 2, H / 2, W * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, type === 'a120' ? 'rgba(0,8,6,.82)' : 'rgba(20,0,0,.82)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  drawGrain(alpha) {
    if (!this.pattern) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'screen';
    const ox = -Math.floor(Math.random() * 128);
    const oy = -Math.floor(Math.random() * 128);
    ctx.translate(ox, oy);
    ctx.fillStyle = this.pattern;
    ctx.fillRect(0, 0, this.W + 128, this.H + 128);
    ctx.restore();
  }
}
