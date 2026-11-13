import { useState } from 'react';
import { OP1_ATTR_LABELS, OP1_ATTRS, type CreatureAction, type CreatureSheetData, type Sheet } from '@ucop/shared';
import { useGame } from '../../game';
import { Area, Collapsible, DieButton, newId, Num, Portrait, ResourceBar, Txt, useSheetEditor } from './common';
import { RemoveButton } from './Op1Sheet';

const ACTION_KINDS: CreatureAction['kind'][] = ['padrão', 'movimento', 'completa', 'reação', 'livre'];

export function CreatureSheetView({ sheet }: { sheet: Sheet }) {
  const { rollExpr } = useGame();
  const { data, set, setIn } = useSheetEditor<CreatureSheetData>(sheet);
  const [amount, setAmount] = useState(0);
  const roll = (expr: string, what: string) => expr.trim() && void rollExpr(expr, `${sheet.name} · ${what}`);
  const hurt = data.pv.current <= Math.floor(data.pv.max / 2);

  const rollField = (label: string, value: string, onChange: (v: string) => void, placeholder = '2O+5') => (
    <label className="creature-roll">
      <span>{label}</span>
      <Txt value={value} onChange={onChange} placeholder={placeholder} maxLength={40} className="mono" />
      <DieButton title={`Rolar ${label}`} onClick={() => roll(value, label)} />
    </label>
  );

  const updateAction = (id: string, patch: Partial<CreatureAction>) =>
    set('actions', data.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  return (
    <div className="creature-sheet">
      <header className="sheet-header">
        <Portrait url={data.portrait} onChange={(url) => set('portrait', url)} />
        <div className="creature-head">
          <div className="row wrap">
            <label>
              Elemento
              <Txt value={data.element} onChange={(v) => set('element', v)} placeholder="Sangue" maxLength={40} />
            </label>
            <label>
              VD
              <Num value={data.vd} min={0} max={9999} onChange={(v) => set('vd', v)} className="narrow" />
            </label>
            <label>
              Tamanho / tipo
              <Txt value={data.size} onChange={(v) => set('size', v)} placeholder="Criatura grande" maxLength={40} />
            </label>
            <label>
              Defesa
              <Num value={data.defense} min={0} max={99} onChange={(v) => set('defense', v)} className="narrow" />
            </label>
            <label>
              Deslocamento
              <Txt value={data.movement} onChange={(v) => set('movement', v)} maxLength={40} />
            </label>
          </div>
          <div className="presence row wrap">
            <strong>Presença Perturbadora</strong>
            DT <Num value={data.presence.dt} min={0} max={99} onChange={(v) => setIn('presence', { dt: v })} className="narrow" />
            <Txt value={data.presence.damage} onChange={(v) => setIn('presence', { damage: v })} placeholder="3d6" className="mono narrow-txt" label="Dano mental" />
            <button type="button" className="small" disabled={!data.presence.damage} onClick={() => roll(data.presence.damage, 'dano mental')}>
              Rolar dano mental
            </button>
            <Txt value={data.presence.immunity} onChange={(v) => setIn('presence', { immunity: v })} placeholder="NEX 30%+ é imune" maxLength={60} />
          </div>
        </div>
      </header>

      <div className="creature-cols">
        <section className="stack">
          <ResourceBar
            label={hurt ? 'Pontos de Vida · machucado' : 'Pontos de Vida'}
            color={hurt ? '#7f1d1d' : '#b91c1c'}
            current={data.pv.current}
            max={data.pv.max}
            onChange={(v) => setIn('pv', { current: v })}
          />
          <div className="row damage-row">
            <Num value={amount} min={0} max={99999} onChange={setAmount} title="Quantidade" />
            <button type="button" className="danger small" onClick={() => setIn('pv', { current: data.pv.current - amount })}>
              Dano
            </button>
            <button type="button" className="small" onClick={() => setIn('pv', { current: Math.min(data.pv.max, data.pv.current + amount) })}>
              Cura
            </button>
            <span className="grow" />
            <label className="row small">
              PV máx.
              <Num value={data.pv.max} min={0} max={99999} onChange={(v) => setIn('pv', { max: v })} className="narrow" />
            </label>
          </div>
          <p className="muted tiny">Machucado com {Math.floor(data.pv.max / 2)} PV ou menos.</p>

          <div className="creature-attrs">
            {OP1_ATTRS.map((attr) => (
              <label key={attr}>
                <button
                  type="button"
                  className="link plain"
                  onClick={() => roll(data.attributes[attr] > 0 ? `${data.attributes[attr]}d20kh1` : '2d20kl1', OP1_ATTR_LABELS[attr].name)}
                >
                  {OP1_ATTR_LABELS[attr].short}
                </button>
                <Num value={data.attributes[attr]} min={0} max={9} onChange={(v) => setIn('attributes', { [attr]: v })} />
              </label>
            ))}
          </div>

          {rollField('Percepção', data.perception, (v) => set('perception', v))}
          {rollField('Iniciativa', data.initiative, (v) => set('initiative', v))}
          {rollField('Fortitude', data.saves.fortitude, (v) => setIn('saves', { fortitude: v }))}
          {rollField('Reflexos', data.saves.reflexos, (v) => setIn('saves', { reflexos: v }))}
          {rollField('Vontade', data.saves.vontade, (v) => setIn('saves', { vontade: v }))}

          <label className="line-field">
            Sentidos
            <Txt value={data.senses} onChange={(v) => set('senses', v)} maxLength={200} />
          </label>
          <label className="line-field">
            Resistências
            <Txt value={data.resistances} onChange={(v) => set('resistances', v)} maxLength={300} />
          </label>
          <label className="line-field">
            Vulnerabilidades
            <Txt value={data.vulnerabilities} onChange={(v) => set('vulnerabilities', v)} maxLength={300} />
          </label>
          <label className="line-field">
            Imunidades
            <Txt value={data.immunities} onChange={(v) => set('immunities', v)} maxLength={300} />
          </label>
        </section>

        <section className="stack">
          <div className="row">
            <h4 className="grow">Perícias</h4>
            <button type="button" className="outline small" onClick={() => set('skills', [...data.skills, { id: newId(), name: 'Perícia', roll: '1O' }])}>
              + Perícia
            </button>
          </div>
          {data.skills.map((s) => (
            <div key={s.id} className="creature-roll">
              <Txt value={s.name} onChange={(v) => set('skills', data.skills.map((x) => (x.id === s.id ? { ...x, name: v } : x)))} maxLength={60} />
              <Txt value={s.roll} onChange={(v) => set('skills', data.skills.map((x) => (x.id === s.id ? { ...x, roll: v } : x)))} className="mono" maxLength={40} />
              <DieButton title={`Rolar ${s.name}`} onClick={() => roll(s.roll, s.name)} />
              <button type="button" className="link danger-link" onClick={() => set('skills', data.skills.filter((x) => x.id !== s.id))} aria-label="Remover perícia">
                ✕
              </button>
            </div>
          ))}

          <div className="row">
            <h4 className="grow">Ações</h4>
            <button
              type="button"
              className="outline small"
              onClick={() =>
                set('actions', [
                  ...data.actions,
                  { id: newId(), kind: 'padrão', name: 'Ataque', test: '2O+5', damage: '1d6', damageType: '', description: '' },
                ])
              }
            >
              + Ação
            </button>
          </div>
          {data.actions.length === 0 && <p className="empty-state">Nenhuma ação</p>}
          {data.actions.map((a) => (
            <Collapsible
              key={a.id}
              title={a.name}
              subtitle={
                <>
                  <span className="accent">{a.kind}</span>
                  {a.test && ` · teste ${a.test}`}
                  {a.damage && ` · dano ${a.damage} ${a.damageType}`}
                </>
              }
              extra={
                <div className="row">
                  <button type="button" className="small" disabled={!a.test} onClick={() => roll(a.test, `${a.name} (teste)`)}>
                    Teste
                  </button>
                  <button type="button" className="small" disabled={!a.damage} onClick={() => roll(a.damage, `${a.name} (dano)`)}>
                    Dano
                  </button>
                </div>
              }
            >
              <div className="edit-grid">
                <label>
                  Nome
                  <Txt value={a.name} onChange={(v) => updateAction(a.id, { name: v })} maxLength={120} />
                </label>
                <label>
                  Tipo de ação
                  <select value={a.kind} onChange={(e) => updateAction(a.id, { kind: e.target.value as CreatureAction['kind'] })}>
                    {ACTION_KINDS.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Teste
                  <Txt value={a.test} onChange={(v) => updateAction(a.id, { test: v })} placeholder="3O+10" className="mono" maxLength={60} />
                </label>
                <label>
                  Dano
                  <Txt value={a.damage} onChange={(v) => updateAction(a.id, { damage: v })} placeholder="2d6+6" className="mono" maxLength={60} />
                </label>
                <label>
                  Tipo de dano
                  <Txt value={a.damageType} onChange={(v) => updateAction(a.id, { damageType: v })} maxLength={40} />
                </label>
              </div>
              <Area value={a.description} onChange={(v) => updateAction(a.id, { description: v })} placeholder="Descrição" rows={2} />
              <RemoveButton onClick={() => set('actions', data.actions.filter((x) => x.id !== a.id))} />
            </Collapsible>
          ))}

          <label className="area-field">
            Notas
            <Area value={data.notes} onChange={(v) => set('notes', v)} placeholder="Comportamento, enigma de medo, táticas…" rows={4} />
          </label>
        </section>
      </div>
    </div>
  );
}
