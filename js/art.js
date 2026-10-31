/* ============================================================
   ROOMS — процедурная пиксельная графика (canvas, без ассетов)
   ============================================================ */

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(ctx, w, h, amount, colors, alpha = 0.5) {
  for (let i = 0; i < amount; i++) {
    ctx.globalAlpha = Math.random() * alpha;
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    const s = Math.random() < 0.82 ? 1 : 2;
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

/* ---------------------------------------------------------- шкаф */
export function makeLocker(seed = 1) {
  const rng = mulberry32(seed);
  const w = 84, h = 188;
  const c = canvas(w, h);
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);

  // корпус
  const body = x.createLinearGradient(0, 0, w, 0);
  body.addColorStop(0, '#10130f');
  body.addColorStop(0.12, '#343a2f');
  body.addColorStop(0.5, '#272c24');
  body.addColorStop(0.88, '#1c211a');
  body.addColorStop(1, '#0b0e0a');
  x.fillStyle = body;
  x.fillRect(4, 2, w - 8, h - 6);

  // верхняя крышка
  x.fillStyle = '#3e4638';
  x.fillRect(2, 0, w - 4, 5);
  x.fillStyle = '#0a0c09';
  x.fillRect(2, 4, w - 4, 2);

  // дверцы
  for (let d = 0; d < 2; d++) {
    const dx = 9 + d * 33;
    const dw = 30;
    const grad = x.createLinearGradient(dx, 0, dx + dw, 0);
    grad.addColorStop(0, '#2b3128');
    grad.addColorStop(0.5, '#353b30');
    grad.addColorStop(1, '#1d221b');
    x.fillStyle = grad;
    x.fillRect(dx, 11, dw, h - 24);
    x.strokeStyle = 'rgba(0,0,0,.55)';
    x.strokeRect(dx + 0.5, 11.5, dw - 1, h - 25);

    // вентиляционные прорези
    x.fillStyle = 'rgba(3,5,3,.85)';
    for (let v = 0; v < 4; v++) {
      x.fillRect(dx + 6, 24 + v * 6, dw - 12, 2);
      x.fillRect(dx + 6, h - 54 + v * 6, dw - 12, 2);
    }
    // ручка
    x.fillStyle = '#6c715e';
    x.fillRect(dx + (d === 0 ? dw - 7 : 4), 88, 3, 15);
    x.fillStyle = '#11140f';
    x.fillRect(dx + (d === 0 ? dw - 6 : 5), 90, 1, 11);
  }

  // замок / бирка
  x.fillStyle = '#0c0f0b';
  x.fillRect(w / 2 - 3, 84, 6, 22);
  x.fillStyle = '#8c7a4b';
  x.fillRect(w / 2 - 2, 88, 4, 5);

  // ржавчина и грязь
  x.globalAlpha = 0.5;
  const rust = x.createLinearGradient(0, h - 60, 0, h);
  rust.addColorStop(0, 'rgba(90,52,26,0)');
  rust.addColorStop(1, 'rgba(96,52,24,.55)');
  x.fillStyle = rust;
  x.fillRect(6, h - 62, w - 12, 58);
  x.globalAlpha = 1;
  speckle(x, w, h, 110, ['#5e391f', '#2a1a10', '#70745c', '#11150f'], 0.45);

  // тень
  const sh = x.createLinearGradient(0, h - 18, 0, h);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,.75)');
  x.fillStyle = sh;
  x.fillRect(0, h - 18, w, 18);

  return { img: c, w: 0.88, h: 2.12, seed };
}

/* ---------------------------------------------------------- ящик */
export function makeCrate(seed = 1) {
  const rng = mulberry32(seed);
  const c = canvas(88, 78);
  const x = c.getContext('2d');
  x.clearRect(0, 0, 88, 78);
  const g = x.createLinearGradient(0, 0, 0, 78);
  g.addColorStop(0, '#4a4230');
  g.addColorStop(0.5, '#383224');
  g.addColorStop(1, '#1d1a12');
  x.fillStyle = g;
  x.fillRect(3, 5, 82, 70);
  x.fillStyle = '#5b533c';
  x.fillRect(3, 5, 82, 4);
  x.fillStyle = '#14120c';
  x.fillRect(3, 72, 82, 3);

  // доски
  x.strokeStyle = 'rgba(0,0,0,.45)';
  for (let i = 1; i < 4; i++) {
    x.beginPath();
    x.moveTo(4, 5 + i * 17);
    x.lineTo(84, 5 + i * 17);
    x.stroke();
  }
  // крест
  x.strokeStyle = 'rgba(20,17,10,.8)';
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(7, 9); x.lineTo(81, 70);
  x.moveTo(81, 9); x.lineTo(7, 70);
  x.stroke();
  x.lineWidth = 1;
  // трафарет
  x.fillStyle = 'rgba(190,175,120,.28)';
  x.font = 'bold 15px monospace';
  x.fillText('R-12', 28, 43);
  speckle(x, 88, 78, 50, ['#6a3d20', '#17140d', '#777a5e'], 0.4);
  return { img: c, w: 0.62, h: 0.58 };
}

/* ---------------------------------------------------------- лампа */
export function makeLamp() {
  const c = canvas(72, 92);
  const x = c.getContext('2d');
  x.strokeStyle = '#2a2f27';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(36, 0);
  x.lineTo(36, 30);
  x.stroke();
  const g = x.createLinearGradient(0, 28, 0, 60);
  g.addColorStop(0, '#30352c');
  g.addColorStop(1, '#10130f');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(24, 30);
  x.lineTo(48, 30);
  x.lineTo(60, 56);
  x.lineTo(12, 56);
  x.closePath();
  x.fill();
  x.fillStyle = 'rgba(255,235,180,.85)';
  x.beginPath();
  x.ellipse(36, 58, 10, 4, 0, 0, Math.PI * 2);
  x.fill();
  return { img: c, w: 0.38, h: 0.36 };
}

/* ---------------------------------------------------------- батарейка */
export function makeBattery() {
  const c = canvas(46, 26);
  const x = c.getContext('2d');
  x.clearRect(0, 0, 46, 26);
  x.fillStyle = '#13140f';
  x.fillRect(4, 3, 38, 20);
  x.fillStyle = '#c69a3c';
  x.fillRect(5, 4, 36, 18);
  x.fillStyle = '#221e13';
  x.fillRect(9, 6, 28, 14);
  x.fillStyle = '#ffd47a';
  x.fillRect(34, 7, 3, 12);
  x.fillStyle = '#9a742c';
  x.fillRect(40, 9, 3, 8);
  x.fillStyle = '#e7bd63';
  x.font = 'bold 9px monospace';
  x.fillText('+', 37, 8);
  x.strokeStyle = 'rgba(255,230,160,.5)';
  x.strokeRect(5, 4, 36, 18);
  return { img: c, w: 0.38, h: 0.2 };
}

/* ---------------------------------------------------------- A-60 тело */
export function makeA60() {
  const w = 132, h = 260;
  const c = canvas(w, h);
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);

  // аура
  const aura = x.createRadialGradient(w / 2, h * 0.45, 8, w / 2, h * 0.45, w * 0.7);
  aura.addColorStop(0, 'rgba(95,8,4,.34)');
  aura.addColorStop(1, 'rgba(60,0,0,0)');
  x.fillStyle = aura;
  x.fillRect(0, 0, w, h);

  x.fillStyle = '#060504';
  x.strokeStyle = 'rgba(120,24,16,.4)';
  x.lineWidth = 2;

  // ноги
  x.beginPath();
  x.moveTo(48, 168);
  x.quadraticCurveTo(38, 216, 26, 252);
  x.lineTo(41, 256);
  x.quadraticCurveTo(53, 216, 61, 172);
  x.closePath(); x.fill(); x.stroke();
  x.beginPath();
  x.moveTo(72, 170);
  x.quadraticCurveTo(84, 220, 101, 251);
  x.lineTo(114, 244);
  x.quadraticCurveTo(99, 206, 91, 166);
  x.closePath(); x.fill(); x.stroke();

  // торс
  x.beginPath();
  x.moveTo(52, 66);
  x.quadraticCurveTo(30, 106, 41, 178);
  x.quadraticCurveTo(67, 194, 93, 176);
  x.quadraticCurveTo(104, 106, 82, 64);
  x.closePath(); x.fill(); x.stroke();

  // руки — слишком длинные
  x.beginPath();
  x.moveTo(44, 82);
  x.quadraticCurveTo(19, 140, 12, 214);
  x.lineTo(23, 233);
  x.lineTo(30, 232);
  x.quadraticCurveTo(38, 152, 59, 100);
  x.closePath(); x.fill(); x.stroke();
  x.beginPath();
  x.moveTo(90, 80);
  x.quadraticCurveTo(112, 138, 121, 209);
  x.lineTo(111, 230);
  x.lineTo(102, 228);
  x.quadraticCurveTo(96, 150, 78, 98);
  x.closePath(); x.fill(); x.stroke();

  // кисти-пальцы
  x.strokeStyle = 'rgba(120,24,16,.5)';
  x.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    x.beginPath();
    x.moveTo(17 + i * 2, 231);
    x.lineTo(9 + i * 4, 254 + (i % 2) * 3);
    x.stroke();
    x.beginPath();
    x.moveTo(106 + i * 2, 228);
    x.lineTo(116 + i * 4, 252 - (i % 2) * 3);
    x.stroke();
  }

  // голова, наклонённая набок
  x.save();
  x.translate(w / 2, 42);
  x.rotate(-0.09);
  x.fillStyle = '#070605';
  x.beginPath();
  x.ellipse(0, 0, 30, 38, 0, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = 'rgba(130,28,18,.45)';
  x.lineWidth = 2;
  x.stroke();
  // глаза
  x.shadowColor = '#ff2b18';
  x.shadowBlur = 18;
  x.fillStyle = '#ff3a22';
  x.beginPath(); x.ellipse(-12, -4, 5, 3.2, 0.18, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(12, -4, 5, 3.2, -0.18, 0, Math.PI * 2); x.fill();
  x.shadowBlur = 0;
  // улыбка
  x.fillStyle = '#e8dfcd';
  x.beginPath();
  x.moveTo(-18, 12);
  x.quadraticCurveTo(0, 31, 19, 11);
  x.quadraticCurveTo(1, 22, -18, 12);
  x.closePath();
  x.fill();
  x.fillStyle = '#160605';
  for (let i = -12; i <= 12; i += 6) x.fillRect(i, 14, 2, 6);
  x.restore();

  // рваные края
  x.globalAlpha = 0.3;
  x.fillStyle = '#000';
  for (let i = 0; i < 30; i++) {
    x.fillRect(Math.random() * w, Math.random() * h, 2, 3);
  }
  x.globalAlpha = 1;
  return { img: c, w: 2.4, h: 2.55 };
}

/* ---------------------------------------------------------- A-120 тело */
export function makeA120() {
  const w = 120, h = 240;
  const c = canvas(w, h);
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);

  // холодная аура — едва тлеющая, не белая
  const aura = x.createRadialGradient(w / 2, h * 0.42, 8, w / 2, h * 0.42, w * 0.8);
  aura.addColorStop(0, 'rgba(112,148,132,.13)');
  aura.addColorStop(0.6, 'rgba(48,74,63,.05)');
  aura.addColorStop(1, 'rgba(20,34,28,0)');
  x.fillStyle = aura;
  x.fillRect(0, 0, w, h);

  const body = '#070b09';
  const deep = '#040706';
  const rim = 'rgba(178,205,187,.42)';
  const rimSoft = 'rgba(132,164,146,.2)';

  x.fillStyle = body;
  x.strokeStyle = rimSoft;
  x.lineWidth = 1.1;

  // ноги — неестественно тонкие
  x.beginPath(); x.moveTo(51, 156); x.quadraticCurveTo(49, 202, 40, 238); x.lineTo(50, 238); x.quadraticCurveTo(57, 200, 60, 158); x.closePath(); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(65, 156); x.quadraticCurveTo(69, 202, 81, 238); x.lineTo(70, 238); x.quadraticCurveTo(63, 200, 60, 158); x.closePath(); x.fill(); x.stroke();

  // торс — впалый, вытянутый
  x.beginPath();
  x.moveTo(46, 60);
  x.quadraticCurveTo(33, 98, 42, 160);
  x.quadraticCurveTo(60, 170, 76, 160);
  x.quadraticCurveTo(87, 98, 72, 60);
  x.closePath();
  x.fill(); x.stroke();

  // рёбра
  x.strokeStyle = 'rgba(118,146,130,.16)';
  x.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = 82 + i * 13;
    x.beginPath();
    x.moveTo(45 + i * 0.8, y);
    x.quadraticCurveTo(58, y + 5, 75 - i * 0.8, y);
    x.stroke();
  }

  // руки — длинные, висят до колен
  x.fillStyle = body;
  x.strokeStyle = rimSoft;
  x.lineWidth = 1.1;
  x.beginPath(); x.moveTo(45, 72); x.quadraticCurveTo(24, 126, 24, 190); x.lineTo(32, 200); x.lineTo(38, 196); x.quadraticCurveTo(37, 132, 57, 92); x.closePath(); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(73, 72); x.quadraticCurveTo(95, 124, 94, 190); x.lineTo(86, 200); x.lineTo(80, 196); x.quadraticCurveTo(82, 132, 62, 92); x.closePath(); x.fill(); x.stroke();

  // пальцы
  x.strokeStyle = 'rgba(150,180,162,.3)';
  x.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    x.beginPath(); x.moveTo(26 + i * 3, 195); x.lineTo(22 + i * 4, 216 + (i % 2) * 4); x.stroke();
    x.beginPath(); x.moveTo(92 - i * 3, 195); x.lineTo(97 - i * 4, 215 + (i % 2) * 4); x.stroke();
  }

  // голова — маленькая, опущенная, с бледной кромкой
  x.fillStyle = '#0a0f0c';
  x.beginPath();
  x.ellipse(59, 38, 19, 27, 0.05, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = 'rgba(190,215,198,.34)';
  x.lineWidth = 1.3;
  x.beginPath();
  x.ellipse(59, 38, 19, 27, 0.05, -2.5, 0.9);
  x.stroke();

  // пустые глазницы и вертикальная пасть
  x.fillStyle = deep;
  x.beginPath(); x.ellipse(52, 35, 5.4, 8.4, 0.15, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(68, 35, 5.4, 8.4, -0.15, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(60, 55, 3.6, 11, 0, 0, Math.PI * 2); x.fill();
  // тусклый блик в глазах
  x.fillStyle = 'rgba(196,224,206,.22)';
  x.fillRect(53, 36, 1, 2);
  x.fillRect(69, 36, 1, 2);

  // бледная кромка вдоль правой стороны силуэта
  x.strokeStyle = rim;
  x.lineWidth = 1.4;
  x.beginPath();
  x.moveTo(74, 62);
  x.quadraticCurveTo(88, 100, 78, 158);
  x.stroke();
  x.beginPath();
  x.moveTo(82, 74);
  x.quadraticCurveTo(96, 128, 91, 190);
  x.stroke();
  x.beginPath();
  x.moveTo(62, 160);
  x.quadraticCurveTo(68, 202, 80, 236);
  x.stroke();

  // пыль и холодная испарина
  x.globalAlpha = 0.24;
  for (let i = 0; i < 46; i++) {
    x.fillStyle = Math.random() < 0.58 ? '#030604' : '#9fb8a8';
    x.fillRect(Math.random() * w, Math.random() * h, 1, 2);
  }
  x.globalAlpha = 1;
  return { img: c, w: 1.95, h: 2.28 };
}

/* ---------------------------------------------------------- лица */
function drawNoise(ctx, w, h, amount, alpha = 0.25) {
  for (let i = 0; i < amount; i++) {
    ctx.globalAlpha = Math.random() * alpha;
    ctx.fillStyle = Math.random() < 0.55 ? '#000' : '#dfe6d8';
    const s = Math.random() < 0.8 ? 1 : 2;
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

export function makeFace90() {
  const w = 520, h = 440;
  const c = canvas(w, h);
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);

  // шея
  x.fillStyle = '#7f8577';
  x.beginPath();
  x.moveTo(205, 320);
  x.quadraticCurveTo(195, 420, 175, 440);
  x.lineTo(345, 440);
  x.quadraticCurveTo(325, 420, 315, 320);
  x.closePath();
  x.fill();

  // голова
  const head = x.createRadialGradient(235, 155, 18, 260, 220, 230);
  head.addColorStop(0, '#d6d8c6');
  head.addColorStop(0.45, '#a7a996');
  head.addColorStop(0.82, '#6c7062');
  head.addColorStop(1, '#3d4138');
  x.fillStyle = head;
  x.beginPath();
  x.moveTo(260, 22);
  x.bezierCurveTo(350, 22, 420, 88, 424, 178);
  x.bezierCurveTo(428, 262, 386, 326, 310, 352);
  x.bezierCurveTo(274, 364, 240, 360, 206, 348);
  x.bezierCurveTo(132, 322, 92, 258, 96, 176);
  x.bezierCurveTo(100, 92, 168, 22, 260, 22);
  x.closePath();
  x.fill();

  // тени
  x.save();
  x.clip();
  const sh = x.createLinearGradient(90, 0, 430, 0);
  sh.addColorStop(0, 'rgba(0,0,0,.5)');
  sh.addColorStop(0.26, 'rgba(0,0,0,0)');
  sh.addColorStop(0.75, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,.62)');
  x.fillStyle = sh;
  x.fillRect(80, 0, 360, 380);
  const forehead = x.createLinearGradient(0, 20, 0, 180);
  forehead.addColorStop(0, 'rgba(255,255,240,.2)');
  forehead.addColorStop(1, 'rgba(255,255,240,0)');
  x.fillStyle = forehead;
  x.fillRect(120, 20, 280, 180);
  x.restore();

  // глазницы
  function socket(cx, cy, rx, ry, rot) {
    x.save();
    x.translate(cx, cy);
    x.rotate(rot);
    const g = x.createRadialGradient(0, 0, 2, 0, 0, rx);
    g.addColorStop(0, '#000');
    g.addColorStop(0.72, '#050605');
    g.addColorStop(0.9, 'rgba(15,18,14,.95)');
    g.addColorStop(1, 'rgba(15,18,14,0)');
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    x.fill();
    // зрачок
    x.shadowColor = '#e9ffe9';
    x.shadowBlur = 12;
    x.fillStyle = '#eaffea';
    x.beginPath();
    x.ellipse(3, 2, 4.4, 4.4, 0, 0, Math.PI * 2);
    x.fill();
    x.shadowBlur = 0;
    x.fillStyle = '#050604';
    x.beginPath();
    x.ellipse(3.8, 2.4, 1.8, 1.8, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  socket(196, 172, 48, 38, 0.12);
  socket(326, 172, 48, 38, -0.12);

  // нос
  x.fillStyle = 'rgba(25,28,22,.55)';
  x.beginPath();
  x.moveTo(254, 196);
  x.quadraticCurveTo(246, 240, 238, 252);
  x.quadraticCurveTo(257, 260, 274, 252);
  x.quadraticCurveTo(267, 236, 262, 198);
  x.closePath();
  x.fill();

  // рот — слишком широкий
  x.fillStyle = '#080906';
  x.beginPath();
  x.moveTo(143, 276);
  x.quadraticCurveTo(240, 250, 372, 270);
  x.quadraticCurveTo(352, 338, 252, 342);
  x.quadraticCurveTo(172, 338, 143, 276);
  x.closePath();
  x.fill();

  // зубы
  x.fillStyle = '#d8d3b7';
  for (let i = 0; i < 10; i++) {
    const tx = 164 + i * 21;
    const th = 12 + Math.random() * 9;
    x.beginPath();
    x.moveTo(tx, 268 + Math.random() * 5);
    x.lineTo(tx + 13, 267 + Math.random() * 5);
    x.lineTo(tx + 11, 268 + th);
    x.lineTo(tx + 3, 268 + th);
    x.closePath();
    x.fill();
  }
  for (let i = 0; i < 8; i++) {
    const tx = 184 + i * 21;
    const th = 9 + Math.random() * 7;
    x.beginPath();
    x.moveTo(tx, 332);
    x.lineTo(tx + 13, 332);
    x.lineTo(tx + 11, 332 - th);
    x.lineTo(tx + 3, 332 - th);
    x.closePath();
    x.fill();
  }

  // трещины
  x.strokeStyle = 'rgba(35,38,30,.55)';
  x.lineWidth = 1.2;
  const cracks = [
    [312, 208, 338, 246, 330, 276],
    [172, 214, 156, 246, 162, 264],
    [250, 52, 260, 88, 248, 108],
    [400, 128, 410, 176, 398, 208]
  ];
  for (const cr of cracks) {
    x.beginPath();
    x.moveTo(cr[0], cr[1]);
    x.lineTo(cr[2], cr[3]);
    x.lineTo(cr[4], cr[5]);
    x.stroke();
  }

  // руки по краям
  x.fillStyle = 'rgba(120,124,108,.8)';
  x.beginPath();
  x.moveTo(0, 440);
  x.quadraticCurveTo(18, 330, 58, 300);
  x.quadraticCurveTo(30, 372, 42, 440);
  x.closePath(); x.fill();
  x.beginPath();
  x.moveTo(520, 440);
  x.quadraticCurveTo(502, 330, 462, 300);
  x.quadraticCurveTo(490, 372, 478, 440);
  x.closePath(); x.fill();
  x.strokeStyle = 'rgba(50,54,44,.55)';
  x.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    x.beginPath(); x.moveTo(52 + i * 3, 304); x.lineTo(30 + i * 4, 360 + i * 8); x.stroke();
    x.beginPath(); x.moveTo(468 - i * 3, 304); x.lineTo(490 - i * 4, 360 + i * 8); x.stroke();
  }

  drawNoise(x, w, h, 1700, 0.3);
  return c;
}

export function makeFace60() {
  const w = 520, h = 440;
  const c = canvas(w, h);
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);

  const bg = x.createRadialGradient(260, 210, 10, 260, 210, 320);
  bg.addColorStop(0, 'rgba(70,6,3,.95)');
  bg.addColorStop(0.55, 'rgba(24,2,1,.92)');
  bg.addColorStop(1, 'rgba(2,0,0,1)');
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);

  // тёмный силуэт
  x.fillStyle = '#080302';
  x.beginPath();
  x.ellipse(260, 225, 178, 208, 0, 0, Math.PI * 2);
  x.fill();

  // красная подсветка
  const rim = x.createRadialGradient(260, 180, 30, 260, 210, 220);
  rim.addColorStop(0, 'rgba(150,20,12,.45)');
  rim.addColorStop(0.6, 'rgba(80,6,3,.12)');
  rim.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = rim;
  x.fillRect(0, 0, w, h);

  // глаза
  x.shadowColor = '#ff2d18';
  x.shadowBlur = 35;
  x.fillStyle = '#ff3b22';
  x.beginPath(); x.ellipse(184, 172, 34, 17, 0.18, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(338, 172, 34, 17, -0.18, 0, Math.PI * 2); x.fill();
  x.shadowBlur = 0;
  x.fillStyle = '#1a0201';
  x.beginPath(); x.ellipse(186, 174, 9, 12, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(336, 174, 9, 12, 0, 0, Math.PI * 2); x.fill();

  // пасть
  x.fillStyle = '#050101';
  x.beginPath();
  x.moveTo(126, 260);
  x.quadraticCurveTo(260, 230, 396, 258);
  x.quadraticCurveTo(380, 386, 260, 396);
  x.quadraticCurveTo(142, 384, 126, 260);
  x.closePath();
  x.fill();
  // зубы
  x.fillStyle = '#e6dcc3';
  for (let i = 0; i < 12; i++) {
    const tx = 148 + i * 19;
    const th = 20 + Math.random() * 18;
    x.beginPath();
    x.moveTo(tx, 258 + Math.random() * 8);
    x.lineTo(tx + 13, 256 + Math.random() * 8);
    x.lineTo(tx + 10, 258 + th);
    x.lineTo(tx + 2, 258 + th);
    x.closePath();
    x.fill();
  }
  for (let i = 0; i < 10; i++) {
    const tx = 168 + i * 19;
    const th = 15 + Math.random() * 14;
    x.beginPath();
    x.moveTo(tx, 380);
    x.lineTo(tx + 12, 380);
    x.lineTo(tx + 10, 380 - th);
    x.lineTo(tx + 3, 380 - th);
    x.closePath();
    x.fill();
  }

  // вены
  x.strokeStyle = 'rgba(160,28,18,.4)';
  x.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    x.beginPath();
    const sx = 100 + Math.random() * 320;
    const sy = 40 + Math.random() * 340;
    x.moveTo(sx, sy);
    x.lineTo(sx + (Math.random() - 0.5) * 70, sy + 30 + Math.random() * 40);
    x.stroke();
  }

  drawNoise(x, w, h, 2000, 0.35);
  return c;
}

export function makeFace120() {
  const w = 520, h = 440;
  const c = canvas(w, h);
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);
  const bg = x.createRadialGradient(260, 200, 30, 260, 220, 330);
  bg.addColorStop(0, 'rgba(150,175,165,.3)');
  bg.addColorStop(0.55, 'rgba(35,52,45,.6)');
  bg.addColorStop(1, 'rgba(0,3,2,.98)');
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(168,185,174,.75)';
  x.beginPath();
  x.ellipse(260, 212, 128, 178, 0.04, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = 'rgba(6,10,8,.95)';
  x.beginPath(); x.ellipse(208, 176, 34, 50, 0.2, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(312, 176, 34, 50, -0.2, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(260, 282, 28, 58, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(20,30,25,.5)';
  x.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    x.beginPath();
    const sx = 150 + Math.random() * 220;
    const sy = 60 + Math.random() * 300;
    x.moveTo(sx, sy);
    x.lineTo(sx + (Math.random() - 0.5) * 60, sy + 20 + Math.random() * 50);
    x.stroke();
  }
  drawNoise(x, w, h, 1600, 0.35);
  return c;
}

/* ---------------------------------------------------------- превью двери / фон */
export function makeGrain(size = 128) {
  const c = canvas(size, size);
  const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.random() < 0.55 ? 34 : 0;
  }
  x.putImageData(img, 0, 0);
  return c;
}
