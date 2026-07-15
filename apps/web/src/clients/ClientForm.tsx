import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClientCreateInput, ClientDto, ClientType, ClientUpdateInput } from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCreateClient, useUpdateClient } from './queries'

const todayIso = () => new Date().toISOString().slice(0, 10)

interface ClientFormProps {
  mode: 'create' | 'edit'
  initial?: ClientDto
  onDone: () => void
}

export function ClientForm({ mode, initial, onDone }: ClientFormProps) {
  const { t } = useTranslation()
  const [fullName, setFullName] = useState(initial?.fullName ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [clientType, setClientType] = useState<ClientType>(initial?.clientType ?? 'standard')
  const [clientSince, setClientSince] = useState(initial?.clientSince ?? todayIso())
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [localError, setLocalError] = useState<string | null>(null)

  const create = useCreateClient()
  const update = useUpdateClient(initial?.id ?? '')
  const pending = create.isPending || update.isPending
  const mutationError = create.error ?? update.error

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    if (!fullName.trim()) {
      setLocalError(t('clients.form.required'))
      return
    }

    if (mode === 'create') {
      const input: ClientCreateInput = { fullName: fullName.trim(), clientType, email, phone, clientSince, notes }
      create.mutate(input, { onSuccess: onDone })
    } else {
      const patch: ClientUpdateInput = { fullName: fullName.trim(), clientType, email, phone, clientSince, notes }
      update.mutate(patch, { onSuccess: onDone })
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="cf-fullName" className="text-sm font-medium text-foreground">
          {t('clients.form.fullName')}
        </label>
        <Input
          id="cf-fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="cf-email" className="text-sm font-medium text-foreground">
            {t('clients.form.email')}
          </label>
          <Input
            id="cf-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="cf-phone" className="text-sm font-medium text-foreground">
            {t('clients.form.phone')}
          </label>
          <Input
            id="cf-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="cf-type" className="text-sm font-medium text-foreground">
            {t('clients.form.clientType')}
          </label>
          <Select
            id="cf-type"
            value={clientType}
            onChange={(e) => setClientType(e.target.value as ClientType)}
          >
            <option value="standard">{t('clients.type.standard')}</option>
            <option value="sports">{t('clients.type.sports')}</option>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="cf-since" className="text-sm font-medium text-foreground">
            {t('clients.form.clientSince')}
          </label>
          <Input
            id="cf-since"
            type="date"
            value={clientSince}
            onChange={(e) => setClientSince(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="cf-notes" className="text-sm font-medium text-foreground">
          {t('clients.form.notes')}
        </label>
        <Textarea id="cf-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {(localError || mutationError) && (
        <p className="text-sm text-destructive">{localError ?? t('clients.form.saveError')}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          {t('clients.form.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? t('clients.form.saving')
            : mode === 'create'
              ? t('clients.form.create')
              : t('clients.form.save')}
        </Button>
      </div>
    </form>
  )
}
