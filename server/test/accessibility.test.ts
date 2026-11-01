import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

let server: http.Server;
let baseUrl: string;

let citizenAToken: string;
let citizenAId: string;
let citizenBToken: string;
let citizenBId: string;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });

  const login = async (email: string) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'CivoraDev123!' }),
    });
    const json = (await res.json()) as any;
    assert.ok(json.success, `Login failed for ${email}`);
    return { token: json.data.token as string, user: json.data.user };
  };

  const a = await login('aarav.sharma@example.com');
  const b = await login('priya.patel@example.com');

  citizenAToken = a.token;
  citizenAId = a.user.id;

  citizenBToken = b.token;
  citizenBId = b.user.id;
});

after(async () => {
  // Clean up any test preferences created
  if (citizenAId) {
    await prisma.userAccessibilityPreference.deleteMany({
      where: { userId: { in: [citizenAId, citizenBId] } },
    });
  }

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('Module 15: Accessibility, Multilingual Support & Inclusive Experience Tests', () => {
  describe('1. Supported Languages Metadata Directory', () => {
    test('GET /api/accessibility/languages returns directory of Indian regional languages', async () => {
      const res = await fetch(`${baseUrl}/api/accessibility/languages`);
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.defaultLanguage, 'en');
      assert.strictEqual(json.data.totalCount, 3);

      const codes = json.data.languages.map((l: any) => l.code);
      assert.ok(codes.includes('en'), 'Must include English');
      assert.ok(codes.includes('hi'), 'Must include Hindi');
      assert.ok(codes.includes('pa'), 'Must include Punjabi');

      const hindi = json.data.languages.find((l: any) => l.code === 'hi');
      assert.strictEqual(hindi.nativeName, 'हिन्दी');
      assert.strictEqual(hindi.script, 'Devanagari');

      const punjabi = json.data.languages.find((l: any) => l.code === 'pa');
      assert.strictEqual(punjabi.nativeName, 'ਪੰਜਾਬੀ');
      assert.strictEqual(punjabi.script, 'Gurmukhi');
    });
  });

  describe('2. User Accessibility & Language Preference Fallbacks', () => {
    test('GET /api/accessibility/preferences returns standard defaults for unauthenticated visitor', async () => {
      const res = await fetch(`${baseUrl}/api/accessibility/preferences`);
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.preferences.isDefault, true);
      assert.strictEqual(json.data.preferences.language, 'en');
      assert.strictEqual(json.data.preferences.textSize, 'normal');
      assert.strictEqual(json.data.preferences.reducedMotion, false);
      assert.strictEqual(json.data.preferences.highContrast, false);
    });

    test('GET /api/accessibility/preferences returns defaults when authenticated user has no saved record', async () => {
      const res = await fetch(`${baseUrl}/api/accessibility/preferences`, {
        headers: { Authorization: `Bearer ${citizenBToken}` },
      });
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.preferences.isDefault, true);
      assert.strictEqual(json.data.preferences.language, 'en');
    });
  });

  describe('3. Validation and Authorization Safeguards', () => {
    test('PUT /api/accessibility/preferences rejects unauthenticated requests with HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/accessibility/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'hi' }),
      });
      assert.strictEqual(res.status, 401);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'UNAUTHORIZED');
    });

    test('PUT /api/accessibility/preferences rejects unsupported language code with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/accessibility/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({ language: 'fr' }),
      });
      assert.strictEqual(res.status, 400);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    });

    test('PUT /api/accessibility/preferences rejects invalid text size with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/accessibility/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({ textSize: 'gigantic' }),
      });
      assert.strictEqual(res.status, 400);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    });
  });

  describe('4. Preference Persistence & Audit Trail', () => {
    test('Citizen updates preferences to Hindi, large text, and reduced motion', async () => {
      const res = await fetch(`${baseUrl}/api/accessibility/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          language: 'hi',
          textSize: 'large',
          reducedMotion: true,
          highContrast: false,
        }),
      });
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.preferences.language, 'hi');
      assert.strictEqual(json.data.preferences.textSize, 'large');
      assert.strictEqual(json.data.preferences.reducedMotion, true);
      assert.strictEqual(json.data.preferences.isDefault, false);
    });

    test('GET /api/accessibility/preferences retrieves persisted Hindi preferences for Citizen A', async () => {
      const res = await fetch(`${baseUrl}/api/accessibility/preferences`, {
        headers: { Authorization: `Bearer ${citizenAToken}` },
      });
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.preferences.language, 'hi');
      assert.strictEqual(json.data.preferences.textSize, 'large');
      assert.strictEqual(json.data.preferences.reducedMotion, true);
      assert.strictEqual(json.data.preferences.isDefault, false);
    });

    test('Audit event is created upon updating accessibility preferences', async () => {
      const audit = await prisma.auditEvent.findFirst({
        where: {
          actorId: citizenAId,
          entityType: 'USER_ACCESSIBILITY_PREFERENCE',
          action: 'UPDATE',
        },
        orderBy: { createdAt: 'desc' },
      });
      assert.ok(audit, 'Audit event must be logged');
      assert.strictEqual(audit.actorId, citizenAId);
    });

    test('Citizen updates preference to Punjabi and extra large text', async () => {
      const res = await fetch(`${baseUrl}/api/accessibility/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAToken}`,
        },
        body: JSON.stringify({
          language: 'pa',
          textSize: 'larger',
          highContrast: true,
        }),
      });
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.preferences.language, 'pa');
      assert.strictEqual(json.data.preferences.textSize, 'larger');
      assert.strictEqual(json.data.preferences.highContrast, true);
    });

    test('Citizen B maintains independent preferences without being affected by Citizen A', async () => {
      const res = await fetch(`${baseUrl}/api/accessibility/preferences`, {
        headers: { Authorization: `Bearer ${citizenBToken}` },
      });
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      // Citizen B never set preferences, so they remain default English
      assert.strictEqual(json.data.preferences.language, 'en');
      assert.strictEqual(json.data.preferences.isDefault, true);
    });
  });
});
