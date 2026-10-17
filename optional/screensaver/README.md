# Screensaver

![Screensaver](../../docs/screenshots/screensaver.jpg)

A photo slideshow when nobody touches the screen, with Frame's clock on top: big time, date, the weather and the next event of the day. Tap to wake.

## Install

1. Install **WallPanel** from HACS.
2. `./install.sh screensaver`
3. Put your photos in a media folder, e.g. `/media/frame` (Media → Local media).
4. Add this to `frame.yaml`, next to `kiosk_mode:`:

```yaml
wallpanel:
  enabled: true
  idle_time: 120            # seconds without a touch
  fade_in_time: 3
  crossfade_time: 2
  display_time: 10
  image_url: media-source://media_source/local/frame
  media_order: random
  image_fit_landscape: cover
  image_fit_portrait: contain
  image_background: image
  show_image_info: false
  screensaver_start_navigation_path: /dashboard-frame/home
  cards:
    - type: custom:button-card
      template: frame_screensaver
      wp_style:
        width: 100vw
        height: 100vh
        margin: 0
```

Add `?wp_enabled=false` to the URL while you work on the dashboard. All WallPanel options are in its [README](https://github.com/j-a-n/lovelace-wallpanel).
