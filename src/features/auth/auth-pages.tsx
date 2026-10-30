import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { loginRequestSchema, registerRequestSchema } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { Eye, EyeOff, Info, TriangleAlert } from '@/components/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { announce } from '@/lib/announce'
import { usePageMeta } from '@/lib/page-meta'
import { cn } from '@/lib/utils'
import { HomePage } from '@/features/catalog/home-page'
import { completeAuth, safeRedirect, useSession } from '@/session/session'

type Mode = 'login' | 'register'

function zodErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) out[String(i.path[0])] ??= i.message
  return out
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-10', props.className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        aria-controls={props.id}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

function focusFirstError(form: HTMLFormElement | null, errors: Record<string, string>) {
  const first = Object.keys(errors)[0]
  if (first) form?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
}

function SocialButtons() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-[0.6875rem] text-muted-foreground">Ou continue com</p>
      {['Google', 'Facebook'].map((p) => (
        <Button key={p} type="button" variant="secondary" disabled aria-describedby="social-unavailable" className="w-full">
          Continuar com {p}
        </Button>
      ))}
      <p id="social-unavailable" className="text-center text-[0.625rem] text-subtle-foreground">
        Login social indisponível nesta demonstração.
      </p>
    </div>
  )
}

function LoginForm({ redirect, reason }: { redirect?: string; reason?: 'expired' }) {
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(undefined)
    const parsed = loginRequestSchema.safeParse(values)
    if (!parsed.success) {
      const errs = zodErrors(parsed.error.issues)
      setErrors(errs)
      focusFirstError(formRef.current, errs)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      const auth = await api.auth.login(parsed.data)
      completeAuth(auth)
      announce(`Bem-vindo de volta, ${auth.session.user.displayName}.`)
      toast.success(`Olá, ${auth.session.user.displayName.split(' ')[0]}!`, { description: 'Login realizado.' })
      void navigate({ to: safeRedirect(redirect), replace: true })
    } catch (err) {
      const apiErr = toApiError(err)
      if (Object.keys(apiErr.fieldErrors).length) setErrors(apiErr.fieldErrors)
      setFormError(apiErr.message)
      announce(apiErr.message, 'assertive')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4" aria-labelledby="auth-title" data-testid="login-form">
      {reason === 'expired' ? (
        <Alert variant="warning" data-testid="session-expired-alert">
          <Info size={16} />
          <AlertDescription>Sua sessão expirou. Entre novamente para continuar de onde parou.</AlertDescription>
        </Alert>
      ) : null}
      {formError ? (
        <Alert variant="destructive" role="alert" data-testid="auth-error">
          <TriangleAlert size={16} />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <Field id="login-email" label="E-mail" required error={errors.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" placeholder="nome@email.com" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />}
      </Field>
      <Field id="login-password" label="Senha" required error={errors.password}>
        {(p) => <PasswordInput {...p} name="password" autoComplete="current-password" value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} />}
      </Field>
      <button
        type="button"
        className="-mt-2 self-end text-[0.6875rem] text-primary hover:underline"
        onClick={() => toast.info('Recuperação de senha', { description: 'Indisponível nesta demonstração. Use as credenciais fictícias do README.' })}
      >
        Esqueceu a senha?
      </button>
      <Button type="submit" size="lg" loading={loading} data-testid="login-submit">
        Entrar
      </Button>
      <SocialButtons />
    </form>
  )
}

function RegisterForm({ redirect }: { redirect?: string }) {
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState({ displayName: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(undefined)
    const parsed = registerRequestSchema.safeParse(values)
    const errs = parsed.success ? {} : zodErrors(parsed.error.issues)
    if (!values.confirm) errs.confirm = 'Confirme sua senha.'
    else if (values.confirm !== values.password) errs.confirm = 'As senhas não conferem.'
    if (!parsed.success || Object.keys(errs).length) {
      setErrors(errs)
      focusFirstError(formRef.current, errs)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      const auth = await api.auth.register(parsed.data)
      completeAuth(auth)
      announce('Conta criada com sucesso.')
      toast.success('Conta criada!', { description: `Bem-vindo à Kurio, ${auth.session.user.displayName}.` })
      void navigate({ to: safeRedirect(redirect), replace: true })
    } catch (err) {
      const apiErr = toApiError(err)
      if (Object.keys(apiErr.fieldErrors).length) {
        setErrors(apiErr.fieldErrors)
        focusFirstError(formRef.current, apiErr.fieldErrors)
      }
      setFormError(apiErr.message)
      announce(apiErr.message, 'assertive')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4" aria-labelledby="auth-title" data-testid="register-form">
      {formError ? (
        <Alert variant="destructive" role="alert" data-testid="auth-error">
          <TriangleAlert size={16} />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <Field id="reg-name" label="Nome de exibição" required error={errors.displayName}>
        {(p) => <Input {...p} name="displayName" autoComplete="name" value={values.displayName} onChange={set('displayName')} />}
      </Field>
      <Field id="reg-email" label="E-mail" required error={errors.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" placeholder="nome@email.com" value={values.email} onChange={set('email')} />}
      </Field>
      <Field id="reg-password" label="Senha" required error={errors.password} description="Mínimo de 8 caracteres, com maiúscula, minúscula e número.">
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" value={values.password} onChange={set('password')} />}
      </Field>
      <Field id="reg-confirm" label="Confirmar senha" required error={errors.confirm}>
        {(p) => <PasswordInput {...p} name="confirm" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} />}
      </Field>
      <Button type="submit" size="lg" loading={loading} data-testid="register-submit">
        Criar perfil
      </Button>
      <SocialButtons />
    </form>
  )
}

function AuthScreen({ mode }: { mode: Mode }) {
  const search = useSearch({ strict: false }) as { redirect?: string; reason?: 'expired' }
  const navigate = useNavigate()
  const { isAuthenticated } = useSession()
  usePageMeta({ title: mode === 'login' ? 'Entrar — Kurio' : 'Criar conta — Kurio' })

  // já autenticado: segue para o destino
  useEffect(() => {
    if (isAuthenticated) void navigate({ to: safeRedirect(search.redirect), replace: true })
  }, [isAuthenticated, navigate, search.redirect])

  const close = () => {
    const target = safeRedirect(search.redirect)
    const isPrivate = ['/pagamento', '/perfil', '/pedidos', '/favoritos'].some((p) => target.startsWith(p))
    void navigate({ to: isPrivate ? '/' : target })
  }

  return (
    <>
      <div inert aria-hidden="true" className="hidden md:block">
        <HomePage search={{}} interactive={false} />
      </div>
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent
          className="max-w-sm max-md:inset-0 max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-h-dvh max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0 md:border-b-4 md:border-b-primary"
          closeLabel="Fechar e voltar"
          onOpenAutoFocus={(e) => {
            // foco no primeiro campo do formulário
            e.preventDefault()
            ;(document.querySelector('[data-auth-dialog] input') as HTMLInputElement | null)?.focus()
          }}
          data-auth-dialog=""
        >
          <p className="pt-6 text-center text-lg font-extrabold tracking-[0.3em] md:hidden" aria-hidden="true">
            KURIO
          </p>
          <nav aria-label="Acesso à conta" className="flex justify-center gap-3 text-sm font-bold">
            <Link to="/entrar" search={{ redirect: search.redirect }} aria-current={mode === 'login' ? 'page' : undefined} className={cn('rounded-sm px-1', mode === 'login' ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
              Entrar
            </Link>
            <span aria-hidden="true" className="text-border">
              |
            </span>
            <Link to="/cadastro" search={{ redirect: search.redirect }} aria-current={mode === 'register' ? 'page' : undefined} className={cn('rounded-sm px-1', mode === 'register' ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
              Criar conta
            </Link>
          </nav>
          <DialogTitle id="auth-title" className="sr-only">
            {mode === 'login' ? 'Entrar na Kurio' : 'Criar conta de colecionador'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {mode === 'login' ? 'Entre para gerenciar sua coleção, carteiras e pedidos.' : 'Crie seu perfil de colecionador para comprar e favoritar NFTs.'}
          </DialogDescription>
          {mode === 'login' ? <LoginForm redirect={search.redirect} reason={search.reason} /> : <RegisterForm redirect={search.redirect} />}
          <p className="text-center text-[0.6875rem] text-muted-foreground">
            {mode === 'login' ? (
              <>
                Novo na Kurio?{' '}
                <Link to="/cadastro" search={{ redirect: search.redirect }} className="text-primary hover:underline">
                  Crie sua conta
                </Link>
              </>
            ) : (
              <>
                Já tem uma conta?{' '}
                <Link to="/entrar" search={{ redirect: search.redirect }} className="text-primary hover:underline">
                  Entrar
                </Link>
              </>
            )}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function LoginPage() {
  return <AuthScreen mode="login" />
}

export function RegisterPage() {
  return <AuthScreen mode="register" />
}
