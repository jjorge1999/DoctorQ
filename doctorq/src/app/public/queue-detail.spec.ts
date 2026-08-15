import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { QueueDetail } from './queue-detail';
import { QueueService } from '../core/queue.service';

describe('QueueDetail', () => {
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
      startsAt: '09:00',
      endsAt: '15:00',
      note: '',
      updatedAt: Date.now(),
    },
    doctor: { id: 'd-1', fullName: 'Dr. Test', specialty: 'General', hospitalIds: ['h-1'] },
    hospital: { id: 'h-1', name: 'Test Hospital', address: '1 Test St', city: 'Testville' },
    waiting: 3,
    waitingNumbers: [6, 7, 8],
    slotsLeft: 12,
    acceptingNewPatients: true,
    estimatedWaitMinutes: 30,
  };

  function setup(matches = false) {
    (globalThis as any).matchMedia = vi.fn().mockReturnValue({ matches });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: QueueService, useValue: { entry$: () => of(entry) } },
      ],
    });
    const fixture = TestBed.createComponent(QueueDetail);
    fixture.componentRef.setInput('id', 'q-1');
    fixture.detectChanges();
    return fixture;
  }

  it('reads prefers-reduced-motion from matchMedia', () => {
    expect(setup(true).componentInstance.prefersReducedMotion).toBe(true);
  });

  it('defaults reduced-motion to false when the system has no preference', () => {
    expect(setup(false).componentInstance.prefersReducedMotion).toBe(false);
  });

  it('gives the display panel a view-transition-name matching the queue id', () => {
    const fixture = setup();
    const el = fixture.nativeElement.querySelector('.display') as HTMLElement;
    expect(el.style.getPropertyValue('view-transition-name')).toBe('queue-number-q-1');
  });

  it('renders the "open" advice tone for an accepting, non-cutoff queue', () => {
    const fixture = setup();
    const advice = fixture.nativeElement.querySelector('.advice');
    expect(advice.classList.contains('open')).toBe(true);
  });
});
