# Cover art layers

Drop the painted cover here and the title screen uses it instead of the 3D scene
(`?cover=3d` still shows the 3D scene). With no `layers.json` nothing changes.

## Files
Export every layer at the **same canvas size** (e.g. 3840x2160, 16:9, transparent WebP).
Layers stack in the order listed; they line up with no extra positioning.

| layer | what | tip |
|---|---|---|
| `bg.webp` | shop, street, sky | paint or inpaint the parts the characters cover |
| `mid.webp` | pole, chalkboard, banner | |
| `char-1.webp` ... | one character each | |
| `char-1-eyes.webp` | closed eyes only (rest transparent) | flashes on every few seconds |
| `cat.webp` | the cat | |
| `fg.webp` | blurred leaves and flowers in front | |

Menu buttons and the logo stay HTML, so leave the left side calm for the buttons.

## `layers.json`
```json
{
  "width": 3840,
  "height": 2160,
  "focus": { "x": 0.62, "y": 0.5 },
  "petals": true,
  "layers": [
    { "id": "bg", "src": "bg.webp", "depth": 0.1 },
    { "id": "mid", "src": "mid.webp", "depth": 0.25, "anim": "flicker", "seconds": 3 },
    { "id": "char-1", "src": "char-1.webp", "depth": 0.5, "anim": "breathe", "seconds": 4.2, "origin": "50% 100%", "blink": "char-1-eyes.webp" },
    { "id": "cat", "src": "cat.webp", "depth": 0.6, "anim": "bob", "seconds": 2.6 },
    { "id": "fg", "src": "fg.webp", "depth": 1, "anim": "sway", "seconds": 7, "origin": "0% 100%" }
  ]
}
```
- `depth` 0-1: how far the layer slides with the mouse / phone tilt (far = small).
- `anim`: `breathe`, `sway`, `bob`, `flicker` or `none`; `seconds` is one loop.
- `focus`: the point kept in view when the screen is narrower than the art (phones).
- Reduced-motion users get the still picture.
