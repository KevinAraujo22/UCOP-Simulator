import { useMemo, useState, type ReactNode } from 'react';
import {
  describeEffects,
  findAbility,
  findItem,
  findOrigin,
  findRitual,
  findTrail,
  OP1_ATTR_LABELS,
  OP1_CLASS_POWERS,
  OP1_CLASSES,
  OP1_ELEMENTS,
  OP1_ITEM_KINDS,
  OP1_ITEMS,
  OP1_NEX_VALUES,
  OP1_ORIGINS,
  OP1_PARANORMAL_POWERS,
  OP1_PATENTS,
  OP1_RITUALS,
  OP1_SKILLS,
  OP1_TRAILS,
  OP1_TRAINING,
  op1ClassFeatures,
  op1Derive,
  op1Skill,
  op1TestExpression,
  RITUAL_BASE_COST,
  type CatalogAbility,
  type Op1Attack,
  type Op1Attr,
  type Op1Item,
  type Op1ItemKind,
  type Op1Ritual,
  type Op1SheetData,
  type Sheet,
  type SheetAbility,
} from '@ucop/shared';
import { memberName, useGame } from '../../game';
import { CatalogPicker, type PickerEntry } from './CatalogPicker';
import {
  Area,
  Collapsible,
  DieButton,
  matches,
  newId,
  Num,
  Portrait,
  ResourceBar,
  Txt,
  useSheetEditor,
} from './common';

const NL = String.fromCharCode(10);

type Tab = 'combate' | 'habilidades' | 'rituais' | 'inventario' | 'descricao';
const TABS: { id: Tab; label: string }[] = [
  { id: 'combate', label: 'Combate' },
  { id: 'habilidades', label: 'Habilidades' },
  { id: 'rituais', label: 'Rituais' },
  { id: 'inventario', label: 'Inventário' },
  { id: 'descricao', label: 'Descrição' },
];

export function Op1SheetView({ sheet }: { sheet: Sheet }) {
  const { campaign, members, rollExpr } = useGame();
  const { data, set, setIn } = useSheetEditor<Op1SheetData>(sheet);
  const derived = useMemo(() => op1Derive(data), [data]);
  const [tab, setTab] = useState<Tab>('combate');
  const [editAttrs, setEditAttrs] = useState(false);
  const det = campaign.determination;
  const cls = OP1_CLASSES[data.classId];
  const resourceLabel = det ? 'PD' : 'PE';

  /** Detalhamento de um máximo: base da classe + cada fonte automática + ajuste manual. */
  const hint = (key: 'pv' | 'pe' | 'san' | 'pd', max: number) => {
    const lines: string[] = [];
    let auto = 0;
    for (const src of derived.sources) {
      const v = (src.effects[key] ?? 0) + (key === 'pd' ? (src.effects.pe ?? 0) : 0);
      if (v) {
        auto += v;
        lines.push(`${src.label}: ${v > 0 ? '+' : ''}${v}`);
      }
    }
    const manual = data.bonus[key];
    if (manual) lines.push(`Ajuste manual: ${manual > 0 ? '+' : ''}${manual}`);
    return [`Classe e NEX: ${max - auto - manual}`, ...lines].join(NL);
  };

  const rollTest = (label: string, attr: Op1Attr, bonus: number) =>
    void rollExpr(op1TestExpression(data.attributes[attr], bonus), `${sheet.name} · ${label}`);

  return (
    <div className="op1-sheet">
      <header className="sheet-header">
        <Portrait url={data.portrait} onChange={(url) => set('portrait', url)} />
        <div className="sheet-header-fields">
          <label>
            Origem
            <select
              value={data.originId}
              onChange={(e) => {
                const o = findOrigin(e.target.value);
                set('originId', e.target.value);
                if (o) set('origin', o.name);
              }}
              aria-label="Origem"
            >
              <option value="">Personalizada…</option>
              {OP1_ORIGINS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {!data.originId && <Txt value={data.origin} onChange={(v) => set('origin', v)} placeholder="Nome da origem" maxLength={80} />}
          </label>
          <label>
            Jogador
            <input className="txt" value={memberName(members, sheet.ownerId)} disabled />
          </label>
          <label>
            Classe
            <select
              value={data.classId}
              onChange={(e) => {
                set('classId', e.target.value as Op1SheetData['classId']);
                // A trilha pertence à classe: ao trocar de classe, ela é desmarcada.
                if (findTrail(data.trailId)?.classId !== e.target.value) set('trailId', '');
              }}
            >
              {Object.entries(OP1_CLASSES).map(([id, c]) => (
                <option key={id} value={id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trilha
            <select
              value={data.trailId}
              onChange={(e) => {
                const t = findTrail(e.target.value);
                set('trailId', e.target.value);
                if (t) set('trail', t.name);
              }}
              aria-label="Trilha"
            >
              <option value="">{data.trailId || data.trail ? 'Personalizada…' : 'Nenhuma'}</option>
              {OP1_TRAILS.filter((t) => t.classId === data.classId).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {!data.trailId && <Txt value={data.trail} onChange={(v) => set('trail', v)} placeholder="Nome da trilha" maxLength={80} />}
          </label>
        </div>
      </header>

      <div className="op1-cols">
        {/* ------------------------------------------------ coluna esquerda */}
        <section className="op1-left">
          <div className="attr-wrap">
            <button
              type="button"
              className="link attr-edit"
              onClick={() => setEditAttrs((v) => !v)}
              title="Editar atributos"
            >
              {editAttrs ? 'concluir' : '✎ editar'}
            </button>
            <AttributePentagon
              values={data.attributes}
              editing={editAttrs}
              onChange={(attr, v) => setIn('attributes', { [attr]: v })}
              onRoll={(attr) => rollTest(OP1_ATTR_LABELS[attr].name, attr, 0)}
            />
          </div>
          {det && <div className="rule-badge">Regra de Determinação</div>}

          <div className="stat-row">
            {cls.survivor ? (
              <label className="stat">
                <select value={data.stage} onChange={(e) => set('stage', Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <option key={s} value={s}>
                      {s}º
                    </option>
                  ))}
                </select>
                <span>Estágio</span>
              </label>
            ) : (
              <>
                <label className="stat">
                  <select value={data.nex} onChange={(e) => set('nex', Number(e.target.value))}>
                    {OP1_NEX_VALUES.map((n) => (
                      <option key={n} value={n}>
                        {n}%
                      </option>
                    ))}
                  </select>
                  <span>NEX</span>
                </label>
                <label className="stat" title="Regra opcional Nível de Experiência (0 = usar o NEX)">
                  <Num value={data.xpLevel} min={0} max={20} onChange={(v) => set('xpLevel', v)} />
                  <span>Nível</span>
                </label>
              </>
            )}
            <div className="stat">
              <strong>{derived.peLimit}</strong>
              <span>{resourceLabel} / turno</span>
            </div>
            <label className="stat wide">
              <Txt value={data.movement} onChange={(v) => set('movement', v)} label="Deslocamento" />
              <span>Deslocamento</span>
            </label>
          </div>

          <ResourceBar
            label="Vida"
            color="#b91c1c"
            current={data.pv.current}
            max={derived.pvMax}
            hint={hint('pv', derived.pvMax)}
            onChange={(v) => set('pv', { current: v })}
          />
          {det ? (
            <ResourceBar
              label="Determinação"
              color="#0e7490"
              current={data.pd.current}
              max={derived.pdMax}
              hint={hint('pd', derived.pdMax)}
              onChange={(v) => set('pd', { current: v })}
            />
          ) : (
            <>
              <ResourceBar
                label="Sanidade"
                color="#1d4ed8"
                current={data.san.current}
                max={derived.sanMax}
                hint={hint('san', derived.sanMax)}
                onChange={(v) => set('san', { current: v })}
              />
              <ResourceBar
                label="Esforço"
                color="#b45309"
                current={data.pe.current}
                max={derived.peMax}
                hint={hint('pe', derived.peMax)}
                onChange={(v) => set('pe', { current: v })}
              />
            </>
          )}

          <div className="defense-row">
            <div className="shield" title="Defesa">
              <span>{derived.defense}</span>
            </div>
            <div className="defense-formula">
              <strong>Defesa</strong>
              <div className="row small">
                = 10 + AGI +
                <span
                  className="auto-box"
                  title={
                    derived.sources
                      .filter((src) => src.effects.defense)
                      .map((src) => `${src.label}: +${src.effects.defense}`)
                      .join(NL) || 'Nenhum item ou habilidade'
                  }
                >
                  {derived.effects.defense ?? 0}
                </span>
                +
                <Num
                  value={data.defense.equipment + data.defense.other}
                  min={-50}
                  max={50}
                  onChange={(v) => setIn('defense', { equipment: 0, other: v })}
                  title="Outros"
                />
              </div>
              <div className="muted tiny">equip. (auto) · outros{derived.overloaded && ' · sobrecarregado −5'}</div>
            </div>
            <div className="stat">
              <strong>{derived.block}</strong>
              <span>Bloqueio</span>
            </div>
            <div className="stat">
              <strong>{derived.dodge}</strong>
              <span>Esquiva</span>
            </div>
          </div>

          <label className="line-field">
            Proteção
            <Txt value={data.protection} onChange={(v) => set('protection', v)} maxLength={120} />
          </label>
          <label className="line-field">
            Resistências
            <Txt value={data.resistances} onChange={(v) => set('resistances', v)} maxLength={300} />
          </label>
          <label className="line-field">
            Proficiências
            <Txt value={data.proficiencies} onChange={(v) => set('proficiencies', v)} maxLength={300} />
          </label>

          <Collapsible
            title="Bônus automáticos"
            subtitle={derived.sources.length ? `${derived.sources.length} fonte(s) aplicada(s)` : 'Nenhum no momento'}
          >
            {derived.sources.length === 0 && <p className="muted small">Origem, trilha, habilidades e itens do livro aplicam bônus aqui.</p>}
            <ul className="plain">
              {derived.sources.map((src, i) => (
                <li key={i} className="row small">
                  <span className={`badge src-${src.kind}`}>{src.kind}</span>
                  <span className="grow">{src.label}</span>
                  <span className="accent">{describeEffects(src.effects)}</span>
                </li>
              ))}
            </ul>
          </Collapsible>
          <Collapsible title="Ajustes nos valores" subtitle="Bônus manuais (o que o catálogo não calcula)">
            <div className="adjust-grid">
              {(
                [
                  ['pv', 'PV máx.'],
                  ...(det ? [['pd', 'PD máx.']] : [['pe', 'PE máx.'], ['san', 'SAN máx.']]),
                  ['peLimit', `Limite ${resourceLabel}`],
                  ['ritualDt', 'DT rituais'],
                  ['load', 'Carga'],
                ] as [keyof Op1SheetData['bonus'], string][]
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <Num value={data.bonus[key]} min={-999} max={999} onChange={(v) => setIn('bonus', { [key]: v })} />
                </label>
              ))}
            </div>
          </Collapsible>
        </section>

        {/* ------------------------------------------------ perícias */}
        <section className="op1-skills">
          <h4>Perícias</h4>
          <table className="skills-table">
            <thead>
              <tr>
                <th />
                <th>Perícia</th>
                <th>Dados</th>
                <th>Bônus</th>
                <th>Treino</th>
                <th>Outros</th>
              </tr>
            </thead>
            <tbody>
              {OP1_SKILLS.map((s) => {
                const sk = op1Skill(data, s.id);
                const bonus = derived.skillBonus[s.id];
                const effective = derived.training[s.id];
                const fromOrigin = derived.originSkills.includes(s.id);
                return (
                  <tr key={s.id} className={`t${effective}`}>
                    <td>
                      <DieButton title={`Rolar ${s.name}`} onClick={() => rollTest(s.name, s.attr, bonus)} />
                    </td>
                    <td className="skill-name">
                      <button type="button" className="link plain" onClick={() => rollTest(s.name, s.attr, bonus)}>
                        {s.name}
                        {s.trainedOnly && '*'}
                        {s.load && '+'}
                      </button>
                      {fromOrigin && (
                        <span className="origin-mark" title="Treinada pela origem">
                          ◆
                        </span>
                      )}
                    </td>
                    <td className="dim">({OP1_ATTR_LABELS[s.attr].short})</td>
                    <td className="dim">({bonus})</td>
                    <td>
                      <select
                        className="training"
                        value={effective}
                        title={fromOrigin ? 'Treinada pela origem (mínimo 5)' : undefined}
                        onChange={(e) =>
                          set('skills', {
                            ...data.skills,
                            [s.id]: { ...sk, training: Number(e.target.value) as 0 | 5 | 10 | 15 },
                          })
                        }
                        aria-label={`Treino em ${s.name}`}
                      >
                        {OP1_TRAINING.map((t) => (
                          <option key={t.value} value={t.value} title={t.label}>
                            {t.value}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Num
                        value={sk.other}
                        min={-50}
                        max={50}
                        title={`Outros bônus em ${s.name}`}
                        onChange={(v) => set('skills', { ...data.skills, [s.id]: { ...sk, other: v } })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted tiny">+ penalidade de carga · * somente treinada · clique no nome para rolar</p>
        </section>

        {/* ------------------------------------------------ abas */}
        <section className="op1-tabs">
          <nav className="sheet-tabs">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          {tab === 'combate' && <CombatTab sheet={sheet} data={data} set={set} derived={derived} />}
          {tab === 'habilidades' && (
            <Op1AbilitiesTab data={data} derived={derived} onChange={(v) => set('abilities', v)} costHint={`ex.: 2 ${resourceLabel}`} />
          )}
          {tab === 'rituais' && (
            <RitualsTab sheet={sheet} rituals={data.rituals} onChange={(v) => set('rituals', v)} dt={derived.ritualDt} />
          )}
          {tab === 'inventario' && (
            <InventoryTab
              data={data}
              setIn={setIn}
              derived={derived}
              onAttack={(attack) => {
                set('attacks', [...data.attacks, attack]);
                setTab('combate');
              }}
            />
          )}
          {tab === 'descricao' && (
            <div className="stack">
              {(
                [
                  ['notes', 'Anotações', 'Anotações pessoais do agente…'],
                  ['appearance', 'Aparência', 'Nome, gênero, idade, descrição física…'],
                  ['personality', 'Personalidade', 'Traços marcantes, opiniões, ideais…'],
                  ['history', 'Histórico', 'Infância, família, contato com o paranormal…'],
                  ['objective', 'Objetivo', 'Por que ele faz parte da Ordem?'],
                ] as [keyof Op1SheetData['description'], string, string][]
              ).map(([key, label, ph]) => (
                <label key={key} className="area-field">
                  {label}
                  <Area value={data.description[key]} placeholder={ph} onChange={(v) => setIn('description', { [key]: v })} />
                </label>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pentágono de atributos
// ---------------------------------------------------------------------------
const PENTAGON: { attr: Op1Attr; x: number; y: number }[] = [
  { attr: 'agi', x: 50, y: 12 },
  { attr: 'int', x: 86, y: 40 },
  { attr: 'vig', x: 72, y: 84 },
  { attr: 'pre', x: 28, y: 84 },
  { attr: 'for', x: 14, y: 40 },
];

function AttributePentagon({
  values,
  editing,
  onChange,
  onRoll,
}: {
  values: Record<Op1Attr, number>;
  editing: boolean;
  onChange(attr: Op1Attr, v: number): void;
  onRoll(attr: Op1Attr): void;
}) {
  return (
    <div className="pentagon">
      <svg viewBox="0 0 100 100" className="pentagon-lines" aria-hidden>
        <polygon points="50,12 86,40 72,84 28,84 14,40" fill="none" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="50" cy="52" r="20" fill="currentColor" opacity="0.12" />
      </svg>
      <div className="pentagon-center">ATRIBUTOS</div>
      {PENTAGON.map(({ attr, x, y }) => (
        <div key={attr} className="attr-node" style={{ left: `${x}%`, top: `${y}%` }}>
          {editing ? (
            <div className="attr-editor">
              <button type="button" onClick={() => onChange(attr, Math.max(0, values[attr] - 1))} aria-label={`Diminuir ${attr}`}>
                −
              </button>
              <strong>{values[attr]}</strong>
              <button type="button" onClick={() => onChange(attr, Math.min(7, values[attr] + 1))} aria-label={`Aumentar ${attr}`}>
                +
              </button>
            </div>
          ) : (
            <button type="button" className="attr-value" onClick={() => onRoll(attr)} title={`Rolar ${OP1_ATTR_LABELS[attr].name}`}>
              {values[attr]}
            </button>
          )}
          <span className="attr-name">{OP1_ATTR_LABELS[attr].name}</span>
          <span className="attr-short">{OP1_ATTR_LABELS[attr].short}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Combate
// ---------------------------------------------------------------------------
type SetFn = <K extends keyof Op1SheetData>(key: K, value: Op1SheetData[K]) => void;
type SetInFn = <K extends keyof Op1SheetData>(key: K, partial: Partial<Op1SheetData[K]>) => void;

function CombatTab({
  sheet,
  data,
  set,
  derived,
}: {
  sheet: Sheet;
  data: Op1SheetData;
  set: SetFn;
  derived: ReturnType<typeof op1Derive>;
}) {
  const { rollExpr } = useGame();
  const [expr, setExpr] = useState('');
  const update = (id: string, patch: Partial<Op1Attack>) =>
    set('attacks', data.attacks.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  return (
    <div className="stack">
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (expr.trim()) void rollExpr(expr.trim(), `${sheet.name} · rolagem`);
        }}
      >
        <input className="grow txt mono" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="Rolar dados (ex.: 2d6+3)" />
        <DieButton title="Rolar" onClick={() => expr.trim() && void rollExpr(expr.trim(), `${sheet.name} · rolagem`)} />
      </form>
      <div className="row end">
        <button
          type="button"
          className="outline"
          onClick={() =>
            set('attacks', [
              ...data.attacks,
              { id: newId(), name: 'Novo ataque', skill: 'luta', attackBonus: 0, damage: '1d6', critical: '20/x2', range: '', damageType: '', notes: '' },
            ])
          }
        >
          Novo Ataque
        </button>
      </div>
      {data.attacks.length === 0 && <p className="empty-state">Você ainda não possui ataques</p>}
      {data.attacks.map((a) => {
        const attr = a.skill === 'luta' ? 'for' : 'agi';
        const bonus = derived.skillBonus[a.skill] + a.attackBonus;
        return (
          <Collapsible
            key={a.id}
            title={a.name || 'Ataque'}
            subtitle={
              <>
                <span className="accent">Teste:</span> {a.skill === 'luta' ? 'Luta' : 'Pontaria'} ({bonus >= 0 ? '+' : ''}
                {bonus}) <span className="accent">Dano:</span> {a.damage || '—'} <span className="accent">Crítico:</span>{' '}
                {a.critical || '—'}
              </>
            }
            extra={
              <div className="row">
                <button type="button" className="small" onClick={() => void rollExpr(op1TestExpression(data.attributes[attr], bonus), `${sheet.name} · ${a.name} (ataque)`)}>
                  Ataque
                </button>
                <button type="button" className="small" disabled={!a.damage} onClick={() => void rollExpr(a.damage, `${sheet.name} · ${a.name} (dano)`)}>
                  Dano
                </button>
              </div>
            }
          >
            <div className="edit-grid">
              <label>
                Nome
                <Txt value={a.name} onChange={(v) => update(a.id, { name: v })} maxLength={120} />
              </label>
              <label>
                Perícia
                <select value={a.skill} onChange={(e) => update(a.id, { skill: e.target.value as Op1Attack['skill'] })}>
                  <option value="luta">Luta</option>
                  <option value="pontaria">Pontaria</option>
                </select>
              </label>
              <label>
                Bônus no teste
                <Num value={a.attackBonus} min={-50} max={50} onChange={(v) => update(a.id, { attackBonus: v })} />
              </label>
              <label>
                Dano
                <Txt value={a.damage} onChange={(v) => update(a.id, { damage: v })} placeholder="2d6+4" maxLength={60} />
              </label>
              <label>
                Crítico
                <Txt value={a.critical} onChange={(v) => update(a.id, { critical: v })} placeholder="19/x2" maxLength={20} />
              </label>
              <label>
                Alcance
                <Txt value={a.range} onChange={(v) => update(a.id, { range: v })} maxLength={40} />
              </label>
              <label>
                Tipo de dano
                <Txt value={a.damageType} onChange={(v) => update(a.id, { damageType: v })} maxLength={40} />
              </label>
            </div>
            <Area value={a.notes} onChange={(v) => update(a.id, { notes: v })} placeholder="Observações" rows={2} />
            <RemoveButton onClick={() => set('attacks', data.attacks.filter((x) => x.id !== a.id))} />
          </Collapsible>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Habilidades (Ordem 1): automáticas da classe/origem/trilha + escolhidas
// ---------------------------------------------------------------------------
function Op1AbilitiesTab({
  data,
  derived,
  onChange,
  costHint,
}: {
  data: Op1SheetData;
  derived: ReturnType<typeof op1Derive>;
  onChange(items: SheetAbility[]): void;
  costHint: string;
}) {
  const [picker, setPicker] = useState(false);
  const cls = OP1_CLASSES[data.classId];
  const level = cls.survivor ? data.stage : data.xpLevel > 0 ? data.xpLevel * 5 : data.nex;
  const origin = findOrigin(data.originId);
  const trail = findTrail(data.trailId);
  const auto: CatalogAbility[] = [
    ...op1ClassFeatures(data.classId, level),
    ...(origin ? [origin.power] : []),
    ...(trail && trail.classId === data.classId ? trail.abilities.filter((a) => (a.nex ?? 0) <= level) : []),
  ];
  const taken = new Set(data.abilities.map((a) => a.ref));
  const entries: PickerEntry[] = [
    ...OP1_CLASS_POWERS.map((p) => ({
      id: p.id,
      name: p.name,
      group: OP1_CLASSES[p.group as Op1SheetData['classId']]?.name ?? p.group ?? '',
      subtitle: [p.cost, p.prereq && `Pré-req.: ${p.prereq}`].filter(Boolean).join(' · '),
      summary: p.summary,
      page: p.page,
      taken: taken.has(p.id),
    })),
    ...OP1_PARANORMAL_POWERS.map((p) => ({
      id: p.id,
      name: p.name,
      group: `Paranormal · ${p.group}`,
      subtitle: [p.cost, p.prereq && `Pré-req.: ${p.prereq}`].filter(Boolean).join(' · '),
      summary: p.summary,
      page: p.page,
      taken: taken.has(p.id),
    })),
  ];

  return (
    <div className="stack">
      <div className="row end">
        <button type="button" className="primary" onClick={() => setPicker(true)}>
          Adicionar do livro
        </button>
      </div>
      {auto.length > 0 && <h5 className="list-title">Recebidas automaticamente</h5>}
      {auto.map((a) => (
        <Collapsible
          key={a.id}
          title={a.cost ? `${a.name} (${a.cost})` : a.name}
          subtitle={<span className="muted">{a.kind === 'origem' ? 'Origem' : a.kind === 'trilha' ? `Trilha · ${a.group} · NEX ${a.nex}%` : 'Classe'}</span>}
          extra={derived.sources.some((s) => s.label === a.name) ? <span className="badge src-auto">automático</span> : undefined}
        >
          <CatalogSummary ability={a} />
        </Collapsible>
      ))}
      <h5 className="list-title">Escolhidas</h5>
      <AbilityList
        items={data.abilities}
        onChange={onChange}
        costHint={costHint}
        renderExtra={(item, update) => {
          const ab = findAbility(item.ref);
          if (!ab) return null;
          const src = derived.sources.find((s) => s.label === ab.name && s.kind === 'habilidade');
          return (
            <>
              <CatalogSummary ability={ab} />
              {ab.kind === 'paranormal' && ab.affinity && (
                <label className="check small">
                  <input type="checkbox" checked={item.affinity} onChange={(e) => update({ affinity: e.target.checked })} /> Tenho afinidade
                  com {ab.group}
                </label>
              )}
              {src && <div className="small accent">Aplicado na ficha: {describeEffects(src.effects)}</div>}
            </>
          );
        }}
        badge={(item) => {
          const ab = findAbility(item.ref);
          return ab?.kind === 'paranormal' ? <span className={`element-tag el-${(ab.group ?? '').toLowerCase()}`}>{ab.group}</span> : null;
        }}
      />
      {picker && (
        <CatalogPicker
          title="Poderes e habilidades"
          entries={entries}
          initialGroup={cls.name}
          onClose={() => setPicker(false)}
          onPick={(id) => {
            const ab = findAbility(id)!;
            onChange([...data.abilities, { id: newId(), name: ab.name, cost: ab.cost ?? '', description: '', ref: ab.id, affinity: false }]);
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}

function CatalogSummary({ ability }: { ability: CatalogAbility }) {
  return (
    <div className="catalog-summary">
      <p>{ability.summary}</p>
      {ability.prereq && <p className="muted small">Pré-requisito: {ability.prereq}</p>}
      {ability.affinity && (
        <p className="small">
          <span className="accent">Afinidade:</span> {ability.affinity}
        </p>
      )}
      <p className="muted tiny">Resumo não oficial · texto completo em {ability.page}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Habilidades (também usada pela ficha de Ordem 2)
// ---------------------------------------------------------------------------
export function AbilityList({
  items,
  onChange,
  costHint,
  renderExtra,
  badge,
}: {
  items: SheetAbility[];
  onChange(items: SheetAbility[]): void;
  costHint: string;
  renderExtra?: (item: SheetAbility, update: (patch: Partial<SheetAbility>) => void) => ReactNode;
  badge?: (item: SheetAbility) => ReactNode;
}) {
  const [filter, setFilter] = useState('');
  const update = (id: string, patch: Partial<SheetAbility>) => onChange(items.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  return (
    <div className="stack">
      <div className="row">
        <input className="grow txt" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar habilidades" />
        <button
          type="button"
          className="outline"
          onClick={() => onChange([...items, { id: newId(), name: 'Nova habilidade', cost: '', description: '', ref: '', affinity: false }])}
        >
          Nova Habilidade
        </button>
      </div>
      {items.length === 0 && <p className="empty-state">Nenhuma habilidade</p>}
      {items
        .filter((a) => matches(filter, a.name, a.description))
        .map((a) => (
          <Collapsible key={a.id} title={a.cost ? `${a.name} (${a.cost})` : a.name} extra={badge?.(a)}>
            {renderExtra?.(a, (patch) => update(a.id, patch))}
            <div className="edit-grid two">
              <label>
                Nome
                <Txt value={a.name} onChange={(v) => update(a.id, { name: v })} maxLength={120} />
              </label>
              <label>
                Custo
                <Txt value={a.cost} onChange={(v) => update(a.id, { cost: v })} placeholder={costHint} maxLength={40} />
              </label>
            </div>
            <Area
              value={a.description}
              onChange={(v) => update(a.id, { description: v })}
              placeholder={a.ref ? 'Anotações (opcional)' : 'Descrição (com suas palavras)'}
              rows={a.ref ? 2 : 4}
            />
            <RemoveButton onClick={() => onChange(items.filter((x) => x.id !== a.id))} />
          </Collapsible>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rituais
// ---------------------------------------------------------------------------
function RitualsTab({
  sheet,
  rituals,
  onChange,
  dt,
}: {
  sheet: Sheet;
  rituals: Op1Ritual[];
  onChange(v: Op1Ritual[]): void;
  dt: number;
}) {
  const { rollExpr } = useGame();
  const [filter, setFilter] = useState('');
  const [picker, setPicker] = useState(false);
  const update = (id: string, patch: Partial<Op1Ritual>) => onChange(rituals.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const taken = new Set(rituals.map((r) => r.ref));
  const blank = (): Op1Ritual => ({
    id: newId(),
    name: 'Novo ritual',
    element: 'Conhecimento',
    circle: 1,
    execution: '',
    range: '',
    target: '',
    duration: '',
    resistance: '',
    description: '',
    discente: '',
    verdadeiro: '',
    roll: '',
    ref: '',
  });

  return (
    <div className="stack">
      <div className="row">
        <input className="grow txt" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar rituais" />
        <div className="stat inline">
          <span>DT de rituais</span>
          <strong>{dt}</strong>
        </div>
      </div>
      <div className="row end">
        <button type="button" className="outline" onClick={() => onChange([...rituals, blank()])}>
          Novo Ritual
        </button>
        <button type="button" className="primary" onClick={() => setPicker(true)}>
          Adicionar do livro
        </button>
      </div>
      {rituals.length === 0 && <p className="empty-state">Nenhum ritual</p>}
      {rituals
        .filter((r) => matches(filter, r.name, r.element, r.description))
        .map((r) => {
          const cat = findRitual(r.ref);
          return (
            <Collapsible
              key={r.id}
              title={r.name}
              subtitle={
                <>
                  <span className={`element-tag el-${r.element.toLowerCase()}`}>{`${r.element} ${r.circle}`.trim()}</span>{' '}
                  <span className="muted small">
                    {RITUAL_BASE_COST[r.circle]} PE{r.execution && ` · ${r.execution}`}
                    {r.range && ` · ${r.range}`}
                  </span>
                </>
              }
              extra={
                r.roll ? (
                  <button type="button" className="small" onClick={() => void rollExpr(r.roll, `${sheet.name} · ${r.name}`)}>
                    Rolar {r.roll}
                  </button>
                ) : undefined
              }
            >
              {cat && (
                <div className="catalog-summary">
                  <p>{cat.summary}</p>
                  {(cat.discente || cat.verdadeiro) && (
                    <p className="small">
                      {cat.discente ? <span className="accent">Discente (+{cat.discente} PE) </span> : null}
                      {cat.verdadeiro ? <span className="accent">Verdadeiro (+{cat.verdadeiro} PE)</span> : null}
                    </p>
                  )}
                  <p className="muted tiny">Resumo não oficial · texto completo em {cat.page}</p>
                </div>
              )}
              <div className="edit-grid">
                <label>
                  Nome
                  <Txt value={r.name} onChange={(v) => update(r.id, { name: v })} maxLength={120} />
                </label>
                <label>
                  Elemento
                  <select value={r.element} onChange={(e) => update(r.id, { element: e.target.value })}>
                    {OP1_ELEMENTS.map((el) => (
                      <option key={el}>{el}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Círculo
                  <select value={r.circle} onChange={(e) => update(r.id, { circle: Number(e.target.value) })}>
                    {[1, 2, 3, 4].map((c) => (
                      <option key={c} value={c}>
                        {c}º
                      </option>
                    ))}
                  </select>
                </label>
                {(
                  [
                    ['execution', 'Execução'],
                    ['range', 'Alcance'],
                    ['target', 'Alvo/Área'],
                    ['duration', 'Duração'],
                    ['resistance', 'Resistência'],
                    ['roll', 'Rolagem (ex.: 3d8)'],
                  ] as [keyof Op1Ritual, string][]
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <Txt value={String(r[key])} onChange={(v) => update(r.id, { [key]: v })} maxLength={120} />
                  </label>
                ))}
              </div>
              <Area
                value={r.description}
                onChange={(v) => update(r.id, { description: v })}
                placeholder={cat ? 'Anotações (opcional)' : 'Efeito (com suas palavras)'}
                rows={cat ? 2 : 3}
              />
              {!cat && (
                <>
                  <Area value={r.discente} onChange={(v) => update(r.id, { discente: v })} placeholder="Discente (+PE)" rows={2} />
                  <Area value={r.verdadeiro} onChange={(v) => update(r.id, { verdadeiro: v })} placeholder="Verdadeiro (+PE)" rows={2} />
                </>
              )}
              <RemoveButton onClick={() => onChange(rituals.filter((x) => x.id !== r.id))} />
            </Collapsible>
          );
        })}
      {picker && (
        <CatalogPicker
          title="Rituais"
          entries={OP1_RITUALS.map((r) => ({
            id: r.id,
            name: r.name,
            group: r.elements.length > 1 ? 'Vários' : r.elements[0],
            subtitle: `${r.circle}º círculo · ${RITUAL_BASE_COST[r.circle]} PE · ${r.execution} · ${r.range}`,
            summary: r.summary,
            page: r.page,
            taken: taken.has(r.id),
          }))}
          onClose={() => setPicker(false)}
          onPick={(id) => {
            const r = findRitual(id)!;
            onChange([
              ...rituals,
              {
                ...blank(),
                name: r.name,
                element: r.elements[0],
                circle: r.circle,
                execution: r.execution,
                range: r.range,
                target: r.target,
                duration: r.duration,
                resistance: r.resistance,
                roll: r.roll ?? '',
                ref: r.id,
              },
            ]);
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inventário
// ---------------------------------------------------------------------------
function InventoryTab({
  data,
  setIn,
  derived,
  onAttack,
}: {
  data: Op1SheetData;
  setIn: SetInFn;
  derived: ReturnType<typeof op1Derive>;
  onAttack(attack: Op1Attack): void;
}) {
  const [filter, setFilter] = useState('');
  const [picker, setPicker] = useState<Op1ItemKind | null>(null);
  const items = data.inventory.items;
  const setItems = (next: Op1Item[]) => setIn('inventory', { items: next });
  const update = (id: string, patch: Partial<Op1Item>) => setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const blank = (kind: Op1ItemKind): Op1Item => ({
    id: newId(),
    name: OP1_ITEM_KINDS.find((k) => k.id === kind)!.label,
    kind,
    category: kind === 'amaldicoado' ? 2 : 0,
    spaces: 1,
    details: '',
    damage: '',
    critical: '',
    damageType: '',
    defense: 0,
    description: '',
    ref: '',
    equipped: true,
  });
  const limits = derived.patent.limits;
  const kindLabel = (k: string) => OP1_ITEM_KINDS.find((x) => x.id === k)?.label ?? k;

  return (
    <div className="stack">
      <input className="txt" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar itens" />
      <div className="inv-grid">
        <span>Pontos de prestígio</span>
        <Num value={data.inventory.prestige} min={0} max={99999} onChange={(v) => setIn('inventory', { prestige: v })} />
        <span>Patente</span>
        <strong className="box">{derived.patent.name}</strong>
        <span>Limite de itens</span>
        <div className="cat-row">
          {limits.map((l, i) => (
            <span key={i} className="box" title={`Categoria ${['I', 'II', 'III', 'IV'][i]}`}>
              {l}
            </span>
          ))}
        </div>
        <span>No inventário</span>
        <div className="cat-row">
          {derived.itemsByCategory.map((n, i) => (
            <span key={i} className={`box ${n > limits[i] ? 'over' : ''}`} title={`Categoria ${['I', 'II', 'III', 'IV'][i]}`}>
              {n}
            </span>
          ))}
        </div>
        <span>Limite de crédito</span>
        <strong className="box">{derived.patent.credit}</strong>
        <span>Carga</span>
        <div className="cat-row">
          <span className={`box ${derived.overloaded ? 'over' : ''}`} title="Espaços usados">
            {derived.loadUsed}
          </span>
          <span className="box" title="Carga máxima (sem penalidade)">
            {derived.loadMax}
          </span>
          <span className="box" title="Máximo absoluto (sobrecarregado)">
            {derived.loadMax * 2}
          </span>
        </div>
      </div>
      <div className="row wrap">
        <span className="muted small">Do livro</span>
        {OP1_ITEM_KINDS.filter((k) => k.id !== 'amaldicoado').map((k) => (
          <button key={k.id} type="button" className="primary small" onClick={() => setPicker(k.id)}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="row wrap">
        <span className="muted small">Novo em branco</span>
        {OP1_ITEM_KINDS.map((k) => (
          <button key={k.id} type="button" className="outline small" onClick={() => setItems([...items, blank(k.id)])}>
            {k.label}
          </button>
        ))}
      </div>
      {items.length === 0 && <p className="empty-state">Inventário vazio</p>}
      {items
        .filter((i) => matches(filter, i.name, i.details, i.description))
        .map((i) => {
          const cat = findItem(i.ref);
          return (
            <Collapsible
              key={i.id}
              title={i.name}
              subtitle={
                i.kind === 'arma' ? (
                  <>
                    <span className="accent">Dano:</span> {i.damage || '—'} <span className="accent">Crítico:</span> {i.critical || '—'}
                  </>
                ) : i.kind === 'protecao' ? (
                  <>
                    <span className="accent">Defesa:</span> +{i.defense} {!i.equipped && <span className="muted">(não equipada)</span>}
                  </>
                ) : (
                  <span className="muted">{kindLabel(i.kind)}</span>
                )
              }
              extra={
                i.kind === 'protecao' ? (
                  <label className="check small" title="Proteções equipadas somam na Defesa">
                    <input type="checkbox" checked={i.equipped} onChange={(e) => update(i.id, { equipped: e.target.checked })} /> Equipada
                  </label>
                ) : i.kind === 'arma' ? (
                  <button
                    type="button"
                    className="small"
                    title="Cria um ataque na aba Combate com os dados desta arma"
                    onClick={() =>
                      onAttack({
                        id: newId(),
                        name: i.name,
                        skill: /corpo a corpo/i.test(i.details) ? 'luta' : 'pontaria',
                        attackBonus: 0,
                        damage: i.damage.split('/')[0],
                        critical: i.critical,
                        range: cat?.range ?? '',
                        damageType: i.damageType,
                        notes: '',
                      })
                    }
                  >
                    Usar como ataque
                  </button>
                ) : undefined
              }
            >
              {cat && (
                <div className="catalog-summary">
                  <p>{cat.summary}</p>
                  <p className="muted tiny">Texto completo em {cat.page}</p>
                </div>
              )}
              <div className="edit-grid">
                <label>
                  Nome
                  <Txt value={i.name} onChange={(v) => update(i.id, { name: v })} maxLength={120} />
                </label>
                <label>
                  Tipo
                  <select value={i.kind} onChange={(e) => update(i.id, { kind: e.target.value as Op1ItemKind })}>
                    {OP1_ITEM_KINDS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Categoria
                  <select value={i.category} onChange={(e) => update(i.id, { category: Number(e.target.value) })}>
                    {['0', 'I', 'II', 'III', 'IV'].map((c, idx) => (
                      <option key={c} value={idx}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Espaços
                  <Num value={i.spaces} min={0} max={20} onChange={(v) => update(i.id, { spaces: v })} />
                </label>
                <label className="span2">
                  Detalhes
                  <Txt value={i.details} onChange={(v) => update(i.id, { details: v })} placeholder="Ex.: Tática · Corpo a corpo · Duas mãos" maxLength={200} />
                </label>
                {i.kind === 'arma' && (
                  <>
                    <label>
                      Dano
                      <Txt value={i.damage} onChange={(v) => update(i.id, { damage: v })} maxLength={60} />
                    </label>
                    <label>
                      Crítico
                      <Txt value={i.critical} onChange={(v) => update(i.id, { critical: v })} maxLength={20} />
                    </label>
                    <label>
                      Tipo de dano
                      <Txt value={i.damageType} onChange={(v) => update(i.id, { damageType: v })} maxLength={40} />
                    </label>
                  </>
                )}
                {i.kind === 'protecao' && (
                  <label>
                    Defesa
                    <Num value={i.defense} min={0} max={50} onChange={(v) => update(i.id, { defense: v })} />
                  </label>
                )}
              </div>
              <Area value={i.description} onChange={(v) => update(i.id, { description: v })} placeholder="Descrição / anotações" rows={2} />
              <RemoveButton onClick={() => setItems(items.filter((x) => x.id !== i.id))} />
            </Collapsible>
          );
        })}
      <p className="muted tiny">Patentes: {OP1_PATENTS.map((p) => `${p.name} (${p.minPrestige})`).join(' · ')}</p>
      {picker && (
        <CatalogPicker
          title={`Itens · ${kindLabel(picker)}`}
          entries={OP1_ITEMS.filter((it) => it.kind === picker).map((it) => ({
            id: it.id,
            name: it.name,
            group: it.details?.split(' · ')[0] ?? kindLabel(it.kind),
            subtitle: `Categoria ${['0', 'I', 'II', 'III', 'IV'][it.category]} · ${it.spaces} espaço(s)`,
            summary: it.summary,
            page: it.page,
          }))}
          onClose={() => setPicker(null)}
          onPick={(id) => {
            const it = findItem(id)!;
            setItems([
              ...items,
              {
                ...blank(it.kind),
                name: it.name,
                category: it.category,
                spaces: it.spaces,
                details: it.details ?? '',
                damage: it.damage ?? '',
                critical: it.critical ?? '',
                damageType: it.damageType ?? '',
                defense: it.defense ?? 0,
                ref: it.id,
              },
            ]);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

export function RemoveButton({ onClick }: { onClick(): void }) {
  return (
    <div className="row end">
      <button type="button" className="link danger-link" onClick={onClick}>
        Remover
      </button>
    </div>
  );
}
