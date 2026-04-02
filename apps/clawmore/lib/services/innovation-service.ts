/**
 * Innovation Service - Handles innovation pattern lifecycle.
 * Single responsibility: innovation pattern recording, retrieval, and status management.
 */

import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { InnovationPatternRecord } from '../types/models';
import { KeyBuilder } from '../ddb/key-builder';
import { UpdateBuilder } from '../ddb/update-builder';
import { dbConfig } from '../ddb/env-config';

export interface CreateInnovationPatternInput {
  pattern: {
    title: string;
    rationale: string;
    logic: string;
    category: 'performance' | 'security' | 'cost' | 'reliability';
    filesAffected: string[];
  };
  sourceRepo: string;
  sourceOwner: string;
}

export class InnovationService {
  constructor(private docClient: DynamoDBDocumentClient) {}

  /**
   * Create a new innovation pattern record.
   */
  async createPattern(data: CreateInnovationPatternInput): Promise<void> {
    const { pattern, sourceRepo, sourceOwner } = data;
    const timestamp = new Date().toISOString();
    const keys = KeyBuilder.innovationPattern(timestamp, sourceRepo);

    const builder = new UpdateBuilder()
      .set('EntityType', 'InnovationPattern')
      .set('title', pattern.title)
      .set('rationale', pattern.rationale)
      .set('logic', pattern.logic)
      .set('category', pattern.category)
      .set('filesAffected', pattern.filesAffected)
      .set('sourceRepo', sourceRepo)
      .set('sourceOwner', sourceOwner)
      .set('status', 'PENDING', 'status')
      .set('createdAt', timestamp);

    await this.docClient.send(
      new UpdateCommand({
        TableName: dbConfig.tableName,
        Key: keys,
        ...builder.build(),
      })
    );
  }

  /**
   * Get all pending innovation patterns.
   */
  async getPendingPatterns(): Promise<InnovationPatternRecord[]> {
    const response = await this.docClient.send(
      new QueryCommand({
        TableName: dbConfig.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk_prefix)',
        ExpressionAttributeValues: {
          ':pk': 'INNOVATION',
          ':sk_prefix': 'PATTERN#',
        },
        ScanIndexForward: false, // Recent first
      })
    );

    return (response.Items || []) as InnovationPatternRecord[];
  }

  /**
   * Update status of an innovation pattern.
   */
  async updatePatternStatus(
    sk: string,
    status: 'PROMOTED' | 'REJECTED'
  ): Promise<void> {
    const builder = new UpdateBuilder()
      .set('status', status, 'status')
      .set('updatedAt', new Date().toISOString());

    await this.docClient.send(
      new UpdateCommand({
        TableName: dbConfig.tableName,
        Key: { PK: 'INNOVATION', SK: sk },
        ...builder.build(),
      })
    );
  }
}
