import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { QueueBoard } from './queue-board';
import { QueueService } from '../core/queue.service';
import { DirectoryService } from '../core/directory.service';

describe('QueueBoard hospital filter', () => {
  const hospitals = [
    { id: 'h-1', name: "St. Luke's Medical Center", address: '', city: '' },
    { id: 'h-2', name: 'Makati Medical Center', address: '', city: '' },
  ];

  function setup(dismissedWith: string | undefined = undefined) {
    const open = vi.fn().mockReturnValue({ afterDismissed: () => of(dismissedWith) });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: QueueService, useValue: { board$: of([]) } },
        { provide: DirectoryService, useValue: { hospitals$: of(hospitals) } },
        { provide: MatBottomSheet, useValue: { open } },
      ],
    });
    const fixture = TestBed.createComponent(QueueBoard);
    fixture.detectChanges();
    return { component: fixture.componentInstance, open };
  }

  it('opens the hospital filter sheet with the current hospitals and selection', () => {
    const { component, open } = setup();
    component.hospitalFilter.set('h-1');
    component.openHospitalFilter();

    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: { hospitals, selected: 'h-1' } }),
    );
  });

  it('updates the hospital filter when the sheet is dismissed with a hospital id', () => {
    const { component } = setup('h-2');
    component.openHospitalFilter();
    expect(component.hospitalFilter()).toBe('h-2');
  });

  it('leaves the hospital filter unchanged when the sheet is dismissed with no selection', () => {
    const { component } = setup(undefined);
    component.hospitalFilter.set('h-1');
    component.openHospitalFilter();
    expect(component.hospitalFilter()).toBe('h-1');
  });

  it('computes the active hospital name for the filter chip', () => {
    const { component } = setup();
    component.hospitalFilter.set('h-2');
    expect(component.activeHospitalName()).toBe('Makati Medical Center');
  });
});

describe('QueueBoard reduced motion', () => {
  function setupWithMatchMedia(matches: boolean) {
    (globalThis as any).matchMedia = vi.fn().mockReturnValue({ matches });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: QueueService, useValue: { board$: of([]) } },
        { provide: DirectoryService, useValue: { hospitals$: of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(QueueBoard);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('reads prefers-reduced-motion from matchMedia', () => {
    expect(setupWithMatchMedia(true).prefersReducedMotion).toBe(true);
  });

  it('defaults to false when the system has no preference', () => {
    expect(setupWithMatchMedia(false).prefersReducedMotion).toBe(false);
  });
});
