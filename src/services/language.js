const LANGUAGE_STORAGE_KEY = 'vibemoments-language'

export const SUPPORTED_LANGUAGES = [
  {
    code: 'system',
    label: 'System default'
  },
  {
    code: 'en',
    label: 'English'
  },
  {
    code: 'sv',
    label: 'Svenska'
  },
  {
    code: 'ru',
    label: 'Русский'
  },
  {
    code: 'pl',
    label: 'Polski'
  }
]

export const getDeviceLanguage = () => {
  return navigator.language?.split('-')[0] || 'en'
}

export const getSavedLanguage = () => {
  return localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'system'
}

export const getResolvedLanguage = () => {
  const savedLanguage = getSavedLanguage()

  if (savedLanguage !== 'system') {
    return savedLanguage
  }

  const deviceLanguage = getDeviceLanguage()

  return ['en', 'sv', 'ru', 'pl'].includes(deviceLanguage) ? deviceLanguage : 'en'
}

export const saveLanguage = (language) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
}
