import { initLocale } from './locale';

initLocale().then(() => import('./components/app-root'));
