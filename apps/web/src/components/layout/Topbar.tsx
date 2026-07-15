import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'

export function Topbar({ title }: { title?: string }) {
  const { t } = useTranslation()
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <h2 className="text-xl font-semibold text-foreground">{title ?? t('app.name')}</h2>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
