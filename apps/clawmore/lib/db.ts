/**
 * Database layer for Clawmore - exports services and types.
 *
 * This module provides a clean, testable interface to DynamoDB operations
 * organized by domain/use-case (users, billing, account lifecycle, etc.)
 *
 * Services are injected with the DocClient for easier testing.
 * See individual service files for operation details.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Export client for direct use if needed
const ddbClient = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(ddbClient);

// Export types
export * from './types/models';

// Export utilities
export { KeyBuilder } from './ddb/key-builder';
export { UpdateBuilder } from './ddb/update-builder';
export { dbConfig } from './ddb/env-config';

// Export services
export { UserService } from './services/user-service';
export { BillingService } from './services/billing-service';
export { AccountLifecycleService } from './services/account-lifecycle-service';
export { AccountManagementService } from './services/account-management-service';
export {
  MutationService,
  type CreateMutationInput,
} from './services/mutation-service';
export {
  InnovationService,
  type CreateInnovationPatternInput,
} from './services/innovation-service';

// Export factory function for convenience - creates all services with the client
export function createServices() {
  return {
    users: new (require('./services/user-service').UserService)(docClient),
    billing: new (require('./services/billing-service').BillingService)(
      docClient
    ),
    accountLifecycle:
      new (require('./services/account-lifecycle-service').AccountLifecycleService)(
        docClient
      ),
    accountManagement:
      new (require('./services/account-management-service').AccountManagementService)(
        docClient
      ),
    mutations: new (require('./services/mutation-service').MutationService)(
      docClient
    ),
    innovations:
      new (require('./services/innovation-service').InnovationService)(
        docClient
      ),
  };
}

/**
 * Legacy compatibility layer - backward-compatible function exports
 * These re-export the services for existing code compatibility.
 */

const userService = new (require('./services/user-service').UserService)(
  docClient
);
const billingService =
  new (require('./services/billing-service').BillingService)(docClient);
const accountLifecycleService =
  new (require('./services/account-lifecycle-service').AccountLifecycleService)(
    docClient
  );
const accountManagementService =
  new (require('./services/account-management-service').AccountManagementService)(
    docClient
  );
const mutationService =
  new (require('./services/mutation-service').MutationService)(docClient);
const innovationService =
  new (require('./services/innovation-service').InnovationService)(docClient);

export async function ensureUserMetadata(email: string) {
  return userService.ensureUserMetadata(email);
}

export async function getUserMetadata(email: string) {
  return userService.getUserMetadata(email);
}

export async function getUserStatus(email: string) {
  return userService.getUserStatus(email);
}

export async function createManagedAccountRecord(data: {
  awsAccountId: string;
  ownerEmail: string;
  repoName: string;
}) {
  return accountManagementService.createManagedAccount(data);
}

export async function getManagedAccountsForUser(email: string) {
  return userService.getUserAccounts(email);
}

export async function updateUserSkills(email: string, skills: string[]) {
  return userService.updateUserSkills(email, skills);
}

export async function deductCredits(email: string, costCents: number) {
  const { newBalance } = await billingService.deductCredits(email, costCents);

  // Suspend if balance is 0 or below
  if (newBalance <= 0) {
    await accountLifecycleService.suspendAccount(email);
    return { newBalance: 0, suspended: true };
  }

  return { newBalance, suspended: false };
}

export async function addCredits(email: string, amountCents: number) {
  const current = await userService.getUserMetadata(email);
  const wasSuspended = current?.accountStatus === 'SUSPENDED';

  const { newBalance } = await billingService.addCredits(email, amountCents);

  // Auto-resume if was suspended and now has credits
  if (wasSuspended && newBalance > 0) {
    await accountLifecycleService.resumeAccount(email);
  }

  return { newBalance, wasSuspended };
}

export async function suspendAccount(email: string) {
  return accountLifecycleService.suspendAccount(email);
}

export async function resumeAccount(email: string) {
  return accountLifecycleService.resumeAccount(email);
}

export async function updateProvisioningStatus(
  awsAccountId: string,
  status: 'provisioning' | 'complete' | 'failed',
  error?: string,
  repoUrl?: string
) {
  return accountLifecycleService.updateProvisioningStatus(
    awsAccountId,
    status,
    error,
    repoUrl
  );
}

export async function updateAccountStatus(
  awsAccountId: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DEPLOY'
) {
  return accountLifecycleService.updateAccountStatus(awsAccountId, status);
}

export async function getProvisioningStatus(email: string) {
  const accounts = await userService.getUserAccounts(email);
  return accountLifecycleService.getProvisioningStatus(email, accounts);
}

export async function createMutationRecord(data: {
  userId: string;
  mutationId: string;
  repoName?: string;
  type: string;
  status: 'SUCCESS' | 'FAILURE';
  complexitySaved?: number;
  estimatedHoursSaved?: number;
  tokensUsed?: number;
}) {
  return mutationService.createMutation(data);
}

export async function getRecentMutationsForUser(email: string, limit = 10) {
  return mutationService.getRecentMutations(email, limit);
}

export async function createInnovationPatternRecord(data: {
  pattern: {
    title: string;
    rationale: string;
    logic: string;
    category: 'performance' | 'security' | 'cost' | 'reliability';
    filesAffected: string[];
  };
  sourceRepo: string;
  sourceOwner: string;
}) {
  return innovationService.createPattern(data);
}

export async function getPendingInnovations() {
  return innovationService.getPendingPatterns();
}

export async function updateInnovationStatus(
  sk: string,
  status: 'PROMOTED' | 'REJECTED'
) {
  return innovationService.updatePatternStatus(sk, status);
}
