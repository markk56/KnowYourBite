import { useTranslation } from 'react-i18next'
import { SUPPORTED_LOCALES } from '@kyb/i18n'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = i18n.resolvedLanguage

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('actions.language')}>
      {SUPPORTED_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => void i18n.changeLanguage(locale)}
          aria-pressed={current === locale}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium uppercase transition-colors',
            current === locale
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {locale}
        </button>
      ))}
    </div>
  )
}
