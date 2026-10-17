# Planes overhead

![A plane over Home](../../docs/screenshots/home-plane.png)

When the [Flightradar24 integration](https://github.com/AlexandrErohin/home-assistant-flightradar24) sees an aircraft near you, a plane flies across the whole screen in its real direction (north is up), as far off-centre as it passes your home. It stays for as long as you'd see it in the sky. Jets, small planes, freighters and helicopters (with a spinning rotor) each have their own picture, and the shadow gets softer the higher they fly.

The tag next to it shows flight and route. **Tap it** for the flight card: route with progress, times, delay, aircraft, altitude and speed, over a flight through the clouds behind that aircraft (WebGL; without it, a plain backdrop).

![Flight card](../../docs/screenshots/flight-card.jpg)

## Install

1. Install **Flightradar24** from HACS and add it (Settings → Devices & services). Set a small radius around your home, e.g. 5000 m.
2. `./install.sh flights`
3. In `templates/frame.yaml`, uncomment `flights:` and set the same radius in km:

```yaml
    flights:
      entity: sensor.flightradar24_current_in_area
      radius_km: 5
```

Reload. To test without waiting for a plane, open the browser console on the dashboard and run:

```js
__frameFly({ heading: 250, flight_number: "LH123", altitude: 35000, ground_speed: 450 })
```

## Options (`flights:`)

| | Default | |
| --- | --- | --- |
| `entity` | `sensor.flightradar24_current_in_area` | |
| `radius_km` | 5 | As set in the integration |
| `min_elevation` | 20 | Degrees above the horizon that count as "visible" (sets how long a plane stays) |
| `max_at_once` | 3 | |
| `pause_on_screensaver` | false | No planes while WallPanel's screensaver runs |

The plane images were generated for this project.
