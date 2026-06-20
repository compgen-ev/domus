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
