# Energy page

![Energy](../../docs/screenshots/energy.png)

Reads the sources you set up in Home Assistant's energy dashboard (**Settings → Dashboards → Energy**): grid in and out, solar, battery, cost. No sensor lists needed.

- **Top:** using now, solar now, grid today (with cost), self-sufficient %. Tap a tile for details.
- **Energy today / Last 30 days:** consumption per hour or day. The yellow part came from solar or battery.
- **Electricity price:** per hour, today and tomorrow; the cheapest coming hours are green, the most expensive red.
- **Power:** any sensor as a chart.

## Install

```bash
./install.sh energy
```

Then open `views/40-energy.yaml` and set:

- `power` / `solar_power`: live power sensors in W (optional; without them the tiles show today's totals), `solar_max`: your solar peak in W.
- `frame_prices` → `entity`: a price sensor whose attributes hold the prices. Nord Pool (`raw_today`/`raw_tomorrow`), EPEX Spot (`data`), Tibber-style `today`/`tomorrow` lists and `prices: [{start, price}]` work. Quarter hours are averaged. `scale: 100` and `unit: ct` show EUR/kWh as cents; change them for other currencies.
- `frame_chart` → `entity`: any sensor with statistics.

## Templates

| Template | |
| --- | --- |
| `frame_energy` | `power`, `solar_power`, `solar_max` |
| `frame_energy_bars` | `period: hour` (today) or `day` with `days: 30`, `title` |
| `frame_chart` | `kind: area` (with `period: 5minute`, `hours`) or `bars` (with `period: day`/`month`, `days`, `stat: change` for meters), `scale`, `unit`, `decimals` |
| `frame_prices` | `entity`, `scale`, `unit`, `decimals`, `cheap` (how many hours are marked) |
