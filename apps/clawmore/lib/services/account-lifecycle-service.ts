/**
 * Account Lifecycle Service - Handles account status transitions.
 * Single responsibility: provisioning, suspension, resumption, and account status changes.
 */

import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ManagedAccountRecord } from '../types/models';
import { KeyBuilder } from '../ddb/key-builder';
import { UpdateBuilder } from '../ddb/update-builder';
import { dbConfig } from '../ddb/env-config';

export class AccountLifecycleService {
  constructor(private docClient: DynamoDBDocumentClient) {}

  /**
   * Update provisioning status of a managed account.
   */
  async updateProvisioningStatus(
    awsAccountId: string,
    status: 'provisioning' | 'complete' | 'failed',
    error?: string,
    repoUrl?: string
  ): Promise<void> {
    const builder = new UpdateBuilder()
      .set('provisioningStatus', status)
      .setIf('repoUrl', repoUrl)
      .setIf('provisioningError', error);

    await this.docClient.send(
      new UpdateCommand({
        TableName: dbConfig.tableName,
        Key: KeyBuilder.accountMetadata(awsAccountId),
        ...builder.build(),
      })
    );
  }

  /**
   * Update the operational status of a managed account.
   */
  async updateAccountStatus(
    awsAccountId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DEPLOY'
  ): Promise<void> {
    const builder = new UpdateBuilder()
      .set('accountStatus', status)
      .set('updatedAt', new Date().toISOString());

    await this.docClient.send(
      new UpdateCommand({
        TableName: dbConfig.tableName,
        Key: KeyBuilder.accountMetadata(awsAccountId),
        ...builder.build(),
      })
    );
  }

  /**
   * Suspend a user account — blocks mutation activity.
   */
  async suspendAccount(email: string): Promise<void> {
    const builder = new UpdateBuilder()
      .set('accountStatus', 'SUSPENDED')
      .set('suspendedAt', new Date().toISOString());

    await this.docClient.send(
      new UpdateCommand({
        TableName: dbConfig.tableName,
        Key: KeyBuilder.userMetadata(email),
        ...builder.build(),
      })
    );
  }

  /**
   * Resume a suspended user account.
   */
  async resumeAccount(email: string): Promise<void> {
    await this.docClient.send(
      new UpdateCommand({
        TableName: dbConfig.tableName,
        Key: KeyBuilder.userMetadata(email),
        UpdateExpression:
          'SET accountStatus = :status, resumedAt = :now REMOVE suspendedAt',
        ExpressionAttributeValues: {
          ':status': 'ACTIVE',
          ':now': new Date().toISOString(),
        },
      })
    );
  }

  /**
   * Get provisioning status across all accounts for a user.
   */
  async getProvisioningStatus(
    email: string,
    accounts: ManagedAccountRecord[]
  ): Promise<{
    status: 'provisioning' | 'complete' | 'failed' | 'none';
    accounts: ManagedAccountRecord[];
  }> {
    if (accounts.length === 0) {
      return { status: 'none', accounts: [] };
    }

    const hasProvisioning = accounts.some(
      (a) => a.provisioningStatus === 'provisioning'
    );
    const hasFailed = accounts.some((a) => a.provisioningStatus === 'failed');

    if (hasProvisioning) return { status: 'provisioning', accounts };
    if (hasFailed) return { status: 'failed', accounts };
    return { status: 'complete', accounts };
  }
}
