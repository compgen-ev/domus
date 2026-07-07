import { describe, it, expect } from 'vitest';
import './building-edit-form';
import type { BuildingEditForm } from './building-edit-form';
import { parseDate } from '../utils/dates';

describe('edit form dirty detection (repro)', () => {
  async function mountForm() {
    const el = document.createElement('building-edit-form') as BuildingEditForm;
    (el as any).building = {
      id: 'Q1', label: 'Haus', lat: 48, lng: 11,
      inception: { value: parseDate('1850')! },
    };
    (el as any).detail = {
      heritages: [], images: [], architects: [], commissionedBy: [],
      occupants: [], owners: [], addresses: [], replacedBy: [], replaces: [],
    };
    document.body.appendChild(el);
    await (el as any).updateComplete;
    return el as any;
  }

  it('starts clean', async () => {
    const el = await mountForm();
    expect(el._canSave).toBe(false);
    el.remove();
  });

  it('typing a new date via the real input chain enables save (with source)', async () => {
    const el = await mountForm();
    el.sourceUrl = 'https://example.com/x';
    await el.updateComplete;

    const sdi = el.shadowRoot!.querySelector('statement-date-input') as any;
    expect(sdi).toBeTruthy();
    await sdi.updateComplete;
    const di = sdi.shadowRoot!.querySelector('date-input') as any;
    expect(di).toBeTruthy();
    await di.updateComplete;
    const input = di.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('1850');

    input.value = '1900';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    expect(el.formInception.value).toBe('1900');
    expect(el._inceptionChanged).toBe(true);
    expect(el._canSave).toBe(true);
    el.remove();
  });

  it('changing only the mode dropdown also marks dirty', async () => {
    const el = await mountForm();
    el.sourceUrl = 'https://example.com/x';
    const sdi = el.shadowRoot!.querySelector('statement-date-input') as any;
    sdi.dispatchEvent(new CustomEvent('edit-changed', {
      detail: { mode: 'before', value: '1850', earliest: '', latest: '1850' },
    }));
    await el.updateComplete;
    expect(el._inceptionChanged).toBe(true);
    expect(el._canSave).toBe(true);
    el.remove();
  });
});

describe('Q140374595 shape (vor 1409)', () => {
  async function mountForm() {
    const el = document.createElement('building-edit-form') as any;
    el.building = {
      id: 'Q140374595', label: 'Haus', lat: 48, lng: 9,
      inception: { latest: parseDate('1409')! },
    };
    el.detail = {
      heritages: [], images: [], architects: [], commissionedBy: [],
      occupants: [], owners: [], addresses: [], replacedBy: [], replaces: [],
    };
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  it('typing a different bound in vor mode marks dirty', async () => {
    const el = await mountForm();
    el.sourceUrl = 'https://example.com/x';
    const sdi = el.shadowRoot!.querySelector('statement-date-input') as any;
    await sdi.updateComplete;
    expect(sdi.edit).toEqual({ mode: 'before', value: '', earliest: '', latest: '1409' });
    const di = sdi.shadowRoot!.querySelector('date-input') as any;
    await di.updateComplete;
    const input = di.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('1409');
    input.value = '1410';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(el._inceptionChanged).toBe(true);
    expect(el._canSave).toBe(true);
    el.remove();
  });

  it('WITHOUT a source, the button stays disabled despite the change', async () => {
    const el = await mountForm();
    const sdi = el.shadowRoot!.querySelector('statement-date-input') as any;
    await sdi.updateComplete;
    const di = sdi.shadowRoot!.querySelector('date-input') as any;
    await di.updateComplete;
    const input = di.shadowRoot!.querySelector('input') as HTMLInputElement;
    input.value = '1410';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(el._inceptionChanged).toBe(true);
    expect(el._canSave).toBe(false); // greyed: claim change requires a source
    el.remove();
  });
});

describe('save hint', () => {
  async function mountForm() {
    const el = document.createElement('building-edit-form') as any;
    el.building = {
      id: 'Q1', label: 'Haus', lat: 48, lng: 11,
      inception: { value: parseDate('1850')! },
    };
    el.detail = {
      heritages: [], images: [], architects: [], commissionedBy: [],
      occupants: [], owners: [], addresses: [], replacedBy: [], replaces: [],
    };
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  it('shows no hint and disables save with no changes', async () => {
    const el = await mountForm();
    expect(el._canSave).toBe(false);
    expect(el.shadowRoot!.querySelector('.save-hint')).toBeNull();
    el.remove();
  });

  it('shows a hint when a claim changed but no source was given', async () => {
    const el = await mountForm();
    const sdi = el.shadowRoot!.querySelector('statement-date-input') as any;
    await sdi.updateComplete;
    const di = sdi.shadowRoot!.querySelector('date-input') as any;
    await di.updateComplete;
    const input = di.shadowRoot!.querySelector('input') as HTMLInputElement;
    input.value = '1900';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    expect(el._canSave).toBe(false);
    const hint = el.shadowRoot!.querySelector('.save-hint');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toContain('Quelle erforderlich');
    el.remove();
  });

  it('hint disappears once a source is filled in', async () => {
    const el = await mountForm();
    const sdi = el.shadowRoot!.querySelector('statement-date-input') as any;
    await sdi.updateComplete;
    const di = sdi.shadowRoot!.querySelector('date-input') as any;
    await di.updateComplete;
    const input = di.shadowRoot!.querySelector('input') as HTMLInputElement;
    input.value = '1900';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.sourceUrl = 'https://example.com/x';
    await el.updateComplete;

    expect(el._canSave).toBe(true);
    expect(el.shadowRoot!.querySelector('.save-hint')).toBeNull();
    el.remove();
  });

  it('label-only changes need no source and show no hint', async () => {
    const el = await mountForm();
    el.formLabel = 'Neuer Name';
    await el.updateComplete;
    expect(el._canSave).toBe(true);
    expect(el.shadowRoot!.querySelector('.save-hint')).toBeNull();
    el.remove();
  });
});
