# Print X Article (Chrome extension)

The bookmarklet in this repo, packaged as an MV3 Chrome extension. Same code:
`print-article.js` is generated from `../bookmarklet.src.js` by `../build.sh`.

## Install (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → select this `extension/` folder

## Use

Open an X article (or a thread) and either:

- click the toolbar icon, or
- press **Alt+Shift+P**

The page is reformatted into the print layout and the print dialog opens. The
document title is temporarily swapped to `Author - Title` so "Save as PDF"
suggests a sane filename, then restored when the dialog closes.

The button only acts on `x.com` / `twitter.com`; anywhere else it flashes a red
`!` badge and does nothing.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest: `scripting` + host permissions for X, toolbar action, keyboard command |
| `background.js` | Service worker; injects `print-article.js` into the active tab on click/shortcut |
| `print-article.js` | **Generated** — do not edit; edit `../bookmarklet.src.js` and run `../build.sh` |
| `icons/icon.svg` | Source for the 48/128 icons |
| `icons/icon-small.svg` | Bolder, bar-less variant for the 16/32 icons |

Regenerate the icons after editing either SVG:

```sh
cd extension/icons
for s in 48 128; do magick -background none icon.svg       -resize ${s}x${s} icon${s}.png; done
for s in 16 32; do magick -background none icon-small.svg -resize ${s}x${s} icon${s}.png; done
```
