import type { Member, Scene, SceneState } from '@ucop/shared';

interface PlayerPanelProps {
  members: Member[];
  userId: string;
  view: SceneState | null;
  activeScene: Scene | null;
}

export function PlayerPanel({ members, userId, view, activeScene }: PlayerPanelProps) {
  const mine = view?.tokens.filter((t) => t.ownerId === userId) ?? [];
  return (
    <div className="panel">
      <section>
        <h3>Cena</h3>
        <p>{activeScene ? activeScene.name : <span className="muted">Nenhuma cena ativa.</span>}</p>
      </section>

      <section>
        <h3>Seus tokens</h3>
        {mine.length === 0 ? (
          <p className="muted small">Você não controla nenhum token nesta cena.</p>
        ) : (
          <ul className="plain">
            {mine.map((t) => (
              <li key={t.id} className="row">
                <span className="swatch" style={{ background: t.color }} />
                <span>{t.name}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">
          Arraste seus tokens (contorno dourado) para movê-los. Roda do mouse aproxima/afasta; arraste o fundo para
          mover o mapa.
        </p>
      </section>

      <section>
        <h3>Membros</h3>
        <ul className="plain">
          {members.map((m) => (
            <li key={m.userId} className="row">
              <span className="grow">
                {m.name}
                {m.userId === userId && ' (você)'}
              </span>
              <span className={`badge ${m.role}`}>{m.role === 'gm' ? 'Mestre' : 'Jogador'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
