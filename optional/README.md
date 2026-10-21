# Optional modules

Each folder adds a page or a card to Frame. Add one with the install script from the repo root:

```bash
./install.sh calendar energy
```

Or copy by hand: `dashboard/templates/*` → `/config/frame/templates/`, `dashboard/views/*` → `/config/frame/views/`, `www/frame/*` → `/config/www/frame/`. Then follow the module's README for its last step. Pages appear in the rail by themselves.

The **Setup** page lists all of them and marks the ones that fit what your Home Assistant already has.

| Module | Adds | Needs |
| --- | --- | --- |
| [calendar](calendar/) | Calendar page: day, 3 days, week, month; add, move, edit, delete events | A calendar integration |
| [energy](energy/) | Energy page: use, solar, grid, self-sufficiency, per hour and day, prices | Home Assistant's energy dashboard set up |
| [flights](flights/) | Planes from Flightradar24 fly across the screen, with a flight card | [Flightradar24](https://github.com/AlexandrErohin/home-assistant-flightradar24) (HACS) |
| [timer](timer/) | Kitchen timer behind the big clock: dial, presets, rings on this device and your speakers | Nothing (speakers optional); a Home Assistant package |
| [scenes](scenes/) | Scene pictures in the room window: white light, morning, evening …, and dynamic scenes that move colours between the lamps | Colour or white lamps; a download script; a Home Assistant package for the dynamic ones |
| [rubbish](rubbish/) | Next pickups with painted bins and a "put out tonight" reminder | A waste calendar, e.g. [Waste Collection Schedule](https://github.com/mampfes/hacs_waste_collection_schedule) (HACS) |
| [appliances](appliances/) | Washing machine, dishwasher, dryer … while they run or are finished | Any status sensor or smart plug |
| [cameras](cameras/) | Camera page with live tiles and motion | Camera entities |
| [media](media/) | Music page and a mini player for Home | Media players |
| [screensaver](screensaver/) | Photo slideshow with clock, weather and the next event | [WallPanel](https://github.com/j-a-n/lovelace-wallpanel) (HACS) |
