import { Issue } from '../providers/issuesProvider';

// Internal types for report object sections
interface IssueItem {
  severity: 'critical' | 'major' | 'minor' | 'info';
  message: string;
  location?: {
    file: string;
    line?: number;
  };
}

interface ContextIssueItem extends IssueItem {
  issues?: IssueItem[];
}

interface SectionResult {
  issues: IssueItem[];
}

export interface AIReadyResult {
  summary: {
    totalIssues: number;
    toolsRun: string[];
    executionTime: number;
  };
  scoring?: {
    overall: number;
    rating: string;
    timestamp: string;
    toolsUsed: string[];
    breakdown?: Array<{
      toolName: string;
      score: number;
      rating?: string;
      rawMetrics?: Record<string, any>;
      factors?: Array<{
        name: string;
        impact: number;
        description: string;
      }>;
      recommendations?: Array<{
        action: string;
        estimatedImpact: number;
        priority: string;
      }>;
    }>;
  };
  patterns?: Array<{
    fileName: string;
    issues: Array<{
      type: string;
      severity: 'critical' | 'major' | 'minor' | 'info';
      message: string;
      location: {
        file: string;
        line?: number;
      };
      suggestion?: string;
    }>;
    metrics?: {
      tokenCost: number;
      consistencyScore: number;
    };
  }>;
  context?: Array<{
    severity: 'critical' | 'major' | 'minor' | 'info';
    message: string;
    location?: {
      file: string;
      line?: number;
    };
    issues?: Array<{
      severity: 'critical' | 'major' | 'minor' | 'info';
      message: string;
      location?: {
        file: string;
        line?: number;
      };
    }>;
  }>;
  consistency?: {
    summary: {
      totalIssues: number;
      filesAnalyzed: number;
    };
    results?: Array<{
      file: string;
      issues: Array<{
        severity: 'critical' | 'major' | 'minor' | 'info';
        message: string;
        location?: {
          file: string;
          line?: number;
        };
      }>;
    }>;
  };
  docDrift?: {
    issues: Array<{
      severity: 'critical' | 'major' | 'minor' | 'info';
      message: string;
      location?: {
        file: string;
        line?: number;
      };
    }>;
  };
  deps?: {
    issues: Array<{
      severity: 'critical' | 'major' | 'minor' | 'info';
      message: string;
      location?: {
        file: string;
        line?: number;
      };
    }>;
  };
  duplicates?: any[];
  'contract-enforcement'?: {
    issues: Array<{
      severity: 'critical' | 'major' | 'minor' | 'info';
      message: string;
      location?: {
        file: string;
        line?: number;
      };
    }>;
  };
}

/**
 * Derive rating from score
 */
export function getRatingFromScore(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  if (score >= 60) return 'Needs Work';
  return 'Critical';
}

/**
 * Count issues by severity from all tools
 */
export function countIssues(result: AIReadyResult): {
  critical: number;
  major: number;
  minor: number;
  info: number;
  total: number;
  score: number;
  rating: string;
} {
  const counts = {
    critical: 0,
    major: 0,
    minor: 0,
    info: 0,
    total: 0,
    score: 100,
    rating: 'Excellent',
  };

  if (Array.isArray(result.patterns)) {
    result.patterns.forEach((p) => {
      if (Array.isArray(p.issues)) {
        p.issues.forEach((issue) => {
          const sev = issue.severity as 'critical' | 'major' | 'minor' | 'info';
          counts[sev] = counts[sev] + 1;
          counts.total++;
        });
      }
    });
  }

  // Count context issues
  if (Array.isArray(result.context)) {
    result.context.forEach((issue: ContextIssueItem) => {
      // Some formats have root level issues, some have nested
      if (issue.severity) {
        const sev = issue.severity as 'critical' | 'major' | 'minor' | 'info';
        counts[sev] = counts[sev] + 1;
        counts.total++;
      }
      if (Array.isArray(issue.issues)) {
          issue.issues.forEach((nested: IssueItem) => {
          const sev = nested.severity as 'critical' | 'major' | 'minor' | 'info';
          counts[sev] = counts[sev] + 1;
          counts.total++;
        });
      }
    });
  }

  // Count consistency issues
  if (result.consistency && Array.isArray(result.consistency.results)) {
    result.consistency.results.forEach((r) => {
      if (Array.isArray(r.issues)) {
        r.issues.forEach((issue) => {
          const sev = issue.severity as 'critical' | 'major' | 'minor' | 'info';
          counts[sev] = counts[sev] + 1;
          counts.total++;
        });
      }
    });
  }

  // Count doc drift issues
  if (result.docDrift && Array.isArray(result.docDrift.issues)) {
    result.docDrift.issues.forEach((issue) => {
      const sev = issue.severity as 'critical' | 'major' | 'minor' | 'info';
      counts[sev] = counts[sev] + 1;
      counts.total++;
    });
  }

  // Count dependency issues
  if (result.deps && Array.isArray(result.deps.issues)) {
    result.deps.issues.forEach((issue) => {
      const sev = issue.severity as 'critical' | 'major' | 'minor' | 'info';
      counts[sev] = counts[sev] + 1;
      counts.total++;
    });
  }

  // Clarity (AI Signal Clarity)
  const clarity =
    (result as Record<string, SectionResult | undefined>)['ai-signal-clarity'] ||
    (result as Record<string, SectionResult | undefined>)['ai-signal'] ||
    (result as Record<string, SectionResult | undefined>)['aiSignalClarity'];
  if (clarity && Array.isArray(clarity.results)) {
    clarity.results.forEach((r: SectionResult) => {
      if (Array.isArray(r.issues)) {
        r.issues.forEach((issue: IssueItem) => {
          const sev = issue.severity as 'critical' | 'major' | 'minor' | 'info';
          counts[sev] = counts[sev] + 1;
          counts.total++;
        });
      }
    });
  }

  // Contract Enforcement
  const contractEnforcement =
    (result as Record<string, SectionResult | undefined>)['contract-enforcement'] ||
    (result as Record<string, SectionResult | undefined>)['contractEnforcement'];
  if (contractEnforcement && Array.isArray(contractEnforcement.issues)) {
    contractEnforcement.issues.forEach((issue: IssueItem) => {
      const sev = issue.severity as 'critical' | 'major' | 'minor' | 'info';
      counts[sev] = counts[sev] + 1;
      counts.total++;
    });
  }

  // Fallback scoring calculation
  const totalDeduction =
    counts.critical * 15 + counts.major * 5 + counts.minor * 1 + counts.info * 0.1;
  counts.score = Math.max(0, Math.round(100 - totalDeduction));
  counts.rating = getRatingFromScore(counts.score);

  return counts;
}

export function collectAllIssues(result: AIReadyResult): Issue[] {
  const issues: Issue[] = [];

  // Patterns
  if (Array.isArray(result.patterns)) {
    result.patterns.forEach((p) => {
      if (Array.isArray(p.issues)) {
        p.issues.forEach((issue) => {
          issues.push({ ...issue, tool: 'patterns' });
        });
      }
    });
  }

  // Context
  if (Array.isArray(result.context)) {
    result.context.forEach((issue: ContextIssueItem) => {
      if (issue.severity) {
        issues.push({ ...issue, tool: 'context' });
      }
      if (Array.isArray(issue.issues)) {
        issue.issues.forEach((i: IssueItem) => {
          issues.push({ ...i, tool: 'context' });
        });
      }
    });
  }

  // Consistency
  if (result.consistency && Array.isArray(result.consistency.results)) {
    result.consistency.results.forEach((r) => {
      if (Array.isArray(r.issues)) {
        r.issues.forEach((issue) => {
          issues.push({ ...issue, tool: 'consistency' });
        });
      }
    });
  }

  // Doc Drift
  if (result.docDrift && Array.isArray(result.docDrift.issues)) {
    result.docDrift.issues.forEach((issue: IssueItem) => {
      issues.push({ ...issue, tool: 'doc-drift' });
    });
  }

  // Deps
  if (result.deps && Array.isArray(result.deps.issues)) {
    result.deps.issues.forEach((issue: IssueItem) => {
      issues.push({ ...issue, tool: 'deps-health' });
    });
  }

  // Clarity (AI Signal Clarity)
  const clarity =
    (result as Record<string, SectionResult | undefined>)['ai-signal-clarity'] ||
    (result as Record<string, SectionResult | undefined>)['ai-signal'] ||
    (result as Record<string, SectionResult | undefined>)['aiSignalClarity'];
  if (clarity && Array.isArray(clarity.results)) {
    clarity.results.forEach((r: SectionResult) => {
      if (Array.isArray(r.issues)) {
        r.issues.forEach((issue: IssueItem) => {
          issues.push({ ...issue, tool: 'ai-signal-clarity' });
        });
      }
    });
  }

  // Contract Enforcement
  const contractEnforcement =
    (result as Record<string, SectionResult | undefined>)['contract-enforcement'] ||
    (result as Record<string, SectionResult | undefined>)['contractEnforcement'];
  if (contractEnforcement && Array.isArray(contractEnforcement.issues)) {
    contractEnforcement.issues.forEach((issue: IssueItem) => {
      issues.push({ ...issue, tool: 'contract-enforcement' });
    });
  }

  return issues;
}
