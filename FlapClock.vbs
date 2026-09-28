' FlapClock launcher - opens the flip clock fullscreen, no console window.
Option Explicit
Dim sh, fso, dir, page
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir  = fso.GetParentFolderName(WScript.ScriptFullName)
page = fso.BuildPath(dir, "index.html")

If Not fso.FileExists(page) Then
  MsgBox "index.html not found next to this launcher.", 16, "FlapClock"
  WScript.Quit 1
End If

' Prefer a Chromium browser in fullscreen; fall back to the default browser.
Dim candidates
candidates = Array( _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"), _
  sh.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"), _
  sh.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe"), _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"), _
  sh.ExpandEnvironmentStrings("%LocalAppData%\Google\Chrome\Application\chrome.exe") _
)

Dim exe, i, found
found = False
For i = 0 To UBound(candidates)
  If fso.FileExists(candidates(i)) Then
    exe = candidates(i)
    sh.Run """" & exe & """ --start-fullscreen --new-window """ & page & """", 1, False
    found = True
    Exit For
  End If
Next

If Not found Then
  sh.Run """" & page & """", 1, False
End If
