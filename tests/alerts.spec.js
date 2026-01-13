/**
 * Sigma HQ Backend Tests
 * 
 * Tests for core backend functionality.
 * Run: npx playwright test tests/alerts.spec.js
 */

import { test, expect } from '@playwright/test';

const WHATSAPP_URL = 'https://sigma-whatsapp-71025980302.europe-west1.run.app';
const SYNC_URL = 'https://sigma-sync-worker-71025980302.europe-west1.run.app';
const DASHBOARD_URL = 'https://sigma-hq-app.vercel.app';

// ============================================
// STATUS API TESTS
// ============================================

test.describe('Status API - System Health', () => {

  test('Sync Worker /status returns healthy with all checks', async ({ request }) => {
    const response = await request.get(`${SYNC_URL}/status`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.service).toBe('sigma-sync-worker');
    expect(data.status).toBe('healthy');
    expect(data.health_checks.firestore).toBe('connected');
    expect(data.health_checks.gcs).toBe('connected');
    
    console.log(`✅ Sync Worker v${data.version}: Firestore=${data.health_checks.firestore}, GCS=${data.health_checks.gcs}`);
  });

  test('WhatsApp /status returns healthy with all checks', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/status`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.service).toBe('sigma-whatsapp-webhook');
    expect(data.status).toBe('healthy');
    expect(data.health_checks.firestore).toBe('connected');
    expect(data.health_checks.waha_api).toBe('online');
    
    console.log(`✅ WhatsApp v${data.version}: Firestore=${data.health_checks.firestore}, WAHA=${data.health_checks.waha_api}`);
  });

});

// ============================================
// WEBHOOK TESTS
// ============================================

test.describe('WhatsApp Webhook', () => {

  test('Webhook processes message events', async ({ request }) => {
    const testPayload = {
      event: 'message',
      payload: {
        id: { id: 'test-' + Date.now() },
        from: '201234567890@c.us',
        chatId: '201234567890-test@g.us',
        body: 'Test message from Playwright',
        timestamp: Math.floor(Date.now() / 1000),
        fromMe: false,
        _data: {
          notifyName: 'Test User'
        }
      }
    };

    const response = await request.post(`${WHATSAPP_URL}/`, {
      data: testPayload,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('processed');
    console.log(`✅ Webhook processed message for group: ${data.group}`);
  });

  test('Webhook skips non-message events', async ({ request }) => {
    const testPayload = {
      event: 'session.status',
      payload: {
        status: 'CONNECTED'
      }
    };

    const response = await request.post(`${WHATSAPP_URL}/`, {
      data: testPayload,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('processed');
    expect(data.event).toBe('session.status');
  });

});

// ============================================
// FRONTEND TESTS
// ============================================

test.describe('Frontend Sidebar', () => {

  test('Sidebar loads without JavaScript errors', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
    
    await expect(page.locator('body')).toBeVisible();
    
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    
    await page.waitForTimeout(2000);
    
    if (errors.length > 0) {
      console.error('❌ JavaScript errors:', errors);
    } else {
      console.log('✅ No JavaScript errors detected');
    }
    
    expect(errors.length).toBe(0);
  });

});
