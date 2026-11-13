import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { APP_DIR, PACKAGED } from './config';

/**
 * Extras do modo "programa" (UCOP.exe): abre o navegador e, se o cloudflared estiver
 * disponível, cria um túnel rápido e mostra o link para os jogadores.
 *
 * Variáveis opcionais: UCOP_TUNNEL=0 desliga o túnel (=1 liga também fora do exe);
 * UCOP_OPEN_BROWSER=0 não abre o navegador.
 */
let publicUrl: string | null = null;
let tunnel: ChildProcess | null = null;

export function getPublicUrl(): string | null {
  return publicUrl;
}

const tunnelEnabled = () => (PACKAGED ? process.env.UCOP_TUNNEL !== '0' : process.env.UCOP_TUNNEL === '1');

function openBrowser(url: string): void {
  if (process.env.UCOP_OPEN_BROWSER === '0') return;
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

function cloudflaredPath(): string {
  const local = path.join(APP_DIR || process.cwd(), process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  return fs.existsSync(local) ? local : 'cloudflared';
}

function startTunnel(port: number): void {
  const bin = cloudflaredPath();
  const child = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  tunnel = child;
  const onData = (chunk: Buffer) => {
    const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(chunk.toString());
    if (match && !publicUrl) {
      publicUrl = match[0];
      console.log('\n  ┌──────────────────────────────────────────────────────────┐');
      console.log('  │  Link para os jogadores (mande no grupo):                 │');
      console.log(`  │  ${publicUrl.padEnd(56)}│`);
      console.log('  └──────────────────────────────────────────────────────────┘\n');
    }
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);
  child.on('error', () => {
    tunnel = null;
    console.log('\n  [túnel] cloudflared não encontrado — a mesa funciona só neste PC / rede local.');
    console.log('  Para liberar o acesso pela internet, instale com:');
    console.log('      winget install --id Cloudflare.cloudflared');
    console.log('  ou coloque o cloudflared.exe na mesma pasta do UCOP.exe e abra de novo.\n');
  });
  child.on('exit', (code) => {
    if (tunnel === child) {
      tunnel = null;
      publicUrl = null;
      if (code) console.log(`  [túnel] o cloudflared encerrou (código ${code}). O link deixou de funcionar.`);
    }
  });
}

export function startDesktopExtras(port: number): void {
  const local = `http://localhost:${port}`;
  if (PACKAGED) {
    process.title = 'UCOP.simulator';
    console.log('\n  UCOP.simulator está rodando. NÃO feche esta janela durante a sessão.');
    console.log(`  Mesa neste PC: ${local}`);
  }
  if (tunnelEnabled()) {
    console.log('  [túnel] criando link público pelo Cloudflare…');
    startTunnel(port);
  }
  if (PACKAGED) openBrowser(local);
}

export function stopDesktopExtras(): void {
  tunnel?.kill();
  tunnel = null;
}

/** No exe, uma janela que fecha na hora esconde o erro: espera o Enter antes de sair. */
export function fatal(message: string): void {
  console.error(`\n  ✖ ${message}\n`);
  if (!PACKAGED || !process.stdin.isTTY) process.exit(1);
  console.error('  Pressione Enter para fechar.');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
}
