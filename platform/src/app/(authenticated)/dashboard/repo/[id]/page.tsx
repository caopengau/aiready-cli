import { auth } from '@/app/api/auth/[...nextauth]/route';
import { redirect, notFound } from 'next/navigation';
import { getRepository, listUserTeams, listUserRepositories } from '@/lib/db';
import RepoDetailClient from './RepoDetailClient';

interface Props {
  params: { id: string };
}

export default async function RepoDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  const repo = await getRepository(params.id);
  if (!repo) {
    notFound();
  }

  const teams = await listUserTeams(session.user.id);
  const userRepos = await listUserRepositories(session.user.id);

  const reposWithScores = userRepos.filter(
    (r) => r.aiScore !== null && r.aiScore !== undefined
  );
  const overallScore =
    reposWithScores.length > 0
      ? Math.round(
          reposWithScores.reduce((sum, r) => sum + (r.aiScore || 0), 0) /
            reposWithScores.length
        )
      : null;

  return (
    <RepoDetailClient
      repo={repo}
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      teams={teams}
      overallScore={overallScore}
    />
  );
}
