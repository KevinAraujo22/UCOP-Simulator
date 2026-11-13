import { useMemo, useState } from 'react';
import {
  DIE_SIZES,
  OP2_ATTR_LABELS,
  OP2_ATTRS,
  OP2_SKILLS,
  op2SkillDie,
  stepDie,
  type DieSize,
  type Op2Attr,
  type Op2SheetData,
  type Sheet,
} from '@ucop/shared';
import { useGame } from '../../game';
import { Area, Collapsible, matches, newId, Num, Portrait, ResourceBar, Txt, useSheetEditor } from './common';
import { AbilityList, RemoveButton } from './Op1Sheet';

/** Ícone do dado no formato do tipo (triângulo d4, quadrado d6, losango d8…). */
export function DieIcon({ size, value, className = '' }: { size: DieSize; value?: number | string; className?: string }) {
  const shapes: Record<number, string> = {
    4: '12,2 22,21 2,21',
    6: '3,3 21,3 21,21 3,21',
    8: '12,1 23,12 12,23 1,12',
    10: '12,1 22,9 18,22 6,22 2,9',
    12: '12,1 21,6 23,15 16,23 8,23 1,15 3,6',
    20: '12,1 22,7 22,17 12,23 2,17 2,7',
  };
  return (
    <span className={`die-icon d${size} ${className}`} title={`d${size}`}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <polygon points={shapes[size]} />
      </svg>
      <span>{value ?? size}</span>
    </span>
  );
}

function DieStepper({
  value,
  onChange,
  allowD20 = false,
  label,
}: {
  value: DieSize;
  onChange(v: DieSize): void;
  allowD20?: boolean;
  label: string;
}) {
  const sizes: readonly DieSize[] = allowD20 ? DIE_SIZES : DIE_SIZES.filter((d) => d !== 20);
  const idx = sizes.indexOf(value);
  return (
    <div className="die-stepper">
      <button type="button" onClick={() => onChange(sizes[Math.max(0, idx - 1)])} aria-label={`Diminuir ${label}`}>
        −
      </button>
      <DieIcon size={value} className="big" />
      <button type="button" onClick={() => onChange(sizes[Math.min(sizes.length - 1, idx + 1)])} aria-label={`Aumentar ${label}`}>
        +
      </button>
    </div>
  );
}

export function Op2SheetView({ sheet }: { sheet: Sheet }) {
  const { rollOp2 } = useGame();
  const { data, set, setIn } = useSheetEditor<Op2SheetData>(sheet);
  const [sort, setSort] = useState<'nome' | 'passo'>('nome');
  const [tab, setTab] = useState<'habilidades' | 'equipamentos' | 'notas'>('habilidades');
  const [filter, setFilter] = useState('');

  const skills = useMemo(() => {
    const list = [...OP2_SKILLS];
    if (sort === 'passo') list.sort((a, b) => op2SkillDie(data, b.id) - op2SkillDie(data, a.id) || a.name.localeCompare(b.name));
    return list;
  }, [sort, data]);

  const roll = (label: string, attr: Op2Attr, skillDie: DieSize | null) => {
    const dice: DieSize[] = [data.attributes[attr]];
    if (skillDie) dice.push(stepDie(skillDie, data.skillSteps));
    for (const b of data.bonusDice) if (b) dice.push(b);
    let fear: DieSize | null = null;
    if (data.fear.active) {
      if (data.fear.asBonus) dice.push(data.fear.die);
      else fear = data.fear.die;
    }
    void rollOp2(dice, fear, `${sheet.name} · ${label}`);
  };

  return (
    <div className="op2-sheet">
      {/* ------------------------------------------------ esquerda */}
      <section className="op2-left">
        <div className="op2-id card">
          <Portrait url={data.portrait} onChange={(url) => set('portrait', url)} />
          <div className="stack compact grow">
            <Txt value={data.profile} onChange={(v) => set('profile', v)} placeholder="Perfil" className="profile-tag" maxLength={60} />
            <Txt value={data.concept} onChange={(v) => set('concept', v)} placeholder="Conceito / origem" maxLength={120} />
            <label className="row">
              Nível
              <Num value={data.level} min={1} max={10} onChange={(v) => set('level', v)} className="narrow" />
            </label>
          </div>
        </div>

        <h4 className="slanted">Atributos</h4>
        <div className="op2-attrs">
          {OP2_ATTRS.map((attr) => (
            <div key={attr} className="op2-attr">
              <button type="button" className="link plain attr-title" onClick={() => roll(OP2_ATTR_LABELS[attr], attr, null)} title="Rolar atributo">
                {OP2_ATTR_LABELS[attr]}
              </button>
              <DieStepper
                value={data.attributes[attr]}
                allowD20
                label={OP2_ATTR_LABELS[attr]}
                onChange={(v) => setIn('attributes', { [attr]: v })}
              />
            </div>
          ))}
        </div>

        {(['pv', 'pd'] as const).map((key) => (
          <div key={key} className="op2-resource">
            <div className="row end small">
              DT
              <Num value={data[key].dt} min={0} max={99} onChange={(v) => setIn(key, { dt: v })} className="narrow" title={`DT ${key.toUpperCase()}`} />
              <span className="muted tiny">(+3 por teste)</span>
            </div>
            <ResourceBar
              label={key === 'pv' ? 'PV' : 'PD'}
              color={key === 'pv' ? '#b91c1c' : '#6d28d9'}
              current={data[key].current}
              max={data[key].max}
              onChange={(v) => setIn(key, { current: v })}
            />
            <label className="row end small">
              Máximo
              <Num value={data[key].max} min={0} max={9999} onChange={(v) => setIn(key, { max: v })} className="narrow" />
            </label>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------ meio */}
      <section className="op2-mid">
        <h4 className="slanted">Modificadores de Perícias</h4>
        <div className="op2-mods card">
          <div>
            <div className="mod-title">Dados bônus</div>
            <div className="row">
              {data.bonusDice.map((d, i) => (
                <select
                  key={i}
                  value={d ?? ''}
                  onChange={(e) => {
                    const next = [...data.bonusDice];
                    next[i] = e.target.value ? (Number(e.target.value) as DieSize) : null;
                    set('bonusDice', next);
                  }}
                  aria-label={`Dado bônus ${i + 1}`}
                >
                  <option value="">✕</option>
                  {DIE_SIZES.filter((s) => s !== 20).map((s) => (
                    <option key={s} value={s}>
                      d{s}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>
          <div>
            <div className="mod-title">Passos das perícias</div>
            <div className="row">
              <button type="button" onClick={() => set('skillSteps', Math.max(-5, data.skillSteps - 1))} aria-label="Menos um passo">
                −
              </button>
              <strong className="box">{data.skillSteps}</strong>
              <button type="button" onClick={() => set('skillSteps', Math.min(5, data.skillSteps + 1))} aria-label="Mais um passo">
                +
              </button>
            </div>
          </div>
          <div>
            <div className="mod-title">Dado de pavor</div>
            <DieStepper value={data.fear.die} label="dado de pavor" onChange={(v) => setIn('fear', { die: v })} />
          </div>
          <div className="stack compact">
            <label className="check">
              <input type="checkbox" checked={data.fear.active} onChange={(e) => setIn('fear', { active: e.target.checked })} /> Ativar dado de
              pavor
            </label>
            <label className="check">
              <input type="checkbox" checked={data.fear.asBonus} onChange={(e) => setIn('fear', { asBonus: e.target.checked })} /> Usar como
              bônus
            </label>
          </div>
        </div>

        <div className="row">
          <h4 className="slanted grow">Perícias</h4>
          <div className="seg">
            <button type="button" className={sort === 'nome' ? 'active' : ''} onClick={() => setSort('nome')}>
              Nome
            </button>
            <button type="button" className={sort === 'passo' ? 'active' : ''} onClick={() => setSort('passo')}>
              Passo
            </button>
          </div>
        </div>
        <ul className="op2-skills">
          {skills.map((s) => {
            const die = op2SkillDie(data, s.id);
            return (
              <li key={s.id}>
                <button type="button" className="link plain skill-roll" onClick={() => roll(s.name, s.attr, die)} title={`Rolar ${s.name}`}>
                  {s.name}
                </button>
                <select
                  className="die-select"
                  value={die}
                  onChange={(e) => set('skills', { ...data.skills, [s.id]: Number(e.target.value) as DieSize })}
                  aria-label={`Dado de ${s.name}`}
                >
                  {DIE_SIZES.filter((d) => d !== 20).map((d) => (
                    <option key={d} value={d}>
                      d{d}
                    </option>
                  ))}
                </select>
                <DieIcon size={stepDie(die, data.skillSteps)} />
                <span className="plus">+</span>
                <DieIcon size={data.attributes[s.attr]} />
                <span className="attr-chip">{OP2_ATTR_LABELS[s.attr]}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------------ direita */}
      <section className="op2-right">
        <nav className="sheet-tabs slanted-tabs">
          {(
            [
              ['habilidades', 'Habilidades'],
              ['equipamentos', 'Equipamentos'],
              ['notas', 'Notas'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        {tab === 'habilidades' && (
          <div className="stack">
            <div className="armor card row">
              <span className="grow">Pontos de armadura</span>
              <button type="button" onClick={() => set('armorPoints', Math.max(0, data.armorPoints - 1))} aria-label="Gastar ponto de armadura">
                −
              </button>
              <strong className="box">{data.armorPoints}</strong>
              <button type="button" onClick={() => set('armorPoints', data.armorPoints + 1)} aria-label="Adicionar ponto de armadura">
                +
              </button>
            </div>
            <AbilityList items={data.abilities} onChange={(v) => set('abilities', v)} costHint="ex.: 2 PD" />
          </div>
        )}
        {tab === 'equipamentos' && (
          <div className="stack">
            <div className="row">
              <input className="grow txt" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar equipamento" />
              <button type="button" className="primary" onClick={() => set('equipment', [...data.equipment, { id: newId(), name: 'Novo item', description: '' }])}>
                Adicionar
              </button>
            </div>
            {data.equipment.length === 0 && <p className="empty-state">Nenhum equipamento</p>}
            {data.equipment
              .filter((e) => matches(filter, e.name, e.description))
              .map((e) => {
                const update = (patch: Partial<(typeof data.equipment)[number]>) =>
                  set('equipment', data.equipment.map((x) => (x.id === e.id ? { ...x, ...patch } : x)));
                return (
                  <Collapsible key={e.id} title={e.name}>
                    <Txt value={e.name} onChange={(v) => update({ name: v })} label="Nome" maxLength={120} />
                    <Area value={e.description} onChange={(v) => update({ description: v })} placeholder="Descrição" rows={3} />
                    <RemoveButton onClick={() => set('equipment', data.equipment.filter((x) => x.id !== e.id))} />
                  </Collapsible>
                );
              })}
          </div>
        )}
        {tab === 'notas' && <Area value={data.notes} onChange={(v) => set('notes', v)} placeholder="Anotações" rows={14} />}
      </section>
    </div>
  );
}
