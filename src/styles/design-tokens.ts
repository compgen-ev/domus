import { css } from 'lit';

export const designTokens = css`
  :host {
    /* ── Colors ──────────────────────────────────────────────────────────── */

    /* Primary (CompGen Blue) */
    --color-primary: #000052;
    --color-primary-hover: #00003a;
    --color-primary-light: #eef0fa;
    --color-primary-lighter: #f8f9fd;

    /* Accent (Gold) */
    --color-accent: #ffd700;
    --color-accent-dark: #e6c200;
    --color-accent-light: #fff4cc;

    /* Neutrals */
    --color-text-primary: #0f172a;
    --color-text-secondary: #475569;
    --color-text-tertiary: #64748b;
    --color-text-muted: #94a3b8;

    --color-bg-primary: #ffffff;
    --color-bg-secondary: #f8fafc;
    --color-bg-tertiary: #f1f5f9;

    --color-border: #e2e8f0;
    --color-border-light: #f1f5f9;
    --color-border-focus: var(--color-primary);

    /* Semantic */
    --color-error: #dc2626;
    --color-success: #16a34a;
    --color-warning: #f59e0b;
    --color-info: #3b82f6;

    /* Heritage badge */
    --color-heritage: #b45309;

    /* ── Typography ──────────────────────────────────────────────────────── */

    --font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;

    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;

    --font-size-xs: 0.75rem;      /* 12px */
    --font-size-sm: 0.875rem;     /* 14px */
    --font-size-base: 1rem;       /* 16px */
    --font-size-lg: 1.125rem;     /* 18px */
    --font-size-xl: 1.25rem;      /* 20px */
    --font-size-2xl: 1.5rem;      /* 24px */

    --line-height-tight: 1.25;
    --line-height-normal: 1.5;
    --line-height-relaxed: 1.75;

    /* ── Spacing ─────────────────────────────────────────────────────────── */

    --space-1: 0.25rem;   /* 4px */
    --space-2: 0.5rem;    /* 8px */
    --space-3: 0.75rem;   /* 12px */
    --space-4: 1rem;      /* 16px */
    --space-5: 1.25rem;   /* 20px */
    --space-6: 1.5rem;    /* 24px */
    --space-8: 2rem;      /* 32px */
    --space-10: 2.5rem;   /* 40px */
    --space-12: 3rem;     /* 48px */

    /* ── Border Radius ───────────────────────────────────────────────────── */

    --radius-sm: 0.25rem;  /* 4px */
    --radius-md: 0.375rem; /* 6px */
    --radius-lg: 0.5rem;   /* 8px */
    --radius-xl: 0.75rem;  /* 12px */
    --radius-full: 624.9375rem; /* pill */

    /* ── Shadows ─────────────────────────────────────────────────────────── */

    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    --shadow-focus: 0 0 0 3px rgba(0, 0, 82, 0.1);

    /* ── Transitions ─────────────────────────────────────────────────────── */

    --transition-fast: 150ms ease;
    --transition-normal: 200ms ease;
    --transition-slow: 300ms ease;

    /* ── Z-index ─────────────────────────────────────────────────────────── */

    --z-base: 1;
    --z-dropdown: 10;
    --z-sticky: 20;
    --z-overlay: 30;
    --z-modal: 40;
    --z-toast: 50;

    /* ── Component Tokens ────────────────────────────────────────────────── */

    /* App bar */
    --appbar-height: 44px;

    /* Panel */
    --panel-width-desktop: 400px;
    --panel-height-mobile: 70vh;

    /* Content */
    --content-max-width: 680px;
  }
`;

/**
 * Shared button styles
 */
export const buttonStyles = css`
  button {
    font-family: var(--font-family);
    cursor: pointer;
    transition: all var(--transition-fast);
    border: none;
    font-weight: var(--font-weight-medium);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Primary button */
  .btn-primary {
    background: var(--color-primary);
    color: white;
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  /* Secondary button */
  .btn-secondary {
    background: transparent;
    color: var(--color-text-secondary);
    padding: var(--space-3) var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--color-bg-secondary);
    border-color: var(--color-text-muted);
  }

  /* Accent button */
  .btn-accent {
    background: var(--color-accent);
    color: var(--color-primary);
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }

  .btn-accent:hover:not(:disabled) {
    background: var(--color-accent-dark);
  }

  /* Pill button (rounded) */
  .btn-pill {
    border-radius: var(--radius-full);
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-xs);
  }

  /* Link button */
  .btn-link {
    background: none;
    color: var(--color-primary);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
  }

  .btn-link:hover:not(:disabled) {
    background: var(--color-primary-light);
  }
`;

/**
 * Shared badge/pill styles
 */
export const badgeStyles = css`
  .badge {
    display: inline-block;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-xl);
  }

  .badge-primary {
    background: var(--color-primary);
    color: white;
  }

  .badge-accent {
    background: var(--color-accent);
    color: var(--color-primary);
  }

  .badge-heritage {
    background: var(--color-accent);
    color: var(--color-primary);
  }

  .badge-outline {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
  }
`;

/**
 * Shared input styles
 */
export const inputStyles = css`
  input,
  textarea,
  select {
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }

  input:focus,
  textarea:focus,
  select:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: var(--shadow-focus);
  }

  textarea {
    resize: vertical;
  }

  label {
    display: block;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
`;
