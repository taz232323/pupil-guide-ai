## Problem

Animations currently trigger when the **top** of the element reaches the **bottom** of the viewport (`anchorPlacement: "top-bottom"`), and the global `offset: 300` shifts that trigger another 300px earlier. So the element starts animating while it's still off-screen — by the time you scroll to it, the 900ms animation is mostly done and you only catch the tail end.

## Fix

Change the trigger point so the animation starts when the element is actually entering the viewport, not before.

1. In `src/pages/Index.tsx` `AOS.init({...})`:
   - `anchorPlacement: "top-bottom"` → `"center-bottom"` (waits until the element's center reaches the bottom of the viewport — i.e. roughly when its top edge is already on screen).
   - `offset: 300` → `0` (no extra early trigger; the anchor alone decides the moment).
   - Keep `duration: 900`, `easing: "ease-in-out"`, `once: true`, `mirror: false`.

2. Update every `data-aos-anchor-placement="top-bottom"` attribute on the page to `data-aos-anchor-placement="center-bottom"` so per-element overrides match the new global behavior. Affected elements: hero badge, h1, paragraph, CTA row, all Features section nodes, How It Works section nodes (including the connecting line and each step + icon), Testimonials section nodes, and the final CTA card + mountain icon.

3. Leave the hero mountain parallax (`translate3d` driven by `scrollY`) alone — it isn't an AOS animation.

## Expected result

- On initial page load (no scroll): nothing has animated; every element sits in its pre-animation state.
- As the user scrolls, each element begins its 900ms animation right as it crosses into the visible area, so the full motion is seen.
