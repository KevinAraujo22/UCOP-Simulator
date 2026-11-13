import type { CatalogAbility } from './types';

const P = (page: number) => `OPRPG p. ${page}`;

function pp(
  element: string,
  name: string,
  summary: string,
  extra: Partial<CatalogAbility> = {},
): CatalogAbility {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return { id: `paranormal-${slug}`, kind: 'paranormal', group: element, name, page: P(115), summary, ...extra };
}

/** Poderes paranormais (via Transcender). Resumos próprios. */
export const OP1_PARANORMAL_POWERS: CatalogAbility[] = [
  pp('Geral', 'Aprender Ritual', 'Aprende um ritual de 1º círculo (2º a partir de 45% e 3º a partir de 75% de NEX). Pode ser escolhido várias vezes.', {
    page: P(114),
  }),
  pp('Geral', 'Resistir a <Elemento>', 'Resistência 10 contra o elemento escolhido.', { page: P(114), affinity: 'A resistência sobe para 20.' }),
  // Conhecimento
  pp('Conhecimento', 'Expansão de Conhecimento', 'Aprende um poder de outra classe.', { prereq: 'Conhecimento 1', affinity: 'Aprende um segundo poder de outra classe.' }),
  pp('Conhecimento', 'Percepção Paranormal', 'Ao procurar pistas, pode rolar de novo um dado menor que 10.', {
    affinity: 'Pode rolar de novo até dois dados menores que 10.',
  }),
  pp('Conhecimento', 'Precognição', '+2 na Defesa e em testes de resistência.', {
    prereq: 'Conhecimento 1',
    affinity: 'Imune à condição desprevenido.',
    effect: () => ({ defense: 2, saves: 2 }),
  }),
  pp('Conhecimento', 'Sensitivo', '+5 em Diplomacia, Intimidação e Intuição.', {
    affinity: 'Nos testes opostos de Diplomacia/Intimidação, o oponente sofre penalidade.',
    effect: () => ({ skills: { diplomacia: 5, intimidacao: 5, intuicao: 5 } }),
  }),
  pp('Conhecimento', 'Visão do Oculto', '+5 em Percepção e enxerga no escuro.', {
    affinity: 'Ignora camuflagem.',
    effect: () => ({ skills: { percepcao: 5 } }),
  }),
  // Energia
  pp('Energia', 'Afortunado', '1×/rolagem, rola de novo um resultado 1 em dados que não sejam d20.', {
    affinity: 'Também pode rolar de novo um 1 no d20, 1×/teste.',
  }),
  pp('Energia', 'Campo Protetor', 'Ao se esquivar, 1 PE para +5 na Defesa.', { prereq: 'Energia 1', cost: '1 PE', affinity: 'Também recebe +5 em Reflexos e evita o dano de efeitos que passaria pela metade.' }),
  pp('Energia', 'Causalidade Fortuita', 'A DT para procurar pistas cai –5 até você achar uma pista.', { affinity: 'A redução passa a valer sempre.' }),
  pp('Energia', 'Golpe de Sorte', '+1 na margem de ameaça dos seus ataques.', { prereq: 'Energia 1', affinity: '+1 no multiplicador de crítico.' }),
  pp('Energia', 'Manipular Entropia', '2 PE para um alvo próximo rolar de novo um dado de um teste.', { prereq: 'Energia 1', cost: '2 PE', affinity: 'O alvo rola de novo todos os dados que você escolher.' }),
  // Morte
  pp('Morte', 'Encarar a Morte', '+1 no limite de PE por turno durante cenas de ação (não afeta DT).', {
    affinity: 'O aumento vira +3 no total.',
  }),
  pp('Morte', 'Escapar da Morte', '1×/cena, um dano que o deixaria com 0 PV o deixa com 1 PV.', {
    prereq: 'Morte 1',
    affinity: 'Evita o dano por completo (com dano massivo, fica com 1 PV).',
  }),
  pp('Morte', 'Potencial Aprimorado', '+1 PE por NEX (cresce junto com o NEX).', {
    affinity: 'O bônus passa a ser +2 PE por NEX.',
    effect: ({ steps, affinity }) => ({ pe: steps * (affinity ? 2 : 1) }),
  }),
  pp('Morte', 'Potencial Reaproveitado', '1×/rodada, ao passar num teste de resistência, ganha 2 PE temporários.', {
    affinity: 'Ganha 3 PE temporários em vez de 2.',
  }),
  pp('Morte', 'Surto Temporal', '1×/cena, gaste PE para uma ação padrão adicional.', { prereq: 'Morte 2', affinity: 'Pode ser usado 1×/turno em vez de 1×/cena.' }),
  // Sangue
  pp('Sangue', 'Anatomia Insana', '50% de chance de ignorar o dano extra de críticos e ataques furtivos.', {
    prereq: 'Sangue 2',
    affinity: 'Fica imune a acertos críticos e ataques furtivos.',
  }),
  pp('Sangue', 'Arma de Sangue', 'Movimento + 2 PE: arma natural de sangue até o fim da cena.', { cost: '2 PE', affinity: 'A arma vira parte permanente de você e causa 1d10 de dano de Sangue.' }),
  pp('Sangue', 'Sangue de Ferro', '+2 PV por NEX (cresce junto com o NEX).', {
    affinity: '+5 em Fortitude e imunidade a venenos e doenças.',
    effect: ({ steps, affinity }) => ({ pv: steps * 2, ...(affinity ? { skills: { fortitude: 5 } } : {}) }),
  }),
  pp('Sangue', 'Sangue Fervente', 'Machucado: +1 em Agilidade ou Força.', { prereq: 'Sangue 2', affinity: 'O bônus aumenta para +2.' }),
  pp('Sangue', 'Sangue Vivo', 'Na 1ª vez que fica machucado na cena, ganha cura acelerada 2.', { prereq: 'Sangue 1', affinity: 'A cura acelerada sobe para 5.' }),
];
