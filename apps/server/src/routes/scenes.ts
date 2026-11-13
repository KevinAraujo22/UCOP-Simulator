import { Router } from 'express';
import { clampTokenCell, createSceneSchema, updateSceneSchema, type Scene } from '@ucop/shared';
import { currentUser, requireAuth, requireMember } from '../auth';
import { assertCampaignUpload, HttpError, parse } from '../http';
import {
  emitActiveScene,
  emitSceneDeleted,
  emitSceneList,
  emitSceneUpdated,
  emitTokenChanged,
  gmSceneState,
  playerSceneState,
} from '../realtime';
import { campaigns, scenes, tokens } from '../repo';

export const scenesRouter = Router();
scenesRouter.use(['/campaigns', '/scenes'], requireAuth);

function loadScene(id: string): Scene {
  const scene = scenes.get(id);
  if (!scene) throw new HttpError(404, 'Cena não encontrada');
  return scene;
}

/** Mestre: todas as cenas. Jogador: apenas a cena ativa (se houver). */
scenesRouter.get('/campaigns/:id/scenes', (req, res) => {
  const member = requireMember(req.params.id, currentUser(req).id);
  if (member.role === 'gm') {
    res.json(scenes.list(req.params.id));
    return;
  }
  const state = playerSceneState(req.params.id);
  res.json(state ? [state.scene] : []);
});

scenesRouter.post('/campaigns/:id/scenes', (req, res) => {
  requireMember(req.params.id, currentUser(req).id, { gm: true });
  const input = parse(createSceneSchema, req.body);
  assertCampaignUpload(req.params.id, input.backgroundUrl);
  const scene = scenes.create(req.params.id, input);
  emitSceneList(req.params.id);
  res.status(201).json(scene);
});

/** Estado completo (cena + tokens). Jogadores só acessam a cena ativa, sem ocultos. */
scenesRouter.get('/scenes/:id', (req, res) => {
  const scene = loadScene(req.params.id);
  const member = requireMember(scene.campaignId, currentUser(req).id);
  if (member.role === 'gm') {
    res.json(gmSceneState(scene));
    return;
  }
  const state = playerSceneState(scene.campaignId);
  if (!state || state.scene.id !== scene.id) throw new HttpError(404, 'Cena não encontrada');
  res.json(state);
});

scenesRouter.patch('/scenes/:id', (req, res) => {
  const scene = loadScene(req.params.id);
  requireMember(scene.campaignId, currentUser(req).id, { gm: true });
  const patch = parse(updateSceneSchema, req.body);
  assertCampaignUpload(scene.campaignId, patch.backgroundUrl);
  const updated = scenes.update({ ...scene, ...patch });
  emitSceneUpdated(updated);

  // Se o mapa encolheu, traz de volta os tokens que ficaram para fora.
  if (updated.width < scene.width || updated.height < scene.height) {
    for (const token of tokens.listByScene(updated.id)) {
      const pos = clampTokenCell(token.x, token.y, token.size, updated);
      if (pos.x !== token.x || pos.y !== token.y) {
        emitTokenChanged(updated, tokens.update({ ...token, ...pos }), token);
      }
    }
  }
  res.json(updated);
});

scenesRouter.delete('/scenes/:id', (req, res) => {
  const scene = loadScene(req.params.id);
  requireMember(scene.campaignId, currentUser(req).id, { gm: true });
  const wasActive = campaigns.findRow(scene.campaignId)?.active_scene_id === scene.id;
  scenes.delete(scene.id);
  if (wasActive) {
    campaigns.setActiveScene(scene.campaignId, null);
    emitActiveScene(scene.campaignId);
  }
  emitSceneDeleted(scene);
  res.status(204).end();
});
