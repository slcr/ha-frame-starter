# Kitchen timer

![Kitchen timer](../../docs/screenshots/timer.png)

Tap the big clock on Home for a kitchen timer. The time left shows big inside a dial: drag the ring to set the time (one turn is 60 minutes, keep turning for more), or tap a preset to start right away. While it runs the arc shrinks, and you can pause, stop or add a minute or five.

The timer runs in Home Assistant, not in the browser. It rings even when the tablet sleeps or the page reloads, and every device showing Frame sees the same timer. When it's done, the window opens by itself on every one of them, and the chosen sound plays on your speakers at full volume as an announcement, so the music carries on afterwards. "This device" rings in the browser too. With the window closed, a small floating bar shows the time left; drag it anywhere.

## Install

1. `./install.sh timer`. This also copies `packages/frame_timer.yaml` into `/config/packages/`.
2. If you don't use packages yet, add this to `configuration.yaml` and restart Home Assistant:

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

3. In `templates/frame.yaml`, uncomment `timer:` and list the speakers it may ring on:

   ```yaml
       timer:
         speakers:
           - entity: media_player.kitchen
             name: Kitchen
   ```

Reload, tap the clock. Which speakers ring is chosen in the timer window and kept in `input_text.frame_timer_speakers`.

The browser only plays sound after the page was touched once (autoplay rules), and iOS plays it at the tablet's own volume.

## Options (`timer:`)

| | Default | |
| --- | --- | --- |
| `speakers` | `[]` | `[{entity, name}]` media players to choose from. Announcements with a volume work on Sonos; other players play the sound at their current volume, if they support announcements. |
| `presets` | Tea 4, Soft egg 6, Bread rolls 8, Hard egg 10, Pasta 11, Pizza 12, Rice 20, Potatoes 25 | `[{name, min, icon}]`, `icon` is an emoji |

All words can be changed with `text:` in the household settings, like Frame's own. The keys are at the top of `www/frame/timer.js`.

## Sounds

Gong, bells, a kitchen ringer, beeps, marimba and an alarm, about 3 seconds each, synthesised for this project. Add your own: put `<name>.mp3` into `www/frame/timer/`, add the name to the options of `input_select.frame_timer_sound` and to `SOUNDS` in `timer.js`.
