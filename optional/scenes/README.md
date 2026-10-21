# Scenes

![Scenes](../../docs/screenshots/room-scenes.png)

Scene pictures in the room window. Tap a light tile that has `area:` and the window lists every lamp of the room. With this module it also gets tabs next to "Lamps":

- **Scenes:** white light (Bright, Read, Relax …), everyday, morning, evening and calm scenes as picture tiles. A tap spreads the scene's colours over the room's lamps, shuffled every time, so tapping again gives a new mix. Lamps that only do white get the matching colour temperature.
- **Special:** Halloween, winter holidays, party, neon & space and romance. These are dynamic: the colours slowly move from lamp to lamp until you pick something else, switch everything off, or something else gives a lamp a colour.

Tap a lamp's round icon for its own colours: white levels in its range, a palette by hue, and the same scenes for just that lamp.

The scenes and their pictures come from the Hue gallery, by way of [Hypfer/hass-scene_presets](https://github.com/Hypfer/hass-scene_presets). Frame doesn't ship the pictures; `scenes.py` downloads them once.

## Install

1. Get the scenes (Python 3, nothing else to install; about 10 MB):

   ```bash
   python3 optional/scenes/scenes.py
   ```

2. `./install.sh scenes`. This copies the pictures to `/config/www/frame/scenes/` and `packages/frame_scenes.yaml` into `/config/packages/`.
3. For the dynamic scenes, packages must be on in `configuration.yaml` (then restart Home Assistant):

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

   Without the package the Special tab is left out; everything else works.
4. In `templates/frame.yaml`, uncomment `scenes: true`. Reload.

## Your own choice

The tabs, groups, scenes and their names are in `TABS` at the top of `scenes.py`; the library has 146 scenes. Run it again after a change (`-f` downloads every picture again), then `./install.sh scenes` and bump `?v=` of the frame.js resource.
