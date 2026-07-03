import { css } from 'lit';
import { designTokens } from './design-tokens';

export const baseStyles = css`
  ${designTokens}

  :host {
    font-family: var(--font-family);
    -webkit-font-smoothing: antialiased;
    color: var(--color-text-primary);
  }
`;

/**
 * Icon button styles
 */
export const iconButtonStyles = css`
  .btn-icon {
    background: none;
    border: none;
    padding: var(--space-1);
    color: var(--icon-button-color);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: color var(--transition-fast);
    font-size: 20px;
  }

  .btn-icon:hover:not(:disabled) {
    color: var(--icon-button-color-hover);
  }

  .btn-icon:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/**
 * Shared styles for the map's floating control panels (OHM outlines,
 * historical layer picker) — anything rendering a `.control-panel` box.
 */
export const controlPanelStyles = css`
  .control-panel {
    background: var(--color-bg-primary);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    padding: var(--space-2) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    overflow-y: auto;
    max-height: 100%;
  }

  .control-summary {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: none;
    border: none;
    padding: var(--space-1) 0;
    margin: 0;
    font-family: inherit;
    font-size: var(--font-size-sm);
    color: var(--icon-button-color);
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: color var(--transition-fast);
  }

  .control-summary:hover {
    color: var(--icon-button-color-hover);
  }

  .control-summary > domus-icon,
  .control-summary-icon domus-icon {
    font-size: 22px;
  }

  .control-summary-icon {
    position: relative;
    display: inline-flex;
  }

  .control-summary-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-accent);
    border: 1.5px solid var(--color-bg-primary);
  }

  .control-summary-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary);
  }

  .time-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .time-header h4 {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
  }

  .slider-label {
    display: block;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: calc(-1 * var(--space-1));
  }

  .year-input {
    width: 80px;
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    text-align: center;
    font-family: inherit;
  }

  .year-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    margin: var(--space-2) 0;
    background: var(--color-border);
    border-radius: 2px;
    outline: none;
  }

  .year-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-primary);
    border: 2px solid var(--color-bg-primary);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }

  .year-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-primary);
    border: 2px solid var(--color-bg-primary);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }

  .year-slider:disabled::-webkit-slider-thumb {
    background: var(--color-text-muted);
  }

  .year-slider:disabled::-moz-range-thumb {
    background: var(--color-text-muted);
  }

  .historical-select {
    width: 100%;
    padding: var(--space-2) calc(var(--space-3) + 16px) var(--space-2) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-family: inherit;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    box-sizing: border-box;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24'%3E%3Cpath fill='%23475569' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--space-2) center;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }

  .historical-select:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: var(--shadow-focus);
  }

  .historical-select:disabled {
    opacity: 0.5;
  }

  .attribution-note {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .attribution-note a {
    color: inherit;
  }
`;
