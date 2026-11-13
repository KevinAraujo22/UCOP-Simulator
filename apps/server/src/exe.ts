/**
 * Ponto de entrada do UCOP.exe. Instala o tratamento de erros antes de carregar o
 * servidor, para que qualquer falha na inicialização (ex.: módulo do SQLite ausente)
 * apareça na janela em vez de ela fechar sozinha.
 */
import { fatal } from './launcher';

// O "ws" (usado pelo Socket.IO) tenta carregar aceleradores nativos opcionais; dentro do
// exe isso só gera um aviso do Node. Desliga a tentativa (ele funciona igual sem eles).
process.env.WS_NO_BUFFER_UTIL ??= '1';
process.env.WS_NO_UTF_8_VALIDATE ??= '1';

process.on('uncaughtException', (err) => fatal(`Erro inesperado: ${err.message}`));

import('./index').catch((err: Error) => {
  const hint = /better_sqlite3/.test(err.message)
    ? ' Verifique se o arquivo better_sqlite3.node está na mesma pasta do UCOP.exe.'
    : '';
  fatal(`Não foi possível iniciar: ${err.message}.${hint}`);
});
