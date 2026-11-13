# UCOP.simulator

Mesa virtual de RPG para jogar **Ordem Paranormal** online com os amigos: o mestre monta cenas com mapa e grade, posiciona tokens e decide o que os jogadores veem; cada jogador move os próprios tokens e todo mundo acompanha em tempo real.

> Projeto de fã, **não oficial**. Não é afiliado nem endossado pela Jambô ou pelos criadores de Ordem Paranormal.

## O que já funciona (etapas 1 e 2)

- **Contas**: cadastro e login com e-mail e senha (senha com bcrypt, sessão com JWT).
- **Campanhas**: criar campanha (quem cria é o mestre), entrar pelo **código de convite**; só o mestre vê o código.
- **Cenas**: o mestre cria várias cenas, troca entre elas livremente e **ativa** uma para os jogadores. Cada cena tem nome, imagem de fundo, tamanho da célula (px) e largura/altura em células. Dá para ajustar a grade ao tamanho da imagem.
- **Tabuleiro** (Konva): arrastar o fundo move o mapa, a roda do mouse dá zoom em direção ao cursor, a grade é desenhada por cima do fundo e os tokens aparecem como círculo com iniciais ou com imagem.
- **Tokens**: nome, cor, tamanho em células, imagem opcional, dono opcional e "oculto". Ao soltar, o token **encaixa na grade**. O movimento é otimista (aparece na hora) e é desfeito se o servidor recusar.
- **Servidor autoritativo**: o jogador só move tokens dos quais é dono, e só na cena ativa. O mestre pode tudo. **Tokens ocultos nunca são enviados aos jogadores**: nem posição, nem nome. Imagens enviadas só podem ser baixadas por membros da campanha.

## Como rodar

Requisitos: **Node 20.12+** (testado com 20.20) e **npm 10+** (testado com 11).

```bash
npm install
npm run dev
```

- Front-end (Vite): http://localhost:5173
- API + Socket.IO: http://localhost:3333. O Vite repassa `/api`, `/socket.io` e `/uploads` para ela.

Outros comandos:

| Comando             | O que faz                                                           |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | servidor (tsx watch) e web (Vite) juntos, via `concurrently`        |
| `npm run typecheck` | `tsc --noEmit` em todos os pacotes                                  |
| `npm run build`     | gera `apps/web/dist`                                                |
| `npm start`         | sobe só o servidor; se `apps/web/dist` existir, ele serve o site também |

### Configuração

Copie `.env.example` para `.env`, na raiz ou em `apps/server/`:

| Variável        | Padrão             | Descrição                                                                                  |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| `JWT_SECRET`    | segredo de dev (com aviso no console) | **Obrigatório** fora do seu PC. Use uma string longa e aleatória.        |
| `UCOP_PORT`     | `3333`             | Porta do servidor                                                                          |
| `DATA_DIR`      | `apps/server/data` | Onde ficam o SQLite (`ucop.sqlite`) e os uploads                                           |
| `NODE_ENV`      | –                  | Com `production`, o cookie das imagens vira `Secure` (exige HTTPS)                         |
| `COOKIE_SECURE` | –                  | `false` desliga o `Secure` mesmo em produção, para quem serve só por HTTP numa rede local  |

### Testando mestre e jogador na mesma máquina

O login fica salvo por origem do navegador. Para ter duas contas abertas ao mesmo tempo, abra o mestre em `http://localhost:5173` e o jogador em `http://[::1]:5173` (ou numa janela anônima). Depois:

1. Como mestre, crie a campanha e copie o código de convite.
2. Abra a mesa, crie uma cena, envie a imagem de fundo e clique em **Ativar**.
3. Como jogador, entre com o código.
4. Como mestre, crie um token com o jogador como **Dono** e outro marcado como **Oculto**.
5. O jogador consegue arrastar só o token dele (contorno dourado) e não vê o oculto. O mestre vê tudo e move qualquer token.

## Arquitetura

```
UCOP.simulator/
├── packages/shared/      @ucop/shared: tipos, eventos Socket.IO tipados, schemas zod, helpers de grade
│   └── src/{types,events,schemas,grid}.ts
├── apps/server/          @ucop/server: Express 4 + Socket.IO 4.8 + better-sqlite3 (roda com tsx)
│   └── src/
│       ├── index.ts        HTTP, rotas, Socket.IO e o build do front, se existir
│       ├── config.ts       .env, portas, pastas, JWT_SECRET
│       ├── db.ts           esquema SQLite (users, campaigns, members, scenes, tokens)
│       ├── repo.ts         acesso a dados (linhas → tipos do shared)
│       ├── auth.ts         JWT, cookie, middlewares requireAuth/requireMember
│       ├── realtime.ts     salas e broadcasts (mestre recebe tudo; jogador, só o visível)
│       ├── socket.ts       handlers do Socket.IO (regras de permissão)
│       └── routes/         auth, campaigns, scenes, uploads
└── apps/web/             @ucop/web: Vite 5 + React 18 + react-router + react-konva
    └── src/
        ├── pages/          AuthPage (login/cadastro), CampaignsPage, TablePage (mesa)
        └── components/     Board (tabuleiro Konva), GmPanel, PlayerPanel
```

**Fluxo de dados**

- **REST** (`/api`): autenticação, campanhas, membros, CRUD de cenas e upload de imagens (multer, 10 MB, PNG/JPG/WEBP/GIF).
- **Socket.IO** (autenticado pelo JWT no handshake): `campaign:join`, `scene:view` e `scene:activate` (só o mestre), `token:create`, `token:update`, `token:move` e `token:delete`. Toda ação devolve um ack `{ ok, data | error }`.
- **Salas**: cada campanha tem uma sala do mestre e uma dos jogadores. O mestre recebe eventos de todas as cenas. Os jogadores recebem apenas a cena ativa, já filtrada: um token que fica oculto chega para eles como `token:removed`, e um token revelado chega como `token:upserted`.
- **Posições** são guardadas em **células**, não em pixels. Assim, mudar o tamanho da célula não desalinha nada. O servidor sempre limita a posição para o token caber no mapa.
- **Imagens** ficam em `DATA_DIR/uploads/<campanha>/` e são servidas em `/uploads/...` apenas para membros. O `<img>` do Konva usa um cookie httpOnly, emitido no login, porque não consegue enviar o cabeçalho `Authorization`.

## Roadmap

### Etapa 3: fichas de personagem

Fichas de Ordem Paranormal ligadas aos tokens e às contas dos jogadores, com edição pelo dono e pelo mestre e sincronização em tempo real.

- Modelos de referência para os campos e o layout:
  - Ordem Paranormal (1ª edição): https://rpgpedia.com/ficha/ordem-paranormal/9MBCW3LIYLWJuOBe14rc
  - Ordem Paranormal 2: https://rpgpedia.com/ficha/ordem-paranormal-2/IIxTgNwxzri7UjaZm7b4
- Atributos, perícias, PV, SAN e PE (ou Determinação), NEX, defesa, inventário, rituais e habilidades. Cálculos derivados, como limites por NEX e bônus, serão feitos no `@ucop/shared` para valer igual no cliente e no servidor.
- Barras de PV/SAN/PE visíveis no token, com controle do mestre sobre o que os outros jogadores enxergam.
- O conteúdo dos livros (rituais, origens, trilhas etc.) poderá ser incluído com o selo **"não oficial"**, sob a licença de conteúdo da comunidade, que ainda será anexada ao repositório antes de qualquer texto dos livros entrar no projeto.

### Etapa 4: rolagens e combate (proposta)

- Rolador de dados com a sintaxe do sistema (ex.: `3d20`, pegar o maior, `+ perícia`), clicável a partir da ficha.
- Chat da mesa com histórico de rolagens e rolagens secretas do mestre.
- Ordem de iniciativa, turnos e condições nos tokens.

### Etapa 5: ferramentas de mesa e produção (proposta)

- Névoa de guerra, régua de distância, desenhos e marcações no mapa.
- Camadas (mapa, tokens, mestre) e trava de tokens.
- Trilha sonora e ambientação, controladas pelo mestre.
- Backup e exportação de campanhas, convite com expiração, convite revogável e papéis extras (co-mestre).

## Hospedagem

O servidor é um processo Node único: API, Socket.IO, uploads e o site compilado. Todos os dados ficam em `apps/server/data/` (ou em `DATA_DIR`). **Faça backup dessa pasta**, porque ela contém o banco e as imagens.

Preparação comum:

```bash
npm install
npm run build
```

Depois, crie o `.env` com um `JWT_SECRET` forte (`NODE_ENV=production` se for usar HTTPS) e rode `npm start`.

### Opção A: seu PC ligado + Cloudflare Tunnel (grátis)

Bom para as sessões com os amigos sem abrir porta no roteador. A mesa só fica no ar enquanto o PC estiver ligado e com o servidor rodando.

1. Instale o `cloudflared`: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Suba o servidor com `npm start` (porta 3333).
3. **Túnel rápido**, sem conta e com URL aleatória a cada execução:
   ```bash
   cloudflared tunnel --url http://localhost:3333
   ```
   Compartilhe a URL `https://….trycloudflare.com` que aparecer.
4. **Túnel fixo** (com domínio próprio na Cloudflare):
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create ucop
   cloudflared tunnel route dns ucop mesa.seudominio.com
   cloudflared tunnel run --url http://localhost:3333 ucop
   ```
   O `cloudflared` também pode ser instalado como serviço (`cloudflared service install`), e o servidor pode ser mantido no ar com o `pm2`.

A Cloudflare entrega HTTPS e WebSocket automaticamente, então use `NODE_ENV=production`.

### Opção B: VPS (ex.: Oracle Cloud Always Free)

Fica no ar 24 h. A instância Ampere (ARM) do plano gratuito da Oracle dá conta com folga.

1. Crie uma VM Ubuntu e libere as portas 80 e 443 na *Security List* da VCN **e** no firewall da VM (`iptables`/`ufw`).
2. Instale o Node 20 (por exemplo, via NodeSource) e as ferramentas de build: `sudo apt install -y build-essential python3`, necessárias caso o `better-sqlite3` precise compilar.
3. Clone o repositório e rode `npm install && npm run build`. Crie o `.env` com `JWT_SECRET` e `NODE_ENV=production`.
4. Mantenha o processo vivo com `pm2` (`npx pm2 start npm --name ucop -- start` e depois `pm2 save && pm2 startup`) ou com um serviço `systemd`.
5. Coloque um proxy com HTTPS na frente. O **Caddy** é o mais simples:
   ```
   mesa.seudominio.com {
       reverse_proxy localhost:3333
   }
   ```
   O Caddy emite o certificado sozinho e já repassa WebSocket. Também dá para usar o Cloudflare Tunnel da opção A na VPS, sem abrir porta nenhuma.
6. Agende o backup de `apps/server/data/`, por exemplo com `cron` + `tar` para um bucket.

## Licença e créditos

Código do UCOP.simulator: licença a definir. Ordem Paranormal é uma marca de seus respectivos donos. Este projeto é feito por fãs e não é oficial.
