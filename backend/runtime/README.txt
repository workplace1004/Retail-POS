Portable Java for Worldline C-TEP bridge
----------------------------------------
Copy a full Java 17 x64 JRE (or JDK) into this folder so you have:

  runtime/java/bin/java.exe   (Windows)
  runtime/java/bin/java       (Linux/macOS)

The bridge launcher (npm run worldline-bridge / npm run dev) uses only this tree — no global JDK install required.

On Windows you can install Temurin 17 JRE here automatically: run backend\bat\INSTALL_PORTABLE_JAVA.bat

Copy Worldline bridge binaries (JAR + DLLs + .class) into: backend/worldline-ctep-bridge/
