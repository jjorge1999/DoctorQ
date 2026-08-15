import { TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { HospitalFilterSheet, HospitalFilterSheetData } from './hospital-filter-sheet';

describe('HospitalFilterSheet', () => {
  const data: HospitalFilterSheetData = {
    hospitals: [
      { id: 'h-1', name: "St. Luke's Medical Center", address: '', city: '' },
      { id: 'h-2', name: 'Makati Medical Center', address: '', city: '' },
    ],
    selected: 'all',
  };

  function setup(overrideData: HospitalFilterSheetData = data) {
    const dismiss = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: overrideData },
        { provide: MatBottomSheetRef, useValue: { dismiss } },
      ],
    });
    const fixture = TestBed.createComponent(HospitalFilterSheet);
    fixture.detectChanges();
    return { fixture, dismiss };
  }

  it('renders "All hospitals" plus one option per hospital', () => {
    const { fixture } = setup();
    const options = fixture.nativeElement.querySelectorAll('.option');
    expect(options.length).toBe(3);
  });

  it('marks the currently selected hospital', () => {
    const { fixture } = setup({ ...data, selected: 'h-2' });
    const selected = fixture.nativeElement.querySelector('.option.selected');
    expect(selected.textContent).toContain('Makati Medical Center');
  });

  it('dismisses with the chosen hospital id when an option is clicked', () => {
    const { fixture, dismiss } = setup();
    const options: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.option');
    options[2].click(); // Makati Medical Center
    expect(dismiss).toHaveBeenCalledWith('h-2');
  });

  it('dismisses with "all" when "All hospitals" is clicked', () => {
    const { fixture, dismiss } = setup({ ...data, selected: 'h-1' });
    const options: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.option');
    options[0].click();
    expect(dismiss).toHaveBeenCalledWith('all');
  });
});
