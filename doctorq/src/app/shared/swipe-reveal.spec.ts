import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwipeReveal } from './swipe-reveal';

@Component({
  imports: [SwipeReveal],
  template: `<div appSwipeReveal #swipe="appSwipeReveal"></div>`,
})
class HostComponent {}

function pointerEvent(clientX: number): PointerEvent {
  return { clientX } as PointerEvent;
}

describe('SwipeReveal', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const directive = fixture.debugElement.children[0].injector.get(SwipeReveal);
    return { directive };
  }

  it('starts closed with no transform offset', () => {
    const { directive } = setup();
    expect(directive.open()).toBe(false);
    expect(directive.transformStyle()).toBe('translateX(0px)');
  });

  it('follows the finger while dragging left, clamped to the reveal width', () => {
    const { directive } = setup();
    directive.onPointerDown(pointerEvent(300));
    directive.onPointerMove(pointerEvent(250));
    expect(directive.transformStyle()).toBe('translateX(-50px)');

    directive.onPointerMove(pointerEvent(0));
    expect(directive.transformStyle()).toBe('translateX(-148px)');
  });

  it('snaps open when released past half the reveal width', () => {
    const { directive } = setup();
    directive.onPointerDown(pointerEvent(300));
    directive.onPointerMove(pointerEvent(140));
    directive.onPointerEnd();

    expect(directive.open()).toBe(true);
    expect(directive.transformStyle()).toBe('translateX(-148px)');
  });

  it('snaps closed when released before half the reveal width', () => {
    const { directive } = setup();
    directive.onPointerDown(pointerEvent(300));
    directive.onPointerMove(pointerEvent(280));
    directive.onPointerEnd();

    expect(directive.open()).toBe(false);
    expect(directive.transformStyle()).toBe('translateX(0px)');
  });

  it('closes on demand, e.g. after a revealed action fires', () => {
    const { directive } = setup();
    directive.onPointerDown(pointerEvent(300));
    directive.onPointerMove(pointerEvent(140));
    directive.onPointerEnd();
    expect(directive.open()).toBe(true);

    directive.close();
    expect(directive.open()).toBe(false);
    expect(directive.transformStyle()).toBe('translateX(0px)');
  });
});
