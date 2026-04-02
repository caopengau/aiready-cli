/**
 * Domain models for Clawmore database layer.
 * Centralized type definitions to avoid duplication.
 */

export interface ManagedAccountRecord {
  PK: string;
  SK: string;
  EntityType: 'ManagedAccount';
  awsAccountId: string;
  ownerEmail: string;
  repoName: string;
  currentMonthlySpendCents: number;
  reportedOverageCents: number;
  lastCostSync?: string;
  provisioningStatus?: 'provisioning' | 'complete' | 'failed';
  provisioningError?: string;
  accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DEPLOY';
  repoUrl?: string;
  updatedAt?: string;
}

export interface UserMetadata {
  PK: string;
  SK: 'METADATA';
  EntityType: 'UserMetadata';
  aiTokenBalanceCents: number;
  aiRefillThresholdCents: number;
  aiTopupAmountCents: number;
  coEvolutionOptIn: boolean;
  autoTopupEnabled: boolean;
  enabledSkills: string[];
  accountStatus?: 'ACTIVE' | 'SUSPENDED';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeMutationSubscriptionItemId?: string;
  suspendedAt?: string;
  resumedAt?: string;
}

export interface MutationRecord {
  PK: string;
  SK: string;
  EntityType: 'MutationEvent';
  mutationId: string;
  userId: string;
  repoName: string;
  mutationType: string;
  mutationStatus: 'SUCCESS' | 'FAILURE';
  complexitySaved?: number;
  estimatedHoursSaved?: number;
  tokensUsed?: number;
  createdAt: string;
}

export interface InnovationPatternRecord {
  PK: 'INNOVATION';
  SK: string;
  EntityType: 'InnovationPattern';
  title: string;
  rationale: string;
  logic: string;
  category: 'performance' | 'security' | 'cost' | 'reliability';
  filesAffected: string[];
  sourceRepo: string;
  sourceOwner: string;
  status: 'PENDING' | 'PROMOTED' | 'REJECTED';
  createdAt: string;
}
