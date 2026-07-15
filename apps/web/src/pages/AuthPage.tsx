import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileDown,
  Globe,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import logoUrl from '@/assets/logo.jpg'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useLogin, useRegister } from '@/auth/useAuth'
import { cn } from '@/lib/utils'

interface Feature {
  key: string
  icon: LucideIcon
  iconClass: string
}

const FEATURES: Feature[] = [
  { key: 'crm', icon: Users, iconClass: 'from-amber-400 to-amber-600' },
  { key: 'assessments', icon: ClipboardList, iconClass: 'from-emerald-400 to-emerald-600' },
  { key: 'recipes', icon: BookOpen, iconClass: 'from-orange-400 to-orange-600' },
  { key: 'planner', icon: CalendarDays, iconClass: 'from-lime-400 to-lime-600' },
  { key: 'ai', icon: Sparkles, iconClass: 'from-yellow-400 to-amber-600' },
  { key: 'pdf', icon: FileDown, iconClass: 'from-rose-400 to-rose-600' },
]

const inputClass =
  'w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function AuthPage() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const login = useLogin()
  const register = useRegister()
  const pending = login.isPending || register.isPending
  // Only surface the current mode's error (avoids a stale login error masking a
  // registration error and vice-versa).
  const activeError = mode === 'login' ? login.error : register.error

  const switchMode = () => {
    login.reset()
    register.reset()
    setMode((m) => (m === 'login' ? 'register' : 'login'))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      login.mutate({ email, password })
    } else {
      register.mutate({ email, password, fullName })
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left — auth form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-sm">
              <img src={logoUrl} alt={t('app.name')} className="h-9 w-9 rounded-xl object-contain" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">{t('app.name')}</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === 'login' ? t('marketing:form.loginSubtitle') : t('marketing:form.registerSubtitle')}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === 'register' && (
              <Field id="fullName" label={t('auth.fullName')} icon={Users}>
                <input
                  id="fullName"
                  className={inputClass}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </Field>
            )}

            <Field id="email" label={t('auth.email')} icon={Mail}>
              <input
                id="email"
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>

            <Field id="password" label={t('auth.password')} icon={Lock}>
              <input
                id="password"
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </Field>

            {activeError && (
              <p className="text-sm font-medium text-destructive">{activeError.message}</p>
            )}

            <Button type="submit" className="mt-2 h-11 w-full" disabled={pending}>
              {pending ? t('auth.pleaseWait') : mode === 'login' ? t('auth.login') : t('auth.register')}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
            <button
              type="button"
              onClick={switchMode}
              className="font-semibold text-primary hover:underline"
            >
              {mode === 'login' ? t('auth.register') : t('auth.login')}
            </button>
          </p>

          <div className="mt-12 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">© 2026 {t('app.name')}</p>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      {/* Right — branded showcase (desktop only) */}
      <div
        className="relative hidden overflow-hidden px-16 py-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-center"
        style={{ background: 'linear-gradient(135deg, hsl(36 16% 11%), hsl(36 18% 16%))' }}
      >
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />

        <div className="relative z-10 mx-auto w-full max-w-xl">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
            {t('marketing:headline')}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">{t('marketing:subheadline')}</p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.key}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition hover:bg-white/10"
                >
                  <div
                    className={cn(
                      'mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm',
                      feature.iconClass,
                    )}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    {t(`marketing:features.${feature.key}.title`)}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">
                    {t(`marketing:features.${feature.key}.body`)}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/50">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> {t('marketing:badges.gdpr')}
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-4 w-4" /> {t('marketing:badges.languages')}
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> {t('marketing:badges.ai')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  icon: Icon,
  children,
}: {
  id: string
  label: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {children}
      </div>
    </div>
  )
}
