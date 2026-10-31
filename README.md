# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/12fxz/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/12fxz/PlayGround)

- 🎮 [Open the project](https://omgithub.com/12fxz/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=12fxz%2FPlayGround).
- 💻 [Explore the source](https://github.com/12fxz/PlayGround).
- 🛠️ [Check build runs](https://github.com/12fxz/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/12fxz/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/12fxz).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->

# ROOMS — Сектор R

Одностраничный хоррор-выживач от первого лица. Ты спускаешься в подземный комплекс «Сектор R» и идёшь через **300 процедурно генерируемых комнат**. Фонарик садится, батарейки попадаются редко, а в коридорах ждут три сущности.

Игра полностью автономна: HTML, CSS и JavaScript без внешних библиотек и файлов-ассетов. Графика рисуется на Canvas 2D (raycasting), звук синтезируется через WebAudio.

## Управление

| Действие | Клавиатура | Сенсор |
| --- | --- | --- |
| Идти вперёд / назад | `W` / `S`, `↑` / `↓` | ▲ / ▼ |
| Осмотреться | `A` / `D`, `←` / `→`, мышь | ◀ / ▶ или свайп |
| Дверь / спрятаться | `E` | E |
| Фонарик | `F` | F |
| Замереть | `SHIFT` | II |
| Рюкзак | `TAB` | ▤ |
| Пауза | `ESC` | II в углу |

## Как выжить

- **A-60 «Шум»** появляется после 30-й комнаты. За три комнаты до атаки слышна сирена. Когда он бежит — включи фонарик и спрячься в шкаф (`E`).
- **A-90 «Взгляд»** появляется после 60-й комнаты. Не двигайся вообще: ни клавишами, ни мышью, ни пальцем.
- **A-120 «Обратный»** появляется после 90-й комнаты. Не иди вперёд. Если успел — спрячься в шкаф, но не открывай дверцу.
- Фонарик тратит примерно **1% заряда за 10 секунд**. Батарейки лежат на полу (шанс ~5% на комнату), вставляются из рюкзака (`R` или кнопка).
- В полной темноте шкаф не найти. Держи фонарик заряженным.
- Цель — дойти до комнаты **300** и открыть дверь.

Лучший результат и последние забеги сохраняются в `localStorage` браузера.

## Запуск

Откройте `index.html` через любой статический HTTP-сервер, например:

```bash
python3 -m http.server 8000
```

и перейдите на `http://localhost:8000`. Модульные скрипты не работают по `file://`, поэтому сервер нужен.

## Структура

- `index.html` — экраны лобби, игры, настроек, паузы, инвентаря и финалов.
- `css/style.css` — тёмный интерфейс, адаптив под телефоны/планшеты и safe-area.
- `js/world.js` — палитры и процедурная генерация комнат.
- `js/art.js` — процедурные спрайты шкафов, ящиков, лампы и монстров.
- `js/renderer.js` — raycasting, свет фонарика, спрайты, скримеры.
- `js/audio.js` — синтезированные звуки и эмбиент.
- `js/game.js` — состояние игры, события, ввод, интерфейс, сохранения.

