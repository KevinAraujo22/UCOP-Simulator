import { useEffect, useRef, useState } from 'react';
import type { ExprRollDetail, RollRecord } from '@ucop/shared';

const DICE_3D = new Set([4, 6, 8, 10, 12, 20]);
const MAX_3D_DICE = 20;
const PALETTE = ['#7c3aed', '#b91c1c', '#0f766e', '#1d4ed8', '#a16207', '#be185d', '#15803d', '#475569'];

function colorFor(userId: string): string {
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Notação do dice-box com resultados predefinidos (os do servidor): "3d20+2d6@4,17,9,3,5". */
function diceNotation(roll: RollRecord): string | null {
  const groups: string[] = [];
  const values: number[] = [];
  const add = (sides: number, rolled: number[]) => {
    if (!DICE_3D.has(sides) || !rolled.length) return;
    const room = MAX_3D_DICE - values.length;
    if (room <= 0) return;
    const slice = rolled.slice(0, room);
    groups.push(`${slice.length}d${sides}`);
    values.push(...slice);
  };
  const d = roll.detail;
  const expr = d.type === 'expr' ? d : d.type === 'cast' ? d.roll : null;
  if (expr) {
    for (const t of expr.terms) if (t.kind === 'dice') add(t.sides, t.rolls);
  } else if (d.type === 'op2') {
    for (const die of d.dice) add(die.sides, [die.value]);
    if (d.fear) add(d.fear.sides, [d.fear.value]);
  }
  return groups.length ? `${groups.join('+')}@${values.join(',')}` : null;
}

// ---------------------------------------------------------------------------
// Cartão com o resultado (valor + somas)
// ---------------------------------------------------------------------------
function ExprParts({ d }: { d: ExprRollDetail }) {
  return (
    <>
      <code className="roll-expr">{d.expression}</code>
      <span className="roll-dice">
        {d.terms.map((t, i) => (
          <span key={i} className="term">
            {(i > 0 || t.sign < 0) && <span className="op">{t.sign < 0 ? '−' : '+'}</span>}
            {t.kind === 'const' ? (
              <span className="const">{t.value}</span>
            ) : (
              <span className="group">
                [
                {t.rolls.map((v, j) => (
                  <span key={j} className={`die ${t.kept[j] ? '' : 'dropped'} ${v === t.sides ? 'max' : v === 1 ? 'min' : ''}`}>
                    {v}
                  </span>
                ))}
                ]
              </span>
            )}
          </span>
        ))}
      </span>
    </>
  );
}

const FORM_LABEL = { normal: '', discente: ' (Discente)', verdadeiro: ' (Verdadeiro)' } as const;

export function RollCard({ roll, compact = false }: { roll: RollRecord; compact?: boolean }) {
  const d = roll.detail;
  const outcome = d.type === 'op2' ? d.outcome : null;
  return (
    <div className={`roll-card ${compact ? 'compact' : ''} ${outcome ?? ''} ${d.type === 'cast' ? 'cast' : ''}`}>
      <div className="roll-head">
        <span className="roll-who" style={{ color: colorFor(roll.userId) }}>
          {roll.userName}
        </span>
        {roll.secret && <span className="badge">secreta</span>}
        <span className="roll-label">{roll.label || 'Rolagem'}</span>
      </div>
      <div className="roll-body">
        <div className="roll-parts">
          {d.type === 'expr' && <ExprParts d={d} />}
          {d.type === 'op2' && (
            <span className="roll-dice">
              {d.dice.map((die, i) => (
                <span
                  key={i}
                  className={`die ${die.cancelled ? 'cancelled' : die.counted ? '' : 'dropped'}`}
                  title={`d${die.sides}${die.cancelled ? ' (anulado pelo pavor)' : ''}`}
                >
                  {die.value}
                  <sub>d{die.sides}</sub>
                </span>
              ))}
              {d.fear && (
                <span className="die fear" title="Dado de pavor">
                  {d.fear.value}
                  <sub>pavor d{d.fear.sides}</sub>
                </span>
              )}
            </span>
          )}
          {d.type === 'cast' && (
            <>
              <span className="cast-line">
                <span className={`element-tag el-${d.element.toLowerCase()}`}>
                  {d.element} {d.circle}
                </span>{' '}
                conjurou <strong>{d.ritual}</strong>
                {FORM_LABEL[d.form]}
              </span>
              <span className="muted small">
                −{d.cost} {d.resource} (restam {d.remaining}) · DT {d.dt}
              </span>
              {d.roll && <ExprParts d={d.roll} />}
            </>
          )}
        </div>
        <div className="roll-total">{d.type === 'cast' && !d.roll ? `−${d.cost}` : d.total}</div>
      </div>
      {outcome && (
        <div className="roll-outcome">{outcome === 'critical-success' ? 'Sucesso crítico!' : 'Falha crítica!'}</div>
      )}
      {d.type === 'op2' && d.fearEnds && <div className="roll-note">O dado de pavor tirou 1: o pavor termina.</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camada de dados 3D + cartão em destaque para cada rolagem nova
// ---------------------------------------------------------------------------
type DiceBoxInstance = import('@3d-dice/dice-box-threejs').default;

/** dice3d = false: só o cartão do resultado (ex.: app de celular, mais leve). */
export function DiceOverlay({ rolls, dice3d = true }: { rolls: RollRecord[]; dice3d?: boolean }) {
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<RollRecord[]>([]);
  const busy = useRef(false);
  const boxRef = useRef<Promise<DiceBoxInstance | null> | null>(null);
  const [showing, setShowing] = useState<RollRecord | null>(null);

  // Rolagens já existentes ao entrar na mesa não são animadas.
  if (seen.current === null) seen.current = new Set(rolls.map((r) => r.id));

  useEffect(() => {
    const fresh = rolls.filter((r) => !seen.current!.has(r.id));
    if (!fresh.length) return;
    for (const r of fresh) seen.current!.add(r.id);
    queue.current.push(...fresh);
    void pump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolls]);

  function getBox(): Promise<DiceBoxInstance | null> {
    boxRef.current ??= import('@3d-dice/dice-box-threejs')
      .then(async ({ default: DiceBox }) => {
        const box = new DiceBox('#ucop-dice', {
          sounds: false,
          shadows: true,
          theme_material: 'glass',
          theme_customColorset: { background: '#7c3aed', foreground: '#ffffff', texture: 'none', material: 'glass' },
          light_intensity: 0.9,
          gravity_multiplier: 400,
          baseScale: 130,
          strength: 1.3,
        });
        await box.initialize();
        return box;
      })
      .catch((err) => {
        console.warn('[ucop] dados 3D indisponíveis, mostrando só o resultado', err);
        return null;
      });
    return boxRef.current;
  }

  async function pump() {
    if (busy.current) return;
    busy.current = true;
    try {
      while (queue.current.length) {
        const roll = queue.current.shift()!;
        const notation = diceNotation(roll);
        const box = notation && dice3d ? await getBox() : null;
        if (box && notation) {
          try {
            box.clearDice();
            await box.updateConfig({
              theme_customColorset: {
                background: colorFor(roll.userId),
                foreground: '#ffffff',
                texture: 'none',
                material: 'glass',
              },
            });
            await Promise.race([box.roll(notation), new Promise((r) => setTimeout(r, 6000))]);
          } catch (err) {
            console.warn('[ucop] falha ao animar dados', err);
          }
        }
        setShowing(roll);
        await new Promise((r) => setTimeout(r, queue.current.length ? 1800 : 3500));
        box?.clearDice();
        setShowing(null);
      }
    } finally {
      busy.current = false;
    }
  }

  return (
    <>
      <div id="ucop-dice" className="dice-layer" aria-hidden />
      {showing && (
        <div className="roll-spotlight" key={showing.id}>
          <RollCard roll={showing} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Aba "Dados": histórico + rolagem livre
// ---------------------------------------------------------------------------
export function RollLog({
  rolls,
  onRoll,
  isGm,
  secret,
  onSecret,
}: {
  rolls: RollRecord[];
  onRoll(expression: string): void;
  isGm: boolean;
  secret: boolean;
  onSecret(v: boolean): void;
}) {
  const [expr, setExpr] = useState('1d20');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [rolls.length]);

  return (
    <div className="roll-log">
      <div className="roll-list">
        {rolls.length === 0 && <p className="muted small">Nenhuma rolagem ainda.</p>}
        {rolls.map((r) => (
          <RollCard key={r.id} roll={r} compact />
        ))}
        <div ref={endRef} />
      </div>
      <form
        className="roll-form stack compact"
        onSubmit={(e) => {
          e.preventDefault();
          if (expr.trim()) onRoll(expr.trim());
        }}
      >
        <div className="quick-dice">
          {[4, 6, 8, 10, 12, 20].map((s) => (
            <button key={s} type="button" className="small" onClick={() => onRoll(`1d${s}`)}>
              d{s}
            </button>
          ))}
        </div>
        <div className="row">
          <input
            className="grow mono"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="ex.: 3d20kh1+5, 2d6+3, 3O+10"
            aria-label="Expressão de dados"
          />
          <button className="primary">Rolar</button>
        </div>
        {isGm && (
          <label className="check">
            <input type="checkbox" checked={secret} onChange={(e) => onSecret(e.target.checked)} /> Rolagens secretas (só o
            mestre vê)
          </label>
        )}
        <p className="muted small">
          <code>kh1</code> fica com o maior, <code>kl1</code> com o menor. <code>3O</code> = 3d20 pegando o maior.
        </p>
      </form>
    </div>
  );
}
