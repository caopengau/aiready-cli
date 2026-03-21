/// <reference path="./.sst/platform/config.d.ts" />

// Suppress AWS SDK warning when both profile and static keys are set
// by prioritizing the profile (which is the project standard)
if (
  process.env.AWS_PROFILE &&
  (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY)
) {
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
}

export default $config({
  app(input) {
    return {
      name: 'aiready-platform',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
      providers: {
        stripe: '0.0.14',
      },
    };
  },
  async run() {
    // Configure the Stripe provider
    $config.providers.stripe = {
      apiKey: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
    };

    // --- Stripe Products & Prices (IaC) ---

    // 1. Pro Plan ($49/mo)
    const proProduct = new stripe.Product('ProProduct', {
      name: 'AIReady Pro',
      description: 'Advanced AI-readiness metrics and historical trends for individual developers.',
    });

    const proPrice = new stripe.Price('ProPrice', {
      product: proProduct.id,
      unitAmount: 4900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    // 2. Team Plan ($99/mo)
    const teamProduct = new stripe.Product('TeamProduct', {
      name: 'AIReady Team',
      description: 'CI/CD integration, team benchmarking, and priority support.',
    });

    const teamPrice = new stripe.Price('TeamPrice', {
      product: teamProduct.id,
      unitAmount: 9900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    // 3. Enterprise Plan ($299/mo)
    const enterpriseProduct = new stripe.Product('EnterpriseProduct', {
      name: 'AIReady Enterprise',
      description: 'Custom rules, SSO, and dedicated support for large organizations.',
    });

    const enterprisePrice = new stripe.Price('EnterprisePrice', {
      product: enterpriseProduct.id,
      unitAmount: 29900,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    // S3 Bucket for analysis data
    const bucket = new sst.aws.Bucket('AnalysisBucket');

    // S3 Bucket for user submissions (feedback, waitlist)
    const submissions = new sst.aws.Bucket('SubmissionsBucket');

    // SES Domain Configuration
    // Note: SES domain verification must be done manually in AWS Console
    // or via a separate Pulumi Cloudflare provider setup
    // Local/Dev: noreply@dev.getaiready.dev (subdomain)
    // Production: noreply@getaiready.dev
    const isProd = $app.stage === 'prod' || $app.stage === 'production';
    const isLocal = $app.stage === 'local';
    const sesDomain = isProd ? 'getaiready.dev' : 'dev.getaiready.dev';

    // SNS Topic for System Alerts
    const alertsTopic = new sst.aws.SnsTopic('SystemAlerts');
    // Note: Subscription (e.g. to email) should be done manually or via AWS Console
    // for security/privacy, or added here if the email is fixed.

    // DynamoDB Table for all entities (Single Table Design)
    // TTL enabled for automatic cleanup of old analyses (Free tier: 7 days)
    const table = new sst.aws.Dynamo('MainTable', {
      fields: {
        PK: 'string',
        SK: 'string',
        GSI1PK: 'string',
        GSI1SK: 'string',
        GSI2PK: 'string',
        GSI2SK: 'string',
        GSI3PK: 'string',
        GSI3SK: 'string',
        GSI4PK: 'string',
        GSI4SK: 'string',
      },
      primaryIndex: { hashKey: 'PK', rangeKey: 'SK' },
      globalIndexes: {
        GSI1: { hashKey: 'GSI1PK', rangeKey: 'GSI1SK' },
        GSI2: { hashKey: 'GSI2PK', rangeKey: 'GSI2SK' },
        GSI3: { hashKey: 'GSI3PK', rangeKey: 'GSI3SK' },
        GSI4: { hashKey: 'GSI4PK', rangeKey: 'GSI4SK' },
      },
      ttl: 'ttl', // Enable TTL on the table (field doesn't need to be indexed)
    });

    // EventBridge Bus for platform events
    const bus = new sst.aws.Bus('PlatformBus');

    // Dead Letter Queues for reliability
    const scanDLQ = new sst.aws.Queue('ScanDLQ');
    const analysisDLQ = new sst.aws.Queue('AnalysisDLQ');
    const remediationDLQ = new sst.aws.Queue('RemediationDLQ');

    // Queue for background analysis requests
    const scanQueue = new sst.aws.Queue('ScanQueue', {
      visibilityTimeout: '15 minutes',
      dlq: scanDLQ.arn,
      // Enable Long Polling to reduce request volume
      wait: '20 seconds',
    });

    // Queue for processing uploaded analysis results
    const analysisQueue = new sst.aws.Queue('AnalysisQueue', {
      visibilityTimeout: '5 minutes',
      dlq: analysisDLQ.arn,
      // Enable Long Polling
      wait: '20 seconds',
    });

    // Queue for background remediation requests
    const remediationQueue = new sst.aws.Queue('RemediationQueue', {
      visibilityTimeout: '15 minutes',
      dlq: remediationDLQ.arn,
      wait: '20 seconds',
    });

    // Next.js site configuration
    const siteConfig: sst.aws.NextjsArgs = {
      path: '.',
      dev: {
        command: 'pnpm run dev:next',
        autostart: true,
      },
      environment: {
        S3_BUCKET: bucket.name,
        SUBMISSIONS_BUCKET: submissions.name,
        DYNAMO_TABLE: table.name,
        // NextAuth v5 uses AUTH_URL and AUTH_SECRET
        // For SST dev mode, use localhost; for deployed stages use the actual URL
        AUTH_URL:
          process.env.AUTH_URL ||
          (isLocal
            ? 'http://localhost:8888'
            : isProd
              ? 'https://platform.getaiready.dev'
              : $app.stage === 'dev'
                ? 'https://dev.platform.getaiready.dev'
                : `https://${$app.stage}.platform.getaiready.dev`),
        NEXT_PUBLIC_APP_URL: isLocal
          ? 'http://localhost:8888'
          : isProd
            ? 'https://platform.getaiready.dev'
            : $app.stage === 'dev'
              ? 'https://dev.platform.getaiready.dev'
              : `https://${$app.stage}.platform.getaiready.dev`,
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
        AUTH_SECRET:
          process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '',
        AUTH_TRUST_HOST: 'true',
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
        SES_DOMAIN: sesDomain,
        SES_FROM_EMAIL: `noreply@${sesDomain}`,
        SES_TO_EMAIL: process.env.SES_TO_EMAIL || 'team@getaiready.dev',
        SES_CONFIGURATION_SET:
          'aiready-landing-production-notificationemailconfig-ttxwnzxe',
        REMEDIATION_QUEUE_URL: remediationQueue.url,
      },
    };

    // Add custom domain configuration
    // DNS records are managed by SST via Cloudflare API
    if (isProd) {
      siteConfig.domain = {
        name: 'platform.getaiready.dev',
        dns: sst.cloudflare.dns({
          zone:
            process.env.CLOUDFLARE_ZONE_ID ||
            '50eb7dcadc84c58ab34583742db0b671',
        }),
      };
    } else if ($app.stage === 'dev') {
      siteConfig.domain = {
        name: 'dev.platform.getaiready.dev',
        dns: sst.cloudflare.dns({
          zone:
            process.env.CLOUDFLARE_ZONE_ID ||
            '50eb7dcadc84c58ab34583742db0b671',
        }),
      };
    }

    // Subscribe workers to queues
    scanQueue.subscribe({
      handler: 'src/worker/index.handler',
      timeout: '15 minutes',
      memory: '2048 MB',
      batch: {
        window: '10 seconds',
      },
      nodejs: {
        install: ['isomorphic-git', 'http'],
        copy: [
          {
            from: '../node_modules/.pnpm/web-tree-sitter@0.26.6/node_modules/web-tree-sitter/web-tree-sitter.wasm',
            to: 'web-tree-sitter.wasm',
          },
          {
            from: '../node_modules/.pnpm/@unit-mesh+treesitter-artifacts@1.7.7/node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-python.wasm',
            to: 'tree-sitter-python.wasm',
          },
          {
            from: '../node_modules/.pnpm/@unit-mesh+treesitter-artifacts@1.7.7/node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-java.wasm',
            to: 'tree-sitter-java.wasm',
          },
          {
            from: '../node_modules/.pnpm/@unit-mesh+treesitter-artifacts@1.7.7/node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-go.wasm',
            to: 'tree-sitter-go.wasm',
          },
          {
            from: '../node_modules/.pnpm/@unit-mesh+treesitter-artifacts@1.7.7/node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-c_sharp.wasm',
            to: 'tree-sitter-c_sharp.wasm',
          },
        ],
      },
      link: [table, bucket, scanQueue],
      environment: {
        S3_BUCKET: bucket.name,
        DYNAMO_TABLE: table.name,
        SES_CONFIGURATION_SET:
          'aiready-landing-production-notificationemailconfig-ttxwnzxe',
      },
    });

    remediationQueue.subscribe({
      handler: 'src/worker/remediation.handler',
      timeout: '15 minutes',
      memory: '2048 MB',
      batch: {
        window: '10 seconds',
      },
      nodejs: {
        install: ['isomorphic-git', 'http'],
        copy: [
          {
            from: '../node_modules/.pnpm/web-tree-sitter@0.26.6/node_modules/web-tree-sitter/web-tree-sitter.wasm',
            to: 'web-tree-sitter.wasm',
          },
          {
            from: '../node_modules/.pnpm/@unit-mesh+treesitter-artifacts@1.7.7/node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-python.wasm',
            to: 'tree-sitter-python.wasm',
          },
          {
            from: '../node_modules/.pnpm/@unit-mesh+treesitter-artifacts@1.7.7/node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-java.wasm',
            to: 'tree-sitter-java.wasm',
          },
          {
            from: '../node_modules/.pnpm/@unit-mesh+treesitter-artifacts@1.7.7/node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-go.wasm',
            to: 'tree-sitter-go.wasm',
          },
          {
            from: '../node_modules/.pnpm/@unit-mesh+treesitter-artifacts@1.7.7/node_modules/@unit-mesh/treesitter-artifacts/wasm/tree-sitter-c_sharp.wasm',
            to: 'tree-sitter-c_sharp.wasm',
          },
        ],
      },
      link: [table, bucket, remediationQueue],
      environment: {
        S3_BUCKET: bucket.name,
        DYNAMO_TABLE: table.name,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        SES_CONFIGURATION_SET:
          'aiready-landing-production-notificationemailconfig-ttxwnzxe',
      },
    });

    analysisQueue.subscribe({
      handler: 'src/functions/process-analysis.handler',
      timeout: '5 minutes',
      memory: '1024 MB',
      batch: {
        window: '10 seconds',
      },
      link: [table, bucket, analysisQueue],
      permissions: [
        {
          actions: ['ses:SendEmail', 'ses:SendRawEmail'],
          resources: ['*'],
        },
      ],
      environment: {
        S3_BUCKET: bucket.name,
        DYNAMO_TABLE: table.name,
        SES_CONFIGURATION_SET:
          'aiready-landing-production-notificationemailconfig-ttxwnzxe',
      },
    });

    const site = new sst.aws.Nextjs('Dashboard', {
      ...siteConfig,
      link: [
        table,
        bucket,
        scanQueue,
        analysisQueue,
        remediationQueue,
        submissions,
        bus,
        alertsTopic,
        proPrice,
        teamPrice,
        enterprisePrice,
      ],
      permissions: [
        {
          actions: ['ses:SendEmail', 'ses:SendRawEmail'],
          resources: ['*'],
        },
      ],
    });

    return {
      site: site.url,
      bucketName: bucket.name,
      tableName: table.name,
      scanQueueUrl: scanQueue.url,
      analysisQueueUrl: analysisQueue.url,
      remediationQueueUrl: remediationQueue.url,
      busName: bus.name,
      alertsTopicArn: alertsTopic.arn,
    };
  },
});
