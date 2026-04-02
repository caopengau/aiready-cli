/**
 * DynamoDB key builder utility.
 * Centralizes all key generation logic to prevent duplication and enable validation.
 */

export class KeyBuilder {
  /**
   * Build keys for a user metadata record.
   * @param email User's email address
   */
  static userMetadata(email: string) {
    return {
      PK: `USER#${email}`,
      SK: 'METADATA',
    };
  }

  /**
   * Build keys for a managed account record.
   * @param awsAccountId AWS account ID
   */
  static accountMetadata(awsAccountId: string) {
    return {
      PK: `ACCOUNT#${awsAccountId}`,
      SK: 'METADATA',
    };
  }

  /**
   * Build keys for a user-account link.
   * @param email User's email
   * @param awsAccountId AWS account ID
   */
  static userAccountLink(email: string, awsAccountId: string) {
    return {
      PK: `USER#${email}`,
      SK: `ACCOUNT#${awsAccountId}`,
    };
  }

  /**
   * Build keys for a mutation record.
   * @param userId User ID (email)
   * @param mutationId Unique mutation ID
   */
  static mutation(userId: string, mutationId: string) {
    return {
      PK: `USER#${userId}`,
      SK: `MUTATION#${mutationId}`,
    };
  }

  /**
   * Parse account ID from user-account link SK.
   * @param sk Sort key in format ACCOUNT#<id>
   */
  static parseAccountIdFromSk(sk: string): string {
    const match = sk.match(/^ACCOUNT#(.+)$/);
    if (!match) {
      throw new Error(`Invalid account SK format: ${sk}`);
    }
    return match[1];
  }

  /**
   * Build keys for innovation pattern record.
   * @param timestamp ISO timestamp
   * @param repoName Repository name
   */
  static innovationPattern(timestamp: string, repoName: string) {
    return {
      PK: 'INNOVATION' as const,
      SK: `PATTERN#${timestamp}#${repoName}`,
    };
  }
}
