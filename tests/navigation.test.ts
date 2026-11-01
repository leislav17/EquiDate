import test from 'node:test';
import assert from 'node:assert/strict';
import { eventPath, eventReference, isAdminRoute, resolveEvent, resourceHash, resourceSuffix, navigateHash, subscribeNavigation } from '../src/utils/navigation.ts';
import { createAnalytics, GA_ID } from '../src/lib/analytics.ts';

const id = 'ee4102fa-c37b-49a2-b6f4-15571b24dc2f';
const events = [{ id, slug: 'san-diego', status: 'published' }, { id: 'other', slug: 'draft', status: 'draft' }];
const location = (pathname = '/', search = '', hash = '') => ({ pathname, search, hash });

test('Slugs resolve directly, with a trailing slash and without exposing drafts', () => {
  assert.equal(resolveEvent(location('/san-diego'), events)?.id, id);
  assert.equal(resolveEvent(location('/SAN-DIEGO/'), events)?.id, id);
  assert.equal(resolveEvent(location('/draft'), events), undefined);
  assert.equal(resolveEvent(location('/unknown'), events), undefined);
  assert.equal(resolveEvent(location('/%E0%A4%A'), events), undefined);
  assert.equal(eventPath(events[0]), '/san-diego');
  assert.equal(eventPath({ id }), '/event/' + id);
  assert.equal(resolveEvent(location('/'), [{ id, status: 'published' }]), undefined);
});

test('ID/query legacy links and resource fragments retain their meaning', () => {
  for (const route of [location('/' + id), location('/event/' + id), location('/events/' + id),
    location('/', '?event=' + id), location('/', '', '#event/' + id), location('/', '', '#event-' + id)]) {
    assert.equal(resolveEvent(route, events)?.id, id);
  }
  for (const hash of ['#document-old', '#start-list/old', '#results/old', '#transmission/day/arena']) {
    assert.equal(resolveEvent(location('/san-diego', '', hash), events)?.id, id);
    assert.equal(eventReference(location('/', '', hash)), null);
  }
  for (const route of [location('/admin', '?event=' + id), location('/admin/event/' + id), location('/', '', '#/admin?event=' + id)]) {
    assert.equal(isAdminRoute(route), true);
    assert.equal(resolveEvent(route, events), undefined);
  }
});

test('GA initializes once and never emits manual pageviews alongside Enhanced Measurement', () => {
  const calls: unknown[][] = [];
  const analytics = createAnalytics((...args) => calls.push(args));
  analytics('https://test.example/san-diego', 'test');
  analytics('https://test.example/san-diego', 'test');
  analytics('https://test.example/sjv', 'test');
  analytics('https://test.example/sjv#results/one', 'test');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], ['config', GA_ID, { page_location: 'https://test.example/san-diego', environment: 'test' }]);
  assert.equal(calls.filter(call => call[0] === 'event').length, 0);
});

test('Resource paths map to existing viewers and old fragments retain their exact IDs', () => {
  for (const [suffix, hash] of [['/document/old', '#document-old'], ['/start-list/one', '#start-list/one'],
    ['/results/one', '#results/one'], ['/transmission/day/arena', '#transmission/day/arena']]) {
    const route = location('/san-diego' + suffix);
    assert.equal(resolveEvent(route, events)?.id, id);
    assert.equal(resourceHash(route), hash);
    assert.equal(resourceSuffix(hash), suffix);
    assert.equal(resourceHash(location('/', '', hash)), hash);
  }
  assert.equal(resourceHash(location('/san-diego')), '');
  assert.equal(resourceHash(location('/admin')), '');
});

test('Hash actions use resource paths and closing a resource returns to its contest', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let current = new URL('https://test.example/san-diego?utm_source=test');
  const browser = new EventTarget();
  const history = { pushState: (_state: unknown, _unused: string, url: string) => { current = new URL(url, current); } };
  Object.defineProperties(browser, { location: { get: () => current }, history: { value: history } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  let changes = 0;
  const unsubscribe = subscribeNavigation(() => changes++);
  try {
    navigateHash('#start-list/one');
    assert.equal(current.pathname, '/san-diego/start-list/one');
    assert.equal(current.search, '?utm_source=test');
    navigateHash('document-old');
    assert.equal(current.pathname, '/san-diego/document/old');
    navigateHash('');
    assert.equal(current.pathname, '/san-diego');
    assert.equal(changes, 3);
    navigateHash('');
    assert.equal(changes, 3);
  } finally {
    unsubscribe();
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
