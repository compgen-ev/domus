import { configureLocalization } from '@lit/localize';
import { sourceLocale, targetLocales } from './locale-codes';

const localeModules = import.meta.glob('./locales/*.ts');

export const { getLocale, setLocale } = configureLocalization({
  sourceLocale,
  targetLocales,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadLocale: (locale) => localeModules[`./locales/${locale}.ts`]() as any,
});

export async function initLocale(): Promise<void> {
  const lang = (navigator.languages?.[0] ?? navigator.language ?? '').slice(0, 2);
  const target = (targetLocales as readonly string[]).includes(lang) ? lang : sourceLocale;
  if (target !== sourceLocale) {
    await setLocale(target);
  }
}
