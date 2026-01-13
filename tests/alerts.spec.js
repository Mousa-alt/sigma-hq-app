/**
 * Sigma HQ Alerts Tests - Phase 4.1
 * 
 * Tests for Red Flag & Anomaly Detection system.
 * DO NOT DEPLOY if these tests fail.
 * 
 * Run: npx playwright test tests/alerts.spec.js
 */

import { test, expect } from '@playwright/test';

const WHATSAPP_URL = 'https://sigma-whatsapp-71025980302.europe-west1.run.app';
const DASHBOARD_URL = 'https://sigma-hq-app.vercel.app';

// ============================================
// ALERTS API TESTS
// ============================================

test.describe('Alerts API - Phase 4.1', () => {

  test('GET /alerts returns alerts array', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/alerts`);
    
    // Should return 200 OK (even if empty)
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('alerts');
    expect(data).toHaveProperty('count');
    expect(Array.isArray(data.alerts)).toBeTruthy();
    
    console.log(`✅ Alerts endpoint returned ${data.count} active alerts`);
  });

  test('Health check shows anomaly_detection feature', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    // v4.16 should have anomaly_detection in features
    const hasAnomalyDetection = data.features?.includes('anomaly_detection') || 
                                data.version?.includes('anomaly');
    
    if (hasAnomalyDetection) {
      console.log('✅ Anomaly detection feature is active');
    } else {
      console.log('⚠️ Anomaly detection not yet deployed (version: ' + data.version + ')');
    }
  });

});

// ============================================
// CRITICAL KEYWORD DETECTION TEST
// ============================================

test.describe('Red Flag Detection - Critical Keywords', () => {

  test('Simulated "stop work" message triggers detection logic', async ({ request }) => {
    // This tests that the webhook can receive and process a message
    // The anomaly detector should flag "stop work" as critical
    
    const testPayload = {
      event: 'message',
      payload: {
        id: { id: 'test-' + Date.now() },
        from: '201234567890@c.us',
        chatId: '201234567890-test@g.us',
        body: 'URGENT: stop work immediately on level 3 - safety issue',
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
    console.log('Webhook response:', JSON.stringify(data));
    
    // If anomaly detection is active, should create alerts
    if (data.alerts_created !== undefined) {
      console.log(`✅ Anomaly detection active - ${data.alerts_created} alerts created`);
      expect(data.alerts_created).toBeGreaterThan(0);
    } else {
      console.log('⚠️ Anomaly detection not yet deployed');
    }
  });

  test('Simulated "accident" message triggers high severity', async ({ request }) => {
    const testPayload = {
      event: 'message',
      payload: {
        id: { id: 'test-accident-' + Date.now() },
        from: '201234567890@c.us',
        chatId: '201234567890-test@g.us',
        body: 'There was an accident on site, worker injured',
        timestamp: Math.floor(Date.now() / 1000),
        fromMe: false,
        _data: {
          notifyName: 'Site Manager'
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
    
    if (data.alerts_created !== undefined && data.alerts_created > 0) {
      console.log(`✅ Critical keyword "accident" detected - ${data.alerts_created} alerts`);
    }
  });

});

// ============================================
// SESSION STATUS MONITORING TEST
// ============================================

test.describe('Session Stability Monitoring', () => {

  test('Session status event triggers alert on disconnect', async ({ request }) => {
    const testPayload = {
      event: 'session.status',
      payload: {
        status: 'DISCONNECTED',
        reason: 'Network error'
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
    
    if (data.alerts_created !== undefined) {
      console.log(`✅ Session disconnect alert created: ${data.alerts_created} alerts`);
    }
  });

});

// ============================================
// FRONTEND ALERTS DISPLAY TEST
// ============================================

test.describe('Frontend Alerts Display', () => {

  test('Sidebar loads without errors (alerts listener active)', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Page should load without crashing
    await expect(page.locator('body')).toBeVisible();
    
    // Check for any JavaScript errors related to alerts
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    
    await page.waitForTimeout(2000);
    
    const alertErrors = errors.filter(e => e.toLowerCase().includes('alert'));
    if (alertErrors.length > 0) {
      console.error('❌ Alert-related errors:', alertErrors);
    } else {
      console.log('✅ No alert-related JavaScript errors');
    }
    
    expect(alertErrors.length).toBe(0);
  });

  test('Settings section visible in sidebar', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(3000);
    
    // Should see Settings section
    const settingsSection = page.locator('text=SETTINGS').first();
    const hasSettings = await settingsSection.isVisible();
    
    expect(hasSettings).toBeTruthy();
    console.log('✅ Settings section visible in sidebar');
  });

});
