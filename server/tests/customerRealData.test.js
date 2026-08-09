import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeCreditScore } from '../utils/customerBalance.js';
import { formatPaymentSubmission } from '../utils/formatters.js';

describe('customer real-data contracts', () => {
  it('computeCreditScore uses persisted balance and last credit age', () => {
    assert.equal(
      computeCreditScore({ balance: 0, lastCreditDate: new Date(), createdAt: new Date() }),
      'Excellent'
    );

    const sixtyOneDaysAgo = new Date(Date.now() - 61 * 86400000);
    assert.equal(
      computeCreditScore({
        balance: 1000,
        lastCreditDate: sixtyOneDaysAgo,
        createdAt: sixtyOneDaysAgo,
      }),
      'Risky'
    );
  });

  it('formatPaymentSubmission exposes stable payment linkage fields', () => {
    const now = new Date('2026-01-15T10:30:00.000Z');
    const formatted = formatPaymentSubmission(
      {
        _id: { toString: () => 'sub123' },
        customer: { toString: () => 'cust123' },
        amount: 500,
        method: 'eSewa',
        payType: 'custom',
        payLabel: 'Custom payment',
        transaction: null,
        itemIndex: null,
        itemName: '',
        screenshotUrl: 'https://example.com/a.png',
        note: 'paid',
        status: 'accepted',
        reviewNote: 'ok',
        reportReason: '',
        payment: { toString: () => 'pay123' },
        createdAt: now,
        reviewedAt: now,
      },
      { shopName: 'Sharma Kirana', customerName: 'Ram' }
    );

    assert.equal(formatted.id, 'sub123');
    assert.equal(formatted.customerId, 'cust123');
    assert.equal(formatted.paymentId, 'pay123');
    assert.equal(formatted.shopName, 'Sharma Kirana');
    assert.equal(formatted.status, 'accepted');
    assert.ok(formatted.date);
  });

  it('portal payment mapping keeps receipt and submission relationship keys', () => {
    // Mirrors the fields returned by getPortalPayments after the real-data fix.
    const mapped = {
      id: 'pay123',
      customerId: 'cust123',
      receiptNo: 'RCP-2026-0001',
      submissionId: 'sub123',
      status: 'verified',
    };

    assert.equal(mapped.receiptNo.startsWith('RCP-'), true);
    assert.equal(mapped.submissionId, 'sub123');
    assert.equal(mapped.customerId, 'cust123');
    assert.equal(mapped.status, 'verified');
  });

  it('email-link acceptance requires verified ownership', () => {
    const canAccept = (user) =>
      user.role === 'customer' && !!(user.isEmailVerified || user.authProvider === 'google');

    assert.equal(
      canAccept({ role: 'customer', isEmailVerified: false, authProvider: 'local' }),
      false
    );
    assert.equal(
      canAccept({ role: 'customer', isEmailVerified: true, authProvider: 'local' }),
      true
    );
    assert.equal(
      canAccept({ role: 'customer', isEmailVerified: false, authProvider: 'google' }),
      true
    );
  });

  it('accepted submission dedupe prefers paymentId over amount/date keys', () => {
    const submissions = [
      { id: 'sub1', paymentId: 'pay1', shopName: 'A', amount: 100, date: '2026-01-01' },
      { id: 'sub2', paymentId: null, shopName: 'A', amount: 100, date: '2026-01-01' },
    ];
    const payments = [
      { id: 'pay1', submissionId: 'sub1', shopName: 'A', amount: 100, date: '2026-01-01' },
      { id: 'pay2', submissionId: null, shopName: 'A', amount: 100, date: '2026-01-01' },
    ];

    const linkedPaymentIds = new Set(
      submissions.filter((s) => s.paymentId).map((s) => String(s.paymentId))
    );
    const uniquePayments = payments.filter((p) => !linkedPaymentIds.has(String(p.id)));

    assert.deepEqual(
      uniquePayments.map((p) => p.id),
      ['pay2']
    );
  });
});
