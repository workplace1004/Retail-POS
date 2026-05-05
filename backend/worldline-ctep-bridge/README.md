# Worldline C-TEP Java bridge (same as `sample/`)

This folder mirrors the **sample** Worldline integration:

- **Java** `WorldlineCtepBrowserBridge` (JEasyCTEP) listens for the terminal on **C-TEP** (default port **9000**).
- **HTTP** API for the POS on default port **3210** (`/status`, `POST /sale`, `GET /transaction`, …).
- **Node** in the retail app calls the same flow as `POS_INTEGRATION_EXAMPLE_JS.js` via `backend/services/worldlineCtepBridgeClient.js`.

## Files

- `lib/` — JEasyCTEP JAR and native DLLs (copied from `sample/backend/lib` in this repo).
- `WorldlineCtepBrowserBridge.class` — precompiled bridge (from sample).
- `WorldlineCtepBrowserBridge.java` — source (from sample).
- `POS_INTEGRATION_EXAMPLE_JS.js` — reference client (from sample).

## Run the bridge (Windows)

From repo root:

```bat
backend\worldline-ctep-bridge\START_BRIDGE.bat
```

Or from `backend`:

```bash
npm run worldline-bridge
```

Uses **only** portable Java at `sample/runtime/java/bin/java.exe` (same as `sample/START_BRIDGE_ONLY.bat`). Run `sample/INSTALL_PORTABLE_JAVA.bat` once if that path is missing; no JDK install or `JAVA_HOME` required.

## Configure the POS

Control → External devices → Card → **Worldline** → set **Bridge HTTP base URL** to `http://127.0.0.1:3210` (or your `--http-port`).

On the terminal, point C-TEP to **this PC’s LAN IP** and port **9000** (same as sample).

## Environment (optional)

| Variable | Default | Meaning |
|----------|---------|---------|
| `WORLDLINE_CTEP_HTTP_URL` | `http://localhost:3210` | Bridge base URL if not set in terminal JSON |
| `WORLDLINE_CTEP_PORT` | `9000` | C-TEP listen port (launcher script) |
| `WORLDLINE_CTEP_HTTP_PORT` | `3210` | HTTP listen port (launcher script) |
