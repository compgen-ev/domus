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
