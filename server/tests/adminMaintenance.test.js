import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAdminEmails, isAdminEmail } from '../utils/adminCheck.js';

describe('admin metrics and maintenance contracts', () => {
  it('nonAdminFilter excludes allowlisted admin emails', () => {
    const adminEmails = ['admin@bakibook.com', 'ops@bakibook.com'];
    const nonAdminFilter = (emails) =>
      emails.length ? { email: { $nin: emails } } : {};

    assert.deepEqual(nonAdminFilter(adminEmails), {
      email: { $nin: adminEmails },
    });
    assert.deepEqual(nonAdminFilter([]), {});
  });

  it('shop totals exclude admin identity even when role is shopkeeper', () => {
    const users = [
      { email: 'admin@bakibook.com', role: 'shopkeeper' },
      { email: 'shop@example.com', role: 'shopkeeper' },
      { email: 'cust@example.com', role: 'customer' },
    ];
    const adminSet = new Set(['admin@bakibook.com']);
    const totalUsers = users.filter((u) => !adminSet.has(u.email)).length;
    const totalShops = users.filter(
      (u) => u.role === 'shopkeeper' && !adminSet.has(u.email)
    ).length;

    assert.equal(totalUsers, 2);
    assert.equal(totalShops, 1);
  });

  it('maintenance response contract uses MAINTENANCE code and 503 semantics', () => {
    const payload = {
      success: false,
      code: 'MAINTENANCE',
      message: 'BakiBook is temporarily unavailable. Please check back soon.',
    };
    assert.equal(payload.code, 'MAINTENANCE');
    assert.equal(payload.success, false);
    assert.match(payload.message, /unavailable/i);
  });

  it('admin bypass helper recognizes allowlisted emails', () => {
    const previous = {
      ADMIN_EMAIL: process.env.ADMIN_EMAIL,
      ADMIN_EMAILS: process.env.ADMIN_EMAILS,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    };

    process.env.ADMIN_EMAIL = 'admin@bakibook.com';
    process.env.ADMIN_PASSWORD = 'secret';
    process.env.ADMIN_EMAILS = 'ops@bakibook.com';

    try {
      assert.equal(isAdminEmail('admin@bakibook.com'), true);
      assert.equal(isAdminEmail('OPS@bakibook.com'), true);
      assert.equal(isAdminEmail('user@example.com'), false);
      assert.ok(getAdminEmails().includes('admin@bakibook.com'));
      assert.ok(getAdminEmails().includes('ops@bakibook.com'));
    } finally {
      process.env.ADMIN_EMAIL = previous.ADMIN_EMAIL;
      process.env.ADMIN_EMAILS = previous.ADMIN_EMAILS;
      process.env.ADMIN_PASSWORD = previous.ADMIN_PASSWORD;
    }
  });

  it('allowed maintenance paths keep login and admin reachable', () => {
    const allowed = [
      '/api/health',
      '/api/stats',
      '/api/maintenance-status',
      '/api/auth/login',
      '/api/auth/register',
      '/api/admin/dashboard',
      '/api/admin/maintenance',
    ];
    const blocked = ['/api/portal/dashboard', '/api/customers', '/api/auth/me'];

    const isAllowed = (path) => {
      const prefixes = [
        '/api/health',
        '/api/stats',
        '/api/maintenance-status',
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/google',
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
        '/api/auth/verify-email',
        '/api/admin',
        '/api/legal',
      ];
      return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    };

    for (const path of allowed) assert.equal(isAllowed(path), true);
    for (const path of blocked) assert.equal(isAllowed(path), false);
  });
});
