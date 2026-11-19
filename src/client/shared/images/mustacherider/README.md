# MustacheRider artwork

The project owner supplied the hot dog SVGs in the original `mustach/` folder and `Mustachio_SVG.svg` in the project root. They are kept unchanged and bundled into the graphics by Vite. PNG design references are in `docs/theme-references/mustacherider/`.

Both hot dog SVGs use the same 769.47 × 277.43 canvas. Keep their alignment and aspect ratio. Render the bun first, then reveal the mustard with a horizontal clip based on its visible path bounds. Do not stretch the mustard to represent progress. Cash labels are separate dynamic SVG text, using Rubik Spray Paint loaded from Google Fonts.

`Mustachio_SVG.svg` is the receipt logo. Preserve its square canvas and embedded artwork; render it centered in a fixed 112 × 112 box above the donor name and amount.
