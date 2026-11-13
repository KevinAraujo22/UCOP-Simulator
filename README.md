# UCOP.simulator

## Como rodar

Requisitos: Node 20.12+ e npm 10+.

```bash
npm install
npm run dev
```

Abra http://localhost:5173. A API fica na porta 3333, e o Vite repassa as chamadas para ela.

| Comando             | O que faz                                                 |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | servidor + front-end em modo desenvolvimento              |
| `npm run typecheck` | checagem de tipos de todos os pacotes                     |
| `npm run build`     | gera o front-end em `apps/web/dist`                       |
| `npm start`         | sobe o servidor, que também entrega o build se ele existir |
| `npm run build:exe` | gera o programa `release/UCOP/UCOP.exe` (Windows)          |

Configuração opcional: copie `.env.example` para `.env`. Defina `JWT_SECRET` antes de abrir a mesa para outras pessoas. Os dados ficam em `apps/server/data/`.

## Como rodar pelo UCOP.exe

```bash
npm run build:exe
```

Isso gera a pasta `release/UCOP` (e o `release/UCOP-windows.zip`). Dê dois cliques em `UCOP.exe`: ele sobe a mesa, abre o navegador e mostra o link para os jogadores, se o `cloudflared` estiver instalado (`winget install --id Cloudflare.cloudflared`) ou na mesma pasta do exe. Não precisa de Node instalado para usar o exe. Os dados ficam em `release/UCOP/data` — faça backup dessa pasta e mantenha-a ao atualizar o programa.
