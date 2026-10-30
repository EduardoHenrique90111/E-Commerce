# Guia passo a passo — Windows (Node.js + npm)

Este guia leva do ZIP até a aplicação rodando, os testes e a auditoria. Funciona no Windows 10 e 11.
Os comandos podem ser digitados no **PowerShell** ou no **Prompt de Comando**.

## 1. Instale o Node.js

1. Acesse <https://nodejs.org> e baixe o instalador **LTS** para Windows (`.msi`). O projeto exige
   **Node.js 22.19 ou mais recente** (o Node.js 24 LTS também serve). O npm vem junto.
2. Execute o instalador com as opções padrão.
3. Abra um **novo** PowerShell e confirme as versões:

   ```powershell
   node -v    # deve mostrar v22.19.0 ou superior
   npm -v
   ```

> Se o PowerShell disser que "a execução de scripts foi desabilitada neste sistema" ao rodar `npm`,
> execute uma vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` e confirme com `S`,
> ou use o **Prompt de Comando** (`cmd`) no lugar do PowerShell.

## 2. Extraia o projeto

1. Clique com o botão direito no ZIP → **Extrair tudo…**
2. Escolha uma pasta curta e fora do OneDrive, por exemplo `C:\projetos`. O ZIP já contém a pasta `kurio`,
   então o projeto fica em `C:\projetos\kurio` (caminhos longos e pastas sincronizadas deixam a instalação
   lenta ou causam erros de arquivo em uso).
3. Abra o PowerShell na pasta `kurio`: no Explorador de Arquivos, abra a pasta, clique na barra de
   endereço, digite `powershell` e pressione Enter. Ou:

   ```powershell
   cd C:\projetos\kurio
   ```

## 3. Instale as dependências

```powershell
npm install
```

- Leva alguns minutos na primeira vez e cria a pasta `node_modules` e o arquivo **`package-lock.json`**.
- Guarde o `package-lock.json` junto com o código (ele é o lockfile da entrega e o deploy o utiliza).
- O arquivo `.npmrc` do projeto já contém `legacy-peer-deps=true`, evitando conflitos de dependências
  entre plugins.
- Ao final, o MSW copia `public/mockServiceWorker.js` (já incluído no projeto).

## 4. Rode a aplicação (com mocks)

```powershell
npm run dev
```

Abra <http://localhost:5173>. Toda a API, a sessão, as carteiras, os pagamentos e os eventos em tempo
real são simulados no próprio navegador (MSW). Para parar, pressione `Ctrl + C` no terminal.

Contas de teste (fictícias):

| E-mail | Senha | Situação |
| --- | --- | --- |
| `ana@kurio.dev` | `Kurio@123` | carteiras principal e secundária, carrinho com itens, pedido confirmado |
| `bruno@kurio.dev` | `Kurio@456` | carteira principal, pedido `KUR-1001` |
| `carla@kurio.dev` | `Kurio@789` | conta sem carteiras |

Cupons: `KURIO10`, `LANCAMENTO`, `BOASVINDAS` (válidos) e `EXPIRADO` (expirado).

## 5. Build otimizado e preview

```powershell
npm run build        # verificação de tipos + build de produção (pasta dist)
npm run preview      # serve o dist em http://localhost:4173
```

`npm run build:demo` gera o mesmo build sem a verificação de tipos (é o usado pelo deploy, pelos testes
e pela auditoria).

## 6. Verificação de tipos e lint

```powershell
npm run typecheck
npm run lint
```

## 7. Testes E2E (Playwright)

Na primeira vez, baixe o Chromium usado pelo Playwright:

```powershell
npx playwright install chromium
```

Depois:

```powershell
npm run test:e2e       # fluxos completos em Chromium desktop e mobile (gera o build e sobe o preview sozinho)
npm run test:report    # abre o relatório HTML (reports/playwright)
```

Os testes fazem o build e iniciam o `vite preview` automaticamente. Os traces das falhas ficam em
`test-results` e podem ser abertos pelo relatório HTML.

### Regressão visual no Windows

As imagens de referência (`tests/e2e/__screenshots__`) foram geradas em **Linux**. O Windows desenha o
texto de forma ligeiramente diferente, então a comparação pixel a pixel pode acusar diferenças que não
são regressões. Há duas opções:

- **Comparar com as referências do projeto** (recomendado), executando no contêiner oficial do
  Playwright via Docker Desktop:

  ```powershell
  docker run --rm -it -v "${PWD}:/work" -w /work mcr.microsoft.com/playwright:v1.63.0-noble `
    bash -c "npm ci && npm run test:visual"
  ```

  Use a imagem com a mesma versão do `@playwright/test` instalada (`npx playwright --version`).

- **Gerar referências do seu Windows** e comparar as próximas execuções com elas:

  ```powershell
  npm run test:visual:update
  npm run test:visual
  ```

## 8. Auditoria Lighthouse

```powershell
npm run lighthouse
```

Gera o build otimizado, sobe o preview e faz **3 medições por página (início e detalhe) e perfil
(mobile e desktop)**, cada uma com o navegador limpo. Resultados:

- `lighthouse/reports/summary.md` — medianas, LCP/CLS/TBT, versões e condições;
- `lighthouse/reports/<perfil>/<página>-run<N>.report.html|json` — relatórios completos.

Leva cerca de 10 minutos. Feche outros programas pesados durante a medição: o TBT é sensível à carga
da CPU. Variações úteis:

```powershell
npm run lighthouse:mobile
npm run lighthouse -- --no-build                      # reaproveita o dist existente
npm run lighthouse -- --url=https://SEU-APP.vercel.app # audita a versão publicada
```

O script usa o Chromium instalado pelo Playwright (passo 7) ou, se ele não existir, o Google Chrome.
Para escolher outro executável: `$env:CHROME_PATH="C:\caminho\chrome.exe"`.

## 9. Cenários de simulação

- Painel **Simulação** (botão no canto inferior da tela): escolhe cenários, restaura os dados e dispara
  eventos de tempo real.
- Pela URL: `http://localhost:5173/?scenario=payment-declined` aplica um cenário;
  `?reset=1` restaura todos os dados simulados. A lista completa está no README.

## 10. Publicar na Vercel

1. Crie um repositório no GitHub e envie o projeto **com o `package-lock.json`**:

   ```powershell
   git init
   git add .
   git commit -m "Kurio"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/kurio.git
   git push -u origin main
   ```

2. Em <https://vercel.com>, **Add New → Project**, importe o repositório e confirme. O `vercel.json` já
   define o comando de build (`npm run build:demo`), a pasta `dist`, o fallback de rotas da SPA (acesso
   direto e refresh) e os cabeçalhos do service worker do MSW. Nenhuma variável de ambiente é obrigatória:
   os valores de demonstração estão em `.env.production`.

Netlify e Cloudflare Pages também funcionam: comando `npm run build:demo`, pasta `dist`
(o fallback de rotas está em `public/_redirects`).

## Problemas comuns

| Sintoma | Solução |
| --- | --- |
| `node` não é reconhecido | Reabra o terminal depois de instalar o Node.js; confira se o instalador adicionou o Node ao PATH. |
| `EBADENGINE` / erro de versão | Atualize o Node.js para 22.19+ (ou 24 LTS). |
| Porta 5173 ou 4173 ocupada | Feche o outro processo (`Ctrl + C` no terminal dele) ou use `npm run dev -- --port 5180`. O preview usa a 4173 fixa, exigida pelos testes. |
| `npm install` muito lento ou com erro `EPERM` | Mova a pasta para fora do OneDrive; adicione a pasta às exceções do antivírus; tente de novo após `npm cache verify`. |
| Dados simulados "estranhos" depois de testes | Acesse `/?reset=1` ou use **Restaurar tudo** no painel Simulação. |
| Página antiga após atualizar o código | `Ctrl + F5`; se persistir, DevTools → Application → Clear site data (remove o service worker antigo do MSW). |
