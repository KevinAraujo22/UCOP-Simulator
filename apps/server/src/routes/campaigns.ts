import { Router } from 'express';
import { createCampaignSchema, joinCampaignSchema } from '@ucop/shared';
import { currentUser, requireAuth, requireMember } from '../auth';
import { HttpError, parse } from '../http';
import { emitMemberJoined } from '../realtime';
import { campaigns, members, toCampaign } from '../repo';

export const campaignsRouter = Router();
campaignsRouter.use('/campaigns', requireAuth);

campaignsRouter.get('/campaigns', (req, res) => {
  res.json(campaigns.listForUser(currentUser(req).id));
});

campaignsRouter.post('/campaigns', (req, res) => {
  const user = currentUser(req);
  const { name } = parse(createCampaignSchema, req.body);
  const row = campaigns.create(name, user.id);
  res.status(201).json({ ...toCampaign(row, 'gm'), role: 'gm', memberCount: 1 });
});

campaignsRouter.post('/campaigns/join', (req, res) => {
  const user = currentUser(req);
  const { inviteCode } = parse(joinCampaignSchema, req.body);
  const row = campaigns.findRowByInvite(inviteCode);
  if (!row) throw new HttpError(404, 'Nenhuma campanha com este código');
  let member = members.get(row.id, user.id);
  if (!member) {
    members.add(row.id, user.id, 'player');
    member = members.get(row.id, user.id)!;
    emitMemberJoined(member);
  }
  res.json({ ...toCampaign(row, member.role), role: member.role, memberCount: members.list(row.id).length });
});

campaignsRouter.get('/campaigns/:id', (req, res) => {
  const user = currentUser(req);
  const member = requireMember(req.params.id, user.id);
  const row = campaigns.findRow(req.params.id);
  if (!row) throw new HttpError(404, 'Campanha não encontrada');
  res.json({ ...toCampaign(row, member.role), role: member.role, memberCount: members.list(row.id).length });
});

campaignsRouter.get('/campaigns/:id/members', (req, res) => {
  requireMember(req.params.id, currentUser(req).id);
  res.json(members.list(req.params.id));
});
