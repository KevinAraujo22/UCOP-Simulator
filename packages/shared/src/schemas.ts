import { z } from 'zod';

const id = z.string().min(1).max(64);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve estar no formato #rrggbb');
const uploadUrl = z
  .string()
  .max(300)
  .regex(/^\/uploads\/[\w-]+\/[\w.-]+$/, 'URL de imagem inválida');

export const LIMITS = {
  gridSize: { min: 16, max: 300 },
  sceneCells: { min: 1, max: 200 },
  tokenSize: { min: 1, max: 10 },
} as const;

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(60),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(120),
  password: z.string().min(6, 'A senha precisa de pelo menos 6 caracteres').max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

const gameSystem = z.enum(['op1', 'op2']);

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(80),
  system: gameSystem.default('op1'),
  determination: z.boolean().default(false),
});

export const updateCampaignSchema = z
  .object({
    name: z.string().trim().min(2, 'Nome muito curto').max(80),
    system: gameSystem,
    determination: z.boolean(),
    playersMoveOwnOnly: z.boolean(),
  })
  .partial();

export const joinCampaignSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4,12}$/, 'Código de convite inválido'),
});

const gridSize = z.number().int().min(LIMITS.gridSize.min).max(LIMITS.gridSize.max);
const cells = z.number().int().min(LIMITS.sceneCells.min).max(LIMITS.sceneCells.max);

export const createSceneSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da cena').max(80),
  gridSize: gridSize.default(70),
  width: cells.default(20),
  height: cells.default(15),
  backgroundUrl: uploadUrl.nullable().optional(),
});

export const updateSceneSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    gridSize,
    width: cells,
    height: cells,
    backgroundUrl: uploadUrl.nullable(),
  })
  .partial();

const tokenFields = {
  name: z.string().trim().min(1, 'Informe o nome do token').max(60),
  x: z.number().int().min(0).max(LIMITS.sceneCells.max),
  y: z.number().int().min(0).max(LIMITS.sceneCells.max),
  size: z.number().int().min(LIMITS.tokenSize.min).max(LIMITS.tokenSize.max),
  color: hexColor,
  imageUrl: uploadUrl.nullable(),
  ownerId: id.nullable(),
  hidden: z.boolean(),
  sheetId: id.nullable(),
};

export const createTokenSchema = z.object({
  sceneId: id,
  name: tokenFields.name,
  x: tokenFields.x.default(0),
  y: tokenFields.y.default(0),
  size: tokenFields.size.default(1),
  color: tokenFields.color.default('#8b5cf6'),
  imageUrl: tokenFields.imageUrl.default(null),
  ownerId: tokenFields.ownerId.default(null),
  hidden: tokenFields.hidden.default(false),
  sheetId: tokenFields.sheetId.default(null),
});

export const updateTokenSchema = z.object({
  id,
  patch: z.object(tokenFields).partial(),
});

/** Cria (ou move) o token de uma ficha na cena, ao arrastar a ficha para o mapa. */
export const placeTokenSchema = z.object({
  sheetId: id,
  sceneId: id,
  x: z.number().int().min(0).max(LIMITS.sceneCells.max),
  y: z.number().int().min(0).max(LIMITS.sceneCells.max),
});

export const moveTokenSchema = z.object({
  id,
  x: z.number().int().min(0).max(LIMITS.sceneCells.max),
  y: z.number().int().min(0).max(LIMITS.sceneCells.max),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCampaignInput = z.input<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type JoinCampaignInput = z.infer<typeof joinCampaignSchema>;
export type CreateSceneInput = z.input<typeof createSceneSchema>;
export type UpdateSceneInput = z.infer<typeof updateSceneSchema>;
export type CreateTokenInput = z.input<typeof createTokenSchema>;
export type UpdateTokenInput = z.infer<typeof updateTokenSchema>;
export type MoveTokenInput = z.infer<typeof moveTokenSchema>;
export type PlaceTokenInput = z.infer<typeof placeTokenSchema>;

/** Primeira mensagem de erro legível de um ZodError. */
export function firstZodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Dados inválidos';
  const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
  return `${where}${issue.message}`;
}
