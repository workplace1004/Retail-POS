# Worldline C-TEP Electron TestTool

Deze map bevat een Electron testtool + Java C-TEP bridge voor integratie met een Worldline RX5000 of andere C-TEP terminal.

## Architectuur

```text
Worldline terminal  ->  PC-IP:9000       C-TEP TCP/IP connectie
Electron testtool   ->  localhost:3210  lokale HTTP API naar de bridge
POS software        ->  localhost:3210  zelfde API als Electron gebruikt
```

Belangrijk: de terminal connecteert naar de PC. De POS/browser/Electron praat niet rechtstreeks met poort 9000.

## Bewezen setup uit test

```text
PC IP       : 192.168.1.14
Terminal IP : 192.168.1.40
Terminal    : RX5000
C-TEP poort : 9000
HTTP API    : 3210
```

## Installatie

1. Installeer Node.js LTS.
2. Pak deze map uit.
3. Run `INSTALL_DEPENDENCIES.bat`.
4. Run `START_ELECTRON_TESTTOOL.bat`.

De Electron app start de Java C-TEP bridge automatisch.

## Java bridge only

Zonder Electron kan de programmeur ook alleen de bridge starten:

```bat
START_BRIDGE_ONLY.bat
```

Daarna is de API bereikbaar op:

```text
http://localhost:3210
```

## API endpoints voor POS integratie

### Ping

```http
GET http://localhost:3210/ping
```

### Status

```http
GET http://localhost:3210/status
```

Belangrijkste velden:

```json
{
  "serviceStarted": true,
  "terminalConnected": true,
  "model": "RX5000",
  "serialNumber": "...",
  "transactionBusy": false
}
```

### Betaling starten

```http
POST http://localhost:3210/sale
Content-Type: application/json

{
  "amount": 1.00,
  "reference": "POS-TEST-001",
  "timeoutSec": 180
}
```

Antwoord is async:

```json
{
  "ok": true,
  "accepted": true,
  "txId": "TX-...",
  "message": "Sale started. Poll /transaction for result."
}
```

### Resultaat opvragen

```http
GET http://localhost:3210/transaction
```

Mogelijke statuswaarden:

```text
none
running
done
declined_or_error
timeout
error
cancel_requested
```

### Cancel/reset

```http
POST http://localhost:3210/cancel
```

## Integratieadvies

Voor een POS integratie:

1. Bij opstart: call `/status`.
2. Enkel betaling starten als `terminalConnected=true` en `transactionBusy=false`.
3. Call `/sale`.
4. Poll `/transaction` elke 1 à 2 seconden tot status niet meer `running` is.
5. Bij `approved=true`: markeer betaling OK.
6. Bij error/timeout: toon fout en laat opnieuw proberen of andere betaalmethode kiezen.

## Netwerkcheck

Tijdens draaien moet dit zichtbaar zijn:

```bat
netstat -ano | findstr :9000
```

Verwacht:

```text
0.0.0.0:9000 LISTENING
192.168.1.14:9000 192.168.1.40:xxxxx ESTABLISHED
```

Als `ESTABLISHED` ontbreekt, staat de terminal niet naar het juiste PC-IP of blokkeert de firewall.
