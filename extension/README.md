# Print X Article (Chrome extension)

The bookmarklet in this repo, packaged as an MV3 Chrome extension. Same code:
`print-article.js` is generated from `../bookmarklet.src.js` by `../build.sh`.

The two differ only where `../bookmarklet.src.js` guards a block with `IS_EXT`,
which `build.sh` flips to `true` for the extension build. Today that covers one
thing: the extension puts the author's profile picture next to the byline.

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
| `icons/icon.svg` | Printer with the X logo on the printed sheet; the single source for all four icon sizes |

Regenerate the icons after editing the SVG. All four sizes come from the one
file, so the toolbar, the extensions manager, and the store listing always show
the same mark:

```sh
cd extension/icons
for s in 16 32 48 128; do magick -background none icon.svg -resize ${s}x${s} icon${s}.png; done
```

Keep the shapes and the gaps between them coarse when editing it. Fine detail
survives at 128px and turns to grey mush at 16px, which is what forced a second,
simplified SVG the first time around.
