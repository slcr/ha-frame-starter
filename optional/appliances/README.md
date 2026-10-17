# Appliances

One block for washing machine, dishwasher, dryer, robot vacuum … that only shows while one runs (ice blue, with time left or progress) or has finished (indigo, with a **Done** button). With a power sensor, the run's power curve is drawn behind its row. Tap a row for Home Assistant's dialog.

![On Home](../../docs/screenshots/home.png)

## Install

```bash
./install.sh appliances
```

Add the card to Home's right column (`views/10-home.yaml`):

```yaml
          - type: custom:button-card
            template: frame_appliances
            variables:
              appliances:
                - entity: sensor.dishwasher_operation_state
                  name: Dishwasher
                  icon: mdi:dishwasher
                  program: select.dishwasher_active_program
                  progress: sensor.dishwasher_program_progress
                  finish: sensor.dishwasher_program_finish_time
                  door: sensor.dishwasher_door
                - entity: binary_sensor.washing_machine_running
                  name: Washing machine
                  icon: mdi:washing-machine
                  power: sensor.washing_machine_plug_power
```

## Per appliance

| | |
| --- | --- |
| `entity` | Its state: a status sensor (Home Connect, Miele, LG ThinQ …), a "running" binary sensor or a smart plug switch |
| `name`, `icon` | |
| `idle` | States that mean "off", if yours differ from the defaults (`off`, `idle`, `ready`, `standby`, `finished`, …) |
| `program` | Entity with the current program |
| `progress` / `finish` / `remaining` | % done / end time / minutes or `H:MM` left: whichever you have |
| `power` | Power sensor (W) for the curve |
| `door` | Opening the door clears "finished" |
| `done_hours` | How long "finished" stays (default 3, at most 12) |
| `no_done` | `true` never shows "finished" (vacuums, sprinklers) |

No smart appliance? A smart plug plus a template binary sensor ("power above 5 W") makes any machine work.
