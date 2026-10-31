/* Pure balance formulas. Kept dependency-free so they can be unit tested. */

export const NIGHT_SECONDS = 90;
export const BASE_MAX_ENERGY = 100;
export const BASE_HP = 100;
export const PREVIOUS_INTERN_BEST = 7;

export function speedMultiplier(night) {
  return 1 + 0.05 * (Math.max(1, night) - 1);
}

export function speedPercent(night) {
  return Math.round((speedMultiplier(night) - 1) * 100);
}

export function bushPathTime(night) {
  return 20 / speedMultiplier(night);
}

export function bushStageTime(night) {
  return bushPathTime(night) / 4;
}

export function bushDamage(night) {
  return Math.min(50, 30 + 2 * Math.floor(Math.max(1, night) / 5));
}

export function bushNoiseDuration(night) {
  return Math.min(20, 10 + (Math.max(1, night) - 1) / 3);
}

export function forgottenTimer(night) {
  return Math.max(5.5, 30 - 0.5 * (Math.max(1, night) - 1));
}

export function forgottenDamage(night) {
  return Math.min(35, 14 + Math.max(1, night) * 0.35);
}

/* Interference lasts 3s at night 1, 1.5s by night 20. */
export function ransomJamDuration(night) {
  return Math.max(1.5, 3 - 1.5 * (Math.max(1, night) - 1) / 19);
}

export function ransomInterval(night) {
  return Math.max(7.5, 17 - Math.max(1, night) * 0.19);
}

export function ransomAngerLimit(night) {
  return Math.max(4.5, 8 - Math.max(1, night) * 0.05);
}

export function nightPayout(night) {
  return 10 + Math.floor((Math.max(1, night) - 1) / 5);
}

export function milestoneBonus(night) {
  return night % 5 === 0 ? 50 : 0;
}

export function maxEnergy(upgrades) {
  return BASE_MAX_ENERGY + (upgrades?.battery ? 20 : 0);
}

export function features(night) {
  return {
    doubleJam: night >= 5,
    hideBehindBroken: night >= 10,
    twoForgotten: night >= 15,
    tabletFreeze: night >= 20,
    doubleBush: night >= 30,
    chaos: night >= 50,
    oldSkin: night >= 25,
    reverse: night >= 50,
  };
}

export function featureLabel(night) {
  const f = features(night);
  if (f.chaos) return 'РЕЖИМ «ХАОС»: все монстры активны с 12:00.';
  if (f.doubleBush) return 'BUSH может атаковать дважды подряд.';
  if (f.tabletFreeze) return 'RANSOM замораживает планшет на 2 секунды.';
  if (f.twoForgotten) return 'FORGOTTEN появляется на двух камерах одновременно.';
  if (f.hideBehindBroken) return 'FORGOTTEN прячется за сломанными камерами.';
  if (f.doubleJam) return 'RANSOM может вывести из строя две камеры сразу.';
  return 'Обучение. Слушай шаги. Смотри камеры. Закрывай дверь.';
}

export function featureShort(night) {
  const f = features(night);
  if (f.chaos) return 'ХАОС';
  if (f.doubleBush) return 'BUSH ×2';
  if (f.tabletFreeze) return 'ЗАМОРОЗКА';
  if (f.twoForgotten) return '2 КАМЕРЫ';
  if (f.hideBehindBroken) return 'ЗА ПОМЕХАМИ';
  if (f.doubleJam) return 'ДВОЙНАЯ ПОЛОМКА';
  return 'ОБУЧЕНИЕ';
}

export function tipFor(night) {
  const f = features(night);
  if (f.chaos) return 'Совет: в хаосе дверь важнее камер. Держи планшет под рукой и слушай шаги.';
  if (f.doubleBush) return 'Совет: после первого удара Bush возвращается. Не открывай дверь сразу.';
  if (f.tabletFreeze) return 'Совет: планшет теперь могут заморозить. Меньше дёргай камеры без нужды.';
  if (f.twoForgotten) return 'Совет: Forgotten может быть на двух камерах. Проверяй все, пока таймер идёт.';
  if (f.hideBehindBroken) return 'Совет: если Forgotten не видно, подожди восстановления помех — он мог спрятаться за ними.';
  if (f.doubleJam) return 'Совет: Ransom может сломать две камеры. Следи за индикаторами.';
  return 'Совет: открой планшет, проверь камеры 1–4 и вернись в офис до 6:00 AM.';
}

export function diaryUnlockedCount(completed) {
  return diaryEntries.filter((entry) => entry.at <= completed).length;
}

/* Entries are unlocked by completed nights. Kept here so tests can count them. */
export const diaryEntries = [
  { at: 0, n: 0 },
  { at: 3, n: 3 },
  { at: 6, n: 6 },
  { at: 9, n: 9 },
  { at: 10, n: 10 },
  { at: 12, n: 12 },
  { at: 15, n: 15 },
  { at: 18, n: 18 },
  { at: 20, n: 20 },
  { at: 21, n: 21 },
  { at: 24, n: 24 },
  { at: 27, n: 27 },
  { at: 30, n: 30 },
  { at: 33, n: 33 },
  { at: 36, n: 36 },
  { at: 40, n: 40 },
  { at: 45, n: 45 },
  { at: 50, n: 50 },
];
