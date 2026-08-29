import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getResolvedLanguage } from './services/language.js'

import enTranslation from './locales/en/translation.json'
import svTranslation from './locales/sv/translation.json'
import ruTranslation from './locales/ru/translation.json'
import plTranslation from './locales/pl/translation.json'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslation },
    sv: { translation: svTranslation },
    ru: { translation: ruTranslation },
    pl: { translation: plTranslation }
  },

  lng: getResolvedLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
})

export default i18n
