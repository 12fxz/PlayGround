/* Procedural canvas art: lobby, office, camera feeds, jumpscare, reverse mode. */

const TAU = Math.PI * 2;

export function prepare(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function rnd(min, max) {
  return min + Math.random() * (max - min);
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function roundedRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function text(ctx, str, x, y, { size = 12, color = '#e6b45a', align = 'left', font = 'monospace', alpha = 1, spacing = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function grain(ctx, w, h, count = 90, alpha = 0.08) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const s = Math.random() * 1.8 + 0.4;
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${alpha * Math.random()})`;
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

function vignette(ctx, w, h, strength = 0.55) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function staticNoise(ctx, w, h, amount = 0.5, seed = 0) {
  ctx.save();
  const count = Math.floor(80 + amount * 180);
  for (let i = 0; i < count; i++) {
    const y = Math.random() * h;
    const bh = Math.random() * 3 + 0.5;
    const x = Math.random() * w;
    const bw = Math.random() * w * 0.22;
    const v = Math.floor(Math.random() * 220);
    ctx.fillStyle = `rgba(${v},${v},${v},${0.04 + Math.random() * amount * 0.25})`;
    ctx.fillRect(x, y, bw, bh);
  }
  // occasional bright rolling bar
  if (Math.random() < 0.25) {
    ctx.fillStyle = `rgba(230,240,220,${0.03 + amount * 0.05})`;
    ctx.fillRect(0, Math.random() * h, w, Math.random() * h * 0.09);
  }
  ctx.restore();
}

/* ============================================================
   MONSTER SILHOUETTES
   ============================================================ */

function drawBush(ctx, x, y, s, t = 0, opts = {}) {
  const alpha = opts.alpha ?? 1;
  const eye = opts.eye || '#f2d47a';
  const body = opts.body || '#191410';
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  // legs
  ctx.fillStyle = body;
  roundedRect(ctx, -0.24 * s, -0.4 * s, 0.2 * s, 0.42 * s, 0.06 * s);
  ctx.fill();
  roundedRect(ctx, 0.04 * s, -0.4 * s, 0.2 * s, 0.42 * s, 0.06 * s);
  ctx.fill();
  // feet
  ellipse(ctx, -0.15 * s, -0.01 * s, 0.14 * s, 0.07 * s, body);
  ellipse(ctx, 0.15 * s, -0.01 * s, 0.14 * s, 0.07 * s, body);

  // torso
  const torso = ctx.createLinearGradient(-0.3 * s, -0.9 * s, 0.3 * s, -0.35 * s);
  torso.addColorStop(0, opts.highlight || '#2f261d');
  torso.addColorStop(0.5, body);
  torso.addColorStop(1, '#0d0b09');
  ellipse(ctx, 0, -0.63 * s, 0.34 * s, 0.31 * s, torso);
  // belly patch
  ctx.globalAlpha = alpha * 0.4;
  ellipse(ctx, 0, -0.56 * s, 0.19 * s, 0.18 * s, '#4b3826');
  ctx.globalAlpha = alpha;

  // arms
  ctx.strokeStyle = body;
  ctx.lineWidth = 0.115 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.28 * s, -0.83 * s);
  ctx.quadraticCurveTo(-0.42 * s, -0.68 * s, -0.37 * s, -0.42 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.28 * s, -0.83 * s);
  ctx.quadraticCurveTo(0.42 * s, -0.68 * s, 0.37 * s, -0.42 * s);
  ctx.stroke();
  // claws
  ctx.fillStyle = opts.claw || '#4a3a29';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ellipse(ctx, side * 0.37 * s + (i - 1) * 0.022 * s, -0.4 * s + Math.abs(i - 1) * 0.008 * s, 0.012 * s, 0.026 * s, opts.claw || '#4a3a29');
    }
  }

  // head
  ellipse(ctx, 0, -1.06 * s, 0.26 * s, 0.24 * s, body);
  // ears
  ctx.fillStyle = body;
  ellipse(ctx, -0.2 * s, -1.24 * s, 0.08 * s, 0.08 * s, body);
  ellipse(ctx, 0.2 * s, -1.24 * s, 0.08 * s, 0.08 * s, body);
  ellipse(ctx, -0.2 * s, -1.24 * s, 0.038 * s, 0.038 * s, opts.muzzle || '#3a2c20');
  ellipse(ctx, 0.2 * s, -1.24 * s, 0.038 * s, 0.038 * s, opts.muzzle || '#3a2c20');
  // muzzle
  ellipse(ctx, 0, -0.99 * s, 0.16 * s, 0.11 * s, opts.muzzle || '#3a2c20');
  // eye sockets
  ellipse(ctx, -0.088 * s, -1.08 * s, 0.05 * s, 0.038 * s, 'rgba(0,0,0,0.35)');
  ellipse(ctx, 0.088 * s, -1.08 * s, 0.05 * s, 0.038 * s, 'rgba(0,0,0,0.35)');
  // eyes
  const flick = 0.72 + 0.28 * Math.sin(t * 3.3 + x);
  ctx.shadowColor = eye;
  ctx.shadowBlur = 12 * flick;
  ellipse(ctx, -0.088 * s, -1.08 * s, 0.02 * s, 0.024 * s, eye);
  ellipse(ctx, 0.088 * s, -1.08 * s, 0.02 * s, 0.024 * s, eye);
  ctx.shadowBlur = 0;
  // brow
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(2, 0.018 * s);
  ctx.beginPath();
  ctx.moveTo(-0.13 * s, -1.13 * s);
  ctx.lineTo(-0.05 * s, -1.115 * s);
  ctx.moveTo(0.13 * s, -1.13 * s);
  ctx.lineTo(0.05 * s, -1.115 * s);
  ctx.stroke();
  // grin
  ctx.strokeStyle = 'rgba(225,215,190,0.55)';
  ctx.lineWidth = Math.max(1, 0.008 * s);
  ctx.beginPath();
  ctx.arc(0, -0.995 * s, 0.12 * s, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
  // teeth
  ctx.fillStyle = 'rgba(235,225,200,0.66)';
  for (let i = -2; i <= 2; i++) {
    const tx = i * 0.035 * s;
    const ty = -0.945 * s + Math.abs(i) * 0.006 * s;
    ctx.fillRect(tx - 0.008 * s, ty, 0.016 * s, 0.028 * s);
  }
  ctx.restore();
}

function drawRansom(ctx, x, y, s, t = 0, opts = {}) {
  const alpha = opts.alpha ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  const body = opts.body || '#131011';
  const eye = opts.eye || '#ff6a4d';
  // legs
  ctx.fillStyle = body;
  roundedRect(ctx, -0.14 * s, -0.5 * s, 0.1 * s, 0.5 * s, 0.03 * s);
  ctx.fill();
  roundedRect(ctx, 0.04 * s, -0.5 * s, 0.1 * s, 0.5 * s, 0.03 * s);
  ctx.fill();
  // torso thin
  const g = ctx.createLinearGradient(-0.2 * s, -1.2 * s, 0.2 * s, -0.4 * s);
  g.addColorStop(0, '#2a2222');
  g.addColorStop(0.4, body);
  g.addColorStop(1, '#080707');
  ellipse(ctx, 0, -0.72 * s, 0.18 * s, 0.34 * s, g);
  // shoulders
  ellipse(ctx, -0.15 * s, -0.93 * s, 0.07 * s, 0.1 * s, body);
  ellipse(ctx, 0.15 * s, -0.93 * s, 0.07 * s, 0.1 * s, body);
  // long arms
  ctx.strokeStyle = body;
  ctx.lineWidth = 0.075 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.16 * s, -0.9 * s);
  ctx.quadraticCurveTo(-0.32 * s, -0.7 * s, -0.26 * s, -0.4 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.16 * s, -0.9 * s);
  ctx.quadraticCurveTo(0.32 * s, -0.7 * s, 0.26 * s, -0.4 * s);
  ctx.stroke();
  // head
  ellipse(ctx, 0, -1.18 * s, 0.15 * s, 0.19 * s, body);
  // long ears
  ctx.save();
  ctx.translate(-0.07 * s, -1.31 * s);
  ctx.rotate(-0.12 + Math.sin(t * 0.9) * 0.04);
  roundedRect(ctx, -0.035 * s, -0.34 * s, 0.065 * s, 0.35 * s, 0.03 * s);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(0.07 * s, -1.31 * s);
  ctx.rotate(0.16 + Math.sin(t * 0.8 + 2) * 0.05);
  roundedRect(ctx, -0.03 * s, -0.36 * s, 0.065 * s, 0.37 * s, 0.03 * s);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();
  // eyes
  ctx.shadowColor = eye;
  ctx.shadowBlur = 14;
  ellipse(ctx, -0.055 * s, -1.2 * s, 0.02 * s, 0.026 * s, eye);
  ellipse(ctx, 0.055 * s, -1.2 * s, 0.02 * s, 0.026 * s, eye);
  ctx.shadowBlur = 0;
  // grin
  ctx.strokeStyle = 'rgba(236, 218, 195, 0.8)';
  ctx.lineWidth = Math.max(1, 0.01 * s);
  ctx.beginPath();
  ctx.arc(0, -1.13 * s, 0.1 * s, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,230,210,0.75)';
  for (let i = -3; i <= 3; i++) {
    ctx.fillRect(i * 0.024 * s - 0.005 * s, -1.075 * s + Math.abs(i) * 0.003 * s, 0.01 * s, 0.022 * s);
  }
  ctx.restore();
}

function drawForgotten(ctx, x, y, s, t = 0, opts = {}) {
  const alpha = opts.alpha ?? 0.7;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  // smoky body
  const g = ctx.createLinearGradient(0, -1.3 * s, 0, 0);
  g.addColorStop(0, 'rgba(120,140,120,0.35)');
  g.addColorStop(0.5, 'rgba(30,40,34,0.55)');
  g.addColorStop(1, 'rgba(10,12,10,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const yy = -i / steps * 1.35 * s;
    const ww = (0.06 + Math.sin(i * 0.7 + t * 2) * 0.012 + (1 - i / steps) * 0.14) * s;
    if (i === 0) ctx.moveTo(-ww, yy);
    else ctx.lineTo(-ww, yy);
  }
  for (let i = steps; i >= 0; i--) {
    const yy = -i / steps * 1.35 * s;
    const ww = (0.06 + Math.sin(i * 0.5 + t * 2 + 2) * 0.012 + (1 - i / steps) * 0.14) * s;
    ctx.lineTo(ww, yy);
  }
  ctx.closePath();
  ctx.fill();
  // head
  ellipse(ctx, 0, -1.2 * s, 0.1 * s, 0.14 * s, 'rgba(50,62,52,0.6)');
  // eyes
  ctx.shadowColor = '#dbeaff';
  ctx.shadowBlur = 18;
  const blink = Math.sin(t * 1.7) > 0.92 ? 0.15 : 1;
  ellipse(ctx, -0.04 * s, -1.22 * s, 0.018 * s, 0.03 * s * blink, '#e9f3ff');
  ellipse(ctx, 0.04 * s, -1.22 * s, 0.018 * s, 0.03 * s * blink, '#e9f3ff');
  ctx.shadowBlur = 0;
  // glitch stripes
  ctx.globalAlpha = alpha * 0.5;
  for (let i = 0; i < 3; i++) {
    const yy = -rnd(0.2, 1.2) * s;
    ctx.fillStyle = i % 2 ? 'rgba(180,210,255,0.1)' : 'rgba(0,0,0,0.22)';
    ctx.fillRect(-0.18 * s, yy, 0.36 * s, rnd(1, 4));
  }
  ctx.restore();
}

/* ============================================================
   LOBBY
   ============================================================ */

export function drawLobby(canvas, time) {
  const { ctx, w, h } = prepare(canvas);
  const t = time / 1000;
  ctx.clearRect(0, 0, w, h);

  // back wall
  const wall = ctx.createLinearGradient(0, 0, 0, h * 0.8);
  wall.addColorStop(0, '#0d100b');
  wall.addColorStop(0.45, '#15180f');
  wall.addColorStop(1, '#0a0c08');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  // ceiling
  ctx.fillStyle = '#080a07';
  ctx.fillRect(0, 0, w, h * 0.1);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, h * 0.02 + i * h * 0.014);
    ctx.lineTo(w, h * 0.02 + i * h * 0.014);
    ctx.stroke();
  }

  // floor
  const floorY = h * 0.72;
  const floor = ctx.createLinearGradient(0, floorY, 0, h);
  floor.addColorStop(0, '#111209');
  floor.addColorStop(1, '#070804');
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, w, h - floorY);

  // checkered floor perspective
  ctx.save();
  ctx.globalAlpha = 0.13;
  const vx = w * 0.5;
  const vy = h * 0.29;
  for (let i = -10; i <= 10; i++) {
    ctx.strokeStyle = i % 2 ? '#c8b78d' : '#4b4b38';
    ctx.beginPath();
    ctx.moveTo(vx + i * w * 0.025, floorY);
    ctx.lineTo(vx + i * w * 0.13, h);
    ctx.stroke();
  }
  for (let i = 1; i < 10; i++) {
    const y = floorY + Math.pow(i / 10, 1.7) * (h - floorY);
    ctx.strokeStyle = '#c8b78d';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  // back wall details: wall trim
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, floorY - 10, w, 10);
  ctx.strokeStyle = 'rgba(230,180,90,0.08)';
  ctx.beginPath();
  ctx.moveTo(0, floorY - 16);
  ctx.lineTo(w, floorY - 16);
  ctx.stroke();

  // hanging lamp
  const lampX = w * 0.5;
  const lampY = h * 0.09;
  const flicker = 0.82 + hash(Math.floor(t * 9)) * 0.18;
  const lampGrad = ctx.createRadialGradient(lampX, lampY, 2, lampX, lampY, h * 0.7);
  lampGrad.addColorStop(0, `rgba(230,180,90,${0.2 * flicker})`);
  lampGrad.addColorStop(0.25, `rgba(180,135,60,${0.06 * flicker})`);
  lampGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lampGrad;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#1a1a13';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lampX, 0);
  ctx.lineTo(lampX, lampY - 12);
  ctx.stroke();
  ctx.fillStyle = '#23231a';
  ctx.beginPath();
  ctx.moveTo(lampX - 20, lampY + 6);
  ctx.lineTo(lampX + 20, lampY + 6);
  ctx.lineTo(lampX + 30, lampY - 12);
  ctx.lineTo(lampX - 30, lampY - 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(255,225,160,${flicker})`;
  ellipse(ctx, lampX, lampY + 5, 9, 5);
  ctx.shadowColor = '#e6b45a';
  ctx.shadowBlur = 26 * flicker;
  ellipse(ctx, lampX, lampY + 5, 4, 3, '#fff3cf');
  ctx.shadowBlur = 0;

  // bulletin board
  const bx = w * 0.115;
  const by = h * 0.25;
  const bw = Math.min(w * 0.17, 210);
  const bh = Math.min(h * 0.29, 230);
  ctx.fillStyle = '#211710';
  ctx.fillRect(bx - 5, by - 5, bw + 10, bh + 10);
  ctx.fillStyle = '#2c2418';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = 'rgba(230,180,90,0.14)';
  ctx.strokeRect(bx, by, bw, bh);
  // papers
  for (let i = 0; i < 5; i++) {
    const px = bx + 12 + (i % 3) * (bw / 3.4);
    const py = by + 14 + Math.floor(i / 3) * (bh / 2.3);
    const pw = bw / 4.2;
    const ph = bh / 3.1;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((hash(i + 3) - 0.5) * 0.16);
    ctx.fillStyle = i === 1 ? '#c9bb9d' : '#b7ab8e';
    ctx.fillRect(0, 0, pw, ph);
    ctx.fillStyle = 'rgba(60,50,38,0.6)';
    for (let l = 0; l < 4; l++) ctx.fillRect(4, 6 + l * (ph / 6), pw - 8 - hash(i + l) * 5, 1);
    ctx.fillStyle = '#8c2b22';
    ctx.fillRect(2, 1, 3, 3);
    ctx.restore();
  }
  text(ctx, 'СОТРУДНИКАМ', bx + bw / 2, by - 18, { size: 9, color: 'rgba(230,180,90,0.4)', align: 'center', spacing: 2 });

  // Freddy poster on right wall
  const px = w * 0.78;
  const py = h * 0.2;
  const pw = Math.min(w * 0.13, 160);
  const ph = Math.min(h * 0.23, 190);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(0.012);
  ctx.fillStyle = '#0b0a07';
  ctx.fillRect(-3, -3, pw + 6, ph + 6);
  ctx.fillStyle = '#22160f';
  ctx.fillRect(0, 0, pw, ph);
  // bear face
  ctx.fillStyle = '#4a3222';
  ellipse(ctx, pw / 2, ph * 0.46, pw * 0.28, ph * 0.26);
  ellipse(ctx, pw * 0.31, ph * 0.26, pw * 0.1, ph * 0.1);
  ellipse(ctx, pw * 0.69, ph * 0.26, pw * 0.1, ph * 0.1);
  ctx.fillStyle = '#2b1d14';
  ellipse(ctx, pw / 2, ph * 0.55, pw * 0.13, ph * 0.08);
  ctx.fillStyle = '#d8c79d';
  ellipse(ctx, pw * 0.42, ph * 0.41, 2.5, 3);
  ellipse(ctx, pw * 0.58, ph * 0.41, 2.5, 3);
  text(ctx, 'SMILE!', pw / 2, ph * 0.83, { size: Math.max(9, pw * 0.11), color: '#c9a763', align: 'center', font: 'Georgia, serif' });
  text(ctx, 'FAZBEAR', pw / 2, ph * 0.92, { size: Math.max(6, pw * 0.055), color: 'rgba(216,199,157,0.45)', align: 'center' });
  ctx.restore();

  // pipes on ceiling
  ctx.strokeStyle = 'rgba(80,76,58,0.35)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.075);
  ctx.bezierCurveTo(w * 0.3, h * 0.07, w * 0.6, h * 0.1, w, h * 0.07);
  ctx.stroke();

  // wall stains
  for (let i = 0; i < 4; i++) {
    const sx = hash(i * 7) * w;
    const sy = h * (0.3 + hash(i * 3) * 0.3);
    const rad = 20 + hash(i) * 70;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    g.addColorStop(0, 'rgba(20,16,8,0.3)');
    g.addColorStop(1, 'rgba(20,16,8,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
  }

  // foreground desk
  const deskY = h * 0.82;
  ctx.fillStyle = '#0a0906';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, deskY);
  ctx.lineTo(w * 0.24, deskY - h * 0.02);
  ctx.lineTo(w * 0.76, deskY - h * 0.02);
  ctx.lineTo(w, deskY);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,180,90,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, deskY);
  ctx.lineTo(w * 0.24, deskY - h * 0.02);
  ctx.lineTo(w * 0.76, deskY - h * 0.02);
  ctx.lineTo(w, deskY);
  ctx.stroke();

  // desk items: fan, mug, papers
  const fanX = w * 0.17;
  const fanY = deskY - h * 0.035;
  ctx.fillStyle = '#24251c';
  ellipse(ctx, fanX, fanY, 22, 20);
  ctx.fillStyle = '#11120d';
  ellipse(ctx, fanX, fanY, 17, 15);
  ctx.strokeStyle = 'rgba(180,180,160,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + i * (TAU / 3);
    ctx.beginPath();
    ctx.moveTo(fanX, fanY);
    ctx.lineTo(fanX + Math.cos(a) * 14, fanY + Math.sin(a) * 13);
    ctx.stroke();
  }
  ctx.fillStyle = '#2d2e23';
  ctx.fillRect(fanX - 4, fanY + 16, 8, 9);
  ctx.fillRect(fanX - 12, fanY + 24, 24, 4);

  ctx.fillStyle = '#c9bb9d';
  ctx.save();
  ctx.translate(w * 0.72, deskY - 18);
  ctx.rotate(-0.06);
  ctx.fillRect(0, 0, 64, 40);
  ctx.fillStyle = 'rgba(45,38,28,0.55)';
  for (let i = 0; i < 5; i++) ctx.fillRect(6, 7 + i * 6, 44 - (i % 2) * 12, 1);
  ctx.restore();

  // mug
  const mugX = w * 0.82;
  const mugY = deskY - 18;
  ctx.fillStyle = '#3a3027';
  ctx.fillRect(mugX, mugY, 22, 24);
  ctx.strokeStyle = '#3a3027';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(mugX + 24, mugY + 11, 7, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  text(ctx, '☕', mugX + 11, mugY + 12, { size: 10, color: '#191713', align: 'center' });

  // cables
  ctx.strokeStyle = 'rgba(10,10,8,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, deskY - 8);
  ctx.bezierCurveTo(w * 0.22, deskY + 5, w * 0.35, deskY - 12, w * 0.51, deskY + 4);
  ctx.stroke();

  // ambient dust
  for (let i = 0; i < 26; i++) {
    const dx = (hash(i) * w + t * (4 + hash(i + 2) * 10)) % w;
    const dy = (hash(i + 9) * h + Math.sin(t * 0.4 + i) * 10) % (h * 0.82);
    ctx.fillStyle = `rgba(230,200,140,${0.03 + hash(i + 5) * 0.06})`;
    ctx.fillRect(dx, dy, 1.2, 1.2);
  }

  // center shadow to make terminal pop
  const centerGrad = ctx.createRadialGradient(w / 2, h * 0.48, 40, w / 2, h * 0.48, Math.min(w, h) * 0.46);
  centerGrad.addColorStop(0, 'rgba(0,0,0,0.25)');
  centerGrad.addColorStop(0.7, 'rgba(0,0,0,0.1)');
  centerGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = centerGrad;
  ctx.fillRect(0, 0, w, h);

  grain(ctx, w, h, 80, 0.08);
  vignette(ctx, w, h, 0.5);
}

/* ============================================================
   OFFICE
   ============================================================ */

export function drawOffice(canvas, state, time) {
  const { ctx, w, h } = prepare(canvas);
  const t = time / 1000;
  const shake = state.noise > 0 ? Math.sin(t * 50) * 1.5 : 0;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(shake, state.noise > 0 ? Math.cos(t * 38) * 1.2 : 0);

  // base room
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, state.skinOld ? '#1c150d' : '#14110c');
  wall.addColorStop(0.55, state.skinOld ? '#292018' : '#1d1811');
  wall.addColorStop(1, '#080704');
  ctx.fillStyle = wall;
  ctx.fillRect(-4, -4, w + 8, h + 8);

  const doorX = 0;
  const doorW = w * 0.3;
  const doorTop = h * 0.16;
  const doorBottom = h * 0.86;
  const flicker = 0.55 + hash(Math.floor(t * 7)) * 0.45;
  const lampX = w * 0.665;
  const lampY = h * 0.095;

  // warm wall wash from the ceiling bulb
  const wash = ctx.createRadialGradient(lampX, lampY, 20, lampX, h * 0.55, h * 0.95);
  wash.addColorStop(0, `rgba(210,165,95,${0.11 * flicker})`);
  wash.addColorStop(0.4, `rgba(160,125,70,${0.04 * flicker})`);
  wash.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  // ceiling
  ctx.fillStyle = '#070603';
  ctx.fillRect(0, 0, w, h * 0.1);

  // wall panel lines
  ctx.strokeStyle = 'rgba(230,180,90,0.05)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const y = h * 0.1 + i * h * 0.08;
    if (y < doorBottom) {
      ctx.beginPath();
      ctx.moveTo(doorW, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  // wainscoting on the lower wall
  ctx.fillStyle = 'rgba(0,0,0,0.17)';
  ctx.fillRect(doorW, h * 0.66, w - doorW, h * 0.11);
  ctx.strokeStyle = 'rgba(230,180,90,0.07)';
  ctx.beginPath();
  ctx.moveTo(doorW, h * 0.66);
  ctx.lineTo(w, h * 0.66);
  ctx.moveTo(doorW, h * 0.77);
  ctx.lineTo(w, h * 0.77);
  ctx.stroke();
  for (let x = doorW + w * 0.04; x < w; x += w * 0.075) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.675);
    ctx.lineTo(x, h * 0.765);
    ctx.stroke();
  }

  // ventilation grille
  const ventX = w * 0.57;
  const ventY = h * 0.32;
  ctx.fillStyle = '#0a0906';
  ctx.fillRect(ventX, ventY, w * 0.075, h * 0.045);
  ctx.strokeStyle = 'rgba(200,190,160,0.1)';
  ctx.strokeRect(ventX, ventY, w * 0.075, h * 0.045);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(ventX + 4, ventY + 4 + i * (h * 0.008), w * 0.075 - 8, 1.5);
  }

  // ------- doorway / corridor -------
  ctx.fillStyle = '#050604';
  ctx.fillRect(doorX, doorTop, doorW, doorBottom - doorTop);

  // corridor depth
  const cw = doorW * 0.62;
  const ch = (doorBottom - doorTop) * 0.68;
  const cx = doorW * 0.5 - cw / 2;
  const cy = doorTop + (doorBottom - doorTop) * 0.14;
  ctx.save();
  if (!state.doorClosed) {
    // corridor walls perspective
    const corr = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
    corr.addColorStop(0, '#221c11');
    corr.addColorStop(0.5, '#100d08');
    corr.addColorStop(1, '#090806');
    ctx.fillStyle = corr;
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = 'rgba(210,180,120,0.18)';
    ctx.lineWidth = 1;
    // perspective lines
    for (let i = 0; i < 5; i++) {
      const k = i / 5;
      ctx.beginPath();
      ctx.moveTo(doorX + 6, doorTop + (doorBottom - doorTop) * k);
      ctx.lineTo(cx, cy + ch * k);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(doorX + doorW - 6, doorTop + (doorBottom - doorTop) * k);
      ctx.lineTo(cx + cw, cy + ch * k);
      ctx.stroke();
    }
    // corridor floor
    ctx.fillStyle = 'rgba(180,160,110,0.05)';
    ctx.beginPath();
    ctx.moveTo(doorX, doorBottom);
    ctx.lineTo(doorX + doorW, doorBottom);
    ctx.lineTo(cx + cw, cy + ch);
    ctx.lineTo(cx, cy + ch);
    ctx.closePath();
    ctx.fill();
    // far wall
    const far = ctx.createLinearGradient(cx, cy, cx, cy + ch);
    far.addColorStop(0, '#1a150e');
    far.addColorStop(1, '#0b0906');
    ctx.fillStyle = far;
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = 'rgba(230,180,90,0.22)';
    ctx.strokeRect(cx, cy, cw, ch);
    // distant EXIT sign
    ctx.fillStyle = `rgba(170,35,25,${0.5 + flicker * 0.3})`;
    ctx.fillRect(cx + cw * 0.35, cy + ch * 0.16, cw * 0.3, ch * 0.07);
    text(ctx, 'EXIT', cx + cw * 0.5, cy + ch * 0.195, { size: Math.max(5, cw * 0.06), color: '#ffb0a0', align: 'center' });

    // flashlight beam
    if (state.flashlight) {
      const beam = ctx.createLinearGradient(doorX + doorW * 0.5, doorTop, cx + cw / 2, cy);
      beam.addColorStop(0, 'rgba(255,230,170,0.15)');
      beam.addColorStop(1, 'rgba(255,230,170,0.02)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(doorX + doorW * 0.2, doorBottom);
      ctx.lineTo(doorX + doorW * 0.8, doorBottom);
      ctx.lineTo(cx + cw * 0.8, cy + ch * 0.5);
      ctx.lineTo(cx + cw * 0.2, cy + ch * 0.5);
      ctx.closePath();
      ctx.fill();
    }

    // Bush at the door
    if (state.bushAtDoor) {
      const visible = state.flashlight;
      const scale = Math.min(doorW * 1.18, (doorBottom - doorTop) * 0.62);
      drawBush(ctx, doorX + doorW * 0.52, doorBottom + scale * 0.04, scale, t, {
        alpha: visible ? 0.95 : 0.16,
        eye: visible ? '#ffe08a' : '#8b6a2a',
        body: visible ? '#171310' : '#0a0908',
      });
      if (!visible) {
        // faint eyes in the dark
        ctx.shadowColor = '#d8a040';
        ctx.shadowBlur = 10;
        ellipse(ctx, doorX + doorW * 0.45, doorTop + (doorBottom - doorTop) * 0.48, 2.2, 2.6, 'rgba(240,200,110,0.55)');
        ellipse(ctx, doorX + doorW * 0.57, doorTop + (doorBottom - doorTop) * 0.48, 2.2, 2.6, 'rgba(240,200,110,0.55)');
        ctx.shadowBlur = 0;
      }
    }
  } else {
    // closed shutter
    const sg = ctx.createLinearGradient(doorX, 0, doorX + doorW, 0);
    sg.addColorStop(0, '#1b1c17');
    sg.addColorStop(0.5, '#2b2c24');
    sg.addColorStop(1, '#12130f');
    ctx.fillStyle = sg;
    ctx.fillRect(doorX + 4, doorTop, doorW - 8, doorBottom - doorTop);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    for (let y = doorTop + 6; y < doorBottom; y += 9) {
      ctx.beginPath();
      ctx.moveTo(doorX + 4, y);
      ctx.lineTo(doorX + doorW - 4, y);
      ctx.stroke();
    }
    // warning stripes
    ctx.save();
    ctx.beginPath();
    ctx.rect(doorX + 4, doorBottom - 22, doorW - 8, 14);
    ctx.clip();
    for (let x = doorX - 20; x < doorX + doorW + 20; x += 14) {
      ctx.fillStyle = 'rgba(190,150,60,0.32)';
      ctx.beginPath();
      ctx.moveTo(x, doorBottom - 22);
      ctx.lineTo(x + 7, doorBottom - 22);
      ctx.lineTo(x + 1, doorBottom - 8);
      ctx.lineTo(x - 6, doorBottom - 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // red underlight
    const ug = ctx.createLinearGradient(0, doorBottom - 8, 0, doorBottom);
    ug.addColorStop(0, 'rgba(198,66,52,0)');
    ug.addColorStop(1, `rgba(198,66,52,${0.35 * flicker})`);
    ctx.fillStyle = ug;
    ctx.fillRect(doorX, doorBottom - 8, doorW, 8);
  }
  ctx.restore();

  // door frame
  ctx.fillStyle = '#1b1812';
  ctx.fillRect(doorX, doorTop - 12, doorW, 12);
  ctx.fillRect(doorX, doorTop - 12, 11, doorBottom - doorTop + 12);
  ctx.fillRect(doorX + doorW - 11, doorTop - 12, 11, doorBottom - doorTop + 12);
  ctx.strokeStyle = 'rgba(230,180,90,0.1)';
  ctx.strokeRect(doorX + 1, doorTop - 11, doorW - 2, doorBottom - doorTop + 11);
  // door control panel
  ctx.fillStyle = '#171a13';
  ctx.fillRect(doorW + 8, h * 0.42, 30, 54);
  ctx.fillStyle = state.doorClosed ? '#d16a4d' : '#6d8a52';
  ellipse(ctx, doorW + 23, h * 0.42 + 16, 5, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(doorW + 15, h * 0.42 + 28, 16, 3);
  ctx.fillRect(doorW + 15, h * 0.42 + 35, 16, 3);

  // ------- wall props -------
  // clock
  const clockX = w * 0.44;
  const clockY = h * 0.2;
  const clockR = Math.min(w * 0.023, 34);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ellipse(ctx, clockX + 3, clockY + 4, clockR + 2, clockR + 2);
  ctx.fillStyle = '#242017';
  ellipse(ctx, clockX, clockY, clockR + 2, clockR + 2);
  ctx.fillStyle = '#c7b995';
  ellipse(ctx, clockX, clockY, clockR, clockR);
  ctx.fillStyle = '#18140d';
  ellipse(ctx, clockX, clockY, clockR * 0.86, clockR * 0.86);
  ctx.strokeStyle = 'rgba(220,205,170,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(clockX + Math.cos(a) * clockR * 0.62, clockY + Math.sin(a) * clockR * 0.62);
    ctx.lineTo(clockX + Math.cos(a) * clockR * 0.78, clockY + Math.sin(a) * clockR * 0.78);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(236,226,200,0.72)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(clockX, clockY);
  ctx.lineTo(clockX + clockR * 0.32, clockY - clockR * 0.44);
  ctx.moveTo(clockX, clockY);
  ctx.lineTo(clockX - clockR * 0.12, clockY + clockR * 0.5);
  ctx.stroke();
  ctx.fillStyle = '#c64234';
  ellipse(ctx, clockX, clockY, 2, 2);

  // Freddy poster
  const px = w * 0.77;
  const py = h * 0.16;
  const pw = Math.min(w * 0.16, 170);
  const ph = Math.min(h * 0.28, 230);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-0.015);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(-3, -3, pw + 6, ph + 6);
  ctx.fillStyle = state.skinOld ? '#3c3020' : '#332419';
  ctx.fillRect(0, 0, pw, ph);
  ctx.fillStyle = '#6b4a30';
  ellipse(ctx, pw * 0.5, ph * 0.42, pw * 0.27, ph * 0.24);
  ellipse(ctx, pw * 0.31, ph * 0.24, pw * 0.1, ph * 0.09);
  ellipse(ctx, pw * 0.69, ph * 0.24, pw * 0.1, ph * 0.09);
  ctx.fillStyle = '#3a271a';
  ellipse(ctx, pw * 0.5, ph * 0.51, pw * 0.12, ph * 0.08);
  ctx.fillStyle = '#e2d0a6';
  ellipse(ctx, pw * 0.42, ph * 0.38, 2.4, 3);
  ellipse(ctx, pw * 0.58, ph * 0.38, 2.4, 3);
  text(ctx, 'SMILE!', pw / 2, ph * 0.73, { size: Math.max(9, pw * 0.11), color: '#d8b171', align: 'center', font: 'Georgia, serif' });
  text(ctx, 'FAZBEAR', pw / 2, ph * 0.84, { size: Math.max(5, pw * 0.05), color: 'rgba(230,210,170,0.55)', align: 'center', spacing: 2 });
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.strokeRect(0, 0, pw, ph);
  ctx.restore();

  // security sign above the door
  const signW = doorW * 0.42;
  const signX = doorW * 0.5 - signW / 2;
  const signY = doorTop - h * 0.065;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(signX - 2, signY - 2, signW + 4, h * 0.048 + 4);
  ctx.fillStyle = '#2b2417';
  ctx.fillRect(signX, signY, signW, h * 0.048);
  ctx.strokeStyle = 'rgba(230,180,90,0.2)';
  ctx.strokeRect(signX, signY, signW, h * 0.048);
  text(ctx, 'SECURITY OFFICE', doorW / 2, signY + h * 0.024, {
    size: Math.max(5, doorW * 0.032),
    color: 'rgba(230,185,105,0.62)',
    align: 'center',
    spacing: 1,
  });

  // old guard skin details
  if (state.skinOld) {
    // coat hook + coat
    const hx = w * 0.68;
    const hy = h * 0.36;
    ctx.strokeStyle = 'rgba(190,180,150,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 18);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = '#1d1a13';
    ctx.beginPath();
    ctx.moveTo(hx - 20, hy + 70);
    ctx.lineTo(hx - 13, hy + 14);
    ctx.lineTo(hx, hy + 4);
    ctx.lineTo(hx + 13, hy + 14);
    ctx.lineTo(hx + 20, hy + 70);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,120,70,0.25)';
    ctx.stroke();
    text(ctx, 'F.', hx, hy + 32, { size: 8, color: 'rgba(200,160,100,0.45)', align: 'center' });
    // photo frame
    ctx.fillStyle = '#121008';
    ctx.fillRect(w * 0.33, h * 0.31, 34, 44);
    ctx.fillStyle = '#3d3a2b';
    ctx.fillRect(w * 0.33 + 3, h * 0.31 + 3, 28, 38);
    ctx.fillStyle = '#161309';
    ellipse(ctx, w * 0.33 + 17, h * 0.31 + 17, 3, 3);
  }

  // camera schematic board
  const mapX = w * 0.315;
  const mapY = h * 0.31;
  const mapW = w * 0.08;
  const mapH = h * 0.1;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(mapX - 4, mapY - 4, mapW + 8, mapH + 8);
  ctx.fillStyle = '#151710';
  ctx.fillRect(mapX, mapY, mapW, mapH);
  ctx.strokeStyle = 'rgba(147,173,118,0.25)';
  ctx.strokeRect(mapX, mapY, mapW, mapH);
  ctx.fillStyle = 'rgba(147,173,118,0.28)';
  for (let i = 0; i < 4; i++) {
    const bx = mapX + 6 + (i % 2) * (mapW / 2);
    const by = mapY + 8 + Math.floor(i / 2) * (mapH / 2);
    ctx.fillRect(bx, by, mapW * 0.32, mapH * 0.26);
  }
  text(ctx, 'CCTV', mapX + mapW / 2, mapY + mapH - 7, {
    size: Math.max(5, mapW * 0.09),
    color: 'rgba(147,173,118,0.5)',
    align: 'center',
    spacing: 1,
  });

  // ------- desk -------
  const deskY = h * 0.79;
  const deskG = ctx.createLinearGradient(0, deskY, 0, h);
  deskG.addColorStop(0, state.skinOld ? '#2b2216' : '#211b12');
  deskG.addColorStop(0.18, '#120f09');
  deskG.addColorStop(1, '#060503');
  ctx.fillStyle = deskG;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, deskY + h * 0.02);
  ctx.lineTo(w * 0.13, deskY - h * 0.01);
  ctx.lineTo(w * 0.87, deskY - h * 0.01);
  ctx.lineTo(w, deskY + h * 0.02);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,180,90,0.18)';
  ctx.beginPath();
  ctx.moveTo(0, deskY + h * 0.02);
  ctx.lineTo(w * 0.13, deskY - h * 0.01);
  ctx.lineTo(w * 0.87, deskY - h * 0.01);
  ctx.lineTo(w, deskY + h * 0.02);
  ctx.stroke();

  // desk monitor
  const monW = Math.min(w * 0.29, 300);
  const monH = monW * 0.62;
  const monX = w * 0.455 - monW / 2;
  const monY = deskY - monH - h * 0.04;
  ctx.fillStyle = '#0e0f0b';
  roundedRect(ctx, monX - 8, monY - 8, monW + 16, monH + 16, 4);
  ctx.fill();
  ctx.strokeStyle = '#292a22';
  ctx.lineWidth = 2;
  roundedRect(ctx, monX - 8, monY - 8, monW + 16, monH + 16, 4);
  ctx.stroke();
  // screen glow
  if (!state.blackout && state.energy > 0) {
    const sg = ctx.createLinearGradient(monX, monY, monX, monY + monH);
    sg.addColorStop(0, '#22301d');
    sg.addColorStop(1, '#0b1109');
    ctx.fillStyle = sg;
    ctx.fillRect(monX, monY, monW, monH);
    // mini camera grid
    ctx.strokeStyle = 'rgba(147,173,118,0.35)';
    ctx.strokeRect(monX + 8, monY + 8, monW - 16, monH - 16);
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(monX + 8 + (monW - 16) * (i / 4), monY + 8);
      ctx.lineTo(monX + 8 + (monW - 16) * (i / 4), monY + monH - 8);
      ctx.strokeStyle = 'rgba(147,173,118,0.16)';
      ctx.stroke();
    }
    text(ctx, 'CAM 1', monX + 12, monY + 15, { size: 7, color: 'rgba(190,220,170,0.7)' });
    text(ctx, 'REC', monX + monW - 22, monY + 15, { size: 7, color: 'rgba(230,100,80,0.8)' });
    text(ctx, '2:47 AM', monX + monW / 2, monY + monH / 2, { size: 12, color: 'rgba(190,220,170,0.35)', align: 'center' });
    // scan line
    const sy = monY + ((t * 30) % monH);
    ctx.fillStyle = 'rgba(180,220,160,0.05)';
    ctx.fillRect(monX, sy, monW, 2);
    // screen glow onto desk
    const glow = ctx.createRadialGradient(monX + monW / 2, monY + monH / 2, 0, monX + monW / 2, monY + monH / 2, monW * 0.9);
    glow.addColorStop(0, 'rgba(130,170,110,0.08)');
    glow.addColorStop(1, 'rgba(130,170,110,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(monX - monW * 0.4, monY - monH * 0.3, monW * 1.8, monH * 1.6);
  } else {
    ctx.fillStyle = '#030403';
    ctx.fillRect(monX, monY, monW, monH);
  }
  // stand
  ctx.fillStyle = '#0e0e0a';
  ctx.fillRect(monX + monW / 2 - 6, monY + monH + 8, 12, h * 0.03);
  ctx.fillRect(monX + monW / 2 - 32, monY + monH + 8 + h * 0.03, 64, 5);

  // keyboard
  ctx.save();
  ctx.translate(monX + monW / 2, deskY + h * 0.01);
  ctx.rotate(-0.01);
  ctx.fillStyle = '#171710';
  ctx.fillRect(-monW * 0.33, 0, monW * 0.66, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 12; i++) ctx.fillRect(-monW * 0.31 + i * monW * 0.052, 3, monW * 0.038, 3);
  for (let i = 0; i < 11; i++) ctx.fillRect(-monW * 0.29 + i * monW * 0.052, 8, monW * 0.038, 3);
  ctx.restore();

  // fan on desk right
  const fanX = w * 0.69;
  const fanY = deskY - h * 0.05;
  ctx.fillStyle = '#1a1a14';
  ellipse(ctx, fanX, fanY, 30, 27);
  ctx.fillStyle = '#080906';
  ellipse(ctx, fanX, fanY, 25, 22);
  ctx.strokeStyle = 'rgba(190,190,170,0.18)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const a = t * 2.4 + i * (TAU / 3);
    ctx.beginPath();
    ctx.moveTo(fanX, fanY);
    ctx.lineTo(fanX + Math.cos(a) * 20, fanY + Math.sin(a) * 18);
    ctx.stroke();
  }
  ctx.fillStyle = '#1a1a14';
  ctx.fillRect(fanX - 4, fanY + 23, 8, 10);
  ctx.fillRect(fanX - 17, fanY + 31, 34, 4);

  // papers + mug
  ctx.save();
  ctx.translate(w * 0.17, deskY + h * 0.035);
  ctx.rotate(0.08);
  ctx.fillStyle = '#b6aa8f';
  ctx.fillRect(0, 0, 74, 34);
  ctx.fillStyle = 'rgba(45,38,28,0.6)';
  for (let i = 0; i < 4; i++) ctx.fillRect(6, 6 + i * 6, 54 - (i % 2) * 15, 1);
  ctx.restore();

  const mugX = w * 0.28;
  const mugY = deskY + h * 0.005;
  ctx.fillStyle = state.skinOld ? '#3b3527' : '#2e2a20';
  ctx.fillRect(mugX, mugY, 24, 26);
  ctx.strokeStyle = state.skinOld ? '#3b3527' : '#2e2a20';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(mugX + 26, mugY + 12, 7, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // cables
  ctx.strokeStyle = 'rgba(8,8,6,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(monX + 20, deskY + 22);
  ctx.bezierCurveTo(w * 0.3, h, w * 0.5, deskY + 40, w * 0.85, h);
  ctx.stroke();

  // lamp + light cone
  const lampFlicker = state.blackout ? 0 : flicker;
  const lampG = ctx.createRadialGradient(lampX, lampY, 4, lampX, lampY, h * 0.62);
  lampG.addColorStop(0, `rgba(245,205,125,${0.27 * lampFlicker})`);
  lampG.addColorStop(0.28, `rgba(210,165,90,${0.08 * lampFlicker})`);
  lampG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lampG;
  ctx.fillRect(0, 0, w, h * 0.92);
  ctx.strokeStyle = '#1b1a13';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lampX, 0);
  ctx.lineTo(lampX, lampY - 12);
  ctx.stroke();
  ctx.fillStyle = '#302d20';
  ctx.beginPath();
  ctx.moveTo(lampX - 30, lampY + 10);
  ctx.lineTo(lampX + 30, lampY + 10);
  ctx.lineTo(lampX + 15, lampY - 12);
  ctx.lineTo(lampX - 15, lampY - 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,180,90,0.2)';
  ctx.stroke();
  if (!state.blackout) {
    ctx.fillStyle = `rgba(255,235,180,${0.8 * lampFlicker})`;
    ellipse(ctx, lampX, lampY + 8, 12, 5);
    ctx.shadowColor = '#e6b45a';
    ctx.shadowBlur = 40 * lampFlicker;
    ellipse(ctx, lampX, lampY + 8, 5, 3, '#fff8dd');
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // noise tint
  if (state.noise > 0) {
    ctx.fillStyle = `rgba(120,20,10,${Math.min(0.22, state.noise * 0.02)})`;
    ctx.fillRect(0, 0, w, h);
  }
  // low hp tint
  if (state.hp <= 35) {
    const g = ctx.createRadialGradient(w * 0.35, h * 0.5, 0, w * 0.35, h * 0.5, w * 0.7);
    g.addColorStop(0, 'rgba(150,10,0,0)');
    g.addColorStop(1, 'rgba(120,6,0,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  if (state.blackout) {
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, w, h);
    // emergency light
    const g = ctx.createRadialGradient(w * 0.16, h * 0.55, 4, w * 0.16, h * 0.55, w * 0.3);
    g.addColorStop(0, `rgba(180,30,20,${0.18 + Math.sin(t * 4) * 0.06})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.shadowColor = '#ff452e';
    ctx.shadowBlur = 22;
    const blink = Math.sin(t * 5) > -0.4 ? 1 : 0;
    ellipse(ctx, w * 0.14, h * 0.5, 3, 4, `rgba(255,80,50,${blink * 0.85})`);
    ellipse(ctx, w * 0.21, h * 0.5, 3, 4, `rgba(255,80,50,${blink * 0.85})`);
    ctx.shadowBlur = 0;
  }

  grain(ctx, w, h, 70, 0.07);
}

/* ============================================================
   CAMERA FEEDS
   ============================================================ */

const CAM_INFO = [
  { name: 'КАМЕРА 1 · СЦЕНА' },
  { name: 'КАМЕРА 2 · АРКАДА' },
  { name: 'КАМЕРА 3 · КУХНЯ' },
  { name: 'КАМЕРА 4 · КОРИДОР' },
];

export function camName(index) {
  return CAM_INFO[index]?.name || 'КАМЕРА';
}

export function drawCamera(canvas, state, time) {
  const { ctx, w, h } = prepare(canvas);
  const t = time / 1000;
  ctx.clearRect(0, 0, w, h);
  const cam = state.selectedCam;
  const broken = (state.broken[cam] || 0) > 0;

  ctx.save();
  // base tint
  ctx.fillStyle = '#070806';
  ctx.fillRect(0, 0, w, h);

  if (broken) {
    ctx.fillStyle = '#0c0e0b';
    ctx.fillRect(0, 0, w, h);
    staticNoise(ctx, w, h, 0.9);
    // ghostly silhouette behind static
    if (state.ransomOnCam === cam) {
      drawRansom(ctx, w * 0.52, h * 0.96, h * 0.85, t, { alpha: 0.13, eye: '#ff3b25' });
    }
    if (state.forgotten.active && state.forgotten.cams.includes(cam) && state.features.hideBehindBroken) {
      drawForgotten(ctx, w * 0.5, h * 0.95, h * 0.95, t, { alpha: 0.07 });
    }
    if (Math.random() < 0.12) {
      ctx.fillStyle = 'rgba(230,240,220,0.1)';
      ctx.fillRect(0, Math.random() * h, w, 2);
    }
    ctx.restore();
    return;
  }

  // per-camera environment
  if (cam === 0) drawStage(ctx, w, h, t, state);
  else if (cam === 1) drawArcade(ctx, w, h, t, state);
  else if (cam === 2) drawKitchen(ctx, w, h, t, state);
  else drawHallway(ctx, w, h, t, state);

  // monsters on feed
  const bushCam = state.bush.active && !state.bush.atDoor ? state.bush.stage : state.bush.atDoor ? 3 : -1;
  if (bushCam === cam) {
    if (cam === 0) drawBush(ctx, w * 0.52, h * 0.78, h * 0.52, t, { alpha: 0.9, eye: '#f4cf72' });
    if (cam === 1) drawBush(ctx, w * 0.58, h * 0.88, h * 0.68, t, { alpha: 0.92, eye: '#f4cf72' });
    if (cam === 2) drawBush(ctx, w * 0.55, h * 0.9, h * 0.8, t, { alpha: 0.9, eye: '#f4cf72' });
    if (cam === 3) drawBush(ctx, w * 0.5, h * 0.98, h * 1.05, t, { alpha: 0.95, eye: '#ffd77a' });
  }

  if (state.ransomOnCam === cam) {
    drawRansom(ctx, w * 0.83, h * 0.88, h * 0.7, t, { alpha: 0.45, eye: '#ff4d32' });
    ctx.fillStyle = 'rgba(255,40,20,0.04)';
    ctx.fillRect(0, 0, w, h);
  }

  if (state.forgotten.active && state.forgotten.cams.includes(cam)) {
    drawForgotten(ctx, w * 0.5, h * 0.96, h * 0.92, t, { alpha: 0.6 });
    // interference halo
    ctx.fillStyle = 'rgba(160,190,220,0.035)';
    ctx.fillRect(0, 0, w, h);
  }

  // camera feed artifacts
  staticNoise(ctx, w, h, 0.18);
  ctx.fillStyle = 'rgba(180,210,160,0.018)';
  ctx.fillRect(0, 0, w, h);

  // rolling scan line
  const sy = (t * 40) % h;
  ctx.fillStyle = 'rgba(220,240,210,0.035)';
  ctx.fillRect(0, sy, w, 2);

  ctx.restore();
  vignette(ctx, w, h, 0.72);
}

function drawStage(ctx, w, h, t, state) {
  // stage room
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#241713');
  wall.addColorStop(0.6, '#180f0c');
  wall.addColorStop(1, '#0a0705');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  // ceiling
  ctx.fillStyle = '#0b0806';
  ctx.fillRect(0, 0, w, h * 0.12);

  // curtains
  const curtain = ctx.createLinearGradient(0, 0, w, 0);
  curtain.addColorStop(0, '#4d1b17');
  curtain.addColorStop(0.2, '#2a0f0c');
  curtain.addColorStop(0.5, '#511c17');
  curtain.addColorStop(0.8, '#280e0b');
  curtain.addColorStop(1, '#451714');
  ctx.fillStyle = curtain;
  ctx.fillRect(0, 0, w, h * 0.62);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    const x = (i / 14) * w;
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + 8, h * 0.3, x + (i % 2 ? 10 : -6), h * 0.62);
    ctx.stroke();
  }

  // valance
  ctx.fillStyle = '#33100d';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h * 0.09);
  for (let i = 10; i >= 0; i--) {
    ctx.quadraticCurveTo((i + 0.5) * (w / 10), h * 0.16, i * (w / 10), h * 0.09);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(214,174,96,0.35)';
  ctx.fillRect(0, h * 0.085, w, 2);

  // banner
  text(ctx, "LET'S PARTY!", w * 0.5, h * 0.17, { size: Math.max(10, w * 0.028), color: 'rgba(220,192,130,0.35)', align: 'center', font: 'Georgia, serif', spacing: 2 });

  // stage platform
  const stageY = h * 0.62;
  ctx.fillStyle = '#120c08';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, stageY);
  ctx.lineTo(w * 0.92, stageY);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(214,174,96,0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, stageY);
  ctx.lineTo(w * 0.92, stageY);
  ctx.stroke();
  // stage rim lights
  for (let i = 0; i < 8; i++) {
    const x = w * 0.12 + (i / 7) * w * 0.76;
    ctx.fillStyle = `rgba(230,180,90,${0.25 + Math.sin(t * 2 + i) * 0.15})`;
    ellipse(ctx, x, stageY + 3, 2.4, 2.4);
  }

  // checkered floor
  drawFloor(ctx, w, h, h * 0.78, t);

  // party tables
  for (const [x, s] of [[0.17, 0.85], [0.83, 1.0]]) {
    // tablecloth
    ctx.fillStyle = '#2d1812';
    ellipse(ctx, w * x, h * 0.91, w * 0.115 * s, h * 0.055 * s);
    ctx.fillStyle = 'rgba(160,55,45,0.5)';
    ellipse(ctx, w * x, h * 0.9, w * 0.105 * s, h * 0.045 * s);
    ctx.fillStyle = '#2a1a12';
    ctx.fillRect(w * x - 4, h * 0.91, 8, h * 0.09);
    ctx.fillStyle = '#1f120d';
    ellipse(ctx, w * x, h * 0.995, w * 0.06, h * 0.012);
    // paper plates
    ctx.fillStyle = 'rgba(220,210,185,0.18)';
    ellipse(ctx, w * x - w * 0.035, h * 0.9, 6, 3);
    ellipse(ctx, w * x + w * 0.03, h * 0.895, 5, 2.5);
    // hats
    ctx.fillStyle = 'rgba(190,70,60,0.7)';
    ctx.beginPath();
    ctx.moveTo(w * x - 7, h * 0.882);
    ctx.lineTo(w * x, h * 0.842);
    ctx.lineTo(w * x + 7, h * 0.882);
    ctx.closePath();
    ctx.fill();
    // chairs
    ctx.fillStyle = 'rgba(25,18,13,0.8)';
    ctx.fillRect(w * x - w * 0.09, h * 0.93, w * 0.025, h * 0.06);
    ctx.fillRect(w * x + w * 0.065, h * 0.93, w * 0.025, h * 0.06);
  }

  // stage spotlight beams
  for (let i = 0; i < 3; i++) {
    const lx = w * (0.3 + i * 0.2);
    const beam = ctx.createLinearGradient(lx, 0, lx + (i - 1) * 40, h * 0.65);
    beam.addColorStop(0, 'rgba(220,180,110,0.09)');
    beam.addColorStop(1, 'rgba(220,180,110,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lx - 8, 0);
    ctx.lineTo(lx + 8, 0);
    ctx.lineTo(lx + (i - 1) * 40 + 45, h * 0.65);
    ctx.lineTo(lx + (i - 1) * 40 - 45, h * 0.65);
    ctx.closePath();
    ctx.fill();
  }

  // microphone stand
  ctx.strokeStyle = 'rgba(190,190,170,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.52, h * 0.66);
  ctx.lineTo(w * 0.5, h * 0.56);
  ctx.stroke();
  ctx.fillStyle = 'rgba(190,190,170,0.3)';
  ellipse(ctx, w * 0.5, h * 0.55, 3, 5);

  // streamers
  for (let i = 0; i < 5; i++) {
    const x = w * (0.1 + i * 0.2);
    ctx.strokeStyle = ['rgba(190,70,60,0.25)', 'rgba(190,160,70,0.2)', 'rgba(80,120,150,0.2)'][i % 3];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 20, h * 0.1, x - 15, h * 0.18, x + 10, h * 0.28);
    ctx.stroke();
  }

  // balloons
  for (let i = 0; i < 3; i++) {
    const bx = w * (0.08 + i * 0.03);
    const by = h * (0.3 + i * 0.05);
    ctx.strokeStyle = 'rgba(180,170,140,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 10, h * 0.7);
    ctx.stroke();
    ctx.fillStyle = ['rgba(150,50,40,0.4)', 'rgba(60,90,120,0.35)', 'rgba(160,130,50,0.3)'][i];
    ellipse(ctx, bx, by, 10, 12);
  }

  // ceiling light cones
  for (let i = 0; i < 2; i++) {
    const lx = w * (0.35 + i * 0.3);
    const g = ctx.createLinearGradient(lx, 0, lx, h * 0.7);
    g.addColorStop(0, 'rgba(230,190,120,0.07)');
    g.addColorStop(1, 'rgba(230,190,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(lx - 12, 0);
    ctx.lineTo(lx + 12, 0);
    ctx.lineTo(lx + 60, h * 0.7);
    ctx.lineTo(lx - 60, h * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  grain(ctx, w, h, 40, 0.06);
}

function drawFloor(ctx, w, h, y0, t) {
  const g = ctx.createLinearGradient(0, y0, 0, h);
  g.addColorStop(0, '#0f0b08');
  g.addColorStop(1, '#070504');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, w, h - y0);
  ctx.save();
  ctx.globalAlpha = 0.12;
  const vx = w * 0.5;
  for (let i = -8; i <= 8; i++) {
    ctx.strokeStyle = i % 2 ? '#cdbb8c' : '#3f3a2d';
    ctx.beginPath();
    ctx.moveTo(vx + i * w * 0.03, y0);
    ctx.lineTo(vx + i * w * 0.14, h);
    ctx.stroke();
  }
  for (let i = 1; i < 7; i++) {
    const y = y0 + Math.pow(i / 7, 1.8) * (h - y0);
    ctx.strokeStyle = '#9f9270';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawArcade(ctx, w, h, t, state) {
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#10131a');
  wall.addColorStop(0.55, '#0a0d12');
  wall.addColorStop(1, '#050607');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  // floor
  drawFloor(ctx, w, h, h * 0.72, t);

  // ceiling lights
  for (let i = 0; i < 3; i++) {
    const lx = w * (0.2 + i * 0.3);
    const flick = 0.6 + hash(Math.floor(t * 6) + i) * 0.4;
    ctx.fillStyle = `rgba(200,220,180,${0.25 * flick})`;
    ctx.fillRect(lx - 9, 4, 18, 3);
    const g = ctx.createLinearGradient(lx, 0, lx, h * 0.7);
    g.addColorStop(0, `rgba(190,220,180,${0.1 * flick})`);
    g.addColorStop(1, 'rgba(190,220,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(lx - 10, 0);
    ctx.lineTo(lx + 10, 0);
    ctx.lineTo(lx + 70, h * 0.72);
    ctx.lineTo(lx - 70, h * 0.72);
    ctx.closePath();
    ctx.fill();
  }

  // arcade cabinets left and right
  const cabColors = ['#3c2220', '#1f2b39', '#332b1a', '#232d22'];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 3; i++) {
      const cw = w * 0.13;
      const ch = h * 0.5;
      const x = side === 0 ? w * 0.04 + i * cw * 0.92 : w * 0.83 - i * cw * 0.92;
      const y = h * 0.25 + i * h * 0.03;
      ctx.fillStyle = cabColors[(i + side) % cabColors.length];
      ctx.fillRect(x, y, cw, ch);
      ctx.fillStyle = '#080a0c';
      ctx.fillRect(x + cw * 0.12, y + ch * 0.1, cw * 0.76, ch * 0.3);
      // screen glow
      const glow = ctx.createRadialGradient(x + cw / 2, y + ch * 0.25, 0, x + cw / 2, y + ch * 0.25, cw * 0.9);
      glow.addColorStop(0, 'rgba(90,170,200,0.15)');
      glow.addColorStop(1, 'rgba(90,170,200,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x, y, cw, ch);
      // marquee
      ctx.fillStyle = 'rgba(200,120,60,0.25)';
      ctx.fillRect(x + cw * 0.12, y + ch * 0.04, cw * 0.76, ch * 0.04);
      // controls
      ctx.fillStyle = '#0b0c0d';
      ctx.fillRect(x + cw * 0.12, y + ch * 0.46, cw * 0.76, ch * 0.06);
      ctx.fillStyle = 'rgba(180,60,50,0.7)';
      ellipse(ctx, x + cw * 0.35, y + ch * 0.48, 2.4, 2.4);
      ctx.fillStyle = 'rgba(90,120,180,0.7)';
      ellipse(ctx, x + cw * 0.55, y + ch * 0.48, 2.4, 2.4);
      // coin slot
      ctx.fillStyle = '#050606';
      ctx.fillRect(x + cw * 0.42, y + ch * 0.7, cw * 0.16, 2);
    }
  }

  // neon sign
  text(ctx, 'ARCADE', w * 0.5, h * 0.16, { size: Math.max(10, w * 0.035), color: `rgba(120,200,220,${0.35 + Math.sin(t * 2.2) * 0.12})`, align: 'center', font: 'Georgia, serif', spacing: 4 });
  ctx.strokeStyle = 'rgba(120,200,220,0.1)';
  ctx.strokeRect(w * 0.4, h * 0.1, w * 0.2, h * 0.12);

  // prize counter
  ctx.fillStyle = '#120f0a';
  ctx.fillRect(w * 0.32, h * 0.68, w * 0.36, h * 0.18);
  ctx.fillStyle = 'rgba(190,170,120,0.12)';
  ctx.fillRect(w * 0.32, h * 0.68, w * 0.36, 3);

  grain(ctx, w, h, 40, 0.06);
}

function drawKitchen(ctx, w, h, t, state) {
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#1c231b');
  wall.addColorStop(0.6, '#11160f');
  wall.addColorStop(1, '#060806');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  // tile wall
  ctx.strokeStyle = 'rgba(190,215,185,0.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += w * 0.055) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h * 0.6);
    ctx.stroke();
  }
  for (let y = 0; y < h * 0.6; y += h * 0.075) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // flickering fluorescent
  const flick = (Math.sin(t * 13) > -0.85 ? 1 : 0.2) * (0.75 + hash(Math.floor(t * 11)) * 0.25);
  ctx.fillStyle = `rgba(220,240,210,${0.55 * flick})`;
  ctx.fillRect(w * 0.32, h * 0.055, w * 0.36, 3);
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.72);
  g.addColorStop(0, `rgba(210,240,210,${0.2 * flick})`);
  g.addColorStop(0.5, `rgba(200,230,200,${0.06 * flick})`);
  g.addColorStop(1, 'rgba(200,230,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * 0.72);

  // floor
  drawFloor(ctx, w, h, h * 0.7, t);

  // cabinets with steel doors
  for (let i = 0; i < 4; i++) {
    const x = w * 0.04 + i * w * 0.23;
    const grad = ctx.createLinearGradient(x, 0, x + w * 0.18, 0);
    grad.addColorStop(0, '#1a1f19');
    grad.addColorStop(0.5, '#262c24');
    grad.addColorStop(1, '#10130f');
    ctx.fillStyle = grad;
    ctx.fillRect(x, h * 0.24, w * 0.18, h * 0.34);
    ctx.strokeStyle = 'rgba(200,220,195,0.13)';
    ctx.strokeRect(x, h * 0.24, w * 0.18, h * 0.34);
    ctx.fillStyle = 'rgba(200,220,195,0.22)';
    ctx.fillRect(x + w * 0.04, h * 0.29, w * 0.1, 2);
    // handle
    ctx.fillStyle = 'rgba(220,230,215,0.3)';
    ctx.fillRect(x + w * 0.145, h * 0.4, 3, h * 0.04);
  }

  // shelves and jars
  for (let row = 0; row < 2; row++) {
    const sy = h * (0.2 + row * 0.11);
    ctx.fillStyle = 'rgba(20,24,18,0.9)';
    ctx.fillRect(w * 0.06, sy, w * 0.16, 3);
    for (let i = 0; i < 4; i++) {
      const jx = w * (0.075 + i * 0.035);
      const jh = h * (0.035 + (i % 2) * 0.012);
      ctx.fillStyle = ['#4c5b42', '#5a4a32', '#40505a', '#554044'][i];
      ctx.globalAlpha = 0.75;
      ctx.fillRect(jx, sy - jh, w * 0.018, jh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(220,230,210,0.18)';
      ctx.fillRect(jx + 2, sy - jh + 2, 2, jh - 4);
    }
  }

  // hanging pots
  for (let i = 0; i < 4; i++) {
    const x = w * (0.32 + i * 0.11);
    const len = h * (0.09 + (i % 2) * 0.04);
    ctx.strokeStyle = 'rgba(180,190,170,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, len);
    ctx.stroke();
    ctx.fillStyle = 'rgba(70,78,68,0.9)';
    ellipse(ctx, x, len + 5, 9, 5);
  }
  // knives on magnetic strip
  ctx.fillStyle = 'rgba(120,130,115,0.3)';
  ctx.fillRect(w * 0.72, h * 0.3, w * 0.13, 2);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = 'rgba(210,220,205,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.735 + i * 0.035, h * 0.3);
    ctx.lineTo(w * 0.74 + i * 0.035, h * 0.36);
    ctx.stroke();
  }

  // prep table and knife block
  ctx.fillStyle = '#191d16';
  ctx.fillRect(w * 0.16, h * 0.63, w * 0.68, h * 0.12);
  ctx.fillStyle = 'rgba(210,225,200,0.14)';
  ctx.fillRect(w * 0.16, h * 0.63, w * 0.68, 2);
  ctx.fillStyle = '#2c3128';
  ctx.fillRect(w * 0.6, h * 0.59, 34, 22);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = 'rgba(220,228,210,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.61 + i * 9, h * 0.59);
    ctx.lineTo(w * 0.615 + i * 9, h * 0.55);
    ctx.stroke();
  }
  // bloody smear hint
  ctx.fillStyle = 'rgba(95,25,20,0.22)';
  ellipse(ctx, w * 0.4, h * 0.7, 26, 5);
  // steel sink
  ctx.fillStyle = '#0f120d';
  ctx.fillRect(w * 0.22, h * 0.67, w * 0.13, h * 0.05);
  ctx.strokeStyle = 'rgba(190,210,190,0.15)';
  ctx.strokeRect(w * 0.22, h * 0.67, w * 0.13, h * 0.05);
  ctx.beginPath();
  ctx.arc(w * 0.27, h * 0.66, 8, Math.PI, 0);
  ctx.stroke();
  // steam
  for (let i = 0; i < 5; i++) {
    const sx = w * (0.25 + i * 0.11);
    const sy = h * 0.58;
    ctx.strokeStyle = `rgba(210,225,210,${0.06 + Math.sin(t + i) * 0.03})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx + 12, sy - 20, sx - 12, sy - 40, sx + 4, sy - 60);
    ctx.stroke();
  }

  grain(ctx, w, h, 50, 0.07);
}

function drawHallway(ctx, w, h, t, state) {
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#1b160e');
  wall.addColorStop(0.55, '#100d08');
  wall.addColorStop(1, '#050503');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  const vx = w * 0.5;
  const vy = h * 0.42;

  // corridor perspective walls
  ctx.fillStyle = '#0d0b07';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w * 0.24, vy - h * 0.16);
  ctx.lineTo(w * 0.76, vy - h * 0.16);
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();
  // side walls
  const lw = ctx.createLinearGradient(0, 0, w * 0.26, 0);
  lw.addColorStop(0, '#0a0906');
  lw.addColorStop(1, '#241e13');
  ctx.fillStyle = lw;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w * 0.24, vy - h * 0.16);
  ctx.lineTo(w * 0.24, vy + h * 0.24);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  const rw = ctx.createLinearGradient(w, 0, w * 0.74, 0);
  rw.addColorStop(0, '#0a0906');
  rw.addColorStop(1, '#241e13');
  ctx.fillStyle = rw;
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(w * 0.76, vy - h * 0.16);
  ctx.lineTo(w * 0.76, vy + h * 0.24);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // side wall panelling
  ctx.strokeStyle = 'rgba(220,190,130,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const k = i / 5;
    const xl = w * 0.24 * k;
    const yTop = (vy - h * 0.16) * k;
    const yBot = h + ((vy + h * 0.24) - h) * k;
    ctx.beginPath();
    ctx.moveTo(xl, yTop);
    ctx.lineTo(xl, yBot);
    ctx.stroke();
    const xr = w - w * 0.24 * k;
    ctx.beginPath();
    ctx.moveTo(xr, yTop);
    ctx.lineTo(xr, yBot);
    ctx.stroke();
  }

  // floor
  ctx.fillStyle = '#0d0b08';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(w * 0.24, vy + h * 0.24);
  ctx.lineTo(w * 0.76, vy + h * 0.24);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  drawFloor(ctx, w, h, h * 0.7, t);

  // end wall with door
  const dw = w * 0.13;
  const dh = h * 0.3;
  const dx = vx - dw / 2;
  const dy = vy - dh * 0.15;
  const wallG = ctx.createLinearGradient(dx, dy, dx, dy + dh);
  wallG.addColorStop(0, '#2a2418');
  wallG.addColorStop(1, '#15110b');
  ctx.fillStyle = wallG;
  ctx.fillRect(dx - w * 0.035, dy - h * 0.02, dw + w * 0.07, dh + h * 0.04);
  ctx.fillStyle = '#1a160f';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = 'rgba(230,180,90,0.25)';
  ctx.strokeRect(dx, dy, dw, dh);
  // office light leaking
  const og = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh);
  og.addColorStop(0, 'rgba(230,190,110,0.5)');
  og.addColorStop(1, 'rgba(190,140,70,0.12)');
  ctx.fillStyle = og;
  ctx.fillRect(dx + 3, dy + 3, dw - 6, dh - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(dx + dw * 0.47, dy + 4, 2, dh - 8);
  text(ctx, 'OFFICE', vx, dy + dh * 0.2, { size: Math.max(5, dw * 0.1), color: 'rgba(255,230,180,0.55)', align: 'center' });

  // side doors
  for (let side = 0; side < 2; side++) {
    const sx = side === 0 ? w * 0.12 : w * 0.78;
    const sy = h * 0.4;
    const sw = w * 0.055;
    const sh = h * 0.2;
    ctx.fillStyle = 'rgba(15,12,8,0.85)';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = 'rgba(220,190,130,0.1)';
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.fillStyle = 'rgba(230,190,120,0.18)';
    ctx.fillRect(sx + 4, sy + sh * 0.4, sw - 8, 2);
  }

  // perspective floor lines
  ctx.strokeStyle = 'rgba(220,195,140,0.16)';
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * w * 0.09, h);
    ctx.lineTo(w / 2 + i * w * 0.02, vy + h * 0.24);
    ctx.stroke();
  }
  for (let i = 1; i < 6; i++) {
    const y = h - Math.pow(i / 6, 1.5) * (h - (vy + h * 0.24));
    const spread = (y - vy) / (h - vy);
    ctx.beginPath();
    ctx.moveTo(w / 2 - w * 0.5 * spread, y);
    ctx.lineTo(w / 2 + w * 0.5 * spread, y);
    ctx.stroke();
  }

  // ceiling lights
  for (let i = 0; i < 3; i++) {
    const y = h * (0.12 + i * 0.12);
    const lw2 = w * (0.16 - i * 0.035);
    const lx = vx - lw2 / 2;
    const flick = 0.5 + hash(Math.floor(t * 5) + i * 3) * 0.5;
    ctx.fillStyle = `rgba(240,220,170,${0.32 * flick})`;
    ctx.fillRect(lx, y, lw2, 3);
    const g = ctx.createLinearGradient(0, y, 0, y + h * 0.16);
    g.addColorStop(0, `rgba(235,215,165,${0.1 * flick})`);
    g.addColorStop(1, 'rgba(235,215,165,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx + lw2, y);
    ctx.lineTo(lx + lw2 + w * 0.08, y + h * 0.16);
    ctx.lineTo(lx - w * 0.08, y + h * 0.16);
    ctx.closePath();
    ctx.fill();
  }

  // wall pipes and wires
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.02, h * 0.2);
  ctx.bezierCurveTo(w * 0.1, h * 0.35, w * 0.05, h * 0.5, w * 0.16, h * 0.62);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(180,170,140,0.08)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(w, h * 0.16);
  ctx.lineTo(w * 0.77, h * 0.26);
  ctx.stroke();

  // EXIT sign
  ctx.fillStyle = `rgba(180,35,25,${0.5 + Math.sin(t * 3) * 0.12})`;
  ctx.fillRect(vx - 20, vy - h * 0.21, 40, 9);
  text(ctx, 'EXIT', vx, vy - h * 0.21 + 4.5, { size: 6, color: '#ffc0b0', align: 'center' });

  // shadow near the office
  if (state.bush.atDoor) {
    // huge silhouette at end of corridor
    drawBush(ctx, vx, h * 1.02, h * 1.35, t, { alpha: 0.55, eye: '#ffd276', body: '#0b0907' });
  } else if (state.bush.active && state.bush.stage === 3) {
    drawBush(ctx, vx, h * 0.9, h * 1.15, t, { alpha: 0.68, eye: '#ffd276', body: '#0d0b08' });
  }

  grain(ctx, w, h, 50, 0.07);
}

/* ============================================================
   JUMPSCARE
   ============================================================ */

export function drawJumpscare(canvas, time, kind = 'bush') {
  const { ctx, w, h } = prepare(canvas);
  const t = time / 1000;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  const jitterX = (Math.random() - 0.5) * 14;
  const jitterY = (Math.random() - 0.5) * 14;
  ctx.save();
  ctx.translate(w / 2 + jitterX, h / 2 + jitterY);

  if (kind === 'forgotten') {
    const s = Math.min(w, h) * 1.15;
    ctx.globalAlpha = 0.85;
    const g = ctx.createRadialGradient(0, -s * 0.1, 0, 0, 0, s * 0.6);
    g.addColorStop(0, 'rgba(210,230,255,0.35)');
    g.addColorStop(0.4, 'rgba(40,60,60,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w, -h, w * 2, h * 2);
    ellipse(ctx, 0, 0, s * 0.22, s * 0.3, 'rgba(15,20,18,0.9)');
    ctx.shadowColor = '#dceaff';
    ctx.shadowBlur = 40;
    ellipse(ctx, -s * 0.08, -s * 0.05, s * 0.025, s * 0.04, '#f0f7ff');
    ellipse(ctx, s * 0.08, -s * 0.05, s * 0.025, s * 0.04, '#f0f7ff');
    ctx.shadowBlur = 0;
    staticNoise(ctx, w * 2, h * 2, 0.8);
  } else {
    const s = Math.min(w, h) * 1.5;
    // head
    const head = ctx.createRadialGradient(-s * 0.1, -s * 0.15, s * 0.05, 0, 0, s * 0.5);
    head.addColorStop(0, kind === 'ransom' ? '#3a2b2b' : '#5c422a');
    head.addColorStop(0.7, kind === 'ransom' ? '#140f0f' : '#22160e');
    head.addColorStop(1, '#080503');
    ctx.fillStyle = head;
    ellipse(ctx, 0, 0, s * 0.36, s * 0.34);
    // ears
    ctx.fillStyle = '#1c130c';
    ellipse(ctx, -s * 0.26, -s * 0.24, s * 0.12, s * 0.13);
    ellipse(ctx, s * 0.26, -s * 0.24, s * 0.12, s * 0.13);
    // muzzle
    ctx.fillStyle = '#332316';
    ellipse(ctx, 0, s * 0.09, s * 0.2, s * 0.13);
    // eyes
    ctx.shadowColor = kind === 'ransom' ? '#ff3a20' : '#ffcf6d';
    ctx.shadowBlur = 35;
    ellipse(ctx, -s * 0.13, -s * 0.05, s * 0.035, s * 0.045, kind === 'ransom' ? '#ff452b' : '#ffe9a8');
    ellipse(ctx, s * 0.13, -s * 0.05, s * 0.035, s * 0.045, kind === 'ransom' ? '#ff452b' : '#ffe9a8');
    ctx.shadowBlur = 0;
    // teeth
    ctx.fillStyle = '#e6dcc4';
    for (let i = -7; i <= 7; i++) {
      const x = i * s * 0.028;
      const y = s * 0.12 + Math.abs(i) * s * 0.004;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.013, y);
      ctx.lineTo(x + s * 0.013, y);
      ctx.lineTo(x, y + s * 0.055);
      ctx.closePath();
      ctx.fill();
    }
    staticNoise(ctx, w * 2, h * 2, 0.55);
  }
  ctx.restore();

  // red flashes
  ctx.fillStyle = `rgba(160,15,8,${0.14 + Math.abs(Math.sin(t * 8)) * 0.16})`;
  ctx.fillRect(0, 0, w, h);
  vignette(ctx, w, h, 0.85);
}

/* ============================================================
   REVERSE MODE
   ============================================================ */

export function drawReverse(canvas, state, time) {
  const { ctx, w, h } = prepare(canvas);
  const t = time / 1000;
  ctx.clearRect(0, 0, w, h);

  // hallway room
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#0d0a08');
  wall.addColorStop(0.6, '#080605');
  wall.addColorStop(1, '#030202');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  // perspective corridor to guard
  const vx = w * 0.7;
  const vy = h * 0.42;
  ctx.fillStyle = '#17110c';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vx - w * 0.12, vy - h * 0.14);
  ctx.lineTo(vx + w * 0.12, vy - h * 0.14);
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();
  drawFloor(ctx, w, h, h * 0.66, t);
  // left wall
  ctx.fillStyle = '#0c0906';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vx - w * 0.12, vy - h * 0.14);
  ctx.lineTo(vx - w * 0.12, vy + h * 0.2);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // guard booth at end
  const dx = vx - w * 0.08;
  const dy = vy - h * 0.1;
  const dw = w * 0.16;
  const dh = h * 0.34;
  ctx.fillStyle = '#0b0b08';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = `rgba(230,190,120,${state.doorClosed ? 0.5 : 0.18})`;
  ctx.strokeRect(dx, dy, dw, dh);
  // glass
  const gg = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh);
  gg.addColorStop(0, state.doorClosed ? 'rgba(160,60,40,0.18)' : 'rgba(230,200,140,0.16)');
  gg.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = gg;
  ctx.fillRect(dx + 3, dy + 3, dw - 6, dh - 6);
  // guard silhouette
  ctx.fillStyle = 'rgba(8,7,5,0.85)';
  ellipse(ctx, dx + dw * 0.5, dy + dh * 0.58, dw * 0.13, dh * 0.11);
  ctx.fillRect(dx + dw * 0.4, dy + dh * 0.68, dw * 0.2, dh * 0.24);
  // door shutter
  if (state.doorClosed) {
    ctx.fillStyle = 'rgba(60,58,48,0.85)';
    ctx.fillRect(dx - 2, dy, dw + 4, dh);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    for (let y = dy; y < dy + dh; y += 7) {
      ctx.beginPath();
      ctx.moveTo(dx - 2, y);
      ctx.lineTo(dx + dw + 2, y);
      ctx.stroke();
    }
  }
  // door sign
  ctx.fillStyle = state.doorClosed ? 'rgba(200,60,40,0.7)' : 'rgba(110,160,80,0.7)';
  ctx.fillRect(dx + dw * 0.32, dy - 10, dw * 0.36, 5);

  // guard camera light sweeping
  if (state.guardCam >= 1 && state.guardCam <= 4 && !state.doorClosed) {
    const camPositions = [h * 0.2, h * 0.32, h * 0.44, h * 0.56];
    const ly = camPositions[state.guardCam - 1];
    const beam = ctx.createLinearGradient(w * 0.1, ly, vx, vy);
    beam.addColorStop(0, 'rgba(220,230,190,0.07)');
    beam.addColorStop(1, 'rgba(220,230,190,0.14)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(0, ly - 20);
    ctx.lineTo(0, ly + 20);
    ctx.lineTo(vx - w * 0.1, vy + h * 0.04);
    ctx.lineTo(vx - w * 0.1, vy - h * 0.08);
    ctx.closePath();
    ctx.fill();
  }

  // monster avatar position along corridor
  const pos = state.pos; // 0..5
  const k = pos / 5;
  const mx = w * (0.14 + 0.5 * k);
  const my = h * (0.94 - 0.24 * k);
  const ms = h * (0.46 + 0.4 * k);
  ctx.globalAlpha = 0.95;
  if (state.character === 'ransom') drawRansom(ctx, mx, my, ms, t, { alpha: 0.9, eye: '#ff5a3a' });
  else if (state.character === 'forgotten') drawForgotten(ctx, mx, my, ms, t, { alpha: 0.85 });
  else drawBush(ctx, mx, my, ms, t, { alpha: 0.92, eye: '#ffd276' });

  // detection static
  if (state.detected > 0) {
    staticNoise(ctx, w, h, 0.7);
    ctx.fillStyle = `rgba(180,20,10,${0.12 + state.detected * 0.04})`;
    ctx.fillRect(0, 0, w, h);
  }

  // lights
  for (let i = 0; i < 3; i++) {
    const lx = w * (0.3 + i * 0.13);
    const ly = h * (0.14 + i * 0.03);
    const flick = 0.4 + hash(Math.floor(t * 4) + i) * 0.6;
    ctx.fillStyle = `rgba(230,200,150,${0.16 * flick})`;
    ctx.fillRect(lx, ly, w * 0.06, 2);
  }

  grain(ctx, w, h, 60, 0.08);
  vignette(ctx, w, h, 0.6);
}
