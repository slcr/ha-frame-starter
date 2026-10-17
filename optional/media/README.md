# Music

![Music](../../docs/screenshots/music.png)

A music page with cover, title, artist, progress, big buttons and volume, plus a mini player for Home that only shows while something plays. List several players and it follows the one that's playing. Tap the speaker name to switch.

## Install

```bash
./install.sh media
```

Set your players in `views/30-media.yaml`:

```yaml
        - type: custom:button-card
          template: frame_media
          variables:
            players: [media_player.living_room, media_player.kitchen]
```

Mini player on Home (`views/10-home.yaml`, the `side` grid):

```yaml
          - type: custom:button-card
            template: frame_media_mini
            variables:
              players: [media_player.living_room, media_player.kitchen]
```

Works with any media player (Sonos, Music Assistant, Spotify, Cast, AirPlay …). Cover art comes from the player.
