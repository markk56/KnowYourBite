import { Link, useLocation } from 'wouter'
import { BookOpen, CalendarDays, LayoutDashboard, Settings, Users, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import logoUrl from '@/assets/logo.jpg'
import { cn } from '@/lib/utils'

interface NavItem {
  path: string
  labelKey: string
  icon: LucideIcon
  /** false until the module ships — shown with a "coming soon" tag. */
  ready: boolean
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, ready: true },
  { path: '/clients', labelKey: 'nav.clients', icon: Users, ready: true },
  { path: '/recipes', labelKey: 'nav.recipes', icon: BookOpen, ready: true },
  { path: '/planner', labelKey: 'nav.planner', icon: CalendarDays, ready: true },
  { path: '/settings', labelKey: 'nav.settings', icon: Settings, ready: false },
]

export function Sidebar() {
  const [location] = useLocation()
  const { t } = useTranslation()

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-3 border-b border-sidebar-border p-6">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-secondary">
          <img src={logoUrl} alt={t('app.name')} className="h-8 w-8 rounded-full object-contain" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-sidebar-foreground">{t('app.name')}</h1>
          <p className="text-xs text-muted-foreground">{t('app.tagline')}</p>
        </div>
      </div>

      <nav className="p-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = location === item.path
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={cn(
                    'flex items-center gap-3 rounded-lg p-3 text-sm font-medium transition-colors',
                    active
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{t(item.labelKey)}</span>
                  {!item.ready && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                      {t('nav.comingSoon')}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
