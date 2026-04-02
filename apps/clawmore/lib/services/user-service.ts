/**
 * User Service - Handles user account management and metadata.
 * Single responsibility: user lifecycle and provisioning operations.
 */

import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { UserMetadata, ManagedAccountRecord } from '../types/models';
import { KeyBuilder } from '../ddb/key-builder';
import { UpdateBuilder } from '../ddb/update-builder';
import { dbConfig } from '../ddb/env-config';

export class UserService {
  constructor(private docClient: DynamoDBDocumentClient) {}

  /**
   * Ensure user metadata record exists with default values.
   */
  async ensureUserMetadata(email: string): Promise<void> {
    const keys = KeyBuilder.userMetadata(email);
    const existing = await this.docClient.send(
      new GetCommand({
        TableName: dbConfig.tableName,
        Key: keys,
      })
    );

    if (!existing.Item) {
      const builder = new UpdateBuilder()
        .set('EntityType', 'UserMetadata')
        .set('aiTokenBalanceCents', 500) // $5.00 welcome credit
        .set('aiRefillThresholdCents', 100) // $1.00 refill threshold
        .set('aiTopupAmountCents', 1000) // $10.00 default top-up
        .set('coEvolutionOptIn', false)
        .set('autoTopupEnabled', true)
        .set('enabledSkills', ['refactor', 'validation']);

      await this.docClient.send(
        new UpdateCommand({
          TableName: dbConfig.tableName,
          Key: keys,
          ...builder.build(),
        })
      );
    }
  }

  /**
   * Get user metadata.
   */
  async getUserMetadata(email: string): Promise<UserMetadata | null> {
    const response = await this.docClient.send(
      new GetCommand({
        TableName: dbConfig.tableName,
        Key: KeyBuilder.userMetadata(email),
      })
    );
    return (response.Item as UserMetadata) || null;
  }

  /**
   * Get all managed accounts for a user.
   */
  async getUserAccounts(email: string): Promise<ManagedAccountRecord[]> {
    const response = await this.docClient.send(
      new QueryCommand({
        TableName: dbConfig.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk_prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${email}`,
          ':sk_prefix': 'ACCOUNT#',
        },
      })
    );

    const accountIds = (response.Items || []).map((item) =>
      KeyBuilder.parseAccountIdFromSk(item.SK)
    );

    const accounts: ManagedAccountRecord[] = [];
    for (const id of accountIds) {
      const accRes = await this.docClient.send(
        new GetCommand({
          TableName: dbConfig.tableName,
          Key: KeyBuilder.accountMetadata(id),
        })
      );
      if (accRes.Item) accounts.push(accRes.Item as ManagedAccountRecord);
    }

    return accounts;
  }

  /**
   * Update enabled skills for a user.
   */
  async updateUserSkills(email: string, skills: string[]): Promise<void> {
    const builder = new UpdateBuilder()
      .set('enabledSkills', skills)
      .set('updatedAt', new Date().toISOString());

    await this.docClient.send(
      new UpdateCommand({
        TableName: dbConfig.tableName,
        Key: KeyBuilder.userMetadata(email),
        ...builder.build(),
      })
    );
  }

  /**
   * Get user account status from GSI.
   */
  async getUserStatus(email: string): Promise<string | null> {
    const response = await this.docClient.send(
      new QueryCommand({
        TableName: dbConfig.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'USER',
          ':sk': email,
        },
      })
    );

    return response.Items?.[0]?.status || null;
  }
}
