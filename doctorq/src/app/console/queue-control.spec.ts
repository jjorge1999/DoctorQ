import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { QueueControl } from './queue-control';
import { QueueService } from '../core/queue.service';
import { AuthService } from '../core/auth.service';
import { DirectoryService } from '../core/directory.service';

describe('QueueControl vibration feedback', () => {
  const entry = {
    session: {
      id: 'q-1',
      doctorId: 'd-1',
      hospitalId: 'h-1',
      date: '2026-08-15',
      status: 'open' as const,
      nowServing: 5,
      lastIssued: 8,
      maxSlots: 20,
      avgMinutesPerPatient: 10,
      updatedAt: Date.now(),
    },
    doctor: undefined,
    hospital: undefined,
    waiting: 2,
    waitingNumbers: [6, 7],
    acceptingNewPatients: true,
    slotsLeft: 12,
    estimatedWaitMinutes: 20,
  };

  function setup(callNext = vi.fn().mockResolvedValue(undefined)) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: QueueService, useValue: { myBoard$: of([entry]), callNext } },
        { provide: AuthService, useValue: { isAdmin: () => false } },
        {
          provide: DirectoryService,
          useValue: { myApprovedDoctors$: of([]), myPendingDoctors$: of([]) },
        },
      ],
    });
    const fixture = TestBed.createComponent(QueueControl);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('vibrates once calling next succeeds, when the Vibration API is available', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(globalThis.navigator, 'vibrate', { value: vibrate, configurable: true });

    const component = setup();
    await component.callNext(entry as any);

    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('does not vibrate when calling next fails', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(globalThis.navigator, 'vibrate', { value: vibrate, configurable: true });

    const component = setup(vi.fn().mockRejectedValue(new Error('offline')));
    await component.callNext(entry as any);

    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not throw when the Vibration API does not exist, e.g. iOS Safari', async () => {
    Object.defineProperty(globalThis.navigator, 'vibrate', { value: undefined, configurable: true });

    const component = setup();
    await expect(component.callNext(entry as any)).resolves.toBeUndefined();
  });
});
