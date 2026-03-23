import { PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { doc, TABLE_NAME } from './client';
import {
  getItem,
  queryItems,
  batchPutItems,
  PK,
  SK,
  GSI,
  buildUpdateExpression,
  updateItem,
} from './helpers';
import type { Team, TeamMember, User } from './types';
import { updateUser, getUser } from './users';

export async function createTeam(team: Team, ownerId: string): Promise<Team> {
  const now = new Date().toISOString();
  const teamItem = {
    PK: PK.team(team.id),
    SK: SK.metadata,
    GSI1PK: GSI.teams.pk,
    GSI1SK: team.slug,
    ...team,
    createdAt: team.createdAt || now,
    updatedAt: now,
  };

  const memberItem = {
    PK: PK.team(team.id),
    SK: SK.member(ownerId),
    GSI1PK: PK.team(team.id),
    GSI1SK: `MEMBER#${ownerId}`,
    GSI3PK: PK.user(ownerId),
    GSI3SK: PK.team(team.id),
    teamId: team.id,
    userId: ownerId,
    role: 'owner',
    joinedAt: now,
  };

  await batchPutItems([teamItem, memberItem]);
  await updateUser(ownerId, { teamId: team.id, role: 'owner' });
  return team;
}

export async function getTeam(teamId: string): Promise<Team | null> {
  return getItem<Team>({ PK: PK.team(teamId), SK: SK.metadata });
}

export async function getTeamBySlug(slug: string): Promise<Team | null> {
  const items = await queryItems<Team>({
    IndexName: GSI.teams.index,
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :slug',
    ExpressionAttributeValues: { ':pk': GSI.teams.pk, ':slug': slug },
  });
  return items[0] || null;
}

export async function listUserTeams(
  _userId: string
): Promise<(TeamMember & { team: Team })[]> {
  const result = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `TEAMS#`,
        ':prefix': 'TEAM#',
      },
    })
  );

  const memberships = result.Items || [];
  return Promise.all(
    memberships.map(
      async (m) => ({ ...m, team: await getTeam(m.teamId) }) as any
    )
  );
}

export async function listTeamMembers(
  teamId: string
): Promise<(TeamMember & { user: User })[]> {
  const result = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `TEAM#${teamId}`,
        ':prefix': '#MEMBER#',
      },
    })
  );

  const members = result.Items || [];
  return Promise.all(
    members.map(async (m) => ({ ...m, user: await getUser(m.userId) }) as any)
  );
}

export async function addTeamMember(
  teamId: string,
  userId: string,
  role: 'admin' | 'member' = 'member'
): Promise<void> {
  const now = new Date().toISOString();
  const item = {
    PK: `TEAM#${teamId}`,
    SK: `#MEMBER#${userId}`,
    GSI1PK: `TEAM#${teamId}`,
    GSI1SK: `MEMBER#${userId}`,
    GSI3PK: `USER#${userId}`,
    GSI3SK: `TEAM#${teamId}`,
    teamId,
    userId,
    role,
    joinedAt: now,
  };
  await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  await updateUser(userId, { teamId, role });
}

export async function removeTeamMember(
  teamId: string,
  userId: string
): Promise<void> {
  await doc.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `TEAM#${teamId}`, SK: `#MEMBER#${userId}` },
    })
  );
  await updateUser(userId, { teamId: undefined, role: undefined });
}

export async function updateTeam(
  teamId: string,
  updates: Partial<Team>
): Promise<void> {
  const expr = buildUpdateExpression(updates as Record<string, unknown>);
  if (!expr) return;

  await updateItem(
    { PK: `TEAM#${teamId}`, SK: SK.metadata },
    expr.expression,
    expr.values,
    expr.names
  );
}
