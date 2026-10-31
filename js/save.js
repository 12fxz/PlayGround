import { PREVIOUS_INTERN_BEST } from './formulas.js';

const KEY = 'fnaf-signal-lost-save-v1';

export const SHOP_ITEMS = [
  {
    id: 'battery',
    name: 'ДОПОЛНИТЕЛЬНАЯ БАТАРЕЯ',
    icon: '▮',
    price: 50,
    desc: 'Резервный блок питания. +20% энергии на каждую смену. Покупается один раз навсегда.',
    tag: '+20% ЭНЕРГИИ',
  },
  {
    id: 'flashlight',
    name: 'ФОНАРИК',
    icon: '◉',
    price: 100,
    desc: 'Подсвечивает коридор без камер. Видно, если Bush уже у двери. Жрёт 0.7% энергии в секунду.',
    tag: 'КОРИДОР БЕЗ КАМЕР',
  },
  {
    id: 'quietDoor',
    name: 'ТИХАЯ ДВЕРЬ',
    icon: '▐▌',
    price: 150,
    desc: 'Смазанный механизм. Закрытая дверь тратит на 30% меньше энергии: 0.84% в секунду вместо 1.2%.',
    tag: '−30% РАСХОДА',
  },
  {
    id: 'antiNoise',
    name: 'АНТИ-ШУМ',
    icon: '◌',
    price: 200,
    desc: 'Беруши нового поколения. Один раз за ночь звон в ушах после удара Bush не срабатывает.',
    tag: '1 РАЗ / НОЧЬ',
  },
];

export function defaultSave() {
  return {
    version: 1,
    coins: 0,
    completed: 0,
    best: 0,
    deaths: 0,
    upgrades: { battery: false, flashlight: false, quietDoor: false, antiNoise: false },
    notes: '',
    muted: false,
    skinOldGuard: false,
    reverseUnlocked: false,
    reverseWins: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function loadSave() {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    return {
      ...base,
      ...parsed,
      upgrades: { ...base.upgrades, ...(parsed.upgrades || {}) },
      coins: Math.max(0, Number(parsed.coins) || 0),
      completed: Math.max(0, Number(parsed.completed) || 0),
      best: Math.max(0, Number(parsed.best) || 0),
      notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 4000) : '',
    };
  } catch {
    return base;
  }
}

export function persistSave(save) {
  save.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function resetSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function recordLabel(save) {
  const best = Math.max(save.best, 0);
  if (best > PREVIOUS_INTERN_BEST) {
    return { value: `Ночь ${best}`, owner: 'Вы · новый рекорд' };
  }
  return { value: `Ночь ${PREVIOUS_INTERN_BEST}`, owner: 'Предыдущий стажёр' };
}

export function shopOwned(save, id) {
  return Boolean(save.upgrades?.[id]);
}

export function shopAffordable(save, item) {
  return save.coins >= item.price;
}
