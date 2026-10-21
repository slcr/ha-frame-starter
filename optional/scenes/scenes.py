#!/usr/bin/env python3
"""Light scenes for the room window (optional/scenes): picks scenes from a scene library and writes
www/frame/scenes/scenes.json (tabs -> groups -> scenes) with a picture per scene next to it.

Source: github.com/Hypfer/hass-scene_presets (Apache-2.0), the Hue gallery scenes with picture and palette
(CIE xy, brightness 0-254). Pinned to one commit so nothing changes unnoticed. The pictures are downloaded here,
not shipped with Frame. Standard library only; downloads only what is missing (-f: everything).

    python3 optional/scenes/scenes.py [-f] [output folder]

The choice and order are in TABS below. A group with `dyn` (seconds per colour step) is dynamic: the colours
slowly move between the lamps (needs packages/frame_scenes.yaml). 'K' groups are white light: lamps with only a
colour temperature get the Kelvin on the tile. ('K', <kelvin>, <name>) adds a white level the library doesn't have.
"""
import json
import os
import sys
import urllib.request

REPO = 'https://raw.githubusercontent.com/Hypfer/hass-scene_presets/b53280c76f6a94ea68f313c53865c3922d40b2d7'
SRC = REPO + '/custom_components/scene_presets/'
HERE = os.path.dirname(os.path.abspath(__file__))

# (tab key, tab name, [(group name, dyn, [(library category, library name, name on the tile)])])
TABS = [
    ('scenes', 'Scenes', [
        ('White light', 'K', [
            ('Defaults', 'Bright', 'Bright'), ('Defaults', 'Read', 'Read'), ('K', 3500, 'Neutral'),
            ('Defaults', 'Concentrate', 'Concentrate'), ('Defaults', 'Energize', 'Energize'), ('Defaults', 'Relax', 'Relax'),
            ('Defaults', 'Rest', 'Rest'), ('Defaults', 'Dimmed', 'Dimmed'),
        ]),
        ('Everyday', None, [
            ('Daily', 'Arise', 'Arise'), ('Daily', 'Storybook', 'Storybook'), ('Daily', 'Unwind', 'Unwind'), ('Daily', 'Sleepy', 'Sleepy'),
        ]),
        ('Morning', None, [
            ('Sunrise', 'First light', 'First light'), ('Sunrise', 'Horizon', 'Horizon'), ('Sunrise', 'Valley dawn', 'Valley dawn'),
            ('Peaceful', 'Sunday morning', 'Sunday morning'), ('Dreamy', 'Majestic morning', 'Majestic morning'),
            ('Peaceful', 'Lake mist', 'Lake mist'), ('Peaceful', 'Mountain breeze', 'Mountain breeze'), ('Pure', 'Hazy days', 'Hazy days'),
            ('Pure', 'Misty ridge', 'Misty ridge'), ('Pure', 'Spring lake', 'Spring lake'), ('Peaceful', 'Emerald isle', 'Emerald isle'),
            ('Refreshing', 'Blossom', 'Blossom'),
        ]),
        ('Evening', None, [
            ('Cozy', 'Warm embrace', 'Warm embrace'), ('Cozy', 'Savanna sunset', 'Savanna sunset'), ('Cozy', 'Golden pond', 'Golden pond'),
            ('Cozy', 'Rolling hills', 'Rolling hills'), ('Cozy', 'Dreamy dusk', 'Dreamy dusk'), ('Dreamy', 'Sundown', 'Sundown'),
            ('Pure', 'Autumn gold', 'Autumn gold'), ('Rustic', 'Amber robin', 'Amber robin'), ('Rustic', 'Pumpkin spice', 'Pumpkin spice'),
            ('Rustic', 'Fall harvest', 'Fall harvest'), ('Lush', 'Orange fields', 'Orange fields'), ('Lush', 'Painted sky', 'Painted sky'),
        ]),
        ('Calm', None, [
            ('Dreamy', 'Still waters', 'Still waters'), ('Dreamy', 'Adrift', 'Adrift'), ('Dreamy', 'Pensive', 'Pensive'),
            ('Dreamy', 'Lake Placid', 'Lake Placid'), ('Serenity', 'Moonlight', 'Moonlight'), ('Serenity', 'Arctic aurora', 'Arctic aurora'),
            ('Dreamy', 'November haze', 'November haze'), ('Winter whisper', 'Among the pines', 'Among the pines'),
        ]),
    ]),
    ('special', 'Special', [
        ('Halloween', 8, [
            ('Halloween', 'Witching hour', 'Witching hour'), ('Halloween', 'Glowing grins', 'Glowing grins'),
            ('Halloween', 'Trick or treat', 'Trick or treat'), ('Halloween', 'Spellbound', 'Spellbound'),
            ('Halloween', 'Hocus pocus', 'Hocus pocus'), ('Halloween', 'Toil and trouble', 'Toil and trouble'),
            ('Halloween', 'Pandemonium', 'Pandemonium'), ('Halloween', 'Phantom', 'Phantom'),
        ]),
        ('Winter holidays', 12, [
            ('Winter holidays', 'Under the tree', 'Under the tree'), ('Winter holidays', 'Silent night', 'Silent night'),
            ('Winter holidays', 'Golden star', 'Golden star'), ('Winter holidays', 'Snow sparkle', 'Snow sparkle'),
            ('Winter holidays', 'Nutcracker', 'Nutcracker'), ('Winter holidays', 'Jolly', 'Jolly'),
            ('Winter holidays', 'Festive fun', 'Festive fun'), ('Winter holidays', 'Color burst', 'Color burst'),
            ('Winter holidays', 'Crystalline', 'Crystalline'), ('Winter holidays', 'Rosy sparkle', 'Rosy sparkle'),
            ('Winter whisper', 'Snow capped', 'Snow capped'), ('Lush', 'Winter beauty', 'Winter beauty'),
        ]),
        ('Party', 5, [
            ('Party vibes', 'Miami', 'Miami'), ('Party vibes', 'Ibiza', 'Ibiza'), ('Party vibes', 'Rio', 'Rio'),
            ('Party vibes', 'Cancun', 'Cancún'), ('Party vibes', 'Tokyo', 'Tokyo'), ('Party vibes', 'Osaka', 'Osaka'),
            ('Party vibes', 'Chinatown', 'Chinatown'), ('Party vibes', 'Motown', 'Motown'), ('Party vibes', 'Fairfax', 'Fairfax'),
            ('Vibrant', 'Summer splash', 'Summer splash'), ('Vibrant', 'Juicy watermelon', 'Juicy watermelon'),
            ('Vibrant', 'Fruity popsicle', 'Fruity popsicle'),
        ]),
        ('Neon & space', 6, [
            ('Futuristic', 'Vapor wave', 'Vapor wave'), ('Futuristic', 'Soho', 'Soho'), ('Futuristic', 'Tyrell', 'Tyrell'),
            ('Futuristic', 'Magneto', 'Magneto'), ('Futuristic', 'Disturbia', 'Disturbia'), ('Futuristic', 'Hal', 'Hal'),
            ('Serenity', 'Galaxy', 'Galaxy'), ('Serenity', 'Nebula', 'Nebula'), ('Serenity', 'Starlight', 'Starlight'),
            ('Serenity', 'Blood moon', 'Blood moon'), ('Luxurious', 'Scarlet dream', 'Scarlet dream'), ('Luxurious', 'Memento', 'Memento'),
        ]),
        ('Romance', 15, [
            ('Romantic', 'Sunset allure', 'Sunset allure'), ('Romantic', 'Lovebirds', 'Lovebirds'), ('Romantic', 'City of love', 'City of love'),
            ('Romantic', 'Ruby romance', 'Ruby romance'), ('Cozy', 'Ruby glow', 'Ruby glow'), ('Romantic', 'Smitten', 'Smitten'),
            ('Romantic', 'Promise', 'Promise'), ('Cozy', 'Tropical twilight', 'Tropical twilight'),
        ]),
    ]),
]


def kelvin(x, y):
    """xy -> Kelvin (McCamy), 2000-6500, rounded to 100 (like kelvin() in room.js)."""
    n = (x - 0.332) / (0.1858 - y)
    return int(round(max(2000, min(6500, 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33)), -2))


def planck(k):
    """Kelvin -> xy on the Planckian locus (Kim et al., 1667-25000 K), for colour lamps without colour temperature."""
    t = 1e3 / k
    x = (-0.2661239 * t ** 3 - 0.2343589 * t ** 2 + 0.8776956 * t + 0.179910) if k <= 4000 else \
        (-3.0258469 * t ** 3 + 2.1070379 * t ** 2 + 0.2226347 * t + 0.240390)
    y = (-1.1063814 * x ** 3 - 1.34811020 * x ** 2 + 2.18555832 * x - 0.20219683) if k <= 2222 else \
        (-0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867) if k <= 4000 else \
        (3.0817580 * x ** 3 - 5.87338670 * x ** 2 + 3.75112997 * x - 0.37001483)
    return [round(x, 4), round(y, 4)]


def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read()


def main():
    args = [a for a in sys.argv[1:] if a != '-f']
    force = '-f' in sys.argv[1:]
    out_dir = args[0] if args else os.path.join(HERE, 'www', 'frame', 'scenes')
    os.makedirs(out_dir, exist_ok=True)
    lib = json.loads(get(SRC + 'presets.json'))
    cats = {c['name']: c['id'] for c in lib['categories']}
    find = {(p['categoryId'], p['name']): p for p in lib['presets']}
    tabs = []
    for tk, tn, groups in TABS:
        gs = []
        for gn, dyn, items in groups:
            out = []
            for cat, name, label in items:
                if cat == 'K':
                    # no picture: the tile shows the white as a gradient
                    it = {'k': 'k%d' % name, 'n': label, 'bri': 254, 'xy': [planck(name)], 'kv': name}
                else:
                    p = find[(cats[cat], name)]
                    sid = p['id'][:8]
                    img = os.path.join(out_dir, sid + '.jpg')
                    if force or not os.path.exists(img):
                        with open(img, 'wb') as fh:
                            fh.write(get(SRC + 'assets/' + p['img']))
                        print(sid, label)
                    it = {'k': sid, 'n': label, 'img': sid + '.jpg', 'bri': p['bri'], 'xy': [[l['x'], l['y']] for l in p['lights']]}
                    if dyn == 'K':
                        it['kv'] = kelvin(*it['xy'][0])
                out.append(it)
            g = {'n': gn, 'items': out}
            if isinstance(dyn, int):
                g['dyn'] = dyn
            gs.append(g)
        tabs.append({'k': tk, 'n': tn, 'groups': gs})
    keep = {i['img'] for t in tabs for g in t['groups'] for i in g['items'] if 'img' in i}
    for f in os.listdir(out_dir):
        if f.endswith('.jpg') and f not in keep:
            os.remove(os.path.join(out_dir, f))
    with open(os.path.join(out_dir, 'scenes.json'), 'w') as fh:
        json.dump({'source': 'github.com/Hypfer/hass-scene_presets (Apache-2.0)', 'tabs': tabs}, fh, ensure_ascii=False, separators=(',', ':'))
    print(sum(len(g['items']) for t in tabs for g in t['groups']), 'scenes ->', out_dir)


main()
