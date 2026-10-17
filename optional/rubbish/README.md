# Rubbish collection

![On Home](../../docs/screenshots/home.png)

The next pickups from a calendar, each day with a painted bin. On the evening before (and on the morning of the pickup), the block turns indigo with **Put out tonight** and a **Done** button.

## Install

1. A calendar with your pickups. [Waste Collection Schedule](https://github.com/mampfes/hacs_waste_collection_schedule) (HACS) covers many cities; a Local calendar you fill in yourself works too.
2. `./install.sh rubbish`
3. Add the card to Home's right column (`views/10-home.yaml`, the `side` grid):

```yaml
          - type: custom:button-card
            template: frame_bins
            variables:
              calendar: calendar.waste_collection
```

## Options (`frame_bins`)

| Variable | Default | |
| --- | --- | --- |
| `calendar` | `calendar.waste_collection` | |
| `bins` | general, recycling, paper, garden, hazardous | `[{match, label, color, img?, icon?, out?}]`. `match` is text in the event title (any case); `img` a picture (bins in `www/frame/bins`: grey, yellow, blue, hazardous), else `icon` or a drawn bin in `color`; `out: false` for things you don't put out. |
| `groups` | 2 | How many pickup days to show |
| `days` | 21 | How far ahead to look |
| `out_until` | 8 | A pickup counts until this hour on its day |
| `done_helper` | | An `input_datetime` to share "Done" between devices (else it's per device) |

The bin pictures were generated for this project.
