# FlapClock - Flip Clock

**By Deacon Sholy.** A split-flap flip clock, running live in your browser. Large
white numerals on black, real 3D flip animation, plus the **day and date**
underneath. It reads your system clock, re-syncs on every second boundary, and
formats the date for your locale. No dependencies, no build step.

## Run it

**Easiest:** double-click `FlapClock.vbs` - it opens the clock fullscreen in Edge
or Chrome with no extra windows. Close the browser window (or press `Alt+F4`) to
exit.

**Alternative:** double-click `start.bat` (same thing via a brief command window).

**On macOS:** double-click `FlapClock.command`, then press `F` if it does not go
fullscreen by itself. See "macOS" below.

**Manual:** just double-click `index.html` to open it in any browser, then press
`F` for fullscreen.

To use it as a screensaver, go fullscreen (`F`) and leave it - the cursor and
controls fade out on their own after a couple of seconds.

## Moving it to another laptop

Copy the files across (USB stick, OneDrive, network share) - not the whole
folder, because the folder also holds a `FlapClock.scr.WebView2` cache directory
that is about 10 MB of regenerable browser state.

For the browser version, four files are enough:

`index.html`, `styles.css`, `clock.js`, `FlapClock.vbs`

Add `start.bat` if you want a launcher that still works where script execution
is blocked by policy. Add `FlapClock.command` if the other machine is a Mac.
Add `FlapClock.scr` plus the three WebView2 DLLs
(`Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.WinForms.dll`,
`WebView2Loader.dll`) if you want the real screensaver as well.

Then on the new machine, double-click `FlapClock.vbs`.

That is the whole setup. Windows 10/11 ships with Edge, so there is nothing to
install. Settings are stored per-browser in `localStorage`, so set it up again
on the new machine, or copy the profile if you want them carried over.

## macOS

The clock itself is plain HTML/CSS/JS and runs on a Mac as-is - copy
`index.html`, `styles.css` and `clock.js` across and open `index.html` in any
browser, then press `F` for fullscreen. `styles.css` already falls back to
`-apple-system`, so the digits look native rather than substituted.

`FlapClock.command` is the Mac equivalent of the Windows launchers. It finds
Chrome, Chromium, Edge or Brave in `/Applications` or `~/Applications` and opens
the page fullscreen, falling back to your default browser if none of those are
installed. Everything else in this README that mentions `.vbs`, `.bat`, `.scr`,
the WebView2 host or the Windows screen saver timeout is Windows-only and has no
Mac equivalent - macOS does not let third-party apps register a screen saver, so
use the built-in **Clock** screen saver in *System Settings -> Screen Saver*
for that.

Two Mac-specific things to know:

- **Executable bit.** Finder will not run a `.command` that is not marked
  executable. Right-click it and choose **Open**, or run this once in Terminal
  from the folder that holds it: `chmod +x FlapClock.command`
- **Gatekeeper.** If the files arrived by download, macOS marks them as coming
  from an unidentified developer. `xattr -d com.apple.quarantine FlapClock.command`
  clears that, or right-click -> **Open** once and confirm.

The launcher runs in a Terminal window that stays open behind the clock, which is
normal for a `.command` file. Switch away from it with `Cmd+Tab`, or quit
Terminal with `Cmd+Q` once the clock is up - the clock keeps running.

Settings live in `localStorage`, so they persist per browser, exactly as on
Windows.

## Controls

Press `?` for this list at any time.

| Key | Action |
| --- | --- |
| `F` / `Space` | Toggle fullscreen |
| `T` | 12 / 24-hour |
| `S` | Show / hide seconds |
| `D` | Show / hide day & date |
| `A` | Show / hide AM/PM (12-hour only) |
| `H` | Show / hide the split-flap flip animation |
| `K` | Blinking colon |
| `C` | Cycle colour theme |
| `G` | Ambient glow |
| `B` | Show / hide the credit line |
| `[` `]` | Dim / brighten |
| `-` `=` | Smaller / larger |
| `?` | Help |
| `Esc` | Close help / exit fullscreen |

Double-click the clock to toggle fullscreen. Settings are saved to your browser
and remembered next time.

## Themes

Five colourways - `white` (classic), `amber`, `ice`, `mint`, `rose` - each with
an optional soft bloom behind the digits. Press `C` to cycle, or `G` to kill
the glow on a bright room.

## Optional: install as a real Windows screensaver

`FlapClock.scr` is a tiny C# host that renders the same page in a borderless
WebView2 window, which is what lets Windows' own screensaver timeout trigger it.

**Installing**

1. Make sure these seven files are in one folder together:
   `FlapClock.scr`, `index.html`, `styles.css`, `clock.js`,
   `Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.WinForms.dll`,
   `WebView2Loader.dll`
2. Right-click `FlapClock.scr` -> **Install**, then pick it in
   *Settings -> Personalisation -> Lock screen -> Screen saver*
   and set the wait time to however many minutes you want.
3. Move the mouse or press any key to dismiss. A `FlapClock.scr.WebView2` folder
   appears next to the `.scr` on first run - leave it alone.

The target machine needs the
[WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/),
which is preinstalled on Windows 11. To uninstall, clear the screen saver
setting and delete the folder.

**Rebuilding after a code change**

`FlapClock.scr` is not committed to this repository - it is attached to the
release, so a clone stays source-only. Rebuild it after editing
`FlapClockScreensaver.cs`. Grab the
[WebView2 SDK](https://www.nuget.org/packages/Microsoft.Web.WebView2)
(`lib/net462` plus `runtimes/win-x64/native/WebView2Loader.dll`), then:

```
csc /target:winexe /platform:x64 /out:FlapClock.scr ^
  /r:"<sdk>\lib\net462\Microsoft.Web.WebView2.Core.dll" ^
  /r:"<sdk>\lib\net462\Microsoft.Web.WebView2.WinForms.dll" ^
  /r:System.Windows.Forms.dll /r:System.Drawing.dll ^
  FlapClockScreensaver.cs
```

`csc.exe` ships in `C:\Windows\Microsoft.NET\Framework64\v4.0.30319`. Add
`/define:DEBUG` to get a log at `%TEMP%\flapclock-scr.log`; a build without it
logs nothing and shows an error box if WebView2 fails to start.

Note: double-clicking the `.scr` opens the screen saver *configure* dialog, which
this app intentionally ignores. Only Windows' screensaver timeout runs it.


## Files

- `index.html` - page structure and control bar
- `styles.css` - the 3D split-flap animation, themes and layout
- `clock.js` - live time/day logic, flipping, settings
- `FlapClock.vbs` / `start.bat` / `FlapClock.command` - fullscreen launchers
  (Windows / Windows / macOS)
- `FlapClockScreensaver.cs` - source for the WebView2 screensaver host
- `build-release.ps1` - rebuilds `dist\FlapClock-<version>.zip` and `SHA256SUMS.txt`
- `LICENSE` / `CHANGELOG.md` - MIT licence and release history
- `.gitignore` - keeps the cache, SDK assemblies and build output out of git

Not in the repository, but part of the downloadable release:
`FlapClock.scr` and the three WebView2 assemblies. `FlapClock.scr.WebView2/`
appears next to the `.scr` the first time the screensaver runs; it is a
WebView2 browser profile, safe to delete, and regenerates itself.

## Verify a download

`FlapClock.scr` is unsigned, so Defender or SmartScreen may warn before it
runs. Compare the archive against `SHA256SUMS.txt`:

```
certutil -hashfile FlapClock-1.0.0.zip SHA256
```

If Defender flags it, that is a false positive on an unsigned screensaver -
report it at <https://www.microsoft.com/en-us/wdsi/filesubmission>.

## Credits

- **FlapClock** written by **Deacon Sholy**
