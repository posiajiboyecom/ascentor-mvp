# Sage edge tab

Sage is now a slim half-circle tab (44 x 60 px) on the screen edge, in the upper-middle, instead of a round button in the corner.

- Drag it up or down; on phones drag across the middle to move it to the other edge. Arrow Up/Down move it from the keyboard. Position is saved per device.
- It is clamped between the top bar and the bottom tab bar (measured live), so it cannot cover the menu button, top bar or tab bar.
- It hides while the mobile menu, a sheet, a modal or the on-screen keyboard is up, on /coach and on chat screens. z-index 50, below drawers and modals.
- Desktop: right edge only, with a 48px gutter reserved so it never sits on page content or right-hand panels.
- Hide for the session: the small x (hover/focus), the eye icon in the greeting bubble, or hold the tab down.
- Reduced motion: no transitions or pulse.

Other floating things on member pages: the bottom tab bar, sticky top bar, messaging dock (desktop, bottom), toasts, network pill, bottom sheets and the Summit modal. There is no cart bar on member pages, and the social bar (FloatingSocials) is on public pages only.

Checks: `scripts/visual/sage_edge.cjs` (overlap by measurement, 19 routes x 6 widths) and `scripts/visual/sage_interact.cjs` (33 behaviour checks).
