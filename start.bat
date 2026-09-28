@echo off
setlocal
set "PAGE=%~dp0index.html"
set "EDGE1=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE2=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "CHROME1=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME2=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "CHROME3=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if exist "%EDGE1%"   ( start "" "%EDGE1%"   --start-fullscreen --new-window "%PAGE%" & exit /b )
if exist "%EDGE2%"   ( start "" "%EDGE2%"   --start-fullscreen --new-window "%PAGE%" & exit /b )
if exist "%CHROME1%" ( start "" "%CHROME1%" --start-fullscreen --new-window "%PAGE%" & exit /b )
if exist "%CHROME2%" ( start "" "%CHROME2%" --start-fullscreen --new-window "%PAGE%" & exit /b )
if exist "%CHROME3%" ( start "" "%CHROME3%" --start-fullscreen --new-window "%PAGE%" & exit /b )

start "" "%PAGE%"
