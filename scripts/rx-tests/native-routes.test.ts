import test from 'node:test';
import assert from 'node:assert/strict';
import { isNativeAppPath, isNativeAppRequest, NATIVE_APP_HOME } from '../../lib/native-routes';

test('the native apps are recognised by their User-Agent marker', () => {
  assert.equal(isNativeAppRequest('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 AscentorApp/1'), true);
  assert.equal(isNativeAppRequest('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 AscentorApp/1'), true);
  assert.equal(isNativeAppRequest('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'), false);
  assert.equal(isNativeAppRequest(''), false);
  assert.equal(isNativeAppRequest(null), false);
});

test('the member app, admin, sign-in and calls stay inside the apps', () => {
  for (const p of ['/dashboard', '/circle', '/learn/abc', '/sessions', '/messages/123', '/settings/billing', '/store',
    '/admin', '/admin/users', '/admin-login', '/login', '/signup', '/forgot-password', '/reset-password',
    '/auth/continue', '/onboarding', '/checkout', '/call/abc', '/join/token', '/privacy', '/terms', '/api/rx/feed']) {
    assert.equal(isNativeAppPath(p), true, p);
  }
});

test('the public website never shows inside the apps', () => {
  for (const p of ['/', '/pricing', '/about', '/blog', '/blog/a-post', '/elevation-summit', '/donate', '/shop',
    '/movement', '/who-its-for', '/newsletter', '/waitlist', '/careers', '/p/partner', '/door', '/walk-in']) {
    assert.equal(isNativeAppPath(p), false, p);
  }
});

test('website pages are swapped for a page that is itself inside the apps', () => {
  assert.equal(isNativeAppPath(NATIVE_APP_HOME), true);
});
