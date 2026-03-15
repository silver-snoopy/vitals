import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CronometerGwtClient } from '../client.js';

function makeResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

function mockFetchSequence(responses: Response[]): void {
  const queue = [...responses];
  globalThis.fetch = vi.fn().mockImplementation(() => {
    const res = queue.shift();
    if (!res) throw new Error('Unexpected fetch call — queue exhausted');
    return Promise.resolve(res);
  });
}

const GWT_HEADER = 'FAKEGWTHEADER1234567890ABCDEF';
const GWT_PERMUTATION = 'FAKEPERMUTATION1234567890ABCD';

function makeClient() {
  return new CronometerGwtClient('user@test.com', 'pass123', GWT_HEADER, GWT_PERMUTATION);
}

// Minimal responses for a successful 5-step auth + export flow:
// 1. GET /login  → CSRF token in HTML
// 2. POST /login → 302 redirect
// 3. GET redirect location → 200 OK
// 4. POST GWT app (authenticate) → OK[12345,...]
// 5. POST GWT app (generateAuthorizationToken) → "export-token"
// 6. GET /export → CSV content
function makeHappyPathResponses(): Response[] {
  const csrf = makeResponse('<input name="anticsrf" value="testcsrf123">', 200, {
    'set-cookie': 'session=abc; Path=/',
  });
  const login302 = makeResponse('', 302, {
    location: 'https://cronometer.com/dashboard',
    'set-cookie': 'auth=xyz; Path=/',
  });
  const redirect200 = makeResponse('Welcome', 200, { 'set-cookie': 'sesnonce=nonce999; Path=/' });
  const gwtAuth = makeResponse('//OK[12345,["com.cronometer..."]]', 200, {
    'set-cookie': 'sesnonce=nonce999; Path=/',
  });
  const gwtToken = makeResponse('//OK["export-token-abc"]', 200);
  const csv = makeResponse('Date,Energy\n2026-03-12,2000\n', 200);
  return [csrf, login302, redirect200, gwtAuth, gwtToken, csv];
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CronometerGwtClient', () => {
  it('throws immediately when credentials are missing', async () => {
    const client = new CronometerGwtClient('', '', GWT_HEADER, GWT_PERMUTATION);
    await expect(client.exportDailyNutrition(new Date(), new Date())).rejects.toThrow(
      'Missing Cronometer credentials',
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('happy path returns CSV', async () => {
    mockFetchSequence(makeHappyPathResponses());
    const client = makeClient();
    const start = new Date('2026-03-12');
    const end = new Date('2026-03-12');
    const result = await client.exportDailyNutrition(start, end);
    expect(result).toContain('Date,Energy');
    expect(globalThis.fetch).toHaveBeenCalledTimes(6);
  });

  it('throws with JSON error message from login endpoint', async () => {
    const csrf = makeResponse('<input name="anticsrf" value="testcsrf123">', 200);
    const loginJson = makeResponse(
      JSON.stringify({
        success: false,
        error: 'Too Many Attempts. Please try again in 15 minutes.',
      }),
      200,
      { 'content-type': 'application/json' },
    );
    mockFetchSequence([csrf, loginJson]);
    const client = makeClient();
    await expect(client.exportDailyNutrition(new Date(), new Date())).rejects.toThrow(
      'Too Many Attempts',
    );
  });

  it('falls back to /login/ when /login returns empty body for CSRF', async () => {
    // First GET /login → 200 but empty body (no CSRF token)
    const emptyLogin = makeResponse('', 200);
    // Second GET /login/ → 200 with CSRF token
    const loginWithCsrf = makeResponse('<input name="anticsrf" value="testcsrf123">', 200, {
      'set-cookie': 'session=abc; Path=/',
    });
    const rest = makeHappyPathResponses().slice(1); // skip the first CSRF fetch
    mockFetchSequence([emptyLogin, loginWithCsrf, ...rest]);
    const client = makeClient();
    const result = await client.exportDailyNutrition(
      new Date('2026-03-12'),
      new Date('2026-03-12'),
    );
    expect(result).toContain('Date,Energy');
    // 7 fetches: 2 CSRF attempts + login POST + redirect follow + GWT auth + GWT token + export
    expect(globalThis.fetch).toHaveBeenCalledTimes(7);
  });

  it('throws when login body contains rate-limit text', async () => {
    const csrf = makeResponse('<input name="anticsrf" value="testcsrf123">', 200);
    const loginHtml = makeResponse('<html>Error: too many attempts, try again later.</html>', 200);
    mockFetchSequence([csrf, loginHtml]);
    const client = makeClient();
    await expect(client.exportDailyNutrition(new Date(), new Date())).rejects.toThrow(
      'Cronometer login failed',
    );
  });
});
