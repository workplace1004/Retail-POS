# Probleemoplossing Worldline C-TEP Electron TestTool

## Fout: `spawn java ENOENT`
Electron kan Java niet vinden. De C-TEP bridge start dan niet en de app krijgt:

```text
connect ECONNREFUSED 127.0.0.1:3210
```

Deze versie zoekt Java automatisch via:

1. `JAVA_HOME`
2. `JRE_HOME`
3. veelgebruikte installatiemappen onder `C:\Program Files`
4. Windows `PATH`

Controleer op de klant-PC:

```bat
CHECK_JAVA.bat
```

Minimaal nodig: Java 17 x64.

## Correcte architectuur

```text
Worldline terminal/RX5000 -> PC-IP:9000
Electron/POS              -> http://localhost:3210
```

## Netwerkcheck

```bat
netstat -ano | findstr :9000
```

Goed resultaat:

```text
0.0.0.0:9000 LISTENING
192.168.1.14:9000 192.168.1.40:xxxxx ESTABLISHED
```

## HTTP API check

Als de bridge draait:

```text
http://localhost:3210/ping
http://localhost:3210/status
```

Als deze niet openen, draait de Java bridge niet.
