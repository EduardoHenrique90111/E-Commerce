/**
 * Painel "Simulação" (somente com VITE_ENABLE_MOCKS=true e VITE_MOCK_DEVTOOLS=true).
 * Todas as ações atuam no backend simulado (window.__KURIO_MOCK__): as mudanças chegam à
 * interface pelas respostas REST e pelos eventos Socket.IO, nunca por atalhos na UI.
 */
import { useEffect, useState } from 'react'
import { FlaskConical } from './flask-icon'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { guestCartStore } from '@/session/token-store'
import { useSession } from '@/session/session'
import { SCENARIO_NAMES, onConfigChange, type ScenarioName } from '../config'
import { onRealtimeEvent } from '../events'
import { onConnectionsChange } from '../realtime'

export default function MockDevtools() {
  const control = window.__KURIO_MOCK__
  const { user } = useSession()
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState(() => control?.getConfig())
  const [scenario, setScenario] = useState<ScenarioName>(config?.scenario ?? 'default')
  const [connections, setConnections] = useState(() => control?.realtime.connections() ?? [])
  const [events, setEvents] = useState(() => control?.realtime.events().slice(-6) ?? [])
  const [message, setMessage] = useState('')

  useEffect(() => onConfigChange(setConfig), [])
  useEffect(() => onConnectionsChange(setConnections), [])
  useEffect(() => onRealtimeEvent(() => setEvents(control?.realtime.events().slice(-6) ?? [])), [control])

  if (!control || !config) return null
  const ownerKey = user ? `user:${user.id}` : `guest:${guestCartStore.get() ?? ''}`
  const firstLine = () => control.cart.firstLine(ownerKey)
  const report = (text: string) => setMessage(text)

  const actions: Array<{ label: string; run: () => void; testId: string }> = [
    {
      label: 'Subir 10% o preço do 1º item do carrinho',
      testId: 'mock-bump-price',
      run: () => {
        const line = firstLine()
        if (!line) return report('O carrinho está vazio.')
        control.nft.bumpPrice(line.nftId, 10)
        report(`Preço de ${line.nftId} alterado (evento nft.updated emitido).`)
      },
    },
    {
      label: 'Esgotar a edição do 1º item do carrinho',
      testId: 'mock-sell-out',
      run: () => {
        const line = firstLine()
        if (!line) return report('O carrinho está vazio.')
        control.nft.setAvailable(line.nftId, line.editionId, 0)
        report(`Edição ${line.editionId} de ${line.nftId} esgotada.`)
      },
    },
    { label: 'Reenviar último evento (duplicata)', testId: 'mock-replay', run: () => report(control.realtime.replay() ? 'Evento duplicado reenviado.' : 'Nenhum evento emitido ainda.') },
    {
      label: 'Enviar evento antigo do 1º item',
      testId: 'mock-stale',
      run: () => {
        const line = firstLine()
        report(line && control.realtime.emitStale(line.nftId) ? 'Evento com versão antiga enviado.' : 'Altere o preço antes para gerar versões.')
      },
    },
    { label: 'Derrubar conexões Socket.IO', testId: 'mock-disconnect', run: () => report(`${control.realtime.disconnectAll()} conexão(ões) encerrada(s).`) },
    { label: 'Expirar sessão agora', testId: 'mock-expire', run: () => report(`${control.session.expire()} sessão(ões) expirada(s). A próxima requisição autenticada receberá 401.`) },
    { label: 'Confirmar pedidos pendentes', testId: 'mock-confirm', run: () => report(`${control.orders.settleAllPending('confirmed')} pedido(s) confirmado(s).`) },
    { label: 'Recusar pedidos pendentes', testId: 'mock-reject', run: () => report(`${control.orders.settleAllPending('rejected')} pedido(s) recusado(s).`) },
    {
      label: 'Desconectar carteira (extensão)',
      testId: 'mock-wallet-disconnect',
      run: () => {
        if (!user) return report('Entre na conta primeiro.')
        control.wallet.disconnect(user.id)
        report('Carteira desconectada no servidor simulado. Recarregue os dados de pagamento.')
      },
    },
  ]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed bottom-20 left-3 z-40 inline-flex items-center gap-1.5 rounded-full border border-primary/60 bg-surface px-3 py-2 text-[0.6875rem] font-bold text-primary shadow-lg hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:bottom-4"
          data-testid="mock-devtools-toggle"
        >
          <FlaskConical /> Simulação · {config.scenario}
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(24rem,92vw)] text-xs" aria-describedby="mock-desc">
        <SheetTitle>Simulação (MSW)</SheetTitle>
        <SheetDescription id="mock-desc">
          Controle a API simulada: cenários de rede e falhas, dados e eventos em tempo real. Nada aqui altera a interface diretamente.
        </SheetDescription>

        <section className="flex flex-col gap-2">
          <Label htmlFor="mock-scenario">Cenário</Label>
          <NativeSelect id="mock-scenario" value={scenario} onChange={(e) => setScenario(e.target.value as ScenarioName)} className="text-xs">
            {SCENARIO_NAMES.map((name) => (
              <option key={name} value={name}>
                {control.scenarios[name].label}
              </option>
            ))}
          </NativeSelect>
          <p className="text-[0.6875rem] text-muted-foreground">{control.scenarios[scenario].description}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                control.useScenario(scenario)
                report(`Cenário "${control.scenarios[scenario].label}" ativo.`)
              }}
              data-testid="mock-apply-scenario"
            >
              Aplicar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                control.useScenario(scenario, { reset: true })
                window.location.reload()
              }}
            >
              Aplicar e restaurar dados
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-border pt-3">
          <h3 className="font-bold">Ações no servidor simulado</h3>
          {actions.map((a) => (
            <Button key={a.testId} size="sm" variant="secondary" className="justify-start" onClick={a.run} data-testid={a.testId}>
              {a.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="secondary"
            className="justify-start"
            onClick={() => {
              const next = !config.realtimeAvailable
              control.realtime.setAvailable(next)
              report(next ? 'Servidor de tempo real disponível.' : 'Servidor de tempo real indisponível (conexões recusadas).')
            }}
          >
            {config.realtimeAvailable ? 'Tornar tempo real indisponível' : 'Tornar tempo real disponível'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              control.reset()
              localStorage.removeItem('kurio:session-token')
              localStorage.removeItem('kurio:guest-cart')
              sessionStorage.clear()
              window.location.reload()
            }}
            data-testid="mock-reset"
          >
            Restaurar tudo (reset do cenário)
          </Button>
          <p role="status" className="min-h-4 text-[0.6875rem] text-primary">
            {message}
          </p>
        </section>

        <section className="flex flex-col gap-1 border-t border-border pt-3 text-[0.6875rem]">
          <h3 className="text-xs font-bold">Estado</h3>
          <p>
            Conexões Socket.IO: {connections.length} {connections.length ? `(${connections.map((c) => c.userId ?? 'visitante').join(', ')})` : ''}
          </p>
          <p>
            Latência: {config.latency.mode === 'none' ? 'sem atraso' : config.latency.mode === 'fixed' ? `${config.latency.ms} ms` : `${config.latency.min}–${config.latency.max} ms`}
          </p>
          <h4 className="mt-2 font-bold">Últimos eventos</h4>
          <ul className="flex flex-col gap-0.5 font-mono">
            {events.length === 0 ? <li className="text-muted-foreground">Nenhum evento ainda.</li> : null}
            {events.map((e, i) => (
              <li key={`${e.id}-${i}`}>
                {e.id} · {e.type} · {e.resource.id} · v{e.version}
              </li>
            ))}
          </ul>
        </section>
      </SheetContent>
    </Sheet>
  )
}
