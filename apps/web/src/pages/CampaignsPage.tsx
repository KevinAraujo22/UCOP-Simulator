import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CampaignSummary } from '@ucop/shared';
import { api, errorMessage } from '../api';
import { useAuth } from '../auth';
import { CopyButton } from '../components/CopyButton';

export function CampaignsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<CampaignSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<CampaignSummary[]>('/api/campaigns')
      .then(setList)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const created = await api<CampaignSummary>('/api/campaigns', { body: { name: newName } });
      setList((prev) => [created, ...(prev ?? [])]);
      setNewName('');
    });
  };

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const joined = await api<CampaignSummary>('/api/campaigns/join', { body: { inviteCode: code } });
      navigate(`/mesa/${joined.id}`);
    });
  };

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand small">
          UCOP<span>.simulator</span>
        </span>
        <span className="spacer" />
        <span className="muted">Olá, {user?.name}</span>
        <button onClick={logout}>Sair</button>
      </header>

      <main className="content">
        <h2>Suas campanhas</h2>
        {error && <p className="error">{error}</p>}

        {list === null ? (
          <p className="muted">Carregando…</p>
        ) : list.length === 0 ? (
          <p className="muted">Você ainda não participa de nenhuma campanha. Crie uma ou entre com um código.</p>
        ) : (
          <ul className="campaign-grid">
            {list.map((c) => (
              <li key={c.id} className="card campaign-card">
                <div className="row">
                  <strong className="grow">{c.name}</strong>
                  <span className={`badge ${c.role}`}>{c.role === 'gm' ? 'Mestre' : 'Jogador'}</span>
                </div>
                <p className="muted small">
                  {c.memberCount} {c.memberCount === 1 ? 'membro' : 'membros'}
                </p>
                {c.inviteCode && (
                  <p className="invite">
                    Código de convite: <code>{c.inviteCode}</code> <CopyButton text={c.inviteCode} />
                  </p>
                )}
                <Link className="button primary" to={`/mesa/${c.id}`}>
                  Abrir mesa
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="two-cols">
          <form className="card stack" onSubmit={onCreate}>
            <h3>Criar campanha</h3>
            <p className="muted small">Você será o mestre e receberá um código para convidar os jogadores.</p>
            <input
              placeholder="Nome da campanha"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              minLength={2}
            />
            <button className="primary" disabled={busy}>
              Criar
            </button>
          </form>

          <form className="card stack" onSubmit={onJoin}>
            <h3>Entrar com código</h3>
            <p className="muted small">Peça o código de convite ao mestre da campanha.</p>
            <input
              placeholder="Ex.: K7QX2M"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              className="mono"
            />
            <button className="primary" disabled={busy}>
              Entrar
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
