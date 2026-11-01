import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Product mark: a trigger dot connected to an action dot — the whole product in one glyph. */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="0.5" y="0.5" width="19" height="19" rx="5" fill="var(--ink)" />
      <circle cx="6" cy="10" r="2.2" fill="#fff" />
      <path d="M8.5 10h4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" />
      <circle cx="14.5" cy="10" r="2.2" fill="var(--accent)" />
    </svg>
  `,
  styles: `:host { display: inline-flex; }`,
})
export class BrandMark {}
