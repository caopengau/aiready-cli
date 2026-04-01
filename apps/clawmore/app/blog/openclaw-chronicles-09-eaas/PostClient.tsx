'use client';

import BlogLayout from '../_components/BlogLayout';

export default function BlogPost() {
  return (
    <BlogLayout
      metadata={{
        title: 'Evolution-as-a-Service: Managed Hub-and-Spoke',
        description:
          "The architecture of managed evolution. ClawMore's Hub-and-Spoke pattern for serverless agentic swarm AI orchestration across AWS accounts.",
        date: '2026-04-25',
        image: '/blog-assets/openclaw-chronicles-09-eaas.png',
        slug: 'openclaw-chronicles-09-eaas',
      }}
      header={{
        category: 'OPENCLAW_CHRONICLES // PART_09',
        hash: 'eaas',
        readTime: '08 MIN READ',
        title: (
          <>
            Evolution-as-a-Service: <br />
            <span className="text-cyber-blue">Managed Hub-and-Spoke</span>
          </>
        ),
        subtitle: 'The Architecture of Managed Evolution',
        description:
          "The architecture of managed evolution. ClawMore's Hub-and-Spoke pattern for serverless agentic swarm AI orchestration across AWS accounts.",
        image: '/blog-assets/openclaw-chronicles-09-eaas.png',
      }}
    >
      <section>
        <h2 className="text-3xl font-black tracking-tight mb-6 flex items-center gap-4 text-cyber-blue uppercase italic">
          <span className="font-mono text-sm opacity-50">01</span>
          The Hub-and-Spoke Pattern
        </h2>
        <p className="text-zinc-200 leading-relaxed text-lg italic mb-12">
          Scaling a single agent is easy. Orchestrating a swarm across thousand
          of AWS accounts is a different game entirely.
        </p>
        <p className="text-zinc-200 leading-relaxed text-lg mb-8">
          In ClawMore, we use a central **Hub** to maintain the global state of
          the Eclawnomy. Each customer project operates as a **Spoke**,
          connected to the hub via a secure EventBridge bridge. This allows for
          centralized intelligence with decentralized execution—a perfect model
          for serverless AI orchestration.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-3xl font-black tracking-tight mb-6 flex items-center gap-4 text-cyber-blue uppercase italic">
          <span className="font-mono text-sm opacity-50">02</span>
          Managed Evolution
        </h2>
        <p className="text-zinc-200 leading-relaxed text-lg mb-8">
          Instead of every spoke independently learning how to solve common
          problems, successful mutations in one spoke can be "harvested" and
          redistributed across the hub to other spokes. This is
          **Evolution-as-a-Service**.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-3xl font-black tracking-tight mb-6 flex items-center gap-4 text-cyber-blue uppercase italic">
          <span className="font-mono text-sm opacity-50">03</span>
          Account Vending
        </h2>
        <p className="text-zinc-200 leading-relaxed text-lg mb-24">
          To ensure security and zero-cost idling, each spoke is provisioned
          using an automated **Account Vending Machine**. This guarantees that
          every agentic swarm is physically isolated at the AWS account level,
          preventing cross-tenant "agentic noise" and ensuring that the only way
          a spoke can communicate with the hub is through the defined event
          schema.
        </p>
      </section>
    </BlogLayout>
  );
}
