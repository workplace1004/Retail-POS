$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$runtime = Join-Path $root 'runtime'
$javaDir = Join-Path $runtime 'java'
$tmp = Join-Path $root '_tmp_java'
$zip = Join-Path $tmp 'temurin17-jre-win-x64.zip'
$url = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk'

Write-Host "Root: $root"
if (Test-Path (Join-Path $javaDir 'bin\java.exe')) {
  & (Join-Path $javaDir 'bin\java.exe') -version
  Write-Host 'Portable Java staat al klaar.'
  exit 0
}

New-Item -ItemType Directory -Force -Path $runtime | Out-Null
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Write-Host 'Download Java 17 JRE x64...'
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

Write-Host 'Uitpakken...'
Expand-Archive -Path $zip -DestinationPath $tmp -Force
$found = Get-ChildItem $tmp -Directory -Recurse | Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') } | Select-Object -First 1
if (-not $found) { throw 'Kon bin\java.exe niet vinden in gedownloade JRE.' }

Remove-Item -Recurse -Force $javaDir -ErrorAction SilentlyContinue
Move-Item -Path $found.FullName -Destination $javaDir
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue

Write-Host 'OK. Portable Java geïnstalleerd:'
& (Join-Path $javaDir 'bin\java.exe') -version
