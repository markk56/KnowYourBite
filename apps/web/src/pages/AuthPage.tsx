import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import logoUrl from '@/assets/logo.jpg'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useLogin, useRegister } from '@/auth/useAuth'

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function AuthPage() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const login = useLogin()
  const register = useRegister()
  const pending = login.isPending || register.isPending
  const error = login.error ?? register.error

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      login.mutate({ email, password })
    } else {
      register.mutate({ email, password, fullName })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-secondary">
            <img src={logoUrl} alt={t('app.name')} className="h-14 w-14 rounded-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('app.name')}</h1>
          <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
          </h2>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1">
                <label htmlFor="fullName" className="text-sm font-medium text-foreground">
                  {t('auth.fullName')}
                </label>
                <input
                  id="fullName"
                  className={inputClass}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error.message}</p>}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t('auth.pleaseWait') : mode === 'login' ? t('auth.login') : t('auth.register')}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="font-medium text-primary hover:underline"
            >
              {mode === 'login' ? t('auth.register') : t('auth.login')}
            </button>
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  )
}
