# Worldline C-TEP Java bridge (under `backend/` only)

Self-contained under **`backend/worldline-ctep-bridge`** — no separate `sample/` folder is required at runtime.

- **Java** `WorldlineCtepBrowserBridge` (JEasyCTEP) talks C-TEP in two ways:
  - **TCP (default):** listens for the terminal on **C-TEP** (default port **9000**); terminal uses this PC’s LAN IP.
  - **Serial:** opens a **COM / USB serial** port on this PC (e.g. `COM3` on Windows, `/dev/ttyUSB0` on Linux) at a baud rate (default **115200**). Use when the terminal is connected by USB–serial.
- **HTTP** API for the POS on default port **3210** (`/status`, `POST /sale`, `GET /transaction`, …) — unchanged; the POS still only talks to the bridge URL.
- **Node** calls the same HTTP contract via `backend/services/worldlineCtepBridgeClient.js`.

## Files

- `lib/` — JEasyCTEP JAR and native DLLs (copy from your vendor / integration package into this folder).
- `WorldlineCtepBrowserBridge.class` — precompiled bridge.
- `WorldlineCtepBrowserBridge.java` — source reference.
- `POS_INTEGRATION_EXAMPLE_JS.js` — reference client (HTTP shapes).

## Run the bridge (Windows)

From repo root:

```bat
backend\worldline-ctep-bridge\START_BRIDGE.bat
```

**Serial (USB/COM)** — set the port before starting (example `COM3`):

```bat
set WORLDLINE_CTEP_SERIAL=COM3
set WORLDLINE_CTEP_SERIAL_BAUD=115200
backend\worldline-ctep-bridge\START_BRIDGE.bat
```

Or double‑edit `START_BRIDGE_SERIAL.bat` (default `COM3`) and run it.

Or from `backend`:

```bash
npm run worldline-bridge
```

With serial, set env vars first, e.g. `WORLDLINE_CTEP_SERIAL=COM3` (see `backend/scripts/run-worldline-ctep-bridge.cjs`).

Uses **only** portable Java at **`backend/runtime/java/bin/java.exe`** (JRE tree copied next to `worldline-ctep-bridge`). No global JDK or `JAVA_HOME` required for this launcher.

Recompile the bridge class after editing `WorldlineCtepBrowserBridge.java`:

```bat
cd backend\worldline-ctep-bridge
..\..\runtime\java\bin\javac.exe -encoding UTF-8 -cp lib\JEasyCTEP-3.4.0.jar WorldlineCtepBrowserBridge.java
```

## Configure the POS

Control → External devices → Card → **Worldline** → set **Bridge HTTP base URL** to `http://127.0.0.1:3210` (or your `--http-port`).

**TCP mode:** on the terminal, point C-TEP to **this PC’s LAN IP** and port **9000** (or your `WORLDLINE_CTEP_PORT`).

**Serial mode:** no terminal IP; the bridge opens the COM device. Match baud to your device (often 115200; confirm with Worldline / terminal manual).

## Environment (optional)

| Variable | Default | Meaning |
|----------|---------|---------|
| `WORLDLINE_CTEP_HTTP_URL` | `http://localhost:3210` | Bridge base URL if not set in terminal JSON |
| `WORLDLINE_CTEP_PORT` | `9000` | C-TEP TCP listen port (TCP mode only) |
| `WORLDLINE_CTEP_HTTP_PORT` | `3210` | HTTP listen port (launcher script) |
| `WORLDLINE_CTEP_SERIAL` | *(empty)* | If set, bridge uses **serial** C-TEP on this port (`COM3`, `/dev/ttyUSB0`, …) |
| `WORLDLINE_CTEP_SERIAL_BAUD` | `115200` | Serial baud rate (serial mode) |
