# Modules

Every module is a button-card template. Use one like this:

```yaml
- type: custom:button-card
  template: frame_light
  entity: light.kitchen        # when the module takes an entity
  variables:
    name: Kitchen
    icon: mdi:countertop-outline
```

These are the core modules in `templates/core.yaml`. The [optional modules](../optional/) document theirs in their READMEs.

All modules inherit from `frame`, so the household settings (`people`, `calendars`, `weather`, `text`) are available everywhere. Sizes come from the layout: put modules in a `custom:grid-layout` and give the rows a height (`grid-auto-rows: 72px`) or let the module fill its grid area.

## Household (`frame`)

Set these once in `templates/frame.yaml`:

| Variable | |
| --- | --- |
| `people` | `[{id, name, person, color, ink}]`. `person` is a `person.*` entity; `color` is the avatar and event colour; `ink` is the text colour on it. |
| `family` | Colour and icon for events that belong to everyone (`id: family`). |
| `calendars` | `[{entity, who}]`. `who` is a person `id`, `family` or a category `id`. |
| `categories` | More event colours without a person, e.g. `{id: holidays, name: Holiday, color: "#7A756B", ink: "#FFFFFF", icon: mdi:flag-variant}` |
| `weather` | A `weather.*` entity with an hourly forecast |
| `wear` | `{winter: 0, coat: 6, jacket: 12, light: 17, sweater: 22}`: the outfit changes below these feels-like temperatures (°C, the lowest of the next 12 daytime hours) |
| `gusts_from` | 50: gusts from this many km/h count as windy (a hint, the wind pictures, warnings in the weather window) |
| `menu_pages` | `[energy]`: view paths that live in the clock menu (tap the small clock in the rail) instead of the rail |
| `ask` | Adds **Ask** to the rail: Assist in Frame style, big enough to read from across the room. `{pipeline, speaker?, tts?, voice?, language?, volume?}`: `pipeline` is the id of an Assist pipeline (Settings → Voice assistants, the id is in the URL; default: the last one used). With `speaker`, every answer is also read out there (`tts` default `tts.home_assistant_cloud`, `volume` 0–100 on Sonos). Questions and answers stay on the device for 24 hours. |
| `cover_travel` | `{cover.x: seconds}` for covers that don't report their position while moving |
| `text` | Override any UI string (see [customizing.md](customizing.md#language)) |
| `flights` | Switches on [optional/flights](../optional/flights/) |
| `timer` | Switches on [optional/timer](../optional/timer/) |
| `scenes` | Switches on [optional/scenes](../optional/scenes/) |

## Today

### `frame_rail`
The navigation. Place it in the `rail` area of each view. It lists every view of the dashboard with its `title` and `icon`, in file name order; views with `visible: false` are left out.

The small clock at the bottom opens a menu: the pages from `menu_pages` (household settings), for the ones you rarely need, and Home Assistant's settings (the profile for non-admins). With `ask:` set, **Ask** sits above the clock.

| Variable | Default | |
| --- | --- | --- |
| `pages` | (the views) | `[{path, label, icon}]` to list your own instead. `path` is the view's `path`. |
| `active` | from the URL | Force the highlighted page |

### `frame_clock`
Big time and date. Follows the 12/24-hour setting of the user's profile.

Next to it stand two children dressed for today's weather, painted for this project: winter coat, warm coat, jacket, light jacket, long sleeves or T-shirt, with umbrellas in the rain, hats in the sun, snow and wind variants. The outfit is the same one `frame_weather` writes out (see `wear` above). With [optional/timer](../optional/timer/), tapping the clock opens the kitchen timer.

| Variable | Default | |
| --- | --- | --- |
| `figures` | true | `false` hides the children |

To use your own pictures, put them in `www/frame/wx/` under the same names (transparent WebP, cropped head to hip; the existing ones are 800 × 609). The list is in [`www/frame/wx/README.md`](../www/frame/wx/README.md).

### `frame_weather`
Current temperature and condition, today's high/low, "feels like", six 2-hour slots for the next 12 hours (temperature line, rain probability bars) and a hint: *Light jacket. Rain from 20:00.* The clothing follows the feels-like temperature (`wear` above); after it come rain, snow or thunderstorms, strong gusts or sunscreen (UV 6 and up).

**Tap it for the weather window:** the parts of the day ahead (this afternoon, this evening …) with their range, rain and gusts, the next 24 hours to swipe through, the next days as low-to-high bars, and today's sunrise, sunset, rain, wind, gusts and UV index. The head sits on a painted sky that matches the weather and the time of day ([`www/frame/wx/sky`](../www/frame/wx/sky/)). The window uses the daily forecast too when the integration has one; values an integration doesn't provide (gusts, UV) are left out.

| Variable | Default | |
| --- | --- | --- |
| `entity` | `weather` from `frame` | Any weather entity |

### `frame_people`
Everyone in `people` with a `person` entity. People who are away get a ring avatar and their zone. No options.

### `frame_next`
The next timed event from `calendars`, in its person's colour, with a countdown: minutes until it starts (under 100), the start time otherwise, or minutes left while it runs. Today's all-day events appear as chips at the bottom. No options.

### `frame_countdown`
The next birthday or holiday with a painted picture (cake, tree, eggs, school bag) and the days to go; tap it for the next ones. A birthday gets the colour of the person with that name in `people`.

| Variable | Default | |
| --- | --- | --- |
| `birthdays` | `[]` | `[{name, date}]`; `date` is `YYYY-MM-DD` (shows the age) or `MM-DD` |
| `holidays` | `[christmas, easter]` | Built in: `christmas` (25 Dec), `christmas_eve` (24 Dec), `easter` (Easter Sunday), `new_year` |
| `holiday_calendar` | | A calendar with school holidays as all-day events: the next one, with how many days off, while there are none right now |
| `dates` | `[]` | Anything else: `[{name, date, icon?, sub?}]`; `MM-DD` every year, `YYYY-MM-DD` once |
| `count` / `more` | 1 / 6 | Rows shown, and how many more a tap reveals |
| `pics` | | Pictures by icon (`www/frame/countdown/`); other icons show in a square |

### `frame_agenda`
The next 7 days grouped by day. Multi-day events show "until …".

| Variable | Default | |
| --- | --- | --- |
| `max` | 14 | Most events to show (the list fades out at the bottom) |

## House

### `frame_heading`
| Variable | |
| --- | --- |
| `title` | Bold, uppercase |
| `sub` | Serif addition, optional |

### `frame_scene`
A tile that runs a `scene.*` or `script.*` (the `entity`) when tapped, and shows whether it's "active".

| Variable | Default | |
| --- | --- | --- |
| `name`, `icon` | | |
| `kind` | `scene` | `scene`: sub line shows when it last ran. `on`: dark while all `lights` are on, else "2 of 4 on". `off`: dark while all `lights` are off. `open` / `close`: dark while all `covers` are open / closed. |
| `lights` | `[]` | Lights for `on` / `off` |
| `covers` | `[]` | Covers for `open` / `close` |
| `sub` | | Fixed sub line |

### `frame_light`
Tap toggles, dragging sideways dims, holding opens Home Assistant's light dialog. The tile fills up to the brightness, in a soft mix of the colours of the lamps that are on.

| Variable | |
| --- | --- |
| `entity` | A light or a light group (the group's members give the colours) |
| `area` | Instead of `entity`: an area id. The tile stands for every light in that area (using the device's area if the light has none; groups, hidden and config entities are skipped). Dragging dims them all; a **tap opens the room window**: every lamp as its own row (tap, drag, hold work the same), and a lamp's round icon opens its colours: white levels in its range and a palette by hue. With [optional/scenes](../optional/scenes/) the window gets tabs with scene pictures. |
| `name`, `icon` | |

### `frame_cover`
A blind as a slider: left is closed, right is open. Drag or tap to set the position (in steps of 5, snapping to the ends), applied when you let go. Tapping while it moves stops it; holding opens the cover dialog.

| Variable | Default | |
| --- | --- | --- |
| `entity` or `covers` | | One cover, or a list that always moves together |
| `name` | Blind | |
| `branch` | `none` | Draws a line from the light tile on the left: `only`, `first`, `mid`, `last`. Put the light with `view_layout: {grid-row: span N}` next to N covers. |

### `frame_lock`
| Variable | |
| --- | --- |
| `entity` | `lock.*` |
| `door` | `binary_sensor` door contact (optional): "Door open" |
| `battery` | `binary_sensor` battery low (optional): a pill |
| `name` | Label, default "Front door" |

The block turns warm when the lock is unlocked or the door is open. Tapping it opens the lock dialog.

### `frame_openings`
"All closed", or how many are open, with names and how long. Tap it for when each was opened, or today's openings when everything's closed.

| Variable | Default | |
| --- | --- | --- |
| `entities` | every `binary_sensor` with device class door, window or garage_door | The contacts to watch |
| `title` | Windows & doors | |

### `frame_rooms`
Climate tiles: big temperature, humidity in blue, the last 24 hours as a sparkline behind (temperature as an area, humidity as a line). An orange frame and flame while the room's `climate` is heating. Tap a tile for low, high, 3-hour trend and target.

| Variable | Default | |
| --- | --- | --- |
| `rooms` | | `[{name, temp, hum?, climate?}]` |
| `columns` | 2 | |
| `hours` | 24 | |
| `min_span` / `hum_min_span` | 2 / 10 | Smallest y-range so sensor noise stays flat |

Sensors need long-term statistics (`state_class: measurement`).

### `frame_stats`
Big numbers in a card. Hidden when no value is available.

| Variable | Default | |
| --- | --- | --- |
| `title` | | |
| `cols` | 3 | |
| `items` | | `[{label, entity, decimals?, scale?, unit?, warn_above?, warn_below?}]`. `scale`/`unit` convert, e.g. W → kW with `scale: 0.001, unit: kW`. Values past the limits turn red. |

## Onboarding

### `frame_setup`
The Setup page: install checks, entities in this dashboard that don't exist (with likely matches), and a YAML generator. No options. Remove it when you're done.
