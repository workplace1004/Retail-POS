Worldline C-TEP Electron TestTool - Portable Java versie

Doel:
- Geen globale Java-installatie nodig op de POS-pc.
- De tool gebruikt runtime\java\bin\java.exe.

Eerste installatie op POS-pc:
1) Pak deze ZIP uit.
2) Draai INSTALL_PORTABLE_JAVA.bat
   - Dit downloadt Java 17 JRE x64 naar runtime\java.
   - Heeft de POS-pc geen internet? Kopieer dan een Java 17 x64 JRE-map manueel naar runtime\java.
3) Draai INSTALL_DEPENDENCIES.bat
4) Start START_ELECTRON_TESTTOOL.bat

Controle:
- CHECK_PORTABLE_JAVA.bat moet Java 17 tonen.

Netwerkflow:
- Worldline terminal/RX5000 -> PC-IP:9000
- Electron/POS -> http://localhost:3210

Belangrijk:
- Poort 9000 mag niet bezet zijn door een andere listener.
- Firewall moet inkomend TCP 9000 toelaten.
