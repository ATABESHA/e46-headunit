# E46 Head Unit

A custom infotainment system for a BMW E46 (pre-2001, factory radio), running on
a Dell XPS 15 9550 with Ubuntu.

**Phase 1 (this version):** core service, touch screen app and a car simulator.
Everything runs on the laptop without the car.

## Install on the laptop

Open Terminal (Ctrl + Alt + T):

```bash
sudo apt install -y git
git clone https://github.com/<your-user>/<your-repo>.git ~/e46-headunit
cd ~/e46-headunit
bash scripts/install.sh
```

Then open **E46 Head Unit** from the app menu. Quit with **Ctrl + Shift + Q**.

To make it open fullscreen at every login (for the car):

```bash
bash scripts/install.sh --autostart
```

## Update

```bash
cd ~/e46-headunit
bash scripts/update.sh
```

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
     simulator.js   fake data (phase 1)
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
2. Media player, GPS, offline maps
3. CarPlay / Android Auto (Carlinkit USB adapter + node-carplay)
4. Fault codes for all modules (K+DCAN cable, BMW DS2 protocol)
5. K-Bus: lights, locks, windows, reverse signal, steering wheel buttons
6. ESP32: parking sensors, ambient LED lighting
7. Installation in the car: screen, 12 V power, sleep/wake with ignition

## Hardware notes (E46, before 2001)

- **Diagnostics:** pre-2001 E46s may only have the round 20-pin port under the hood.
  You'll need a **K+DCAN USB cable** plus a **20-pin to 16-pin OBD adapter**.
- **K-Bus:** connect at the back of the factory radio. That's convenient, because the radio
  gets replaced anyway.
- **Safety:** the system can read every module. It only changes comfort functions
  (lights, locks, windows, ambient lighting), never brakes, steering or airbags.
