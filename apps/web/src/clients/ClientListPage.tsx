import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { useTranslation } from 'react-i18next'
import { Mail, Phone, Search, UserPlus, Users } from 'lucide-react'
import type { ClientDto, ClientType } from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ClientForm } from './ClientForm'
import { useClients } from './queries'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

function ClientCard({ client }: { client: ClientDto }) {
  const { t } = useTranslation()
  const completed = client.assessmentStatus === 'completed'
  return (
    <Link
      href={`/clients/${client.id}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-semibold text-primary-foreground">
          {initials(client.fullName) || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{client.fullName}</p>
          <span className="text-xs text-muted-foreground">{t(`clients.type.${client.clientType}`)}</span>
        </div>
      </div>

      <span
        className={cn(
          'inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium',
          completed ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {t(`clients.status.${client.assessmentStatus}`)}
      </span>

      <div className="space-y-1 text-sm text-muted-foreground">
        {client.email && (
          <p className="flex items-center gap-2 truncate">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{client.email}</span>
          </p>
        )}
        {client.phone && (
          <p className="flex items-center gap-2 truncate">
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{client.phone}</span>
          </p>
        )}
      </div>
    </Link>
  )
}

export function ClientListPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'' | ClientType>('')
  const [createOpen, setCreateOpen] = useState(false)

  const query = useMemo(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(type ? { type } : {}),
    }),
    [search, type],
  )
  const { data: clients, isPending, isError } = useClients(query)
  const hasFilters = !!search.trim() || !!type

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('clients.title')}</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" />
          {t('clients.new')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('clients.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('clients.searchPlaceholder')}
          />
        </div>
        <Select
          className="w-auto"
          value={type}
          onChange={(e) => setType(e.target.value as '' | ClientType)}
          aria-label={t('clients.type.label')}
        >
          <option value="">{t('clients.filter.all')}</option>
          <option value="standard">{t('clients.type.standard')}</option>
          <option value="sports">{t('clients.type.sports')}</option>
        </Select>
      </div>

      {isPending ? (
        <p className="text-muted-foreground">{t('clients.loading')}</p>
      ) : isError ? (
        <p className="text-destructive">{t('clients.loadError')}</p>
      ) : clients.length === 0 ? (
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          {hasFilters ? (
            <>
              <h3 className="text-lg font-semibold text-foreground">{t('clients.emptySearch.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('clients.emptySearch.body')}</p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-foreground">{t('clients.empty.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('clients.empty.body')}</p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <UserPlus className="h-4 w-4" />
                {t('clients.empty.cta')}
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={t('clients.form.createTitle')}>
        <ClientForm mode="create" onDone={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  )
}
