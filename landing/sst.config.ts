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
      name: 'aiready-landing',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
    };
  },
  async run() {
    const cloudflareZoneId = '50eb7dcadc84c58ab34583742db0b671';

    // Storage for report submissions
    const submissions = new sst.aws.Bucket('Submissions', {
      public: false,
    });

    // SES domain identity is managed as infrastructure so DNS verification is reproducible.
    const domainName = 'getaiready.dev';
    const defaultSesFromEmail = `notifications@${domainName}`;
    const manageSesDomainIdentity =
      $app.stage === 'production' ||
      process.env.SES_MANAGE_DOMAIN_IDENTITY === 'true';
    const emailDomain = manageSesDomainIdentity
      ? new sst.aws.Email('NotificationEmail', {
          sender: domainName,
          dns: sst.cloudflare.dns({
            zone: cloudflareZoneId,
          }),
        })
      : undefined;

    // API Gateway HTTP API for public form submissions
    const api = new sst.aws.ApiGatewayV2('RequestApi', {
      cors: true,
    });

    api.route('POST /', {
      handler: 'api/request-report.handler',
      link: [submissions],
      environment: {
        SUBMISSIONS_BUCKET: submissions.name,
        SES_TO_EMAIL: process.env.SES_TO_EMAIL || '',
        SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || defaultSesFromEmail,
        SES_CONFIGURATION_SET:
          'aiready-landing-production-notificationemailconfig-ttxwnzxe',
      },
      permissions: [
        {
          actions: ['ses:SendEmail', 'ses:SendRawEmail'],
          resources: ['*'],
        },
      ],
    });

    // Static site deployment
    const site = new sst.aws.StaticSite('AireadyLanding', {
      path: './',
      build: {
        command: 'pnpm build',
        output: 'out',
      },
      environment: {
        NEXT_PUBLIC_REQUEST_URL: api.url,
      },
      domain: {
        name:
          $app.stage === 'production'
            ? 'getaiready.dev'
            : `${$app.stage}.getaiready.dev`,
        dns: sst.cloudflare.dns({
          zone: cloudflareZoneId,
        }),
      },
      invalidation: {
        paths: ['/*'],
        wait: true,
      },
    });

    const siteUrl = site.url;

    /*
    // VS Code Marketplace publisher verification
    // Check if the record already exists to avoid 400 Bad Request error
    const cfZoneId = '50eb7dcadc84c58ab34583742db0b671';
    const recordName = '_visual-studio-marketplace-pengcao';
    const recordValue = 'e5370864-bedf-4b65-9ef4-a99596a60d7d';

    try {
      const cp = await import('child_process');
      const cfToken = process.env.CLOUDFLARE_API_TOKEN;
      if (cfToken) {
        const cmd = `curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${cfZoneId}/dns_records?name=${recordName}&type=TXT" -H "Authorization: Bearer ${cfToken}"`;
        const out = cp.execSync(cmd, { encoding: 'utf8' });
        const res = JSON.parse(out);
        if (res.success && res.result && res.result.length > 0) {
          console.log(
            `Cloudflare TXT record for ${recordName} already exists; skipping.`
          );
        } else {
          sst.cloudflare.dns({ zone: cfZoneId }).createRecord(
            'VSCodeMarketplaceVerification',
            {
              type: 'TXT',
              name: recordName,
              value: recordValue,
            },
            {}
          );
        }
      } else {
        // Fallback if no token (shouldn't happen in CI/deploy script)
        sst.cloudflare.dns({ zone: cfZoneId }).createRecord(
          'VSCodeMarketplaceVerification',
          {
            type: 'TXT',
            name: recordName,
            value: recordValue,
          },
          {}
        );
      }
    } catch (e) {
      console.warn(`Warning: Failed to check Cloudflare DNS records: ${e}`);
      // Final fallback
      sst.cloudflare.dns({ zone: cfZoneId }).createRecord(
        'VSCodeMarketplaceVerification',
        {
          type: 'TXT',
          name: recordName,
          value: recordValue,
        },
        {}
      );
    }
    */

    // SNS Topic for health check alerts
    const healthAlertsTopic = new sst.aws.SnsTopic('HealthAlerts', {
      subscriptions: {
        email: process.env.SES_TO_EMAIL || 'caopengau@gmail.com',
      },
    });

    // API Gateway for health check worker to publish alerts
    const healthApi = new sst.aws.ApiGatewayV2('HealthApi', {
      cors: true,
    });

    healthApi.route('POST /alert', {
      handler: 'api/health-alert.handler',
      link: [healthAlertsTopic],
      environment: {
        HEALTH_ALERTS_TOPIC_ARN: healthAlertsTopic.arn,
      },
      permissions: [
        {
          actions: ['sns:Publish'],
          resources: [healthAlertsTopic.arn],
        },
      ],
    });

    return {
      site: siteUrl,
      apiUrl: api.url,
      submissionsBucket: submissions.name,
      emailDomain: emailDomain?.sender ?? domainName,
      healthAlertsTopicArn: healthAlertsTopic.arn,
      healthApiUrl: healthApi.url,
    };
  },
});
