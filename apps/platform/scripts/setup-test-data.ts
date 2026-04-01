import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

// Accept table name from command line or use default
const TABLE_NAME =
  process.argv[2] || 'aiready-platform-dev-MainTableTable-rhuwxtoc';
const REGION = 'ap-southeast-2';

const client = new DynamoDBClient({ region: REGION });
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true },
});

async function setup() {
  const email = 'caopengau@gmail.com';
  console.log(`Setting up data for ${email} in table ${TABLE_NAME}...`);

  // 1. Get User
  const userResult = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :email',
      ExpressionAttributeValues: {
        ':pk': 'USERS',
        ':email': email,
      },
    })
  );

  let user = userResult.Items?.[0];
  if (!user) {
    console.log('User not found, creating...');
    const userId = randomUUID();
    user = {
      PK: `USER#${userId}`,
      SK: '#METADATA',
      GSI1PK: 'USERS',
      GSI1SK: email,
      id: userId,
      email,
      name: 'Cao Peng',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: user }));
  }
  const userId = user.id;
  console.log(`User ID: ${userId}`);

  // 2. Get/Create Repo
  const repoResult = await doc.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'REPO#',
      },
    })
  );

  let repo = repoResult.Items?.find((r) => r.name === 'aiready');
  if (!repo) {
    console.log('Repo "aiready" not found, creating...');
    const repoId = randomUUID();
    repo = {
      PK: `REPO#${repoId}`,
      SK: '#METADATA',
      GSI1PK: `USER#${userId}`,
      GSI1SK: `REPO#${repoId}`,
      id: repoId,
      userId,
      name: 'aiready',
      url: 'https://github.com/getaiready/aiready-cli',
      defaultBranch: 'main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: repo }));
  }
  const repoId = repo.id;
  console.log(`Repo ID: ${repoId}`);

  // 3. Create API Key
  const apiKeyId = randomUUID();
  const keyBody = randomBytes(24).toString('hex');
  const plainKey = `ar_${keyBody}`;
  const keyHash = createHash('sha256').update(plainKey).digest('hex');
  const prefix = `${plainKey.substring(0, 7)}...`;

  console.log('Creating API Key...');
  await doc.send(
    new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: [
          {
            PutRequest: {
              Item: {
                PK: `USER#${userId}`,
                SK: `APIKEY#${apiKeyId}`,
                GSI1PK: `USER#${userId}`,
                GSI1SK: `APIKEY#${apiKeyId}`,
                id: apiKeyId,
                userId,
                name: 'Test Key',
                keyHash,
                prefix,
                type: 'APIKEY',
                createdAt: new Date().toISOString(),
              },
            },
          },
          {
            PutRequest: {
              Item: {
                PK: `APIKEY#${keyHash}`,
                SK: '#METADATA',
                type: 'APIKEY_HASH',
                apiKeyId: apiKeyId,
                userId: userId,
              },
            },
          },
        ],
      },
    })
  );

  console.log('\n--- SETUP COMPLETE ---');
  console.log(`API_KEY: ${plainKey}`);
  console.log(`REPO_ID: ${repoId}`);
  console.log(`TABLE: ${TABLE_NAME}`);
  console.log('----------------------\n');
}

setup().catch(console.error);
