import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * Validates and sanitizes a URL so that only http: and https: protocols are permitted.
 * Rejects javascript:, data:, vbscript: and malformed URIs.
 */
export function sanitizeUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Reject obvious dangerous prefixes before parsing
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    // Check if it's a domain without protocol like "www.ejemplo.com" or "forms.gle/abc"
    if (/^(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/.*)?$/.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return null;
  }
}

/**
 * Parses inline formatting: **bold**, [link](url), and autolink https://...
 */
export function renderInlineContent(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s<>()]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, matchIndex));
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      // Markdown link [text](url)
      const linkText = match[1];
      const rawUrl = match[2];
      const safe = sanitizeUrl(rawUrl);
      if (safe) {
        nodes.push(
          React.createElement(
            'a',
            {
              key: `${keyPrefix}-link-${tokenIdx++}`,
              href: safe,
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'inline-flex items-center gap-1 font-bold text-[#123E59] hover:text-[#0e3247] underline underline-offset-2 break-all',
            },
            React.createElement('span', null, linkText),
            React.createElement(ExternalLink, { className: 'w-3.5 h-3.5 shrink-0 opacity-70', 'aria-hidden': true })
          )
        );
      } else {
        nodes.push(linkText);
      }
    } else if (match[3] !== undefined) {
      // Bold **text**
      nodes.push(
        React.createElement(
          'strong',
          { key: `${keyPrefix}-b-${tokenIdx++}`, className: 'font-bold text-neutral-900' },
          match[3]
        )
      );
    } else if (match[4] !== undefined) {
      // Raw URL
      const rawUrl = match[4];
      const safe = sanitizeUrl(rawUrl);
      if (safe) {
        nodes.push(
          React.createElement(
            'a',
            {
              key: `${keyPrefix}-url-${tokenIdx++}`,
              href: safe,
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'inline-flex items-center gap-1 font-bold text-[#123E59] hover:text-[#0e3247] underline underline-offset-2 break-all',
            },
            React.createElement('span', null, rawUrl),
            React.createElement(ExternalLink, { className: 'w-3.5 h-3.5 shrink-0 opacity-70', 'aria-hidden': true })
          )
        );
      } else {
        nodes.push(rawUrl);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Renders structured markdown content into clean, safe React elements.
 * Supports:
 * - Headings (#, ##, ###)
 * - Unordered lists (- or *)
 * - Ordered lists (1. 2.)
 * - Paragraphs with bold and links
 */
export function renderRichText(content?: string | null): React.ReactNode {
  if (!content || !content.trim()) return null;

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!currentList) return;
    if (currentList.type === 'ul') {
      elements.push(
        React.createElement(
          'ul',
          { key, className: 'list-disc pl-5 space-y-1.5 my-2.5 text-neutral-800 text-sm leading-relaxed' },
          currentList.items.map((item, idx) =>
            React.createElement('li', { key: idx, className: 'pl-0.5' }, ...renderInlineContent(item, `${key}-li-${idx}`))
          )
        )
      );
    } else {
      elements.push(
        React.createElement(
          'ol',
          { key, className: 'list-decimal pl-5 space-y-1.5 my-2.5 text-neutral-800 text-sm leading-relaxed' },
          currentList.items.map((item, idx) =>
            React.createElement('li', { key: idx, className: 'pl-0.5' }, ...renderInlineContent(item, `${key}-oli-${idx}`))
          )
        )
      );
    }
    currentList = null;
  };

  let blockIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Empty line separates blocks
    if (!trimmed) {
      flushList(`list-${blockIdx++}`);
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList(`list-${blockIdx++}`);
      elements.push(
        React.createElement(
          'h5',
          { key: `h3-${blockIdx++}`, className: 'font-display font-bold text-sm text-[#123E59] mt-3 mb-1' },
          ...renderInlineContent(trimmed.slice(4), `h3-content-${blockIdx}`)
        )
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList(`list-${blockIdx++}`);
      elements.push(
        React.createElement(
          'h4',
          { key: `h2-${blockIdx++}`, className: 'font-display font-black text-base text-[#123E59] mt-3.5 mb-1.5' },
          ...renderInlineContent(trimmed.slice(3), `h2-content-${blockIdx}`)
        )
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList(`list-${blockIdx++}`);
      elements.push(
        React.createElement(
          'h3',
          { key: `h1-${blockIdx++}`, className: 'font-display font-black text-lg text-[#123E59] mt-4 mb-2' },
          ...renderInlineContent(trimmed.slice(2), `h1-content-${blockIdx}`)
        )
      );
      continue;
    }

    // Unordered list items (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList(`list-${blockIdx++}`);
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Ordered list items (1. 2.)
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList(`list-${blockIdx++}`);
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[1]);
      continue;
    }

    // Normal paragraph line
    flushList(`list-${blockIdx++}`);
    elements.push(
      React.createElement(
        'p',
        { key: `p-${blockIdx++}`, className: 'text-sm text-neutral-800 leading-relaxed my-1.5 break-words' },
        ...renderInlineContent(trimmed, `p-content-${blockIdx}`)
      )
    );
  }

  flushList(`list-${blockIdx++}`);
  return elements;
}
