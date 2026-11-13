import { useEffect, useState, type FormEvent } from 'react';
import {
  clamp,
  LIMITS,
  SYSTEM_LABELS,
  type Campaign,
  type GameSystem,
  type Member,
  type Scene,
  type SceneState,
  type Sheet,
  type Token,
} from '@ucop/shared';
import { api, errorMessage, uploadImage } from '../api';
import { unwrap, type GameSocket } from '../socket';

interface GmPanelProps {
  socket: GameSocket;
  campaign: Campaign;
  scenes: Scene[];
  activeSceneId: string | null;
  view: SceneState | null;
  members: Member[];
  sheets: Sheet[];
  selectedId: string | null;
  onSelect(id: string | null): void;
  onViewScene(sceneId: string | null): void;
  onSceneSaved(scene: Scene): void;
  onCampaignSaved(campaign: Campaign): void;
  flash(message: string): void;
}

const TOKEN_COLORS = ['#8b5cf6', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6', '#64748b'];

export function GmPanel(props: GmPanelProps) {
  const { socket, campaign, scenes, activeSceneId, view, members, sheets, selectedId, onSelect, onViewScene, flash } = props;
  const campaignId = campaign.id;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (err) {
      flash(errorMessage(err));
    }
  };

  const activate = (sceneId: string | null) =>
    run(async () => unwrap(await socket.emitWithAck('scene:activate', sceneId)));

  return (
    <div className="panel">
      <ScenesSection {...props} activate={activate} run={run} />

      {view && (
        <>
          <SceneSettings
            key={view.scene.id}
            scene={view.scene}
            campaignId={campaignId}
            isActive={view.scene.id === activeSceneId}
            onSaved={props.onSceneSaved}
            onDeleted={() => onViewScene(scenes.find((s) => s.id !== view.scene.id)?.id ?? null)}
            run={run}
          />
          <TokensSection
            socket={socket}
            campaignId={campaignId}
            view={view}
            members={members}
            sheets={sheets}
            selectedId={selectedId}
            onSelect={onSelect}
            run={run}
          />
        </>
      )}

      <section>
        <h3>Campanha</h3>
        <div className="stack compact">
          <label>
            Sistema das fichas
            <select
              value={campaign.system}
              onChange={(e) =>
                void run(async () =>
                  props.onCampaignSaved(
                    await api<Campaign>(`/api/campaigns/${campaignId}`, { method: 'PATCH', body: { system: e.target.value as GameSystem } }),
                  ),
                )
              }
            >
              {(Object.keys(SYSTEM_LABELS) as GameSystem[]).map((s) => (
                <option key={s} value={s}>
                  {SYSTEM_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          {campaign.system === 'op1' && (
            <label className="check">
              <input
                type="checkbox"
                checked={campaign.determination}
                onChange={(e) =>
                  void run(async () =>
                    props.onCampaignSaved(
                      await api<Campaign>(`/api/campaigns/${campaignId}`, { method: 'PATCH', body: { determination: e.target.checked } }),
                    ),
                  )
                }
              />{' '}
              Regra de Determinação (PD no lugar de PE e SAN)
            </label>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={campaign.playersMoveOwnOnly}
              onChange={(e) =>
                void run(async () =>
                  props.onCampaignSaved(
                    await api<Campaign>(`/api/campaigns/${campaignId}`, {
                      method: 'PATCH',
                      body: { playersMoveOwnOnly: e.target.checked },
                    }),
                  ),
                )
              }
            />{' '}
            Jogadores só movem os próprios personagens
          </label>
          <p className="muted tiny">
            Desligado, os jogadores podem mover qualquer token visível (inclusive monstros). Tokens ocultos continuam só com o
            mestre.
          </p>
          <p className="muted tiny">Fichas já criadas mantêm o sistema em que foram criadas.</p>
        </div>
      </section>

      <section>
        <h3>Membros</h3>
        <ul className="plain">
          {members.map((m) => (
            <li key={m.userId} className="row">
              <span className="grow">{m.name}</span>
              <span className={`badge ${m.role}`}>{m.role === 'gm' ? 'Mestre' : 'Jogador'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type Run = (action: () => Promise<unknown>) => Promise<void>;

// ---------------------------------------------------------------------------
// Cenas: listar, criar, abrir e ativar
// ---------------------------------------------------------------------------
function ScenesSection({
  campaign,
  scenes,
  activeSceneId,
  view,
  onViewScene,
  activate,
  run,
}: GmPanelProps & { activate(id: string | null): Promise<void>; run: Run }) {
  const campaignId = campaign.id;
  const [name, setName] = useState('');
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(15);
  const [gridSize, setGridSize] = useState(70);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const scene = await api<Scene>(`/api/campaigns/${campaignId}/scenes`, {
        body: { name, width, height, gridSize },
      });
      setName('');
      onViewScene(scene.id);
    });
  };

  return (
    <section>
      <h3>Cenas</h3>
      {scenes.length === 0 && <p className="muted small">Nenhuma cena ainda.</p>}
      <ul className="plain scene-list">
        {scenes.map((s) => (
          <li key={s.id} className={`row scene-item ${view?.scene.id === s.id ? 'current' : ''}`}>
            <button className="link grow left" onClick={() => onViewScene(s.id)} title="Abrir esta cena no tabuleiro">
              {s.name}
            </button>
            {s.id === activeSceneId ? (
              <>
                <span className="badge active">ativa</span>
                <button className="small" onClick={() => void activate(null)} title="Os jogadores deixam de ver a cena">
                  Desativar
                </button>
              </>
            ) : (
              <button className="small" onClick={() => void activate(s.id)} title="Mostrar esta cena aos jogadores">
                Ativar
              </button>
            )}
          </li>
        ))}
      </ul>

      <form className="stack compact" onSubmit={onCreate}>
        <input placeholder="Nome da nova cena" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="row">
          <NumberField label="Colunas" value={width} onChange={setWidth} {...LIMITS.sceneCells} />
          <NumberField label="Linhas" value={height} onChange={setHeight} {...LIMITS.sceneCells} />
          <NumberField label="Célula (px)" value={gridSize} onChange={setGridSize} {...LIMITS.gridSize} />
        </div>
        <button className="primary">Criar cena</button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ajustes da cena aberta: grade, tamanho, fundo
// ---------------------------------------------------------------------------
function SceneSettings({
  scene,
  campaignId,
  isActive,
  onSaved,
  onDeleted,
  run,
}: {
  scene: Scene;
  campaignId: string;
  isActive: boolean;
  onSaved(scene: Scene): void;
  onDeleted(): void;
  run: Run;
}) {
  const [name, setName] = useState(scene.name);
  const [gridSize, setGridSize] = useState(scene.gridSize);
  const [width, setWidth] = useState(scene.width);
  const [height, setHeight] = useState(scene.height);
  const [uploading, setUploading] = useState(false);

  // Mantém o formulário em dia com alterações vindas do servidor.
  useEffect(() => {
    setName(scene.name);
    setGridSize(scene.gridSize);
    setWidth(scene.width);
    setHeight(scene.height);
  }, [scene]);

  const patch = (body: Partial<Scene>) =>
    run(async () => onSaved(await api<Scene>(`/api/scenes/${scene.id}`, { method: 'PATCH', body })));

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    void patch({ name, gridSize, width, height });
  };

  const onBackground = (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    void run(async () => {
      const url = await uploadImage(campaignId, file);
      await api<Scene>(`/api/scenes/${scene.id}`, { method: 'PATCH', body: { backgroundUrl: url } }).then(onSaved);
    }).finally(() => setUploading(false));
  };

  /** Calcula colunas/linhas para que a imagem caiba na grade atual. */
  const fitToImage = () => {
    if (!scene.backgroundUrl) return;
    const img = new Image();
    img.onload = () => {
      const w = clamp(Math.round(img.naturalWidth / gridSize), LIMITS.sceneCells.min, LIMITS.sceneCells.max);
      const h = clamp(Math.round(img.naturalHeight / gridSize), LIMITS.sceneCells.min, LIMITS.sceneCells.max);
      void patch({ width: w, height: h, gridSize });
    };
    img.src = scene.backgroundUrl;
  };

  const onDelete = () => {
    if (!window.confirm(`Excluir a cena "${scene.name}" e todos os tokens dela? Isso não pode ser desfeito.`)) return;
    void run(async () => {
      await api(`/api/scenes/${scene.id}`, { method: 'DELETE' });
      onDeleted();
    });
  };

  return (
    <section>
      <h3>
        Cena aberta {isActive ? <span className="badge active">ativa</span> : <span className="badge">rascunho</span>}
      </h3>
      <form className="stack compact" onSubmit={onSave}>
        <label>
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="row">
          <NumberField label="Colunas" value={width} onChange={setWidth} {...LIMITS.sceneCells} />
          <NumberField label="Linhas" value={height} onChange={setHeight} {...LIMITS.sceneCells} />
          <NumberField label="Célula (px)" value={gridSize} onChange={setGridSize} {...LIMITS.gridSize} />
        </div>
        <button className="primary">Salvar grade e tamanho</button>
      </form>

      <div className="stack compact">
        <label className="file-input">
          {uploading ? 'Enviando…' : scene.backgroundUrl ? 'Trocar imagem de fundo' : 'Enviar imagem de fundo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={uploading}
            onChange={(e) => {
              onBackground(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {scene.backgroundUrl && (
          <div className="row">
            <button type="button" className="small" onClick={fitToImage} title="Ajusta colunas/linhas ao tamanho da imagem">
              Ajustar ao tamanho da imagem
            </button>
            <button type="button" className="small" onClick={() => void patch({ backgroundUrl: null })}>
              Remover fundo
            </button>
          </div>
        )}
        <button type="button" className="danger small" onClick={onDelete}>
          Excluir cena
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tokens: adicionar, editar e remover
// ---------------------------------------------------------------------------
function TokensSection({
  socket,
  campaignId,
  view,
  members,
  sheets,
  selectedId,
  onSelect,
  run,
}: {
  socket: GameSocket;
  campaignId: string;
  view: SceneState;
  members: Member[];
  sheets: Sheet[];
  selectedId: string | null;
  onSelect(id: string | null): void;
  run: Run;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(TOKEN_COLORS[0]);
  const [size, setSize] = useState(1);
  const [ownerId, setOwnerId] = useState<string>('');
  const [hidden, setHidden] = useState(false);
  const players = members.filter((m) => m.role === 'player');
  const selected = view.tokens.find((t) => t.id === selectedId) ?? null;

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const { scene } = view;
    void run(async () => {
      const token = unwrap(
        await socket.emitWithAck('token:create', {
          sceneId: scene.id,
          name,
          color,
          size,
          ownerId: ownerId || null,
          hidden,
          x: Math.floor((scene.width - size) / 2),
          y: Math.floor((scene.height - size) / 2),
        }),
      );
      setName('');
      setColor(TOKEN_COLORS[(TOKEN_COLORS.indexOf(color) + 1) % TOKEN_COLORS.length]);
      onSelect(token.id);
    });
  };

  return (
    <section>
      <h3>Tokens</h3>
      <form className="stack compact" onSubmit={onAdd}>
        <div className="row">
          <input className="grow" placeholder="Nome do token" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Cor" />
        </div>
        <div className="row">
          <NumberField label="Tamanho" value={size} onChange={setSize} {...LIMITS.tokenSize} />
          <label className="grow">
            Dono
            <OwnerSelect players={players} value={ownerId} onChange={setOwnerId} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Oculto para jogadores
        </label>
        <button className="primary">Adicionar token</button>
      </form>

      <ul className="plain token-list">
        {view.tokens.map((t) => (
          <li key={t.id} className={`row token-item ${t.id === selectedId ? 'current' : ''}`}>
            <span className="swatch" style={{ background: t.color }} />
            <button className="link grow left" onClick={() => onSelect(t.id === selectedId ? null : t.id)}>
              {t.name}
            </button>
            {t.hidden && <span className="badge">oculto</span>}
            {t.ownerId && <span className="muted small">{members.find((m) => m.userId === t.ownerId)?.name ?? '?'}</span>}
          </li>
        ))}
      </ul>

      {selected && (
        <TokenEditor
          key={selected.id}
          token={selected}
          socket={socket}
          campaignId={campaignId}
          players={players}
          sheets={sheets}
          onClose={() => onSelect(null)}
          run={run}
        />
      )}
    </section>
  );
}

function TokenEditor({
  token,
  socket,
  campaignId,
  players,
  sheets,
  onClose,
  run,
}: {
  token: Token;
  socket: GameSocket;
  campaignId: string;
  players: Member[];
  sheets: Sheet[];
  onClose(): void;
  run: Run;
}) {
  const [name, setName] = useState(token.name);
  const [color, setColor] = useState(token.color);
  const [size, setSize] = useState(token.size);
  const [ownerId, setOwnerId] = useState(token.ownerId ?? '');
  const [hidden, setHidden] = useState(token.hidden);
  const [uploading, setUploading] = useState(false);

  const update = (patch: Partial<Token>) =>
    run(async () => unwrap(await socket.emitWithAck('token:update', { id: token.id, patch })));

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    void update({ name, color, size, ownerId: ownerId || null, hidden });
  };

  const onImage = (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    void run(async () => {
      const url = await uploadImage(campaignId, file);
      unwrap(await socket.emitWithAck('token:update', { id: token.id, patch: { imageUrl: url } }));
    }).finally(() => setUploading(false));
  };

  const onDelete = () => {
    if (!window.confirm(`Remover o token "${token.name}"?`)) return;
    void run(async () => {
      unwrap(await socket.emitWithAck('token:delete', token.id));
      onClose();
    });
  };

  return (
    <form className="card stack compact token-editor" onSubmit={onSave}>
      <div className="row">
        <strong className="grow">Editar token</strong>
        <button type="button" className="link" onClick={onClose}>
          fechar
        </button>
      </div>
      <div className="row">
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} required aria-label="Nome" />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Cor" />
      </div>
      <div className="row">
        <NumberField label="Tamanho" value={size} onChange={setSize} {...LIMITS.tokenSize} />
        <label className="grow">
          Dono
          <OwnerSelect players={players} value={ownerId} onChange={setOwnerId} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Oculto para jogadores
      </label>
      <label>
        Ficha vinculada (duplo clique no token abre)
        <select
          value={token.sheetId ?? ''}
          onChange={(e) => void update({ sheetId: e.target.value || null })}
          aria-label="Ficha vinculada"
        >
          <option value="">— nenhuma —</option>
          {sheets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.system === 'creature' ? `☠ ${s.name}` : s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <label className="file-input small grow">
          {uploading ? 'Enviando…' : token.imageUrl ? 'Trocar imagem' : 'Imagem (opcional)'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={uploading}
            onChange={(e) => {
              onImage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {token.imageUrl && (
          <button type="button" className="small" onClick={() => void update({ imageUrl: null })}>
            Sem imagem
          </button>
        )}
      </div>
      <div className="row">
        <button className="primary grow">Salvar</button>
        <button type="button" className="danger" onClick={onDelete}>
          Remover
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Campos auxiliares
// ---------------------------------------------------------------------------
function OwnerSelect({ players, value, onChange }: { players: Member[]; value: string; onChange(v: string): void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— só o mestre —</option>
      {players.map((p) => (
        <option key={p.userId} value={p.userId}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange(v: number): void;
  min: number;
  max: number;
}) {
  return (
    <label className="number-field">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        required
      />
    </label>
  );
}
