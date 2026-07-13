import { MatDialogConfig } from '@angular/material/dialog';

/**
 * Every form dialog opens the same size. Material's default sizing let the content decide,
 * which is how fields ended up overflowing the panel — the panel now decides, and the content
 * wraps and scrolls inside it.
 *
 * On phones the global stylesheet takes this to full screen; the width here is the desktop cap.
 */
export function formDialog<T>(data?: T): MatDialogConfig<T> {
  return {
    data,
    panelClass: 'app-dialog',
    width: '720px',
    maxWidth: '96vw',
    autoFocus: 'first-tabbable',
    restoreFocus: true,
  };
}

/**
 * Confirmations hold a sentence, not a form — `app-dialog-compact` keeps them a normal centered
 * sheet even on a phone, where a one-line question filling the whole screen with empty space
 * below it would read as broken, not as considered design.
 */
export function confirmDialog<T>(data: T): MatDialogConfig<T> {
  return {
    data,
    panelClass: 'app-dialog-compact',
    width: '440px',
    maxWidth: '92vw',
    autoFocus: 'dialog',
    restoreFocus: true,
  };
}
