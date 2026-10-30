import { useEffect, useRef, useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { WALLET_PROVIDERS, walletCreateSchema, walletUpdateSchema, type Network, type Wallet, type WalletProvider } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { ArrowLeft, Plus, RefreshCw, TriangleAlert } from '@/components/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { announce } from '@/lib/announce'
import { NETWORK_LABEL, PROVIDER_LABEL } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'
import { useSaveWallet, useWallets } from '@/queries/account'
import { NETWORKS_BY_PROVIDER } from '@/features/checkout/networks'

type Slot = 'primary' | 'secondary'

interface FormValues {
  name: string
  label: string
  provider: WalletProvider
  network: Network
  address: string
  email: string
  isDefault: boolean
}

const EMPTY: FormValues = { name: '', label: '', provider: 'metamask', network: 'ethereum', address: '', email: '', isDefault: false }

function toValues(w: Wallet): FormValues {
  return { name: w.name, label: w.label, provider: w.provider, network: w.network, address: w.address, email: w.email ?? '', isDefault: w.isDefault }
}

export function WalletsPage() {
  usePageMeta({ title: 'Carteiras — Kurio' })
  const search = useSearch({ strict: false }) as { from?: string }
  const wallets = useWallets()
  const [showSecondary, setShowSecondary] = useState(false)

  if (wallets.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando carteiras">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    )
  }
  if (wallets.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <TriangleAlert size={16} />
        <div className="flex flex-col gap-2">
          <AlertDescription>{toApiError(wallets.error).message}</AlertDescription>
          <Button size="sm" variant="outline" onClick={() => void wallets.refetch()}>
            <RefreshCw size={14} /> Tentar novamente
          </Button>
        </div>
      </Alert>
    )
  }
  const primary = wallets.data.items.find((w) => w.slot === 'primary')
  const secondary = wallets.data.items.find((w) => w.slot === 'secondary')

  return (
    <div className="flex flex-col gap-10">
      {search.from === 'checkout' ? (
        <div>
          <Button asChild variant="outline" size="sm">
            <Link to="/pagamento">
              <ArrowLeft size={14} /> Voltar ao pagamento
            </Link>
          </Button>
        </div>
      ) : null}
      <section aria-labelledby="primary-title" className="flex flex-col gap-4">
        <div>
          <h1 id="primary-title" className="text-sm font-bold">
            Carteira principal
          </h1>
          <p className="text-[0.6875rem] text-muted-foreground">Essa carteira será usada por padrão para pagamentos e para receber NFTs comprados.</p>
        </div>
        <WalletForm slot="primary" wallet={primary} />
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="secondary-title" className="text-sm font-bold">
              Carteira secundária
            </h2>
            <p className="text-[0.6875rem] text-muted-foreground">
              {secondary ? 'Use-a como reserva ou para outra rede.' : 'Você ainda não adicionou uma carteira secundária.'}
            </p>
          </div>
          {!secondary && !showSecondary ? (
            <Button variant="outline" size="sm" onClick={() => setShowSecondary(true)} disabled={!primary} data-testid="add-secondary">
              <Plus size={14} /> Adicionar carteira
            </Button>
          ) : null}
        </div>
        {!primary && !secondary ? <p className="text-[0.6875rem] text-subtle-foreground">Cadastre a carteira principal primeiro.</p> : null}
        {secondary || showSecondary ? <WalletForm slot="secondary" wallet={secondary} onCancel={secondary ? undefined : () => setShowSecondary(false)} /> : null}
      </section>
    </div>
  )
}

function WalletForm({ slot, wallet, onCancel }: { slot: Slot; wallet?: Wallet; onCancel?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<FormValues>(wallet ? toValues(wallet) : { ...EMPTY, isDefault: slot === 'primary' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const save = useSaveWallet()
  const id = `${slot}-wallet`
  useEffect(() => {
    if (wallet) setValues(toValues(wallet))
  }, [wallet])

  const networks = NETWORKS_BY_PROVIDER[values.provider]
  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => setValues((s) => ({ ...s, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(undefined)
    const body = { ...values, email: values.email.trim() }
    const parsed = wallet ? walletUpdateSchema.safeParse(body) : walletCreateSchema.safeParse({ ...body, slot })
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message
      setErrors(errs)
      formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(errs)[0]}"]`)?.focus()
      return
    }
    setErrors({})
    save.mutate(
      { id: wallet?.id, body: wallet ? body : { ...body, slot } },
      {
        onSuccess: () => {
          const msg = slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.'
          toast.success(msg)
          announce(msg)
        },
        onError: (err) => {
          const apiErr = toApiError(err)
          setErrors(apiErr.fieldErrors)
          setFormError(apiErr.message)
          const first = Object.keys(apiErr.fieldErrors)[0]
          if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
          announce(apiErr.message, 'assertive')
        },
      },
    )
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4" data-testid={`wallet-form-${slot}`} aria-label={slot === 'primary' ? 'Dados da carteira principal' : 'Dados da carteira secundária'}>
      {formError ? (
        <Alert variant="destructive" role="alert">
          <TriangleAlert size={16} />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-name`} label="Nome da carteira" required error={errors.name}>
          {(p) => <Input {...p} name="name" value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Carteira de coleção" />}
        </Field>
        <Field id={`${id}-label`} label="Apelido da carteira" required error={errors.label}>
          {(p) => <Input {...p} name="label" value={values.label} onChange={(e) => set('label', e.target.value)} placeholder="Ex.: Principal" />}
        </Field>
        <Field id={`${id}-provider`} label="Tipo de carteira" required error={errors.provider}>
          {(p) => (
            <NativeSelect
              {...p}
              name="provider"
              value={values.provider}
              onChange={(e) => {
                const provider = e.target.value as WalletProvider
                setValues((s) => ({ ...s, provider, network: NETWORKS_BY_PROVIDER[provider].includes(s.network) ? s.network : NETWORKS_BY_PROVIDER[provider][0] }))
              }}
            >
              {WALLET_PROVIDERS.map((w) => (
                <option key={w} value={w}>
                  {PROVIDER_LABEL[w]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id={`${id}-network`} label="Rede" required error={errors.network}>
          {(p) => (
            <NativeSelect {...p} name="network" value={values.network} onChange={(e) => set('network', e.target.value as Network)}>
              {networks.map((n) => (
                <option key={n} value={n}>
                  {NETWORK_LABEL[n]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field
          id={`${id}-address`}
          label="Endereço da carteira"
          required
          error={errors.address}
          description={values.network === 'solana' ? 'Endereço base58 (32 a 44 caracteres).' : 'Formato 0x seguido de 40 caracteres hexadecimais.'}
          className="sm:col-span-2"
        >
          {(p) => (
            <Input
              {...p}
              name="address"
              value={values.address}
              onChange={(e) => set('address', e.target.value.trim())}
              placeholder={values.network === 'solana' ? 'Ex.: 7xKX…gAsU' : 'Ex.: 0x5A3e…E1F2'}
              className="font-mono text-xs"
              spellCheck={false}
              autoComplete="off"
            />
          )}
        </Field>
        <Field id={`${id}-email`} label="E-mail de notificação (opcional)" error={errors.email}>
          {(p) => <Input {...p} name="email" type="email" value={values.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />}
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={`${id}-default`} checked={values.isDefault} onCheckedChange={(v) => set('isDefault', v === true)} />
        <Label htmlFor={`${id}-default`}>Usar como carteira padrão no pagamento</Label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending} data-testid={`wallet-save-${slot}`}>
          Salvar carteira
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  )
}
