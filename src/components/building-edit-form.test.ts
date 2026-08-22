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
      aliases: [],
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
      aliases: [],
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
      aliases: [],
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

describe('background refresh while editing', () => {
  async function mountForm(savedValues?: any) {
    const el = document.createElement('building-edit-form') as any;
    el.building = {
      id: 'Q1', label: 'Haus', lat: 48, lng: 11,
      inception: { value: parseDate('1850')! },
    };
    el.detail = {
      aliases: [],
      heritages: [], images: [], architects: [], commissionedBy: [],
      occupants: [], owners: [], addresses: [], replacedBy: [], replaces: [],
    };
    if (savedValues) el.savedValues = savedValues;
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  it('keeps typed input when the same building is replaced by fresher data', async () => {
    const el = await mountForm();
    el.formLabel = 'Neuer Name';
    el.sourceUrl = 'https://example.com/x';
    await el.updateComplete;

    // A scheduled refresh hands down a new object for the same building.
    el.building = {
      id: 'Q1', label: 'Haus', lat: 48, lng: 11,
      inception: { value: parseDate('1850')! },
      modified: '2026-08-20T10:00:00Z',
    };
    await el.updateComplete;

    expect(el.formLabel).toBe('Neuer Name');
    expect(el.sourceUrl).toBe('https://example.com/x');
    expect(el._canSave).toBe(true);
    el.remove();
  });

  it('still resets when a different building is shown', async () => {
    const el = await mountForm();
    el.formLabel = 'Neuer Name';
    el.sourceUrl = 'https://example.com/x';
    await el.updateComplete;

    el.building = { id: 'Q2', label: 'Anderes Haus', lat: 48, lng: 11 };
    await el.updateComplete;

    expect(el.formLabel).toBe('Anderes Haus');
    expect(el.sourceUrl).toBe('');
    expect(el._canSave).toBe(false);
    el.remove();
  });

  it('clears add-semantics fields when a different building is shown', async () => {
    const el = await mountForm();
    el.formArchitect = { id: 'Q42', label: 'Gottfried Semper' };
    el.formAddress = 'Hauptstr. 1';
    await el.updateComplete;

    el.building = { id: 'Q2', label: 'Anderes Haus', lat: 48, lng: 11 };
    await el.updateComplete;

    expect(el.formArchitect).toBeUndefined();
    expect(el.formAddress).toBe('');
    expect(el._canSave).toBe(false);
    el.remove();
  });
});

describe('prefill from a just-saved edit (SPARQL still stale)', () => {
  async function mountWithSaved() {
    const el = document.createElement('building-edit-form') as any;
    // What SPARQL still returns: the pre-edit state.
    el.building = {
      id: 'Q1', label: 'Haus', lat: 48, lng: 11,
      inception: { value: parseDate('1850')! },
    };
    el.detail = {
      aliases: [],
      heritages: [], images: [], architects: [], commissionedBy: [],
      occupants: [], owners: [], addresses: [], replacedBy: [], replaces: [],
    };
    // What we actually saved a moment ago.
    el.savedValues = {
      id: 'Q1',
      label: 'Neuhaus',
      inception: { value: parseDate('1900')! },
    };
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  it('prefills from the saved values, not the stale query result', async () => {
    const el = await mountWithSaved();
    expect(el.formLabel).toBe('Neuhaus');
    expect(el.formInception.value).toBe('1900');
    el.remove();
  });

  it('starts clean, so the previous edit is not silently re-saved', async () => {
    const el = await mountWithSaved();
    expect(el._inceptionChanged).toBe(false);
    expect(el._canSave).toBe(false);
    el.remove();
  });

  it('detects changes against the saved values', async () => {
    const el = await mountWithSaved();
    el.formLabel = 'Neuhaus II';
    await el.updateComplete;
    expect(el._canSave).toBe(true);
    el.remove();
  });

  it('ignores saved values belonging to another building', async () => {
    const el = await mountWithSaved();
    el.savedValues = { id: 'Q999', label: 'Falsch' };
    el.building = { id: 'Q2', label: 'Anderes Haus', lat: 48, lng: 11 };
    await el.updateComplete;
    expect(el.formLabel).toBe('Anderes Haus');
    el.remove();
  });
});

describe('the baseline is frozen for the lifetime of the form', () => {
  async function mount(props: any = {}) {
    const el = document.createElement('building-edit-form') as any;
    el.building = {
      id: 'Q1', label: 'Haus', lat: 48, lng: 11,
      inception: { value: parseDate('1850')! },
    };
    el.detail = null;
    Object.assign(el, props);
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  const detailWith = (demolished?: any) => ({
    heritages: [], images: [], architects: [], commissionedBy: [],
    occupants: [], owners: [], addresses: [], replacedBy: [], replaces: [],
    ...(demolished ? { demolished } : {}),
  });

  // The invariant that matters: data landing mid-edit never makes the form look
  // dirty, so Save never lights up and no source is demanded for a change the
  // user did not make.
  it('stays clean when a detail fetch lands with a demolition date', async () => {
    const el = await mount();
    expect(el._canSave).toBe(false);

    el.detail = detailWith({ value: parseDate('1900')! });
    await el.updateComplete;

    expect(el._demolishedChanged).toBe(false);
    expect(el._canSave).toBe(false);
    expect(el.shadowRoot!.querySelector('.save-hint')).toBeNull();
    el.remove();
  });

  it('stays clean when a same-id refresh brings a fresher inception', async () => {
    const el = await mount();
    el.building = {
      id: 'Q1', label: 'Haus', lat: 48, lng: 11,
      inception: { value: parseDate('1851')! },
    };
    await el.updateComplete;

    expect(el.formInception.value).toBe('1850'); // frozen, not re-anchored
    expect(el._inceptionChanged).toBe(false);
    expect(el._canSave).toBe(false);
    el.remove();
  });

  it('stays clean when a same-id refresh brings a different label', async () => {
    const el = await mount();
    el.building = { id: 'Q1', label: 'Altes Haus', lat: 48, lng: 11 };
    await el.updateComplete;

    expect(el.formLabel).toBe('Haus');
    expect(el._canSave).toBe(false);
    el.remove();
  });

  it('keeps user input when a same-id refresh arrives', async () => {
    const el = await mount();
    el.formInception = { ...el.formInception, value: '1799' };
    el.formLabel = 'Mein Name';
    el.sourceUrl = 'https://example.com/x';
    await el.updateComplete;

    el.building = {
      id: 'Q1', label: 'Ganz anders', lat: 48, lng: 11,
      inception: { value: parseDate('1851')! },
    };
    el.detail = detailWith({ value: parseDate('1900')! });
    await el.updateComplete;

    expect(el.formInception.value).toBe('1799');
    expect(el.formLabel).toBe('Mein Name');
    expect(el._inceptionChanged).toBe(true);
    expect(el._canSave).toBe(true);
    el.remove();
  });

  it('takes the baseline from a just-saved overlay, and stale data cannot dislodge it', async () => {
    // The real lifecycle: the overlay is already set when the form mounts,
    // because a save closes the form and app-root stores the values first.
    const el = await mount({
      savedValues: {
        id: 'Q1',
        label: 'Neuhaus',
        inception: { value: parseDate('1900')! },
        demolished: { value: parseDate('1950')! },
      },
    });
    expect(el.formLabel).toBe('Neuhaus');
    expect(el.formInception.value).toBe('1900');
    expect(el.formDemolished.value).toBe('1950');
    expect(el._canSave).toBe(false);

    // Stale SPARQL results arriving afterwards must not override the save.
    el.detail = detailWith({ value: parseDate('1800')! });
    await el.updateComplete;

    expect(el.formDemolished.value).toBe('1950');
    expect(el._demolishedChanged).toBe(false);
    expect(el._canSave).toBe(false);
    el.remove();
  });
});

describe('the date inputs interpret against the same baseline the save uses', () => {
  // _renderEcho and _save both call editToStatementDate, and `previous` changes
  // its result (calendar model, carried-over earliest/latest). Feeding them
  // different `previous` values lets the preview disagree with what gets sent.
  async function mount(demolished?: any) {
    const el = document.createElement('building-edit-form') as any;
    el.building = {
      id: 'Q1', label: 'Haus', lat: 48, lng: 11,
      inception: { value: parseDate('1850')! },
    };
    el.detail = {
      aliases: [],
      heritages: [], images: [], architects: [], commissionedBy: [],
      occupants: [], owners: [], addresses: [], replacedBy: [], replaces: [],
      ...(demolished ? { demolished } : {}),
    };
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  const dateInputs = (el: any) =>
    Array.from(el.shadowRoot!.querySelectorAll('statement-date-input')) as any[];

  it('pins inception `previous` to the baseline when a refresh brings a newer one', async () => {
    const el = await mount();
    const baseline = el._base.inception;
    expect(dateInputs(el)[0].previous).toBe(baseline);

    el.building = {
      id: 'Q1', label: 'Haus', lat: 48, lng: 11,
      inception: { value: parseDate('1851')! },
    };
    await el.updateComplete;

    expect(dateInputs(el)[0].previous).toBe(baseline);
    el.remove();
  });

  it('keeps demolished `previous` while the detail prop churns mid-edit', async () => {
    const el = await mount({ value: parseDate('1900')! });
    const baseline = el._base.demolished;
    expect(baseline).toBeDefined();
    expect(dateInputs(el)[1].previous).toBe(baseline);

    // app-root nulls buildingDetail before each refetch, so the prop really does
    // drop out from under an open form.
    el.detail = null;
    await el.updateComplete;

    expect(dateInputs(el)[1].previous).toBe(baseline);
    el.remove();
  });
});

describe('the alias field edits the whole list', () => {
  async function mount(detail: unknown, savedValues?: unknown) {
    const el = document.createElement('building-edit-form') as any;
    el.building = { id: 'Q1', label: 'Haus', lat: 48, lng: 11 };
    el.detail = detail;
    if (savedValues) el.savedValues = savedValues;
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  const loaded = (aliases: string[]) => ({
    aliases,
    heritages: [], images: [], architects: [], commissionedBy: [],
    occupants: [], owners: [], addresses: [], replacedBy: [], replaces: [],
  });

  const aliasInput = (el: any) =>
    el.shadowRoot!.querySelectorAll('input[type="text"]')[1] as HTMLInputElement;

  it('prefills with the aliases the item already has', async () => {
    const el = await mount(loaded(['Müllerhof', 'Alte Schmiede']));
    expect(el.formAliases).toBe('Müllerhof, Alte Schmiede');
    expect(el._canSave).toBe(false);
    el.remove();
  });

  it('marks dirty when a name is added', async () => {
    const el = await mount(loaded(['Müllerhof']));
    el.formAliases = 'Müllerhof, Alte Schmiede';
    await el.updateComplete;
    expect(el._aliasesChanged).toBe(true);
    expect(el._canSave).toBe(true);
    el.remove();
  });

  it('marks dirty when the field is emptied, so aliases can be removed', async () => {
    const el = await mount(loaded(['Müllerhof']));
    el.formAliases = '';
    await el.updateComplete;
    expect(el._aliasesChanged).toBe(true);
    expect(el._canSave).toBe(true);
    el.remove();
  });

  it('ignores whitespace-only differences', async () => {
    const el = await mount(loaded(['Müllerhof', 'Alte Schmiede']));
    el.formAliases = ' Müllerhof ,Alte Schmiede ';
    await el.updateComplete;
    expect(el._aliasesChanged).toBe(false);
    el.remove();
  });

  describe('when the detail fetch never delivered', () => {
    // The edit button is disabled while detail loads, but a failed fetch
    // leaves it enabled with no detail at all. Replacing the alias list
    // against a baseline we never learned would drop the item's real aliases.
    it('disables the field rather than editing an unknown list', async () => {
      const el = await mount(null);
      expect(el._aliasesKnown).toBe(false);
      expect(aliasInput(el).disabled).toBe(true);
      el.remove();
    });

    it('sends nothing even if the field somehow holds text', async () => {
      const el = await mount(null);
      el.formAliases = 'Müllerhof';
      await el.updateComplete;
      expect(el._aliasesChanged).toBe(false);
      expect(el._canSave).toBe(false);
      el.remove();
    });

    it('takes the aliases from a just-saved edit when there is one', async () => {
      const el = await mount(null, { id: 'Q1', label: 'Haus', aliases: ['Müllerhof'] });
      expect(el._aliasesKnown).toBe(true);
      expect(el.formAliases).toBe('Müllerhof');
      expect(aliasInput(el).disabled).toBe(false);
      el.remove();
    });
  });
});
