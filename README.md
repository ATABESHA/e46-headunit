# E46 Head Unit

A custom infotainment system for a BMW E46 (pre-2001, factory radio), running on
a Dell XPS 15 9550 with Ubuntu.

The screen follows the layout and functions of the **SEAT Ibiza 2024 8.25" Media System**
(1082 × 480), plus extras for the E46: parking sensors and camera, fault codes, ambient
lighting, trip computer, styles and one-tap updates.

| Screen | What it does |
|---|---|
| **Home** | 8 tiles with live info (station, song, phone, CarPlay, speed …) |
| **Radio** | Internet radio: popular stations, search, 36 favourites |
| **Media** | Music from the laptop's Music folder and USB sticks; songs, folders, artists, albums |
| **Phone** | Contacts, recent calls, keypad, call screen (simulated - real calls via Full Link) |
| **Full Link** | Apple CarPlay and Android Auto through a Carlinkit USB adapter, wired or wireless |
| **Vehicle** | Driving data + trip computer, door/light status, parking (sensors + camera), fault codes, ambient lighting |
| **Settings** | Sound (bass/mid/treble/balance), display (styles, screen size), camera, connections, software update, simulator |

Always on top: volume display, incoming calls, short messages (USB stick connected …),
and the parking view when reverse gear is engaged.

## Install on the laptop

Open Terminal (Ctrl + Alt + T):

```bash
sudo apt install -y git
git clone https://github.com/ATABESHA/e46-headunit.git ~/e46-headunit
cd ~/e46-headunit
bash scripts/install.sh
```

Then open **E46 Head Unit** from the app menu. Quit with **Ctrl + Shift + Q**.

To make it open fullscreen at every login (for the car):

```bash
bash scripts/install.sh --autostart
```

## Update

**From the app:** Settings → Software update → **Check for updates** → **Update now**.
The app also checks by itself shortly after starting and then every 6 hours; a dot on
Settings means something new is waiting.

**From Terminal** (needed only if the app says so):

```bash
cd ~/e46-headunit
bash scripts/update.sh
```

The update never overwrites files changed on the laptop itself — it stops and lists them.
Make your changes on GitHub (or upload them from the laptop with `git commit` + `git push`).

## Styles and logo

Settings → Display: **Media System** (Ibiza layout), **E46 Classic**, **Modern iDrive** or **M Sport**.
The Media System colours are a starting point, not measured from a real Ibiza; send
screenshots of the real screen to match them.

- Your logo: replace [`ui/public/logo.svg`](ui/public/logo.svg) (SVG works best; for PNG,
  change `logo.svg` to `logo.png` in [`ui/src/App.jsx`](ui/src/App.jsx)).
- Your own style: add a block in [`ui/src/themes.css`](ui/src/themes.css) and list it in
  [`ui/src/theme.js`](ui/src/theme.js).

## Testing with the simulator

**Settings → Simulator** switches between:
- **Driving:** speed, RPM, coolant and fuel change.
- **Reversing:** the parking view opens by itself and the sensors count down.
- **Standing still:** engine idling.

You can also open and close doors there.

## How it works

```
   Screen app (ui/)  ◄──── WebSocket ws://127.0.0.1:8765 ────►  Your own programs
         │                                                    (Python, Node, ...)
         ▼
   Core service (core/)  ── holds all car data ("topics") and runs commands
         │
   Plugins (core/src/plugins/)
     simulator.js   fake car data (until the car is connected)
     updater.js     software updates from GitHub
     carplay.js     CarPlay / Android Auto (Carlinkit adapter)
     media.js       music library: Music folder + USB sticks
     radio.js       internet radio (radio-browser.info) + favourites
     phone.js       phone (simulated for now)
     audio.js       system volume + sound settings
     trip.js        trip computer
     kbus.js        lights, locks, windows, reverse, wheel buttons   (later)
     diag.js        fault codes through the K+DCAN cable             (later)
     esp32.js       parking sensors, ambient LEDs                    (later)
```

- **Topics** are named values, for example `vehicle.speed` or `parking.distances`.
  Plugins write them; the screen shows them.
- **Commands** are requests, for example `ambient.set` or `diag.clear`.
  The screen sends them; a plugin carries them out.
- The full list of topics and commands is at the top of
  [`core/src/plugins/simulator.js`](core/src/plugins/simulator.js).

### Add your own features

| What | How |
|---|---|
| New data source or car function | Write a plugin. See [`examples/my-plugin.js`](examples/my-plugin.js). |
| Separate program in any language | Connect to the WebSocket. See [`examples/my-sensor.py`](examples/my-sensor.py). |
| New screen | Add a file in `ui/src/screens/` and one line in `SCREENS` in [`ui/src/App.jsx`](ui/src/App.jsx). |
| Car-specific settings | Copy `core/config.json` to `core/config.local.json` and edit it (not saved to git). |
| Other music folders | In `config.local.json`: `"media": { "enabled": true, "folders": ["/home/carpc/Music", "/home/carpc/Songs"] }` |

Saved settings (favourites, sound, trip) live in `~/.local/share/e46-headunit/`, so updates never touch them.

WebSocket messages (JSON):

```jsonc
// sent to you when you connect, then on every change
{"type": "snapshot", "state": {"vehicle.speed": 50, ...}}
{"type": "state", "topic": "vehicle.speed", "value": 52}

// you send
{"type": "command", "id": 1, "topic": "ambient.set", "value": {"color": "#00aaff"}}
{"type": "publish", "topic": "my.oilTemp", "value": 96}

// answer to a command
{"type": "result", "id": 1, "ok": true, "value": {...}}
```

The core only listens on `127.0.0.1`, so nothing outside the laptop can reach it.

## Development

```bash
npm install
npm run dev           # core + screen app, reloads on every file change
npm run dev:browser   # same, but the screen opens in a browser at http://127.0.0.1:5173
npm test              # core tests
```

## Roadmap

1. ✅ Core, screen app, simulator
2. ✅ Ibiza Media System layout: radio, media, phone, vehicle, settings
3. ✅ CarPlay / Android Auto (Carlinkit USB adapter + node-carplay), reverse camera
4. Bluetooth: music and hands-free calls from the phone without CarPlay
5. Fault codes for all modules (K+DCAN cable, BMW DS2 protocol)
6. K-Bus: lights, locks, windows, reverse signal, steering wheel buttons
7. ESP32: parking sensors, ambient LED lighting
8. FM/DAB radio with an RTL-SDR USB receiver
9. Installation in the car: screen, 12 V power, sleep/wake with ignition

## Hardware notes (E46, before 2001)

- **Diagnostics:** pre-2001 E46s may only have the round 20-pin port under the hood.
  You'll need a **K+DCAN USB cable** plus a **20-pin to 16-pin OBD adapter**.
- **K-Bus:** connect at the back of the factory radio. That's convenient, because the radio
  gets replaced anyway.
- **Safety:** the system can read every module. It only changes comfort functions
  (lights, locks, windows, ambient lighting), never brakes, steering or airbags.
