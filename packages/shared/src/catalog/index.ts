import { OP1_CLASS_POWERS, OP1_TRAILS, op1ClassFeatures } from './op1-classes';
import { OP1_ITEMS } from './op1-items';
import { OP1_ORIGINS } from './op1-origins';
import { OP1_PARANORMAL_POWERS } from './op1-paranormal';
import { OP1_RITUALS } from './op1-rituals';
import type { CatalogAbility, CatalogItem, CatalogOrigin, CatalogRitual, CatalogTrail, Effects } from './types';

export * from './types';
export { OP1_CLASS_POWERS, OP1_ITEMS, OP1_ORIGINS, OP1_PARANORMAL_POWERS, OP1_RITUALS, OP1_TRAILS, op1ClassFeatures };

/** Custo base em PE de um ritual por círculo (1º = 1, 2º = 3, 3º = 6, 4º = 10). */
export const RITUAL_BASE_COST = [0, 1, 3, 6, 10] as const;

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));

const ABILITIES = byId<CatalogAbility>([
  ...OP1_CLASS_POWERS,
  ...OP1_PARANORMAL_POWERS,
  ...OP1_ORIGINS.map((o) => o.power),
  ...OP1_TRAILS.flatMap((t) => t.abilities),
]);
const RITUALS = byId<CatalogRitual>(OP1_RITUALS);
const ITEMS = byId<CatalogItem>(OP1_ITEMS);
const ORIGINS = byId<CatalogOrigin>(OP1_ORIGINS);
const TRAILS = byId<CatalogTrail>(OP1_TRAILS);

export const findAbility = (id: string) => (id ? ABILITIES.get(id) : undefined);
export const findRitual = (id: string) => (id ? RITUALS.get(id) : undefined);
export const findItem = (id: string) => (id ? ITEMS.get(id) : undefined);
export const findOrigin = (id: string) => (id ? ORIGINS.get(id) : undefined);
export const findTrail = (id: string) => (id ? TRAILS.get(id) : undefined);

/** Soma dois conjuntos de efeitos. */
export function addEffects(a: Effects, b: Effects): Effects {
  const out: Effects = { ...a };
  for (const key of ['pv', 'pe', 'san', 'pd', 'defense', 'saves', 'peLimit', 'ritualDt', 'load'] as const) {
    if (b[key]) out[key] = (out[key] ?? 0) + b[key]!;
  }
  if (b.skills) {
    out.skills = { ...(out.skills ?? {}) };
    for (const [k, v] of Object.entries(b.skills)) out.skills[k] = (out.skills[k] ?? 0) + v;
  }
  return out;
}

/** Descreve um conjunto de efeitos em texto curto (para o detalhamento na ficha). */
export function describeEffects(e: Effects): string {
  const parts: string[] = [];
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  if (e.pv) parts.push(`${sign(e.pv)} PV`);
  if (e.pe) parts.push(`${sign(e.pe)} PE`);
  if (e.san) parts.push(`${sign(e.san)} SAN`);
  if (e.pd) parts.push(`${sign(e.pd)} PD`);
  if (e.defense) parts.push(`${sign(e.defense)} Defesa`);
  if (e.saves) parts.push(`${sign(e.saves)} resistências`);
  if (e.peLimit) parts.push(`${sign(e.peLimit)} limite`);
  if (e.ritualDt) parts.push(`${sign(e.ritualDt)} DT rituais`);
  if (e.load) parts.push(`${sign(e.load)} carga`);
  for (const [k, v] of Object.entries(e.skills ?? {})) parts.push(`${sign(v)} ${k}`);
  return parts.join(', ');
}
