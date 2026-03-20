import { NextRequest } from 'next/server';
import { getRepository, getLatestAnalysis } from '@/lib/db';
import { withApiHandler } from '@/lib/api/handler';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(
    async () => {
      const { id } = await params;
      const searchParams = req.nextUrl.searchParams;
      const threshold = parseInt(searchParams.get('threshold') || '70');
      const failOn = searchParams.get('failOn') || 'critical';

      const repo = await getRepository(id);
      if (!repo) return { error: 'Repository not found', status: 404 };

      const latestAnalysis = await getLatestAnalysis(id);
      if (!latestAnalysis) {
        return { pass: false, reason: 'No analysis found for this repository' };
      }

      const score = latestAnalysis.aiScore || 0;
      const criticalCount =
        (latestAnalysis as any).metrics?.criticalIssues || 0;

      let pass = true;
      let reason = 'AI-Readiness check passed';

      if (score < threshold) {
        pass = false;
        reason = `AI Score ${score} is below threshold ${threshold}`;
      } else if (failOn === 'critical' && criticalCount > 0) {
        pass = false;
        reason = `Found ${criticalCount} critical issues`;
      }

      return {
        pass,
        score,
        threshold,
        criticalIssues: criticalCount,
        reason,
        timestamp: new Date().toISOString(),
      };
    },
    req,
    params
  );
}
