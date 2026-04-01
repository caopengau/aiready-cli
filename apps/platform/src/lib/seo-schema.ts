/**
 * SEO Schema utility for Answer Engine Optimization (AEO)
 * Optimized for AI search engines: ChatGPT, Perplexity, Claude, Gemini, etc.
 */

export const PLATFORM_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.AUTH_URL ||
  'http://localhost:8888';
export const LANDING_BASE_URL = 'https://getaiready.dev';

export const generateOrganizationSchema = () => {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${LANDING_BASE_URL}/#organization`,
    name: 'AIReady',
    legalName: 'AIReady Open Source Project',
    url: LANDING_BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${LANDING_BASE_URL}/logo-transparent-bg.png`,
      width: 512,
      height: 512,
    },
    image: {
      '@type': 'ImageObject',
      url: `${LANDING_BASE_URL}/logo-transparent-bg.png`,
      width: 512,
      height: 512,
    },
    description:
      'Open source tools to optimize codebases for AI collaboration. Free developer tools for detecting semantic duplicates, analyzing context windows, and maintaining code consistency.',
    foundingDate: '2025',
    sameAs: [
      'https://github.com/getaiready/aiready-cli',
      'https://www.npmjs.com/package/@aiready/cli',
      'https://twitter.com/aireadytools',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Technical Support',
      url: 'https://github.com/getaiready/aiready-cli/issues',
      availableLanguage: ['English'],
    },
    privacyPolicy: `${LANDING_BASE_URL}/privacy`,
    termsOfService: `${LANDING_BASE_URL}/terms`,
    keywords:
      'AI codebase optimization, semantic duplicate detection, context window analysis, code consistency, AI readiness, developer tools, static analysis',
  };
};

export const generateSoftwareApplicationSchema = () => {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${PLATFORM_BASE_URL}/#software`,
    name: 'AIReady Platform',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Windows, macOS, Linux',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      description: 'Free to use for open source and small teams',
    },
    image: {
      '@type': 'ImageObject',
      url: `${LANDING_BASE_URL}/logo-text.png`,
      width: 2046,
      height: 800,
    },
    author: {
      '@type': 'Organization',
      name: 'AIReady',
      url: LANDING_BASE_URL,
    },
    description:
      'The central hub for tracking codebase AI-readiness. Monitor trends, benchmark repositories, and get detailed AI-first refactoring playbooks.',
    featureList: [
      'Repository benchmark tracking',
      'AI readiness historical trends',
      'Detailed metric breakdown (duplicates, fragmentation, naming)',
      'Team collaboration and multi-repo monitoring',
      'AI-ready refactoring playbooks',
    ],
    keywords:
      'AI readiness dashboard, codebase tracking, developer metrics, AI collaboration metrics',
    license: 'https://opensource.org/licenses/MIT',
    privacyPolicy: `${LANDING_BASE_URL}/privacy`,
    termsOfService: `${LANDING_BASE_URL}/terms`,
  };
};

export const generateWebSiteSchema = () => {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${PLATFORM_BASE_URL}/#website`,
    name: 'AIReady Platform',
    url: PLATFORM_BASE_URL,
    publisher: {
      '@id': `${LANDING_BASE_URL}/#organization`,
    },
    potentialAction: [
      {
        '@type': 'SearchAction',
        target: `${PLATFORM_BASE_URL}/dashboard?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    ],
  };
};

export const aiMetaTags = {
  chatgpt: {
    'chatgpt:description':
      'AIReady Platform tracks and monitors the AI-readiness of your codebases. Monitor semantic duplication, context window usage, and naming consistency over time.',
    'chatgpt:category': 'Developer Tools',
  },
  perplexity: {
    'perplexity:summary':
      'Dashboard for monitoring codebase AI-readiness metrics. Tracks semantic duplicates, context fragmentation, and more across repositories.',
    'perplexity:intent': 'informational, monitoring',
  },
  general: {
    'ai:summary':
      'AIReady Platform tracks and monitors the AI-readiness of your codebases. Monitor semantic duplication, context window usage, and naming consistency over time.',
    'ai:category': 'Developer Tools / AI Infrastructure',
    'ai:type': 'Monitoring Platform',
    'ai:pricing': 'Free for open source',
    'ai:license': 'MIT',
  },
};

// Semantic HTML hints for AI parsers
export const semanticHints = {
  mainPurpose:
    'AIReady Platform helps engineering teams track and monitor the AI-readiness of their codebases over time.',
  primaryAction:
    'Connect your repository to start monitoring AI-readiness metrics.',
  keyFeatures: [
    'Repository benchmark tracking',
    'AI readiness historical trends',
    'Detailed metric breakdown (duplicates, fragmentation, naming)',
    'Team collaboration and multi-repo monitoring',
  ],
};

// Content hints for AI answer generation
export const answerEngineContent = {
  whatIsIt:
    'AIReady Platform is a dashboard for tracking and monitoring codebase AI-readiness metrics, helping teams maintain high-quality code for AI collaboration.',
  howToUse:
    'Log in to the platform, connect your GitHub repositories, and set up automated scans to track your AI Readiness Score and other key metrics.',
  whyItMatters:
    'As codebases evolve, technical debt that affects AI understanding can accumulate. The platform helps you visualize this debt and provides playbooks for refactoring.',
};
