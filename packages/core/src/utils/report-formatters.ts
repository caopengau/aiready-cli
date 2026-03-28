import { REPORT_STYLES } from './report-styles';

/**
 * Constants for HTML reporting to eliminate magic literals.
 */
const REPORT_CONSTANTS = {
  TAGS: {
    HTML: 'html',
    HEAD: 'head',
    BODY: 'body',
    TITLE: 'title',
    STYLE: 'style',
    META: 'meta',
    DIV: 'div',
    H1: 'h1',
    H2: 'h2',
    P: 'p',
    SPAN: 'span',
    STRONG: 'strong',
    A: 'a',
    TABLE: 'table',
    THEAD: 'thead',
    TBODY: 'tbody',
    TR: 'tr',
    TH: 'th',
    TD: 'td',
  },
  ATTRS: {
    LANG: 'lang',
    CHARSET: 'charset',
    NAME: 'name',
    CONTENT: 'content',
    VIEWPORT: 'viewport',
    VIEWPORT_VAL: 'width=device-width, initial-scale=1.0',
    UTF8: 'UTF-8',
    EN: 'en',
    CLASS: 'class',
    STYLE: 'style',
    HREF: 'href',
  },
  CLASSES: {
    HERO: 'hero',
    STAT_CARD: 'stat-card',
    STAT_VALUE: 'stat-value',
    STAT_LABEL: 'stat-label',
    STATS: 'stats',
    CARD: 'card',
    CRITICAL: 'critical',
    MAJOR: 'major',
    MINOR: 'minor',
    FOOTER: 'footer',
    SCORE_CARD: 'score-card',
    SCORE_VALUE: 'score-value',
    SCORE_LABEL: 'score-label',
  },
};

export interface StatCard {
  value: string | number;
  label: string;
  color?: string;
}

export interface TableConfig {
  headers: string[];
  rows: string[][];
}

export interface HtmlReportSection {
  title: string;
  content: string;
}

export interface ReportOptions {
  title: string;
  packageName: string;
  packageUrl?: string;
  bugUrl?: string;
  version?: string;
  emoji?: string;
}

/**
 * Generic HTML tag builder to reduce string template noise.
 *
 * @param name - HTML tag name
 * @param content - Inner contents
 * @param attrs - Attributes object
 * @returns Formatted HTML string
 */
function tag(
  name: string,
  content: string = '',
  attrs: Record<string, string> = {}
): string {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
  return `<${name}${attrStr}>${content}</${name}>`;
}

/**
 * Generate the <head> section of an HTML report.
 */
export function generateReportHead(
  title: string,
  styles: string = REPORT_STYLES
): string {
  const metaCharset = tag('', '', {
    [REPORT_CONSTANTS.ATTRS.CHARSET]: REPORT_CONSTANTS.ATTRS.UTF8,
  }).replace(/^<|>/g, '');
  const metaViewport = tag('', '', {
    [REPORT_CONSTANTS.ATTRS.NAME]: REPORT_CONSTANTS.ATTRS.VIEWPORT,
    [REPORT_CONSTANTS.ATTRS.CONTENT]: REPORT_CONSTANTS.ATTRS.VIEWPORT_VAL,
  }).replace(/^<|>/g, '');

  return `<!DOCTYPE html>\n<${REPORT_CONSTANTS.TAGS.HTML} ${REPORT_CONSTANTS.ATTRS.LANG}="${REPORT_CONSTANTS.ATTRS.EN}">\n<${REPORT_CONSTANTS.TAGS.HEAD}>\n  <meta ${metaCharset}>\n  <meta ${metaViewport}>\n  ${tag(REPORT_CONSTANTS.TAGS.TITLE, title)}\n  ${tag(REPORT_CONSTANTS.TAGS.STYLE, styles)}\n</${REPORT_CONSTANTS.TAGS.HEAD}>`;
}

/**
 * Generate a hero section for the report header.
 */
export function generateReportHero(title: string, subtitle?: string): string {
  return tag(
    REPORT_CONSTANTS.TAGS.DIV,
    tag(REPORT_CONSTANTS.TAGS.H1, title) +
      (subtitle ? tag(REPORT_CONSTANTS.TAGS.P, subtitle) : ''),
    {
      [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.HERO,
    }
  );
}

/**
 * Generate a grid of status/metric cards.
 */
export function generateStatCards(cards: StatCard[]): string {
  const cardsHtml = cards
    .map((c) =>
      tag(
        REPORT_CONSTANTS.TAGS.DIV,
        tag(REPORT_CONSTANTS.TAGS.DIV, String(c.value), {
          [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.STAT_VALUE,
          ...(c.color
            ? { [REPORT_CONSTANTS.ATTRS.STYLE]: `color: ${c.color}` }
            : {}),
        }) +
          tag(REPORT_CONSTANTS.TAGS.DIV, c.label, {
            [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.STAT_LABEL,
          }),
        { [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.STAT_CARD }
      )
    )
    .join('');
  return tag(REPORT_CONSTANTS.TAGS.DIV, cardsHtml, {
    [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.STATS,
  });
}

/**
 * Generate a standard HTML table.
 */
export function generateTable(config: TableConfig): string {
  const head = tag(
    REPORT_CONSTANTS.TAGS.THEAD,
    tag(
      REPORT_CONSTANTS.TAGS.TR,
      config.headers
        .map((h: string) => tag(REPORT_CONSTANTS.TAGS.TH, h))
        .join('')
    )
  );
  const body = tag(
    REPORT_CONSTANTS.TAGS.TBODY,
    config.rows
      .map((row: string[]) =>
        tag(
          REPORT_CONSTANTS.TAGS.TR,
          row.map((cell) => tag(REPORT_CONSTANTS.TAGS.TD, cell)).join('')
        )
      )
      .join('')
  );
  return tag(REPORT_CONSTANTS.TAGS.TABLE, head + body);
}

/**
 * Generate a summary of issues by severity.
 */
export function generateIssueSummary(
  crit: number,
  maj: number,
  min: number,
  savings?: number
): string {
  const details = [
    tag(REPORT_CONSTANTS.TAGS.SPAN, `🔴 Critical: ${crit}`, {
      [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.CRITICAL,
    }),
    tag(REPORT_CONSTANTS.TAGS.SPAN, `🟡 Major: ${maj}`, {
      [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.MAJOR,
    }),
    tag(REPORT_CONSTANTS.TAGS.SPAN, `🔵 Minor: ${min}`, {
      [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.MINOR,
    }),
  ].join(' &nbsp; ');

  const savingsHtml = savings
    ? tag(
        REPORT_CONSTANTS.TAGS.P,
        tag(REPORT_CONSTANTS.TAGS.STRONG, 'Potential Savings: ') +
          savings.toLocaleString() +
          ' tokens'
      )
    : '';

  return tag(
    REPORT_CONSTANTS.TAGS.DIV,
    tag(REPORT_CONSTANTS.TAGS.H2, '⚠️ Issues Summary') +
      tag(REPORT_CONSTANTS.TAGS.P, details) +
      savingsHtml,
    {
      [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.CARD,
      [REPORT_CONSTANTS.ATTRS.STYLE]: 'margin-bottom: 30px;',
    }
  );
}

/**
 * Generate the report footer with package information and links.
 */
export function generateReportFooter(options: ReportOptions): string {
  const version = options.version ? ` v${options.version}` : '';
  const links = [];
  if (options.packageUrl)
    links.push(
      tag(
        REPORT_CONSTANTS.TAGS.P,
        `Like AIReady? ${tag(REPORT_CONSTANTS.TAGS.A, 'Star us on GitHub', {
          [REPORT_CONSTANTS.ATTRS.HREF]: options.packageUrl,
        })}`
      )
    );
  if (options.bugUrl)
    links.push(
      tag(
        REPORT_CONSTANTS.TAGS.P,
        `Like AIReady? ${tag(REPORT_CONSTANTS.TAGS.A, 'Report it here', {
          [REPORT_CONSTANTS.ATTRS.HREF]: options.bugUrl,
        })}`
      )
    );

  return tag(
    REPORT_CONSTANTS.TAGS.DIV,
    tag(
      REPORT_CONSTANTS.TAGS.P,
      `Generated by ${tag(REPORT_CONSTANTS.TAGS.STRONG, '@aiready/' + options.packageName)}` +
        version
    ) + links.join(''),
    { [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.FOOTER }
  );
}

/**
 * Wrap content in a standard card container.
 */
export function wrapInCard(content: string, title?: string): string {
  return tag(
    REPORT_CONSTANTS.TAGS.DIV,
    (title ? tag(REPORT_CONSTANTS.TAGS.H2, title) : '') + content,
    {
      [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.CARD,
    }
  );
}

/**
 * Generate a complete HTML report.
 */
export function generateCompleteReport(
  options: ReportOptions,
  body: string
): string {
  return (
    generateReportHead(options.title) +
    tag(REPORT_CONSTANTS.TAGS.BODY, body + generateReportFooter(options))
  );
}

/**
 * Generate a standard multi-section HTML report with hero and status cards.
 */
export function generateStandardHtmlReport(
  options: ReportOptions,
  stats: StatCard[],
  sections: HtmlReportSection[],
  score?: { value: number | string; label: string }
): string {
  const hero = generateReportHero(
    `${options.emoji || '🔍'} AIReady ${options.title}`,
    `Generated on ${new Date().toLocaleString()}`
  );

  const scoreCard = score
    ? tag(
        REPORT_CONSTANTS.TAGS.DIV,
        tag(REPORT_CONSTANTS.TAGS.DIV, String(score.value), {
          [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.SCORE_VALUE,
        }) +
          tag(REPORT_CONSTANTS.TAGS.DIV, score.label, {
            [REPORT_CONSTANTS.ATTRS.CLASS]:
              REPORT_CONSTANTS.CLASSES.SCORE_LABEL,
          }),
        { [REPORT_CONSTANTS.ATTRS.CLASS]: REPORT_CONSTANTS.CLASSES.SCORE_CARD }
      )
    : '';
  const statsCards = generateStatCards(stats);

  const bodyContent = `
    ${hero}
    ${scoreCard}
    ${statsCards}
    ${sections.map((s) => wrapInCard(s.content, s.title)).join('\n')}
  `;

  return generateCompleteReport(options, bodyContent);
}
