import { describe, it, expect, vi } from 'vitest';
import { parseRuleFile } from '../parser';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Skill Rule Parser', () => {
  const tmpDir = join(tmpdir(), 'aiready-skills-tests');

  it('should parse a rule file with frontmatter and examples', async () => {
    await mkdir(tmpDir, { recursive: true });
    const filePath = join(tmpDir, 'patterns-test.md');
    const content = `---
title: Test Rule
tags: tag1, tag2
---

## Actual Title

**Impact: CRITICAL (Total failure)**

Explanation text here.

**Incorrect:**

\`\`\`ts
bad()
\`\`\`

**Correct:**

\`\`\`ts
good()
\`\`\`
`;
    await writeFile(filePath, content);

    const { rule, section } = await parseRuleFile(filePath);

    expect(rule.title).toBe('Test Rule');
    expect(rule.impact).toBe('CRITICAL');
    expect(rule.tags).toContain('tag1');
    expect(rule.examples).toHaveLength(2);
    expect(section).toBe(1); // patterns prefix = section 1

    await rm(tmpDir, { recursive: true, force: true });
  });
});
