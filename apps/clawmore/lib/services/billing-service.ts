/**
 * Billing Service - Handles credit deduction and balance management.
 * Single responsibility: billing operations ONLY.
 * Account suspension is delegated to AccountLifecycleService.
 */

import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { KeyBuilder } from '../ddb/key-builder';
import { UpdateBuilder } from '../ddb/update-builder';
import { dbConfig } from '../ddb/env-config';

export class BillingService {
  constructor(private docClient: DynamoDBDocumentClient) {}

  /**
   * Deduct credits from user's AI token balance.
   * Returns the new balance in cents.
   */
  async deductCredits(
    email: string,
    costCents: number
  ): Promise<{ newBalance: number }> {
    const builder = new UpdateBuilder().set(
      'aiTokenBalanceCents',
      `aiTokenBalanceCents - :cost`
    );

    const result = await this.docClient.send(
      new UpdateCommand({
        TableName: dbConfig.tableName,
        Key: KeyBuilder.userMetadata(email),
        UpdateExpression:
          'SET aiTokenBalanceCents = aiTokenBalanceCents - :cost',
        ExpressionAttributeValues: {
          ':cost': costCents,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    const newBalance = result.Attributes?.aiTokenBalanceCents ?? 0;
    return { newBalance };
  }

  /**
   * Add credits to user's AI token balance.
   * Returns the new balance in cents.
   */
  async addCredits(
    email: string,
    amountCents: number
  ): Promise<{ newBalance: number }> {
    const result = await this.docClient.send(
      new UpdateCommand({
        TableName: dbConfig.tableName,
        Key: KeyBuilder.userMetadata(email),
        UpdateExpression:
          'SET aiTokenBalanceCents = if_not_exists(aiTokenBalanceCents, :zero) + :amount',
        ExpressionAttributeValues: {
          ':amount': amountCents,
          ':zero': 0,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    const newBalance = result.Attributes?.aiTokenBalanceCents ?? 0;
    return { newBalance };
  }
}
