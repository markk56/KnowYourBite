import { useTranslation } from 'react-i18next'

export function DashboardPlaceholder() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <h3 className="text-2xl font-semibold text-foreground">{t('shell.welcomeTitle')}</h3>
        <p className="mt-2 text-muted-foreground">{t('shell.welcomeBody')}</p>
      </div>
    </div>
  )
}
