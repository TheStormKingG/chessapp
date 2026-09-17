import type { ReactNode } from 'react';

/**
 * The frame a modal task is presented in: a lesson, a checkpoint attempt, a
 * game. Full-screen, over the app rather than inside it, with no tab bar.
 *
 * DESIGN-SYSTEM.md H-1: these three routes are single focused tasks that were
 * rendered inside the global tab bar, so the interface offered two
 * contradictory models at once — a modal with a close affordance, and a
 * browsable tab section. `modality.md > Best practices`: "Always give people an
 * obvious way to dismiss a modal view"; `tab-bars.md > Best practices`: the tab
 * bar stays visible "except when a modal view covers the tab bar, because a
 * modal is temporary and self-contained". That exception is exactly this frame.
 *
 * It stays a plain `<main>` rather than `role="dialog"`: the route replaces the
 * page, so there is no parent view behind it to be made inert, and claiming a
 * dialog to a screen reader would describe a containment that does not exist.
 * The modality is carried by what the screen offers — one task, one way out —
 * which is what the guideline is actually asking for. Every task inside this
 * frame owns its own dismiss control; that is the invariant to preserve when
 * adding a route here.
 */
export function ModalTask({ children }: { children: ReactNode }) {
  return <main className="min-h-full bg-surface">{children}</main>;
}
