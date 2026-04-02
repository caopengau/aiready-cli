/**
 * Account Management Service - Handles managed account creation and linking.
 * Single responsibility: account provisioning and user-account relationships.
 */

import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { KeyBuilder } from '../ddb/key-builder';
import { UpdateBuilder } from '../ddb/update-builder';
import { dbConfig } from '../ddb/env-config';

export interface CreateManagedAccountInput {
  awsAccountId: string;
  ownerEmail: string;
  repoName: string;
}

export class AccountManagementService {
  constructor(private docClient: DynamoDBDocumentClient) {}

  /**
   * Create a new managed account record and link it to the user.
   */
  async createManagedAccount(data: CreateManagedAccountInput): Promise<void> {
    const { awsAccountId, ownerEmail, repoName } = data;

    // Create account record
    const accountBuilder = new UpdateBuilder()
      .set('EntityType', 'ManagedAccount')
      .set('awsAccountId', awsAccountId)
      .set('ownerEmail', ownerEmail)
      .set('repoName', repoName)
      .set('currentMonthlySpendCents', 0)
      .set('reportedOverageCents', 0)
      .set('createdAt', new Date().toISOString());

    await this.docClient.send(
      new UpdateCommand({
        TableName: dbConfig.tableName,
        Key: KeyBuilder.accountMetadata(awsAccountId),
        ...accountBuilder.build(),
      })
    );

    // Link account to user
    const linkBuilder = new UpdateBuilder()
      .set('EntityType', 'UserAccountLink')
      .set('repoName', repoName);

    await this.docClient.send(
      new UpdateCommand({
        TableName: dbConfig.tableName,
        Key: KeyBuilder.userAccountLink(ownerEmail, awsAccountId),
        ...linkBuilder.build(),
      })
    );
  }
}
