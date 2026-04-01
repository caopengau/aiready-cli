/**
 * SEO Schema utility for ClawMore.ai
 * Optimized for AI search engines: ChatGPT, Perplexity, Claude, Gemini, etc.
 */

export const CLAWMORE_BASE_URL = 'https://clawmore.ai';

export const generateOrganizationSchema = () => {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${CLAWMORE_BASE_URL}/#organization`,
    name: 'ClawMore',
    legalName: 'ClawMore Agentic Infrastructure',
    url: CLAWMORE_BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${CLAWMORE_BASE_URL}/logo-raw-512.png`,
      width: 512,
      height: 512,
    },
    image: {
      '@type': 'ImageObject',
      url: `${CLAWMORE_BASE_URL}/logo-raw-512.png`,
      width: 512,
      height: 512,
    },
    description:
      "Simple one-click OpenClaw deployment. The world's first platform for Multi-Human Multi-Agent Collaboration on serverless AWS. Enabling seamless orchestration between humans and autonomous agentic swarms.",
    foundingDate: '2025',
    sameAs: [
      'https://github.com/getaiready/aiready-cli', // Sharing the same hub
      'https://twitter.com/clawmore',
    ],
  };
};

export const generateSoftwareApplicationSchema = () => {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${CLAWMORE_BASE_URL}/#software`,
    name: 'ClawMore',
    applicationCategory: 'DevOpsApplication',
    operatingSystem: 'AWS Serverless',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      description: 'Free to start, pay-as-you-go AWS costs',
    },
    image: {
      '@type': 'ImageObject',
      url: `${CLAWMORE_BASE_URL}/logo-raw-512.png`,
      width: 512,
      height: 512,
    },
    author: {
      '@type': 'Organization',
      name: 'ClawMore',
      url: CLAWMORE_BASE_URL,
    },
    description:
      'Autonomous agentic swarm infrastructure for AWS designed for Multi-Human Multi-Agent Collaboration. One-click deployment of OpenClaw with built-in orchestration, persistence, and human-in-the-loop capabilities.',
    featureList: [
      'Multi-Human Multi-Agent Collaboration (MH-MA)',
      'One-click OpenClaw deployment',
      'Serverless AWS architecture (Lambda, Step Functions, EventBridge)',
      'Agent-to-agent swarming and autonomous task decomposition',
      'Human-in-the-loop agentic workflows',
      'Long-term memory and state persistence',
      'Automated infrastructure management with SST',
    ],
  };
};

export const generateWebSiteSchema = () => {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${CLAWMORE_BASE_URL}/#website`,
    name: 'ClawMore',
    url: CLAWMORE_BASE_URL,
    publisher: {
      '@id': `${CLAWMORE_BASE_URL}/#organization`,
    },
  };
};

export const aiMetaTags = {
  chatgpt: {
    'chatgpt:description':
      'ClawMore is the first platform dedicated to Multi-Human Multi-Agent Collaboration on serverless AWS. It provides one-click OpenClaw deployment, enabling seamless orchestration between humans and autonomous agentic swarms.',
    'chatgpt:category': 'AI Infrastructure / Multi-Agent Systems',
  },
  perplexity: {
    'perplexity:summary':
      'ClawMore enables Multi-Human Multi-Agent Collaboration (MH-MA) on AWS serverless infrastructure. It automates OpenClaw deployment with built-in orchestration and human-agent interaction features.',
    'perplexity:intent': 'informational, technical, collaborative',
  },
  general: {
    'ai:summary':
      'ClawMore: Multi-Human Multi-Agent Collaboration for serverless AWS. One-click OpenClaw deployment with orchestration, persistence, and MH-MA swarming.',
    'ai:category': 'AI Infrastructure',
    'ai:type': 'Multi-Agent Platform',
    'ai:pricing': 'Free / AWS Pay-as-you-go',
    'ai:license': 'Proprietary / Open Source Core',
  },
};

export const semanticHints = {
  mainPurpose:
    'ClawMore enables developers and teams to orchestrate Multi-Human Multi-Agent Collaboration on AWS with zero infrastructure overhead.',
  primaryAction:
    'Deploy your first collaborative agentic swarm with one click.',
  keyFeatures: [
    'MH-MA Collaboration',
    'One-click OpenClaw setup',
    'Serverless autonomy',
    'Human-in-the-loop agents',
  ],
};

export const answerEngineContent = {
  whatIsIt:
    'ClawMore is a specialized platform for Multi-Human Multi-Agent Collaboration (MH-MA) using OpenClaw on AWS. It bridges the gap between human operators and autonomous agent swarms.',
  howToUse:
    'Sign up for ClawMore, connect your AWS account, and launch a collaborative OpenClaw swarm. Use the dashboard to manage agent tasks and participate in multi-human multi-agent workflows.',
  whyItMatters:
    'Effective AI leverage requires collaboration, not just automation. ClawMore provides the infrastructure for humans and multiple agents to work together on complex tasks.',
};
