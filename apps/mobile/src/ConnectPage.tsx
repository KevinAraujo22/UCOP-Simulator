import { useState, type FormEvent } from 'react';
import { storeToken } from '@web/api';
import { LicenseSeal } from '@web/components/LicenseSeal';
import { getSavedServer, normalizeServer, probeServer, saveServer } from './server';

/** Primeira tela do app: para qual mesa (servidor) se conectar. */
export function ConnectPage() {
  const [value, setValue] = useState(getSavedServer() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const url = normalizeServer(value);
    if (!url) return;
    setError(null);
    setBusy(true);
    try {
      await probeServer(url);
      const changed = url !== getSavedServer();
      saveServer(url);
      // Trocar de servidor invalida a sessão anterior (o token é de outro servidor).
      if (changed) storeToken(null);
      // Recarrega para o app inteiro (sessão, socket) usar o novo endereço.
      window.location.hash = '#/entrar';
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="card auth-card">
        <h1 className="brand">
          UCOP<span>.simulator</span>
        </h1>
        <p className="muted">Conecte-se à mesa do seu mestre.</p>
        <form className="stack" onSubmit={onSubmit}>
          <label>
            Endereço da mesa
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://xxxx.trycloudflare.com"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              required
            />
          </label>
          <p className="muted small">
            Use o link que o mestre mandou (aparece na janela do UCOP.exe e na mesa dele) ou, na mesma rede Wi-Fi, o IP do PC
            com a porta, como <code>192.168.0.10:3333</code>.
          </p>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={busy}>
            {busy ? 'Conectando…' : 'Conectar'}
          </button>
        </form>
      </div>
      <LicenseSeal />
    </div>
  );
}
