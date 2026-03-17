/**
 * Signal detection helpers for AI Signal Clarity.
 */

export const AMBIGUOUS_NAME_PATTERNS = [
  /^[a-z]$/, // single letter: a, b, x, y
  /^(tmp|temp|data|obj|val|res|ret|result|item|elem|thing|stuff|info|misc|util|helper|handler|cb|fn|func)$/i,
  /^[a-z]\d+$/, // x1, x2, n3
];

export const MAGIC_LITERAL_IGNORE = new Set([
  0, 1, -1, 2, 10, 100, 1000, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 30, 60, 24,
  7, 365, 200, 201, 204, 400, 401, 403, 404, 500, 80, 443, 3000, 8000, 8080,
]);
export const MAGIC_STRING_IGNORE = new Set([
  '',
  ' ',
  '\n',
  '\t',
  'utf8',
  'utf-8',
  'hex',
  'base64',
  'true',
  'false',
  'null',
  'undefined',
  'node',
  'production',
  'development',
  'test',
  'error',
  'warn',
  'info',
  'debug',
  'main',
  'module',
  'types',
  'scripts',
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'remove',
  'delete',
  'update',
  'create',
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'key',
  'id',
  'name',
  'type',
  'value',
  'version',
  'description',
  'timestamp',
  'date',
  'time',
  'status',
  'mode',
  'action',
  'effect',
  'resource',
  'principal',
  'statement',
  'sid',
  'allow',
  'deny',
  'sts:AssumeRole',
  'iam:PassRole',
  's3:GetObject',
  's3:PutObject',
  's3:DeleteObject',
  's3:ListBucket',
  'events:PutEvents',
  'logs:GetLogEvents',
  'sqs:SendMessage',
  'sqs:ReceiveMessage',
  'dynamodb:GetItem',
  'dynamodb:PutItem',
  'dynamodb:UpdateItem',
  'dynamodb:DeleteItem',
  'dynamodb:Query',
  'dynamodb:Scan',
]);

const TAILWIND_PATTERN = /^[a-z0-9:-]+(\/[0-9]+)?$/;
// PascalCase or camelCase with at least 2 words is descriptive enough for AI
const DESCRIPTIVE_NAME_PATTERN =
  /^([A-Z]+[a-z0-9]*){2,}$|^([a-z]+[a-z0-9]*)([A-Z]+[a-z0-9]*)+$/;

export function isAmbiguousName(name: string): boolean {
  return AMBIGUOUS_NAME_PATTERNS.some((p) => p.test(name));
}

export function isMagicNumber(value: number): boolean {
  return !MAGIC_LITERAL_IGNORE.has(value);
}

export function isMagicString(value: string): boolean {
  if (value.length === 0) return false;
  if (value.length > 20) return false;
  if (MAGIC_STRING_IGNORE.has(value.toLowerCase())) return false;

  if (TAILWIND_PATTERN.test(value) && value.includes('-')) return false;
  if (value === value.toUpperCase() && value.length > 3) return false;
  if (DESCRIPTIVE_NAME_PATTERN.test(value)) return false;
  if (/[/.]/.test(value)) return false;
  if (/^#[0-9a-fA-F]{3,6}$/.test(value)) return false;

  return !/^\s+$/.test(value);
}

export function isRedundantTypeConstant(name: string, value: any): boolean {
  if (typeof value !== 'string') return false;

  const typeMap: Record<string, string> = {
    TYPE_STRING: 'string',
    TYPE_OBJECT: 'object',
    TYPE_ARRAY: 'array',
    TYPE_NUMBER: 'number',
    TYPE_BOOLEAN: 'boolean',
    TYPE_INTEGER: 'integer',
  };

  // Check for exact matches first
  if (typeMap[name] === value) return true;

  // Check for prefix matches e.g. JSON_TYPE_STRING = 'string'
  for (const [key, val] of Object.entries(typeMap)) {
    if (name.endsWith(key) && value === val) return true;
  }

  return false;
}
