# Cameras

![Cameras](../../docs/screenshots/cameras.jpg)

A page with a live tile per camera, played with Home Assistant's own player (WebRTC/HLS) and a still image underneath until the video runs. A red **Motion** badge appears while motion is detected, and the last motion time otherwise. **Tap** for full screen with controls.

## Install

```bash
./install.sh cameras
```

Then list your cameras in `views/50-cameras.yaml`:

```yaml
        - type: custom:button-card
          template: frame_camera
          entity: camera.driveway
          variables:
            name: Driveway
            motion: binary_sensor.driveway_motion
```

| Variable | |
| --- | --- |
| `name` | Label (default: the camera's name) |
| `motion` | Motion binary sensor (optional) |
| `snapshot` | Another camera entity for the still (optional) |
| `live` | `false` = still image only, refreshed every 10 s |

Tiles also work on other pages, e.g. one camera on Home.
