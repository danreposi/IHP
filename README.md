# 📎 Papelaria & Impressões — Site

Site completo para uma papelaria/centro de impressões, com loja para o cliente,
carrinho, checkout e finalização do pedido pelo WhatsApp, além de um painel
administrativo completo em `/admin`.

## 📂 Estrutura do projeto

```
papelaria-site/
├── frontend/           → HTML, CSS e JS do site (loja + painel admin)
│   ├── index.html       → Página da loja
│   ├── admin.html       → Painel administrativo (/admin)
│   ├── css/style.css    → Todo o visual do site (tema claro/escuro/sistema)
│   ├── js/
│   │   ├── config.js     → Liga/desliga o backend (modo local x modo API)
│   │   ├── utils.js        → Funções compartilhadas (escapeHtml, preços/limites com promoção e variação)
│   │   ├── seed.js          → Dados iniciais (categorias/produtos de exemplo)
│   │   ├── db.js              → Camada de dados (localStorage OU API)
│   │   ├── theme.js             → Troca de tema
│   │   ├── store.js               → Lógica da loja (carrinho, checkout, WhatsApp)
│   │   └── admin.js                → Lógica do painel administrativo
│   └── data/                          → Onde o botão "Publicar"/backup automático grava os JSON no GitHub
│
└── backend/             → API + banco de dados (Node.js/Express), para quando
    ├── server.js           você tiver uma hospedagem própria (não o GitHub Pages)
    ├── db.js
    ├── githubBackup.js     → Backup automático (debounced) pro GitHub
    ├── githubRestore.js    → Restaura o catálogo do GitHub se o disco for zerado (Render free tier)
    ├── routes/
    └── middleware/
```

## 🆕 Novidades desta revisão

**Correções de bugs:**
- 🔒 Corrigido um XSS real: nome/telefone/observações de clientes e nomes de produto/categoria agora passam por `escapeHtml()` antes de entrar na tela — antes, um cliente podia digitar HTML/JS no campo "Nome" do checkout e ele rodava na tela do admin.
- 🔄 `backend/githubRestore.js` e `backend/githubBackup.js` existiam mas nunca eram chamados por nenhuma rota — ou seja, a restauração automática (proteção contra o disco zerado do Render) e o backup automático debounced não funcionavam de verdade. Agora estão conectados no `server.js` e em todas as rotas de escrita.
- 🏷️ O indicador "Token já configurado" no painel sempre mostrava "nenhum token salvo", mesmo com o token salvo — a API nunca devolvia essa informação. Agora existe um campo `githubTokenConfigured` (booleano, sem expor o segredo).
- 📦 Publicação manual (`/api/github/publish`) não incluía o backup de pedidos mesmo com a opção ligada — corrigido, e agora reaproveita o mesmo código do backup automático (evita bugs por código duplicado).
- 🧹 Removidos `LICENSE`/`README.md` duplicados que tinham ido parar dentro de `frontend/css/`, e o `.gitignore`/`.env.example` que haviam sumido.

**Já existentes nesta versão (mantidos):** produtos com promoção (%, ou R$ fixo), variações com preço/quantidade mínima/máxima próprios, controle de estoque com bloqueio de "Esgotado", gráfico de vendas dos últimos 7 dias no dashboard, busca/filtro de pedidos, exportação de pedidos em CSV, reordenar produtos/categorias com ▲▼, duplicar produto.

## 🧠 Como o site funciona (modo local x modo backend)

Você pediu para, por enquanto, usar **apenas o GitHub** (sem hospedagem de
servidor). Por isso o site foi feito em **dois modos**, que já funcionam hoje:

### 1) Modo local (recomendado por enquanto, funciona 100% no GitHub Pages)
- Tudo (produtos, categorias, pedidos, senha do admin) fica salvo no
  **localStorage do navegador** de quem acessa o `/admin` daquele computador.
- Não precisa instalar nada, não precisa de servidor.
- Configuração: em `frontend/js/config.js`, deixe `API_BASE_URL: ""`.
- **Importante:** como não existe banco compartilhado, os pedidos feitos pelos
  clientes finais aparecem no WhatsApp da loja (isso sempre funciona), mas o
  *dashboard* de estatísticas só mostra os dados salvos no navegador de quem
  está com o `/admin` aberto. Para um controle compartilhado entre vários
  dispositivos, use o modo backend abaixo.

### 2) Modo backend (quando você contratar uma hospedagem para o servidor)
- Sobe a pasta `backend/` em qualquer serviço que rode Node.js (Render,
  Railway, um VPS, etc). Ele já vem com **banco de dados** (arquivo
  `backend/data/db.json`, criado automaticamente) e uma **API** completa.
- Depois, em `frontend/js/config.js`, troque:
  ```js
  API_BASE_URL: "https://SEU-BACKEND.onrender.com/api"
  ```
- Pronto: o site (rodando no GitHub Pages ou onde estiver) passa a usar o
  backend e o banco de dados de verdade, com tudo sincronizado entre
  qualquer dispositivo/admin.

Você pode migrar de um modo para o outro a qualquer momento, sem reescrever o
site — é só essa única linha em `config.js`.

## 🚀 Publicando no GitHub Pages (hospedagem gratuita, "por enquanto")

1. Crie um repositório novo no GitHub (ex: `papelaria-site`).
2. Suba TODO o conteúdo deste ZIP para o repositório.
3. No GitHub, vá em **Settings → Pages**.
4. Em "Branch", selecione a branch principal (`main`) e a pasta **`/frontend`**
   (ou mova o conteúdo de `frontend/` para a raiz, se preferir). Salve.
5. Em alguns minutos o GitHub vai te dar um link (algo como
   `https://seu-usuario.github.io/papelaria-site/`) — esse é o site no ar.
6. Acesse `.../admin.html` para entrar no painel (senha padrão: `1234`).

## 🔑 Painel administrativo (`/admin`)

- Acesse `admin.html` (ex: `seusite.com/admin.html`).
- **Senha padrão:** `1234` — troque assim que possível em
  **Configurações → Alterar senha**.
- "Esqueci minha senha" abre um e-mail para `leodanialves@gmail.com` (pode
  trocar esse e-mail em Configurações).
- No painel dá para: cadastrar/editar/excluir produtos e categorias, ver e
  atualizar status dos pedidos, configurar o número do WhatsApp, editar as
  formas de pagamento, trocar a senha e configurar a publicação no GitHub.

⚠️ **Sobre segurança:** o modo local guarda a senha (com hash, nunca em
texto puro) e o carrinho no navegador. Ele é ótimo para começar e para uma
única pessoa administrando, mas não substitui um login "de verdade" com
banco de dados quando o negócio crescer — para isso, use o modo backend.

## 🔗 Publicar alterações no GitHub pelo painel (Token PAT)

Na aba **Publicar**, do painel admin:

1. Crie um token em <https://github.com/settings/tokens> (marque a permissão
   `repo` — para repositórios privados — ou `public_repo` para públicos).
   Dê um prazo de expiração (recomendado).
2. Cole o nome do repositório (`usuario/repositorio`) e o token no painel.
3. Clique em **Publicar alterações agora**: os arquivos `products.json`,
   `categories.json` e `settings.json` (dentro de `frontend/data/`) são
   atualizados diretamente no seu repositório do GitHub.
4. O painel avisa automaticamente quando o token estiver a 7 dias ou menos
   de expirar, para você gerar um novo a tempo.

O token **nunca** é publicado no repositório — ele fica salvo apenas no seu
navegador (modo local) ou no servidor do backend (modo backend), nunca no
código público.

## 📲 WhatsApp

Configure o número da loja em **Configurações → Número do WhatsApp** (com
código do país e DDD, só números, ex: `5531999999999`). Ao clicar em
"Finalizar Pedido", o cliente é levado ao WhatsApp com uma mensagem já
pronta contendo os itens, valores e forma de pagamento escolhidos.

## 🛟 Proteção contra "reset" de hospedagens gratuitas (Render, etc.)

Hospedagens no plano gratuito (como o Render) apagam o disco a cada reinício
do servidor — isso zeraria seu catálogo. Para evitar isso:

1. No painel admin, aba **Publicar**, ative **"Fazer backup automático a cada
   alteração"**. A cada mudança em produtos/categorias/config, o backend
   agenda um commit (agrupando mudanças próximas em um só) pro seu repositório.
2. No servidor (arquivo `.env` do backend), configure:
   ```
   GITHUB_BACKUP_REPO=usuario/repositorio
   GITHUB_BACKUP_BRANCH=main
   ```
   Assim, sempre que o servidor subir "do zero" (sem `backend/data/db.json`),
   ele tenta restaurar automaticamente o último catálogo publicado no GitHub
   antes de criar os dados de exemplo padrão.
3. Pedidos **não** entram nesse backup por padrão (são dados de clientes) —
   só se você marcar "Incluir pedidos no backup" e usar um repositório
   **privado**.

## 🖥️ Rodando o backend localmente (opcional, para testar antes de hospedar)

```bash
cd backend
npm install
cp .env.example .env
npm start
```
O servidor sobe em `http://localhost:3000`. Depois, em
`frontend/js/config.js`, troque `API_BASE_URL` para `"http://localhost:3000/api"`
e abra o `frontend/index.html` no navegador.

## 🎨 Identidade visual

Paleta 60-30-10 conforme o planejamento: fundo branco-gelo (`#F3F4F6`),
estrutura azul-marinho (`#1E3A8A`) e destaques em laranja (`#D97706`). O
carrinho/recibo foi desenhado como uma "nota" com corte serrilhado — uma
referência direta ao próprio fluxo do site (pedido → recibo → WhatsApp) e
aos blocos de notas pontilhados/pautados vendidos na loja.

## 📄 Licença

Este projeto usa uso restrito ("All Rights Reserved") — veja o arquivo
[`LICENSE`](./LICENSE). O código fica visível no GitHub para consulta e
portfólio, mas não pode ser copiado, reutilizado ou redistribuído sem
autorização do autor.

## ✅ Próximos passos sugeridos

- Contratar uma hospedagem simples para o `backend/` quando quiser dados 
  compartilhados entre todos os dispositivos/admins.
- Trocar as imagens de emoji por fotos reais dos produtos (o campo aceita
  URL de imagem).
- Configurar dot com domínio próprio no GitHub Pages, se desejar.
