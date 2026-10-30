import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AVATAR_MAX_BYTES, AVATAR_TYPES, passwordChangeSchema, profileUpdateSchema, type User } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { Camera, CircleUser, Eye, EyeOff, RefreshCw, TriangleAlert } from '@/components/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { announce } from '@/lib/announce'
import { usePageMeta } from '@/lib/page-meta'
import { cn } from '@/lib/utils'
import { useChangePassword, useProfile, useRemoveAvatar, useUpdateAvatar, useUpdateProfile } from '@/queries/account'

function issuesToErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {}
  for (const i of issues) out[String(i.path[0])] ??= i.message
  return out
}

function focusFirst(form: HTMLFormElement | null, errors: Record<string, string>) {
  const first = Object.keys(errors)[0]
  if (first) form?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
}

export function ProfilePage() {
  usePageMeta({ title: 'Perfil do colecionador — Kurio' })
  const profile = useProfile()
  if (profile.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando perfil">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="size-20 rounded-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    )
  }
  if (profile.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <TriangleAlert size={16} />
        <div className="flex flex-col gap-2">
          <AlertDescription>{toApiError(profile.error).message}</AlertDescription>
          <Button size="sm" variant="outline" onClick={() => void profile.refetch()}>
            <RefreshCw size={14} /> Tentar novamente
          </Button>
        </div>
      </Alert>
    )
  }
  return (
    <div className="flex flex-col gap-10">
      <ProfileForm user={profile.data} />
      <PasswordForm />
    </div>
  )
}

async function resizeToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
  bitmap.close()
  return canvas.toDataURL('image/webp', 0.86)
}

function AvatarEditor({ user }: { user: User }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string>()
  const update = useUpdateAvatar()
  const remove = useRemoveAvatar()

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(undefined)
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      setError('Formato não suportado. Envie uma imagem PNG, JPG ou WebP.')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError('A imagem deve ter no máximo 2 MB.')
      return
    }
    try {
      const dataUrl = await resizeToDataUrl(file)
      update.mutate(dataUrl, {
        onSuccess: () => {
          announce('Foto de perfil atualizada.')
          toast.success('Foto de perfil atualizada')
        },
        onError: (err) => setError(toApiError(err).fieldErrors.dataUrl ?? toApiError(err).message),
      })
    } catch {
      setError('Não foi possível ler a imagem selecionada.')
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-surface-2" data-testid="avatar-preview">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={`Foto de perfil de ${user.displayName}`} width={80} height={80} className="size-full object-cover" />
        ) : (
          <CircleUser size={80} strokeWidth={1} className="text-muted-foreground" aria-label="Sem foto de perfil" role="img" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id="avatar-input"
            type="file"
            accept={AVATAR_TYPES.join(',')}
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
            aria-describedby={error ? 'avatar-error avatar-hint' : 'avatar-hint'}
            data-testid="avatar-input"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} loading={update.isPending}>
            <Camera size={14} /> Alterar foto
          </Button>
          {user.avatarUrl ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => remove.mutate(undefined, { onSuccess: () => announce('Foto removida.') })} loading={remove.isPending}>
              Remover
            </Button>
          ) : null}
        </div>
        <p id="avatar-hint" className="text-[0.6875rem] text-subtle-foreground">
          PNG, JPG ou WebP, até 2 MB. A imagem é recortada em 256×256.
        </p>
        {error ? (
          <p id="avatar-error" role="alert" className="text-xs text-destructive" data-testid="avatar-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function ProfileForm({ user }: { user: User }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState({ displayName: user.displayName, username: user.username, email: user.email, bio: user.bio })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const update = useUpdateProfile()
  useEffect(() => setValues({ displayName: user.displayName, username: user.username, email: user.email, bio: user.bio }), [user])
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(undefined)
    const parsed = profileUpdateSchema.safeParse(values)
    if (!parsed.success) {
      const errs = issuesToErrors(parsed.error.issues)
      setErrors(errs)
      focusFirst(formRef.current, errs)
      return
    }
    setErrors({})
    update.mutate(parsed.data, {
      onSuccess: () => {
        toast.success('Perfil atualizado')
        announce('Perfil atualizado com sucesso.')
      },
      onError: (err) => {
        const apiErr = toApiError(err)
        setErrors(apiErr.fieldErrors)
        setFormError(apiErr.message)
        focusFirst(formRef.current, apiErr.fieldErrors)
        announce(apiErr.message, 'assertive')
      },
    })
  }

  return (
    <section aria-labelledby="profile-title" className="flex flex-col gap-5">
      <h1 id="profile-title" className="text-sm font-bold">
        Perfil do colecionador
      </h1>
      <AvatarEditor user={user} />
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4" data-testid="profile-form">
        {formError ? (
          <Alert variant="destructive" role="alert">
            <TriangleAlert size={16} />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="profile-name" label="Nome de exibição" required error={errors.displayName}>
            {(p) => <Input {...p} name="displayName" autoComplete="name" value={values.displayName} onChange={set('displayName')} />}
          </Field>
          <Field id="profile-username" label="Nome de usuário" required error={errors.username} description="Letras minúsculas, números, ponto e sublinhado.">
            {(p) => <Input {...p} name="username" autoComplete="username" value={values.username} onChange={set('username')} />}
          </Field>
          <Field id="profile-email" label="E-mail" required error={errors.email}>
            {(p) => <Input {...p} name="email" type="email" autoComplete="email" value={values.email} onChange={set('email')} />}
          </Field>
        </div>
        <Field id="profile-bio" label="Bio" error={errors.bio} description={`${values.bio.length}/280`}>
          {(p) => <Textarea {...p} name="bio" maxLength={280} value={values.bio} onChange={set('bio')} />}
        </Field>
        <div>
          <Button type="submit" loading={update.isPending} data-testid="profile-save">
            Salvar
          </Button>
        </div>
      </form>
    </section>
  )
}

function PasswordField({ id, name, label, value, onChange, error, autoComplete }: { id: string; name: string; label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <Field id={id} label={label} required error={error}>
      {(p) => (
        <div className="relative">
          <Input {...p} name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
            aria-pressed={visible}
            className={cn('absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      )}
    </Field>
  )
}

function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const change = useChangePassword()
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = passwordChangeSchema.safeParse(values)
    if (!parsed.success) {
      const errs = issuesToErrors(parsed.error.issues)
      setErrors(errs)
      focusFirst(formRef.current, errs)
      return
    }
    setErrors({})
    change.mutate(parsed.data, {
      onSuccess: () => {
        setValues({ currentPassword: '', newPassword: '', confirmPassword: '' })
        toast.success('Senha alterada', { description: 'Outras sessões abertas foram encerradas.' })
        announce('Senha alterada com sucesso.')
      },
      onError: (err) => {
        const apiErr = toApiError(err)
        const errs = Object.keys(apiErr.fieldErrors).length ? apiErr.fieldErrors : { currentPassword: apiErr.message }
        setErrors(errs)
        focusFirst(formRef.current, errs)
        announce(Object.values(errs).join(' '), 'assertive')
      },
    })
  }
  return (
    <section aria-labelledby="password-title" className="flex max-w-md flex-col gap-4">
      <h2 id="password-title" className="text-sm font-bold">
        Alterar senha
      </h2>
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4" data-testid="password-form">
        <PasswordField id="pw-current" name="currentPassword" label="Senha atual" autoComplete="current-password" value={values.currentPassword} onChange={(v) => setValues((s) => ({ ...s, currentPassword: v }))} error={errors.currentPassword} />
        <PasswordField id="pw-new" name="newPassword" label="Nova senha" autoComplete="new-password" value={values.newPassword} onChange={(v) => setValues((s) => ({ ...s, newPassword: v }))} error={errors.newPassword} />
        <PasswordField id="pw-confirm" name="confirmPassword" label="Confirmar nova senha" autoComplete="new-password" value={values.confirmPassword} onChange={(v) => setValues((s) => ({ ...s, confirmPassword: v }))} error={errors.confirmPassword} />
        <div>
          <Button type="submit" loading={change.isPending} data-testid="password-save">
            Salvar
          </Button>
        </div>
      </form>
    </section>
  )
}
