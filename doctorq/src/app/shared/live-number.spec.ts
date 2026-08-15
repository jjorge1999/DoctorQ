import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LiveNumber } from './live-number';

@Component({
  imports: [LiveNumber],
  template: `<app-live-number [value]="value()" />`,
})
class HostComponent {
  readonly value = signal(0);
}

describe('LiveNumber', () => {
  it('renders one digit column per digit of the value', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set(42);
    fixture.detectChanges();

    const tracks = fixture.nativeElement.querySelectorAll('.digit-track');
    expect(tracks.length).toBe(2);
  });

  it('positions each digit column to show the current digit', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set(7);
    fixture.detectChanges();

    const col = fixture.nativeElement.querySelector('.digit-col') as HTMLElement;
    expect(col.style.transform).toBe('translateY(calc(-7 * 1.2em))');
  });

  it('handles a value of zero as a single "0" digit', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set(0);
    fixture.detectChanges();

    const tracks = fixture.nativeElement.querySelectorAll('.digit-track');
    expect(tracks.length).toBe(1);
    expect(tracks[0].textContent).toContain('0');
  });

  it('does not flash on first render', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set(5);
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('.live-number') as HTMLElement;
    expect(el.classList.contains('flash')).toBe(false);
  });

  it('flashes when the value changes after the initial render, then clears', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set(5);
    fixture.detectChanges();

    fixture.componentInstance.value.set(6);
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('.live-number') as HTMLElement;
    expect(el.classList.contains('flash')).toBe(true);

    vi.advanceTimersByTime(520);
    fixture.detectChanges();
    expect(el.classList.contains('flash')).toBe(false);

    vi.useRealTimers();
  });
});
