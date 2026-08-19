import { authDictionary } from './auth';
import { calendarHubDictionary } from './calendarHub';
import { commonDictionary } from './common';
import { navDictionary } from './nav';
import { settingsDictionary } from './settings';
import type { Language } from '../language';

const NAMESPACES = [commonDictionary, authDictionary, navDictionary, calendarHubDictionary, settingsDictionary];

function mergeForLanguage(language: Language): Record<string, string> {
  return Object.assign({}, ...NAMESPACES.map((namespace) => namespace[language]));
}

export const translations: Record<Language, Record<string, string>> = {
  es: mergeForLanguage('es'),
  en: mergeForLanguage('en'),
};
