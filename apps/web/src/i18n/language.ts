export type Language = 'es' | 'en';

export const LANGUAGE_STORAGE_KEY = 'calendar.language';
export const DEFAULT_LANGUAGE: Language = 'es';

export function localeForLanguage(language: Language): string {
  return language === 'en' ? 'en-US' : 'es-ES';
}
