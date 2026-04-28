; electron-builder merges this via nsis.include → customHeader (see templates/nsis/installer.nsi).
; Disables NSIS self-CRC: avoids "Installer integrity check has failed" when the .exe was copied
; imperfectly (USB, cloud sync, AV) even though the payload is fine.
!macro customHeader
  CRCCheck off
!macroend
