# Changelog

All notable changes to FlapClock are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-28

First public release.

### Added

- Split-flap flip clock with a pure-CSS 3D leaf animation, six digits, and a
  blinking colon that stays in phase with the system clock.
- Two ways to run it: `FlapClock.vbs` / `start.bat` open it fullscreen in a
  browser, and `FlapClock.scr` is a real Windows screensaver built on WebView2
  that Windows triggers on its own idle timeout and dismisses on any input.
- Locale-aware date formatting and a locale-derived 12/24-hour default, with
  localised day-period words where the locale has its own short form.
- Five colour themes (`white`, `amber`, `ice`, `mint`, `rose`) plus a toggleable
  ambient bloom.
- Display toggles for seconds, day and date, AM/PM, flip animation, blinking
  colon and the author credit, each bound to a key.
- Dim and size sliders, fullscreen toggle, and an in-app shortcut panel.
- Settings persist in `localStorage` under `flapclock.settings`.
- Author credit on the clock face, in the shortcut panel, in the built file's
  properties, and in the README.
- MIT licensed.

### Notes for packagers

- `FlapClock.scr` is unsigned, so Defender or SmartScreen may warn on download.
  See the README for the SHA-256 and the false-positive link.
- The Windows screensaver needs the WebView2 Runtime, which is preinstalled on
  Windows 11. The browser version needs only Edge or Chrome.
