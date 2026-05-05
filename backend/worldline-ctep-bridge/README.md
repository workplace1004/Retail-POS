# Worldline C-TEP Java bridge (under `backend/` only)

Self-contained under **`backend/worldline-ctep-bridge`** — no separate `sample/` folder is required at runtime.

- **Java** `WorldlineCtepBrowserBridge` (JEasyCTEP) listens for the terminal on **C-TEP** (default port **9000**).
- **HTTP** API for the POS on default port **3210** (`/status`, `POST /sale`, `GET /transaction`, …).
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

Or from `backend`:

```bash
npm run worldline-bridge
```

Uses **only** portable Java at **`backend/runtime/java/bin/java.exe`** (JRE tree copied next to `worldline-ctep-bridge`). No global JDK or `JAVA_HOME` required for this launcher.

## Configure the POS

Control → External devices → Card → **Worldline** → set **Bridge HTTP base URL** to `http://127.0.0.1:3210` (or your `--http-port`).

On the terminal, point C-TEP to **this PC’s LAN IP** and port **9000**.

## Environment (optional)

| Variable | Default | Meaning |
|----------|---------|---------|
| `WORLDLINE_CTEP_HTTP_URL` | `http://localhost:3210` | Bridge base URL if not set in terminal JSON |
| `WORLDLINE_CTEP_PORT` | `9000` | C-TEP listen port (launcher script) |
| `WORLDLINE_CTEP_HTTP_PORT` | `3210` | HTTP listen port (launcher script) |
