# Visual Craft — Colour, Type, Depth, Hierarchy

When you advise on how a surface looks, the first move is never "what colour?" or "which font?" It is "what does this need to communicate, and what does perception demand to communicate it cleanly?" The visual layer is built on how the eye actually works, and almost every decision has a correct, defensible default that a framework leaves on the table.

## Author colour in OKLCH, build ramps by luminance

Define colour in OKLCH — lightness, chroma, hue — not HEX or HSL, because OKLCH is perceptually uniform: equal lightness steps look equal across every hue, so a palette steps evenly without per-hue hand-correction. HSL lies — a 50% blue and a 50% yellow read at wildly different brightness — which silently breaks `darken()`, hue-rotation, and contrast. Build each hue as a ramp (50→950) by pinning a lightness curve and a chroma *arc* that peaks in the mid-steps and tapers at both ends, because extreme lightness cannot hold high chroma without clipping. A flat-chroma ramp is the tell of a generated-but-not-designed palette. Surface everything through semantic tokens (`surface`, `text`, `border`, `brand`, feedback roles); components reference the semantic layer only.

## Dark mode is a remapping, not an inversion

A dark theme is a separate semantic mapping over the same token names. Signal elevation with lightness (a raised surface is lighter), because shadows nearly vanish on dark; desaturate and lighten accents, because a saturated brand glows against dark; avoid pure black and pure white, because maximum contrast causes halation that vibrates text edges. Algorithmic inversion is never a dark mode — it destroys hierarchy and produces wrong colour.

## Contrast: WCAG is the floor, APCA is the lens

Meet WCAG 2.2 AA — 4.5:1 body, 3:1 large and non-text — as the compliance floor, but design with APCA, because the WCAG ratio is not perceptually uniform: it overstates contrast in dark mode and ignores font weight and size, so a "passing" pair can be unreadable. Contrast is a property of the token *pairing* in context, never of a colour alone.

## Typography is roles, each a bundle

A type scale comes from one base and one modular ratio (≈1.2 dense UI, 1.25 general, 1.333+ editorial), relaxed at display sizes where a pure geometric scale overshoots. Each role — display, headings, body, caption, label, mono — bundles size *and* line-height (tight headings, open body), weight, and tracking (negative for large display, slightly positive for small labels), because quality lives in those relationships, not size alone. Name roles by purpose (`text-body`), never appearance (`text-16`). Render each step fluidly with `clamp()` whose preferred value always carries a `rem` term (pure `vw` breaks zoom), on a variable font with `font-optical-sizing: auto`, holding body to a 45–75ch measure.

## Depth is modelled light

Elevation is a multi-layer shadow stack — several shadows with growing offset and blur and inversely scaled alpha, one light-source direction, tinted toward the background rather than pure black — because real light casts many soft accumulating shadows. A single `box-shadow` is a fuzzy grey box. Edges catch light: prefer a translucent, luminosity-aware border or a 1px top highlight over a flat grey line. Interpolate gradients in OKLCH with ~1% noise, because sRGB interpolation muddies the mid-stop and 24-bit steps band.

## Atmosphere is modelled material — translucency, glow, grain, with restraint

High-end surfaces read as material in a scene, not flat fills — and these are the techniques a generic build skips. **Translucency (glass):** an alpha tint over a `backdrop-filter` blur samples the content beneath, reserved for layered chrome (nav, overlays, command surfaces), always with a tint opaque enough to hold text contrast and a solid fallback. **Ambient glow / gradient mesh:** a sub-perceptual radial wash (opacity well under ~0.15, fading to transparent over a solid base, OKLCH-interpolated with ~1% noise) warms a surface and leads the eye — never a hard two-stop dump. **Grain:** a fine, low-opacity noise overlay kills banding and adds tactility. Depth is multi-plane — foreground, surface, background blur and move differently so it reads as layers. The discipline is restraint: when blur, glow, and grain become the subject, the surface is decoration. Borrow the *technique and rigour* of work you admire, never its signature look.

## Finish optically: alignment, crisp edges, tabular figures

Optical alignment is not mathematical: an icon or uneven glyph centred by its bounding box looks off — nudge to where the visual mass balances. Render thin lines on the pixel grid (integer offsets) so 1px borders stay crisp, not smeared across two subpixels. Set compared or in-place-changing figures (tables, metrics, timers, counters) in tabular numerals so columns hold and the layout stops jittering; proportional figures for prose only. Each is invisible until wrong, and collectively they are the gap between considered and almost.

## Hierarchy by weight and colour before size

Build hierarchy with a few greys (near-black, mid, light) and two weights first; size is the last lever, because secondary text that is merely smaller still competes while lightening it makes it recede. Compose grayscale-first — if it fails without colour, the weight-and-spacing hierarchy is broken — and never let colour be the sole differentiator. Proximity groups: related elements closer than unrelated, so equal spacing erases structure.

## Antipatterns to catch

- **HEX/HSL palette math.** Ramps and `darken()` in a non-perceptual space, producing uneven steps.
- **Flat-chroma ramp.** Constant chroma across all steps — generated, not designed.
- **Inverted or pure-black dark mode.** Ignoring elevation, desaturation, and halation.
- **Size-only type tokens.** Sizes named by pixel value, no paired line-height, weight, or tracking.
- **The single-layer shadow and flat grey border.** The documented generic-build depth signature.
- **The default purple gradient.** Two-stop indigo interpolated in sRGB, visibly banding.
- **Blur as decoration.** Backdrop blur on opaque or non-layered surfaces, or without a contrast-safe tint and solid fallback.
- **Glow/grain dump.** A high-opacity or hard-stop "ambient" wash, or heavy noise, used as ornament rather than serving the content.
- **Signature mimicry.** Copying a named product's signature look instead of its underlying technique and restraint.
- **Bounding-box centring.** Mathematical centre for optically-uneven glyphs; blurred hairlines from fractional pixel offsets.
- **Hierarchy by size alone.** Five font sizes where weight and colour would carry it.
