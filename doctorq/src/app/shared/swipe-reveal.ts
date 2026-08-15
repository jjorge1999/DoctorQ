import { Directive, computed, signal } from '@angular/core';

export const SWIPE_REVEAL_WIDTH = 148;

/**
 * Swipe-left-to-reveal-actions for a card. Tracks the live drag offset while a pointer is down
 * and snaps open/closed on release, past/short of half the reveal width. `close()` is exposed for
 * a revealed action button to call after it fires, so the card snaps shut behind it.
 */
@Directive({
  selector: '[appSwipeReveal]',
  standalone: true,
  exportAs: 'appSwipeReveal',
  host: {
    '[style.transform]': 'transformStyle()',
    '[style.transition]': 'transitionStyle()',
    '[style.touch-action]': "'pan-y'",
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerEnd()',
    '(pointercancel)': 'onPointerEnd()',
  },
})
export class SwipeReveal {
  readonly open = signal(false);
  private readonly liveOffset = signal<number | null>(null);
  private startX = 0;

  readonly transformStyle = computed(() => `translateX(${this.offset()}px)`);
  readonly transitionStyle = computed(() =>
    this.liveOffset() === null ? 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
  );

  private offset(): number {
    const live = this.liveOffset();
    if (live !== null) return live;
    return this.open() ? -SWIPE_REVEAL_WIDTH : 0;
  }

  onPointerDown(event: PointerEvent): void {
    this.startX = event.clientX;
    this.liveOffset.set(this.open() ? -SWIPE_REVEAL_WIDTH : 0);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.liveOffset() === null) return;
    const base = this.open() ? -SWIPE_REVEAL_WIDTH : 0;
    const raw = base + (event.clientX - this.startX);
    this.liveOffset.set(Math.min(0, Math.max(-SWIPE_REVEAL_WIDTH, raw)));
  }

  onPointerEnd(): void {
    const offset = this.liveOffset();
    if (offset === null) return;
    this.open.set(offset <= -SWIPE_REVEAL_WIDTH / 2);
    this.liveOffset.set(null);
  }

  close(): void {
    this.open.set(false);
    this.liveOffset.set(null);
  }
}
