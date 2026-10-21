# Weather pictures

## Children (`frame_clock`)

Two children dressed for the day, chosen by `fx.outfit` in `frame.js` from the feels-like temperature of the next 12 daytime hours (thresholds: `wear` in `templates/frame.yaml`). A weather variant comes first when there is one; when a file is missing the plain outfit is used, then none.

| Outfit | Feels like (°C) | Variants |
| --- | --- | --- |
| `winter` | below 0 | `winter-rain`, `winter-snow` |
| `warm` | 0–6 | `warm-rain` |
| `jacket` | 6–12 | `jacket-rain`, `jacket-wind` |
| `light` | 12–17 | `light-rain`, `light-wind` |
| `longsleeve` | 17–22 | `longsleeve-rain`, `longsleeve-sun` |
| `tshirt` | 22 and up | `tshirt-rain`, `tshirt-sun` |

`-rain` when rain is expected, `-wind` with gusts from `gusts_from` (no umbrella in strong wind or thunderstorms), `-snow` for snow, `-sun` for UV 6 and up before 16:00 without rain.

To use your own: transparent WebP, cropped from the head to about the hip, standing on the bottom edge. These are 800 × 609 (the top 780 px of a 1024 × 1536 portrait). Bump `?v=` of the frame.js resource after replacing one.

## Skies (`sky/`)

Behind the head of the weather window (`weather.js`), named after Home Assistant's weather conditions: `sunny`, `clear-night`, `partlycloudy`, `partlycloudy-night`, `cloudy`, `cloudy-night`, `fog`, `rainy`, `rainy-night`, `pouring`, `lightning`, `snowy`, `snowy-rainy`, `windy`. `lightning-rainy` and `exceptional` use `lightning`, `hail` uses `snowy-rainy`, `windy-variant` uses `windy`. At night, conditions without a `-night` picture use the day picture darkened.

1536 × 1024, sky only with a low treeline at the bottom; the top of the picture sits behind the title. Try one in the browser console: `window.__frameWxSky = 'rainy'` (`null` follows the weather again).

All pictures were generated for this project.
