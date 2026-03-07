import { auth } from '@/app/api/auth/[...nextauth]/route';
import { getRepository, listUserTeams } from '@/lib/db';
import { redirect } from 'next/navigation';
import PlatformShell from '@/components/PlatformShell';
import { ScanConfigForm } from './ScanConfigForm';
import Breadcrumb from '@/components/Breadcrumb';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RepoSettingsPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect('/login');
  }

  const repo = await getRepository(id);
  if (!repo) {
    redirect('/dashboard');
  }

  // Verify ownership
  if (repo.userId !== userId) {
    redirect('/dashboard');
  }

  const teams = await listUserTeams(userId);
  const { getLatestAnalysis } = await import('@/lib/db');
  const latestAnalysis = await getLatestAnalysis(id);
  const fileCount = latestAnalysis?.summary?.totalFiles || 0;
  const lastExecutionTime = latestAnalysis?.summary?.executionTime || 0;
  const lastSettings = latestAnalysis?.summary?.config || null;

  async function updateSettings(settings: any | null) {
    'use server';
    const { updateRepositoryConfig } = await import('@/lib/db');
    await updateRepositoryConfig(id, settings);
  }

  return (
    <PlatformShell user={session.user} teams={teams} activePage="repo">
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 text-white max-w-5xl mx-auto">
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: repo.name, href: `/dashboard/repo/${repo.id}` },
            { label: 'Settings', href: `/dashboard/repo/${repo.id}/settings` },
          ]}
        />

        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">
            Scan Strategy
          </h1>
          <p className="text-slate-400">
            Customize how AIReady analyzes{' '}
            <span className="text-cyan-400 font-mono italic">{repo.name}</span>.
            Adjust these parameters to uplift standards or fine-tune for your
            specific stack.
          </p>
        </div>

        <ScanConfigForm
          repoId={repo.id}
          initialSettings={repo.scanConfig || null}
          onSave={updateSettings}
          fileCount={fileCount}
          lastExecutionTime={lastExecutionTime}
          lastSettings={lastSettings}
        />
      </div>
    </PlatformShell>
  );
}
