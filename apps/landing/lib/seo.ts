// SEO utility functions and constants

export const siteConfig = {
  name: 'AIReady',
  title: 'AIReady - Make Your Codebase AI-Ready',
  description:
    'Free tools to optimize your codebase for AI collaboration. Detect semantic duplicates, analyze context windows, and maintain consistency that AI models understand.',
  url: 'https://getaiready.dev',
  ogImage: 'https://getaiready.dev/og-image.png',
  links: {
    twitter: 'https://twitter.com/aireadytools',
    github: 'https://github.com/getaiready/aiready-cli',
    npm: 'https://www.npmjs.com/package/@aiready/cli',
  },
};

export const generateBreadcrumbSchema = (
  items: { name: string; url: string }[]
) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteConfig.url}${item.url}`,
    })),
  };
};

export const generateArticleSchema = (article: {
  title: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  image?: string;
}) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'AIReady',
      logo: {
        '@type': 'ImageObject',
        url: `${siteConfig.url}/logo-transparent-bg.png`,
      },
    },
    image: article.image || siteConfig.ogImage,
  };
};

export const generateHowToSchema = (howTo: {
  name: string;
  description: string;
  totalTime: string;
  steps: { name: string; text: string; url?: string }[];
}) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: howTo.name,
    description: howTo.description,
    totalTime: howTo.totalTime,
    step: howTo.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      url: step.url ? `${siteConfig.url}${step.url}` : undefined,
    })),
  };
};

export const generateWebsiteSchema = () => {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
};

export const generateProductSchema = () => {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'AIReady CLI',
    description: siteConfig.description,
    brand: {
      '@type': 'Brand',
      name: 'AIReady',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: siteConfig.links.npm,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      reviewCount: '2',
      bestRating: '5',
      worstRating: '1',
    },
  };
};

export const generateVideoSchema = (video: {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration: string;
  embedUrl: string;
}) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.name,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    uploadDate: video.uploadDate,
    duration: video.duration,
    embedUrl: video.embedUrl,
    contentUrl: video.embedUrl,
  };
};
