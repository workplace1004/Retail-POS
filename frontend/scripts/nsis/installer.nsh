; Merged by electron-builder (see app-builder-lib/templates/nsis/installer.nsi).
; Fixed install root on C: — customInit runs after initMultiUser, so this overrides
; Program Files and any prior InstallLocation in the registry.

!macro customHeader
  CRCCheck off
!macroend

!macro customInit
  StrCpy $INSTDIR "C:\Retail"
  SetOutPath $INSTDIR
!macroend
