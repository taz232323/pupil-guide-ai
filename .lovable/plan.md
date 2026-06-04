## Goal
Remove the scroll-driven hero zoom. Make the mountain perform a cinematic zoom-in animation when the user clicks **Get Started** or **Watch Demo**, then navigate to `/auth` after the animation completes.

## Changes (src/pages/Index.tsx only)

1. **Remove scroll-zoom plumbing**
   - Delete the `targetProgress`/`currentProgress`/`rafId` refs, the `tick` lerp loop, and the hero-progress portion of `onScroll`.
   - Keep only the lightweight `scrolled` state for the nav bar.
   - Collapse hero section height from `320vh` back to a normal full-viewport hero (`h-screen`, no sticky container).

2. **Add click-triggered zoom state**
   - New state `zooming: boolean` and a `zoomProgress` value driven by a short `requestAnimationFrame` tween (~1.6s, ease-in-cubic).
   - On click of either button:
     - `e.preventDefault()`
     - Set `zooming = true`, start the RAF tween from 0 → 1.
     - On completion, `navigate("/auth")` via `react-router-dom`'s `useNavigate`.

3. **Apply zoom transform**
   - Reuse existing mountain layer styling, but drive `scale` (1 → ~7) and `translateY` (0 → small negative) from `zoomProgress` instead of `heroProgress`.
   - Fade headline/buttons out as `zoomProgress` grows (`opacity: 1 - zoomProgress * 1.2`).
   - Add `pointer-events-none` to buttons once `zooming` is true so the click can't repeat.
   - Keep the atmospheric glow + vignette layers, also scaled by `zoomProgress`.

4. **Convert buttons**
   - `Get Started`: change from `<Button asChild><Link to="/auth">` to a regular `<Button onClick={startZoom}>`.
   - `Watch Demo`: same pattern — `<Button onClick={startZoom}>` (no longer scrolls to `#how`).

5. **Cleanup**
   - Cancel the RAF in the unmount effect.
   - Respect `prefers-reduced-motion`: if reduced, skip the animation and navigate immediately.

## Technical notes
- Single `useNavigate()` hook from `react-router-dom`.
- Tween via `requestAnimationFrame` with a `startTime` timestamp; no new dependency needed.
- The rest of the page (Features, How it works, Testimonials, Footer) is unchanged.
- No backend, no schema, no other files touched.
