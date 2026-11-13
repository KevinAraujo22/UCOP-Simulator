// Gera release/UCOP/UCOP.exe (Windows) usando o recurso oficial do Node
// "single executable application" (SEA). Uso: npm run build:exe
//
// Resultado (pasta pronta para copiar/zipar):
//   release/UCOP/UCOP.exe            servidor + site, com o Node embutido
//   release/UCOP/web/                front-end compilado
//   release/UCOP/better_sqlite3.node módulo nativo do SQLite
//   release/UCOP/data/               criado na primeira execução (banco, uploads) — preservado nos rebuilds
//   release/UCOP-windows.zip         a mesma pasta compactada (sem data/)
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'build', 'exe');
const OUT = path.join(ROOT, 'release', 'UCOP');
const require = createRequire(import.meta.url);
const SENTINEL = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const step = (msg) => console.log(`\n▶ ${msg}`);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (process.platform !== 'win32') console.warn('Aviso: este script foi pensado para gerar o .exe no Windows.');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 12)) {
  console.error(`Node ${process.versions.node} é antigo demais: use Node 20.12 ou mais novo.`);
  process.exit(1);
}

// 1. Front-end ------------------------------------------------------------------
step('Compilando o front-end (Vite)');
const web = spawnSync(npm, ['run', 'build', '-w', '@ucop/web'], { cwd: ROOT, stdio: 'inherit', shell: true });
if (web.status !== 0) process.exit(web.status ?? 1);

// 2. Servidor em um único arquivo CommonJS ---------------------------------------
step('Empacotando o servidor (esbuild)');
fs.rmSync(BUILD, { recursive: true, force: true });
fs.mkdirSync(BUILD, { recursive: true });
const esbuild = await import('esbuild');
await esbuild.build({
  entryPoints: [path.join(ROOT, 'apps/server/src/exe.ts')],
  outfile: path.join(BUILD, 'server.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  // Dependências opcionais do "ws" (aceleradores nativos): ficam de fora e o ws segue sem elas.
  external: ['bufferutil', 'utf-8-validate'],
  // import.meta só é usado fora do exe (config.ts verifica isSea() antes).
  logOverride: { 'empty-import-meta': 'silent' },
  legalComments: 'none',
  logLevel: 'warning',
});

// 3. Blob do SEA ------------------------------------------------------------------
step('Gerando o blob do executável');
const seaConfig = path.join(BUILD, 'sea-config.json');
const blob = path.join(BUILD, 'sea-prep.blob');
fs.writeFileSync(
  seaConfig,
  JSON.stringify({ main: path.join(BUILD, 'server.cjs'), output: blob, disableExperimentalSEAWarning: true }, null, 2),
);
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' });

// 4. Pasta de saída (preserva data/ e .env de execuções anteriores) ---------------
step(`Montando ${path.relative(ROOT, OUT)}`);
fs.mkdirSync(OUT, { recursive: true });
const exe = path.join(OUT, process.platform === 'win32' ? 'UCOP.exe' : 'UCOP');
fs.rmSync(exe, { force: true });
fs.copyFileSync(process.execPath, exe);

const { inject } = require('postject');
await inject(exe, 'NODE_SEA_BLOB', fs.readFileSync(blob), {
  sentinelFuse: SENTINEL,
  ...(process.platform === 'darwin' ? { machoSegmentName: 'NODE_SEA' } : {}),
});

fs.rmSync(path.join(OUT, 'web'), { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'apps/web/dist'), path.join(OUT, 'web'), { recursive: true });
fs.copyFileSync(
  path.join(path.dirname(require.resolve('better-sqlite3/package.json')), 'build/Release/better_sqlite3.node'),
  path.join(OUT, 'better_sqlite3.node'),
);
const cloudflared = path.join(ROOT, 'tools', 'cloudflared.exe');
if (fs.existsSync(cloudflared)) fs.copyFileSync(cloudflared, path.join(OUT, 'cloudflared.exe'));
fs.copyFileSync(path.join(ROOT, '.env.example'), path.join(OUT, '.env.example'));
fs.writeFileSync(
  path.join(OUT, 'LEIA-ME.txt'),
  [
    'UCOP.simulator — como usar',
    '',
    '1. Dê dois cliques em UCOP.exe. Uma janela preta abre (é o servidor) e o navegador abre a mesa.',
    '   Não feche a janela preta durante a sessão; fechar = desligar a mesa.',
    '2. Para os amigos entrarem pela internet, o UCOP usa o Cloudflare Tunnel (grátis, sem abrir porta):',
    '   instale uma vez com   winget install --id Cloudflare.cloudflared',
    '   ou coloque o cloudflared.exe nesta pasta. Ao abrir o UCOP, o link aparece na janela e na mesa do mestre.',
    '   O link muda a cada vez que o UCOP é aberto.',
    '3. Seus dados (contas, campanhas, fichas, imagens) ficam na pasta "data". Faça backup dela.',
    '   Para atualizar o programa, troque os outros arquivos e mantenha a pasta "data".',
    '',
    'Opcional: copie .env.example para .env para trocar a porta (UCOP_PORT) ou desligar o túnel (UCOP_TUNNEL=0).',
    '',
    'O Windows pode avisar que o programa é de "editor desconhecido" (ele não é assinado digitalmente).',
    'Conteúdo não oficial, publicado sob a Licença da Comunidade de Ordem Paranormal. Contém material gerado por IA.',
    '',
  ].join('\r\n'),
);

// 5. Zip para distribuir (sem data/ nem .env) ------------------------------------
if (process.platform === 'win32') {
  step('Compactando release/UCOP-windows.zip');
  const zip = path.join(ROOT, 'release', 'UCOP-windows.zip');
  fs.rmSync(zip, { force: true });
  const items = fs
    .readdirSync(OUT)
    .filter((f) => f !== 'data' && f !== '.env')
    .map((f) => `'${path.join(OUT, f).replace(/'/g, "''")}'`)
    .join(',');
  const ps = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-Command', `Compress-Archive -Path ${items} -DestinationPath '${zip.replace(/'/g, "''")}' -Force`],
    { stdio: 'inherit' },
  );
  if (ps.status !== 0) console.warn('Não foi possível gerar o zip (a pasta release/UCOP continua pronta).');
}

const size = (fs.statSync(exe).size / 1024 / 1024).toFixed(1);
console.log(`\n✔ Pronto: ${path.relative(ROOT, exe)} (${size} MB)`);
console.log('  Dê dois cliques nele para abrir a mesa. Os dados ficam em release/UCOP/data.');
