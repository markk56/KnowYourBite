import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useCurrentUser, useLogout } from '@/auth/useAuth'

export function UserMenu() {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const { t } = useTranslation()

  if (!user) return null

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight text-foreground">{user.fullName}</p>
        <p className="text-xs leading-tight text-muted-foreground">{user.email}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        aria-label={t('auth.logout')}
        title={t('auth.logout')}
      >
        <LogOut />
      </Button>
    </div>
  )
}
