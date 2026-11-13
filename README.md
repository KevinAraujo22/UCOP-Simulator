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

Configuração opcional: copie `.env.example` para `.env`. Defina `JWT_SECRET` antes de abrir a mesa para outras pessoas. Os dados ficam em `apps/server/data/`.
