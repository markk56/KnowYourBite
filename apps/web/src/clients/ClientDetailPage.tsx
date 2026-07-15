import { useState } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ClipboardList, Mail, Pencil, Phone, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ClientForm } from './ClientForm'
import { useClient, useDeleteClient } from './queries'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

export function ClientDetailPage() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const id = params.id ?? ''
  const [, setLocation] = useLocation()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: client, isPending, isError } = useClient(id)
  const remove = useDeleteClient()

  const backLink = (
    <Link href="/clients" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      {t('clients.detail.back')}
    </Link>
  )

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {backLink}
        <p className="text-muted-foreground">{t('clients.loading')}</p>
      </div>
    )
  }

  if (isError || !client) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {backLink}
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <h3 className="text-lg font-semibold text-foreground">{t('clients.detail.notFound')}</h3>
        </div>
      </div>
    )
  }

  const completed = client.assessmentStatus === 'completed'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {backLink}

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-lg font-semibold text-primary-foreground">
              {initials(client.fullName) || '?'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{client.fullName}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {t(`clients.type.${client.clientType}`)}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    completed ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {t(`clients.status.${client.assessmentStatus}`)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              {t('clients.detail.edit')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              {t('clients.detail.delete')}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {t('clients.detail.clientSince')}: {client.clientSince}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('clients.detail.contact')}
        </h3>
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2 text-foreground">
            <Mail className="h-4 w-4 text-muted-foreground" />
            {client.email ?? <span className="text-muted-foreground">{t('clients.detail.noEmail')}</span>}
          </p>
          <p className="flex items-center gap-2 text-foreground">
            <Phone className="h-4 w-4 text-muted-foreground" />
            {client.phone ?? <span className="text-muted-foreground">{t('clients.detail.noPhone')}</span>}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('clients.detail.assessment')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{t(`clients.status.${client.assessmentStatus}`)}</p>
          </div>
          <Button onClick={() => setLocation(`/clients/${client.id}/assessment`)}>
            <ClipboardList className="h-4 w-4" />
            {completed ? t('clients.detail.viewAssessment') : t('clients.detail.startAssessment')}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('clients.detail.notes')}
        </h3>
        {client.notes ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">{client.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t('clients.detail.noNotes')}</p>
        )}
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={t('clients.form.editTitle')}>
        <ClientForm mode="edit" initial={client} onDone={() => setEditOpen(false)} />
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('clients.delete.title')}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('clients.delete.body', { name: client.fullName })}</p>
          {remove.error && <p className="text-sm text-destructive">{t('clients.delete.error')}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={remove.isPending}>
              {t('clients.delete.cancel')}
            </Button>
            <Button
              onClick={() =>
                remove.mutate(client.id, { onSuccess: () => setLocation('/clients') })
              }
              disabled={remove.isPending}
            >
              {t('clients.delete.confirm')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
