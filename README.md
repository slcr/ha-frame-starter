# Frame — a wall dashboard for Home Assistant

A calm, paper-and-ink dashboard for a tablet on the wall. A big clock, the weather and what to wear, who's home, the next event with a countdown and your week, plus lights, blinds, locks, windows and room climate, all readable from across the room.

It's built from [button-card](https://github.com/custom-cards/button-card) templates and [layout-card](https://github.com/thomasloven/lovelace-layout-card), with a small shared runtime. A **Setup page** checks your install, finds the example entities you still need to replace and writes the YAML for you from your own Home Assistant.

![Home on a 12.9" iPad](docs/screenshots/home.png)

## What's in the box

| | |
| --- | --- |
| ![House](docs/screenshots/house.png) | **House:** scenes that show their state ("2 of 4 on"), light tiles in the colours of the lamps that are on (tap toggles, drag dims, hold for details), blinds as sliders, a lock, open windows and doors, and room climate with 24-hour sparklines. |
| ![Tap a climate tile](docs/screenshots/house-details.png) | **Tap for details:** climate tiles show the day's low and high, the 3-hour trend and the target temperature. Sparklines show values on touch. |
| ![Dimming a light](docs/screenshots/light-dimming.png) | **Drag to dim:** the fill follows your finger and the level is set when you let go. Blinds work the same way. |
| ![Setup](docs/screenshots/setup.png) | **Setup page:** checks resources, fonts, theme and weather, then lists every entity in the dashboard that doesn't exist in your Home Assistant yet, with likely matches. |
| ![YAML generator](docs/screenshots/setup-generator.png) | **YAML generator:** people, calendars, lights by area, covers, climate, scenes and contacts, built from what your Home Assistant already has. Copy, paste, done. |

It works on phones too. Under 768 px everything becomes one scrolling column and the rail turns into a top bar.

<p>
  <img src="docs/screenshots/phone-home.png" width="260" alt="Home on a phone">
  <img src="docs/screenshots/phone-house.png" width="260" alt="House on a phone">
</p>

## Modules

| Template | What it shows |
| --- | --- |
| `frame_rail` | Navigation rail (left on tablets, top bar on phones) with a small clock |
| `frame_clock` | Big clock and date |
| `frame_weather` | Current weather, high/low, next 12 hours in 2-hour steps, what to wear and when rain starts |
| `frame_people` | Who's home, and the zone for everyone else |
| `frame_next` | The next calendar event in its person's colour, with a countdown |
| `frame_agenda` | The next 7 days, grouped by day |
| `frame_scene` | Scene or script button that knows when it's active |
| `frame_light` | Light, light group or a whole area, in the colours of the lamps |
| `frame_cover` | Blind as a slider, optionally connected to its room's light |
| `frame_lock` | Lock with door contact and battery warning |
| `frame_openings` | Open windows and doors, and how long they've been open |
| `frame_rooms` | Temperature and humidity tiles with sparklines and heating state |
| `frame_stats` | Big numbers for energy, air quality or any other sensor |
| `frame_heading` | Section heading |
| `frame_setup` | The onboarding page |

[docs/modules.md](docs/modules.md) lists every option.

## Quick start

You need Home Assistant 2024.4 or newer, [HACS](https://hacs.xyz) with **button-card** and **layout-card**, and optionally **kiosk-mode** to hide the header and sidebar.

1. Copy `www/frame` to `/config/www/frame`, `dashboard` to `/config/frame` and `themes/frame.yaml` to your themes folder.
2. Register the dashboard in `configuration.yaml` and add two resources: `/local/frame/frame.js?v=1` and the Google Fonts stylesheet.
3. Restart Home Assistant, open **Frame** in the sidebar and go to **Setup**.

The full walkthrough, including copy-paste snippets and a one-line install over SSH, is in [docs/getting-started.md](docs/getting-started.md).

## Make it yours

- **Your household:** `people`, `calendars` and `weather` live at the top of `dashboard/templates.yaml`. The Setup page generates them for you.
- **Your rooms:** edit `dashboard/views/*.yaml` and paste in the cards the Setup page writes.
- **Colours, fonts, language and your own modules:** see [docs/customizing.md](docs/customizing.md). Dates and numbers already follow your Home Assistant locale, and every UI string can be overridden.

## Why a runtime file?

button-card evaluates each template's JavaScript on every render. Frame keeps its shared helpers (formatting, calendar, forecast, history, sparklines, light colours) in `www/frame/frame.js`, loaded once per page. The stylesheet is parsed once and shared by every card instead of being copied into each one. This keeps an older wall iPad responsive with 50+ cards on screen.

## Credits

The design started from the idea behind [wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard). Type is [Archivo](https://fonts.google.com/specimen/Archivo) and [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif). Icons are [Material Design Icons](https://pictogrammers.com/library/mdi/). The screenshots use demo data.

## License

MIT, see [LICENSE](LICENSE).
