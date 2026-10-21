# Frame — a wall dashboard for Home Assistant

> **From the Reddit post:** this repo came out of [Wes Bos inspired me to go full Home Assistant](https://www.reddit.com/r/homeassistant/comments/1x89liy/wes_bos_inspired_me_to_go_full_home_assistant/) on r/homeassistant. The full version of Frame runs on my own wall every day, with a lot more pages and content than you'll find here. This is "just" the starter: the core layout, the shared runtime and a set of optional modules, ready for you to build your own on top of.

A calm, paper-and-ink dashboard for a tablet on the wall. A big clock, the weather and what to wear, who's home, the next event with a countdown and your week, plus lights, blinds, locks, windows and room climate, all readable from across the room.

It's built from [button-card](https://github.com/custom-cards/button-card) templates and [layout-card](https://github.com/thomasloven/lovelace-layout-card), with a small shared runtime. A **Setup page** checks your install, finds the example entities you still need to replace and writes the YAML for you from your own Home Assistant.

![Home on a 12.9" iPad](docs/screenshots/home.png)

## What's in the box

| | |
| --- | --- |
| ![House](docs/screenshots/house.png) | **House:** scenes that show their state ("2 of 4 on"), light tiles in the colours of the lamps that are on (tap toggles, drag dims, hold for details; a room's tile opens all its lamps), blinds as sliders, a lock, open windows and doors, and room climate with 24-hour sparklines. |
| ![Tap a climate tile](docs/screenshots/house-details.png) | **Tap for details:** climate tiles show the day's low and high, the 3-hour trend and the target temperature. Sparklines show values on touch. |
| ![Dimming a light](docs/screenshots/light-dimming.png) | **Drag to dim:** the fill follows your finger and the level is set when you let go. Blinds work the same way. |
| ![Weather window](docs/screenshots/weather-window.png) | **Weather:** two painted children next to the clock, dressed for the day: coat or T-shirt, umbrella, sunhat, wind-blown scarves. Tap the weather for the whole day over a sky that matches it: the parts of the day, 24 hours, the next days, sunrise, wind and UV. |
| ![Room window](docs/screenshots/room.png) | **Room window:** tap a room's light tile for every lamp in it, each one tap, drag and hold like the tile. "All off" for the room. |
| ![A lamp's colours](docs/screenshots/room-colour.png) | **Colours:** tap a lamp's round icon for the white levels it can do and a palette by hue. |
| ![Countdown](docs/screenshots/countdown-open.png) | **Countdown:** the next birthday or holiday with a painted picture and the days to go; tap it for the next ones. School holidays from a calendar. |
| ![Clock menu](docs/screenshots/clock-menu.png) | **Clock menu:** the small clock in the rail holds the pages you rarely need (Energy) and the way to Settings. An optional **Ask** button opens Assist in Frame style, big enough to read from across the room. |
| ![Setup](docs/screenshots/setup.png) | **Setup page:** checks resources, fonts, theme and weather, then lists every entity in the dashboard that doesn't exist in your Home Assistant yet, with likely matches. |
| ![YAML generator](docs/screenshots/setup-generator.png) | **YAML generator:** people, calendars, lights by area, covers, climate, scenes and contacts, built from what your Home Assistant already has. Copy, paste, done. |

## Optional modules

Add what fits your home: each is a folder in [`optional/`](optional/) that adds a page or a card, installed with one command. The Setup page shows which ones match what your Home Assistant already has.

| | |
| --- | --- |
| ![Calendar](docs/screenshots/calendar-week.png) | **[Calendar](optional/calendar/):** day, 3 days, week and month. Tap to add, hold and drag to move, edit and delete, with undo. |
| ![Energy](docs/screenshots/energy.png) | **[Energy](optional/energy/):** straight from your energy dashboard settings. Use, solar, grid, self-sufficiency, per hour and per day, and electricity prices with the cheapest hours marked. |
| ![Plane over Home](docs/screenshots/home-plane.png) | **[Planes overhead](optional/flights/):** Flightradar24 aircraft fly across the screen in their real direction. Tap the tag for a flight card over a flight through the clouds. |
| ![Flight card](docs/screenshots/flight-card.jpg) | The flight card shows route and progress, delay, landing time, aircraft, altitude and speed. |
| ![Health](docs/screenshots/health.png) | **[Health](optional/health/):** tap a person for their activity rings, weight, heart rate, HRV and last night's sleep stages, each with 30 days. From Apple Health via the iPhone app Health Auto Export; the README walks through the setup. |
| ![Scenes](docs/screenshots/room-scenes.png) | **[Scenes](optional/scenes/):** tap a room's light tile for every lamp in it, their colours, and scenes as pictures: white light, morning, evening, and dynamic ones that let the colours wander between the lamps. |
| ![Kitchen timer](docs/screenshots/timer.png) | **[Kitchen timer](optional/timer/):** tap the clock, turn the dial or tap "Pasta". It runs in Home Assistant, rings on your speakers and every tablet, and floats in a corner while it counts down. |
| ![Rubbish and appliances on Home](docs/screenshots/home.png) | **[Rubbish](optional/rubbish/)** with painted bins and a "put out tonight" reminder, **[appliances](optional/appliances/)** while they run or are finished, and a **[mini player](optional/media/)**. |
| ![Music](docs/screenshots/music.png) | **[Music](optional/media/):** what's playing, big, following whichever player is on. |
| ![Cameras](docs/screenshots/cameras.jpg) | **[Cameras](optional/cameras/):** live tiles with motion; tap for full screen. |
| ![Screensaver](docs/screenshots/screensaver.jpg) | **[Screensaver](optional/screensaver/):** a photo slideshow (WallPanel) with clock, weather and the next event. |

It works on phones too. Under 768 px everything becomes one scrolling column and the rail turns into a top bar.

<p>
  <img src="docs/screenshots/phone-home.png" width="260" alt="Home on a phone">
  <img src="docs/screenshots/phone-house.png" width="260" alt="House on a phone">
  <img src="docs/screenshots/phone-weather.png" width="260" alt="Weather window on a phone">
</p>

## Modules

| Template | What it shows |
| --- | --- |
| `frame_rail` | Navigation rail (left on tablets, top bar on phones); the small clock opens a menu with the pages you rarely need and Settings; optional Ask button for Assist |
| `frame_clock` | Big clock and date, with two children dressed for the weather |
| `frame_weather` | Current weather, high/low, next 12 hours in 2-hour steps, what to wear and when rain starts; tap for the weather window |
| `frame_people` | Who's home, and the zone for everyone else |
| `frame_next` | The next calendar event in its person's colour, with a countdown |
| `frame_agenda` | The next 7 days, grouped by day |
| `frame_countdown` | The next birthday or holiday, with a painted picture |
| `frame_scene` | Scene or script button that knows when it's active |
| `frame_light` | Light, light group or a whole area, in the colours of the lamps |
| `frame_cover` | Blind as a slider, optionally connected to its room's light |
| `frame_lock` | Lock with door contact and battery warning |
| `frame_openings` | Open windows and doors, and how long they've been open |
| `frame_rooms` | Temperature and humidity tiles with sparklines and heating state |
| `frame_stats` | Big numbers for energy, air quality or any other sensor |
| `frame_heading` | Section heading |
| `frame_setup` | The onboarding page |

[docs/modules.md](docs/modules.md) lists every option. The optional modules bring their own templates, documented in their READMEs.

## Quick start

You need Home Assistant 2024.4 or newer, [HACS](https://hacs.xyz) with **button-card** and **layout-card**, and optionally **kiosk-mode** to hide the header and sidebar.

1. Get the repo onto your Home Assistant and run `./install.sh` (add optional modules by name: `./install.sh calendar energy`).
2. Register the dashboard in `configuration.yaml` and add two resources: `/local/frame/frame.js?v=1` and the Google Fonts stylesheet.
3. Restart Home Assistant, open **Frame** in the sidebar and go to **Setup**.

The full walkthrough, with copy-paste snippets, is in [docs/getting-started.md](docs/getting-started.md). Running `./install.sh` again later updates the code but keeps your settings and views.

## Make it yours

- **Your household:** `people`, `calendars` and `weather` live in `templates/frame.yaml`. The Setup page generates them for you.
- **Your rooms:** edit `views/*.yaml` and paste in the cards the Setup page writes. The rail lists every view on its own, using its `title` and `icon`.
- **Colours, fonts, language and your own modules:** see [docs/customizing.md](docs/customizing.md). Dates and numbers already follow your Home Assistant locale, and every UI string can be overridden.

## How it's put together

```
dashboard/            → /config/frame
  frame.yaml          the dashboard: loads every file in templates/ and views/
  templates/          frame.yaml (your household), core.yaml (modules), setup.yaml
  views/              10-home, 20-house, 90-setup (in file name order)
www/frame/            → /config/www/frame: frame.js (runtime), frame.css, weather.js, room.js, assist.js, grain.png, wx/ and countdown/ (pictures)
themes/frame.yaml     → /config/themes
optional/*/           the same layout per module
install.sh            copies all of it
```

## Why a runtime file?

button-card evaluates each template's JavaScript on every render. Frame keeps its shared helpers (formatting, calendar, forecast, history, sparklines, light colours) in `www/frame/frame.js`, loaded once per page. The stylesheet is parsed once and shared by every card instead of being copied into each one. This keeps an older wall iPad responsive with 50+ cards on screen.

## Credits

Built with [Claude Code](https://claude.com/claude-code) running Claude Opus 5.5. Claude wrote the code, the docs and the screenshot tooling together with me, starting from my own Frame dashboard.

The design started from the idea behind [wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard). Type is [Archivo](https://fonts.google.com/specimen/Archivo) and [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif). Icons are [Material Design Icons](https://pictogrammers.com/library/mdi/). The flight card's clouds follow [mrdoob's WebGL clouds](https://mrdoob.com/lab/javascript/webgl/clouds/). The plane, bin and countdown pictures, the children and the skies were generated for this project. The light scenes come from [Hypfer/hass-scene_presets](https://github.com/Hypfer/hass-scene_presets) and are downloaded on install. The screenshots use demo data; the camera and slideshow photos are from [Pexels](https://www.pexels.com/license/) and [Unsplash](https://unsplash.com/license).

## License

MIT, see [LICENSE](LICENSE).
