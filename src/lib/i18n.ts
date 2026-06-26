import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import frCommon from '../locales/fr/common.json';
import enCommon from '../locales/en/common.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { common: frCommon },
      en: { common: enCommon },
    },
    defaultNS: 'common',
    fallbackLng: 'fr',
    lng: 'fr',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
