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
| `npm run build:apk` | gera o app de celular `release/UCOP.apk` (Android)         |

Configuração opcional: copie `.env.example` para `.env`. Defina `JWT_SECRET` antes de abrir a mesa para outras pessoas. Os dados ficam em `apps/server/data/`.

## Como rodar pelo UCOP.exe

```bash
npm run build:exe
```

Isso gera a pasta `release/UCOP` (e o `release/UCOP-windows.zip`). Dê dois cliques em `UCOP.exe`: ele sobe a mesa, abre o navegador e mostra o link para os jogadores, se o `cloudflared` estiver instalado (`winget install --id Cloudflare.cloudflared`) ou na mesma pasta do exe. Não precisa de Node instalado para usar o exe. Os dados ficam em `release/UCOP/data` — faça backup dessa pasta e mantenha-a ao atualizar o programa.

## App de celular (APK)

```bash
npm run build:apk
```

Requer o Android SDK (Android Studio, plataforma 35) e um JDK 21. Gera `release/UCOP.apk`: instale no Android (permitindo apps de fontes desconhecidas), abra e informe o endereço da mesa — o link do túnel que aparece no UCOP.exe ou, na mesma rede Wi-Fi, o IP do PC com a porta (ex.: `192.168.0.10:3333`). No app dá para criar e editar fichas de Ordem 1 e Ordem 2, rolar perícias e conjurar rituais; tudo aparece na rolagem do tabuleiro para a mesa inteira.
