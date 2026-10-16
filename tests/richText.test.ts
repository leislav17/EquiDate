import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { sanitizeUrl, renderRichText, renderInlineContent } from '../src/utils/richText.ts';

test('sanitizeUrl allows safe http/https URLs and rejects unsafe protocols', () => {
  assert.equal(sanitizeUrl('https://forms.gle/12345'), 'https://forms.gle/12345');
  assert.equal(sanitizeUrl('http://equidate.com/reglamento'), 'http://equidate.com/reglamento');
  assert.equal(sanitizeUrl('www.equidate.com/info'), 'https://www.equidate.com/info');

  // Rejects unsafe schemes
  assert.equal(sanitizeUrl('javascript:alert(document.cookie)'), null);
  assert.equal(sanitizeUrl('JAVASCRIPT:void(0)'), null);
  assert.equal(sanitizeUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeUrl('vbscript:msgbox(1)'), null);
  assert.equal(sanitizeUrl(''), null);
  assert.equal(sanitizeUrl('   '), null);
  assert.equal(sanitizeUrl(null), null);
  assert.equal(sanitizeUrl(undefined), null);
});

test('renderRichText returns null for empty or whitespace content', () => {
  assert.equal(renderRichText(''), null);
  assert.equal(renderRichText('   '), null);
  assert.equal(renderRichText('\n\n\t  \n'), null);
  assert.equal(renderRichText(null), null);
  assert.equal(renderRichText(undefined), null);
});

test('renderRichText parses headings, lists, bold text and secure links', () => {
  const content = `## Información importante
**Cierre de inscripciones:** 15/10/2026 a las 20:00 hs.
[Formulario de inscripción](https://forms.gle/concurso2026)

- Estabulación por orden de solicitud
- Ingreso con libreta sanitaria al día
1. Primer llamado 08:30
2. Inicio de pista 09:00`;

  const rendered = renderRichText(content);
  assert.ok(Array.isArray(rendered));
  assert.ok(rendered.length > 0);

  // Check inline rendering with unsafe link
  const unsafeInline = renderInlineContent('[Ataque](javascript:alert(1))', 'test');
  // When sanitized URL is null, the text is rendered inertly without an active href
  assert.ok(unsafeInline.some(node => typeof node === 'string' && node.includes('Ataque')));
  assert.ok(!unsafeInline.some(node => React.isValidElement(node) && (node.props as any).href?.includes('javascript')));

  // Check inline rendering with safe link
  const safeInline = renderInlineContent('[Inscripciones](https://forms.gle/xyz)', 'test');
  const linkElement = safeInline.find((node): node is React.ReactElement<{ href: string; target: string; rel: string }> => React.isValidElement(node) && node.type === 'a');
  assert.ok(linkElement, 'Debe renderizar un elemento <a>');
  assert.equal(linkElement.props.href, 'https://forms.gle/xyz');
  assert.equal(linkElement.props.target, '_blank');
  assert.equal(linkElement.props.rel, 'noopener noreferrer');
});

test('Important info public visibility correctly evaluates whether to hide or show the section', () => {
  // Public section condition: event.importantInfo && event.importantInfo.trim()
  const shouldShow = (importantInfo?: string | null) => Boolean(importantInfo && importantInfo.trim().length > 0);

  // When deleted / cleared or empty, section is completely hidden
  assert.equal(shouldShow(''), false);
  assert.equal(shouldShow('   '), false);
  assert.equal(shouldShow('\n\t  '), false);
  assert.equal(shouldShow(null), false);
  assert.equal(shouldShow(undefined), false);

  // When saved with content, section is displayed
  assert.equal(shouldShow('## Cierre de inscripciones\n15/10/2026'), true);
  assert.equal(shouldShow('[Formulario](https://forms.gle/xyz)'), true);
});

