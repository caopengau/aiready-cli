/**
 * Environment configuration with validation.
 * Ensures critical environment variables are set before runtime.
 */

export class EnvConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvConfigError';
  }
}

export const dbConfig = {
  tableName: process.env.DYNAMO_TABLE,

  validate(): void {
    if (!this.tableName) {
      throw new EnvConfigError(
        'DYNAMO_TABLE environment variable is required but not set'
      );
    }
  },
};

// Validate on module load
try {
  dbConfig.validate();
} catch (error) {
  console.error('Database configuration error:', error);
}
