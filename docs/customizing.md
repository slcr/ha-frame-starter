# Customizing

## Colours

The palette is defined twice, once for the cards and once for Home Assistant itself:

- `www/frame/frame.css`: the `:host { --paper … }` block at the top. The cards use these.
- `themes/frame.yaml`: Home Assistant's own colours (page background, dialogs, cards that aren't Frame cards).

Change both, bump `?v=` on the `frame.js` resource, run `frontend.reload_themes` and reload the page.

| Variable | Used for |
| --- | --- |
| `--paper` | Page background |
| `--card` | Tiles and blocks |
| `--paper-2` | Icon circles, subtle fills |
| `--ink`, `--ink-2`, `--mute` | Text, from strong to quiet |
| `--line` | Dividers, branch lines |
| `--warm`, `--warm-2` | "Needs attention" (open window, unlocked door) |
| `--alert` | Red numbers past a limit, "Now" |
| `--wet` | Rain and humidity |

People and event colours are in `people`, `family` and `categories` in `templates.yaml`.

## Fonts

Archivo (a variable-width grotesque; the numbers use its narrow 62 % width) and Instrument Serif come from Google Fonts. To use others, change `--sans` and `--serif` in `frame.css` and the resource URL. Self-hosting works too: put the files in `www/frame/fonts/` and point a CSS resource with `@font-face` rules at them.

## Language

Dates, times and numbers follow the language and formats in the user's Home Assistant profile. Weather conditions and entity states ("Locked", "Home") come from Home Assistant's own translations.

Frame's own words are in `TEXT` at the top of `www/frame/frame.js`. Override any of them in `templates.yaml`, without touching the runtime:

```yaml
frame:
  variables:
    text:
      today: Heute
      tomorrow: Morgen
      up_next: Als Nächstes
      min_left: Min übrig
      rain_from: Regen ab {0}.
      wear_jacket: Jacke.
```

Labels you write yourself (headings, names, `pages`) are plain YAML.

## Adding a page

1. Copy `views/house.yaml` to `views/garden.yaml` and change `title` and `path`.
2. Add it to `frame.yaml`: `- !include views/garden.yaml`
3. Add it to the rail in `templates.yaml`, under `frame_rail` → `pages`:
   ```yaml
   - path: garden
     label: Garden
     icon: mdi:flower-outline
   ```

Every view uses the same frame: a `custom:grid-layout` with the rail in the first column (88 px) and a main area. Inside the main area, columns are `custom:layout-card`s.

## Writing your own module

A module is a template that inherits from `frame` and returns HTML into the `body` field. `variables.fx` holds the helpers:

```yaml
frame_battery:
  template: frame
  variables:
    title: Phone
  custom_fields:
    body: |
      [[[
        const fx = variables.fx;
        if (!fx) return '';
        const n = fx.num(entity.entity_id, 0);
        const low = n && n.raw < 20;
        return `<div class="blk${low ? ' blk--warn' : ''}"><div class="blk-row">
          <span class="blk-ico${low ? ' is-warn' : ''}"><ha-icon icon="mdi:battery"></ha-icon></span>
          <span class="blk-main"><span class="label">${fx.esc(variables.title)}</span>
            <span class="blk-big">${n ? n.v + ' %' : '–'}</span></span>
        </div></div>`;
      ]]]
```

Useful helpers (all in `www/frame/frame.js`):

| Helper | |
| --- | --- |
| `fx.esc(s)` | Escape text for HTML. Use it for anything that comes from Home Assistant. |
| `fx.t(key, …args)` | A UI string, with overrides from `text` |
| `fx.num(id, decimals)` | `{raw, v, unit}` in the user's number format, or `null` |
| `fx.fmt(id)` | The state as Home Assistant displays it |
| `fx.ok(id)` | Exists and isn't unknown or unavailable |
| `fx.time(d)`, `fx.weekday(d)`, `fx.dateLong(d)`, `fx.dayLabel(d)`, `fx.when(d)`, `fx.dur(ms)` | Dates in the user's locale |
| `fx.person(id)`, `fx.avatar(p, size)`, `fx.pstyle(p)` | People and their colours |
| `fx.agenda(days)` | Events from `calendars` |
| `fx.forecast(id, 'hourly' / 'daily')` | Forecast via `weather.get_forecasts` |
| `fx.hist(ids, hours, maxAgeMin, period, types)` | Long-term statistics |
| `fx.changes(ids, hours)` | State history |
| `fx.spark(rows, hours, opt)` | An SVG sparkline from statistics rows |
| `fx.more(title, rows)` + `fx.tapAttr(key)` + `fx.isOpen(key)` | The dark tap-for-details overlay |

Data helpers cache for the whole page and redraw the card when new data arrives. They return what's cached right away, so the first render may be empty.

Building blocks in `frame.css` you can reuse: `.blk` (card), `.blk-row` / `.blk-ico` / `.blk-main` / `.blk-big` (icon + label + big serif value), `.blk--warn`, `.label`, `.num`, `.chips` / `.chip`, `.st-grid` / `.st` (big numbers), `.sec` (heading).
