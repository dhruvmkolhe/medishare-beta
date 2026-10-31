import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '../locales/en/translation.json';
import hi from '../locales/hi/translation.json';
import gu from '../locales/gu/translation.json';
import ar from '../locales/ar/translation.json';
import fr from '../locales/fr/translation.json';

import bn from '../locales/bn/translation.json';
import mr from '../locales/mr/translation.json';
import te from '../locales/te/translation.json';
import ta from '../locales/ta/translation.json';
import kn from '../locales/kn/translation.json';
import or from '../locales/or/translation.json';
import ml from '../locales/ml/translation.json';
import pa from '../locales/pa/translation.json';
import as from '../locales/as/translation.json';
import ks from '../locales/ks/translation.json';
import sd from '../locales/sd/translation.json';
import kok from '../locales/kok/translation.json';
import ne from '../locales/ne/translation.json';
import mni from '../locales/mni/translation.json';
import brx from '../locales/brx/translation.json';
import sat from '../locales/sat/translation.json';
import doi from '../locales/doi/translation.json';
import mai from '../locales/mai/translation.json';
import sa from '../locales/sa/translation.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  gu: { translation: gu },
  ar: { translation: ar },
  fr: { translation: fr },
  bn: { translation: bn },
  mr: { translation: mr },
  te: { translation: te },
  ta: { translation: ta },
  kn: { translation: kn },
  or: { translation: or },
  ml: { translation: ml },
  pa: { translation: pa },
  as: { translation: as },
  ks: { translation: ks },
  sd: { translation: sd },
  kok: { translation: kok },
  ne: { translation: ne },
  mni: { translation: mni },
  brx: { translation: brx },
  sat: { translation: sat },
  doi: { translation: doi },
  mai: { translation: mai },
  sa: { translation: sa },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
