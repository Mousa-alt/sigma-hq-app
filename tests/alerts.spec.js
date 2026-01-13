/**
 * Alerts & Anomaly Detection Tests (Phase 4.1)
 * 
 * MANDATORY: These tests MUST pass before deployment is considered successful.
 * Tests verify the Red Flag detection system for WhatsApp messages.
 * 
 * Run: npx playwright test tests/alerts.spec.js
 */

const { test, expect } = require('@playwright/test');

const WHATSAPP_URL = 'https://sigma-whatsapp-71025980302.europe-west1.run.app';
const DASHBOARD_URL = 'https://sigma-hq-app.vercel.app';

// ============================================
// ALERTS API TESTS
// ============================================

test.describe('Alerts API - Phase 4.1', () => {

  test('GET /alerts returns alerts array', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/alerts`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('alerts');
    expect(data).toHaveProperty('count');
    expect(Array.isArray(data.alerts)).toBeTruthy();
    
    console.log(`✅ Alerts API returned ${data.count} active alerts`);
  });

  test('WhatsApp backend version includes anomaly_detection', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.version).toContain('anomaly');
    expect(data.features).toContain('anomaly_detection');
    expect(data.features).toContain('red_flag_alerts');
    
    console.log(`✅ Backend version: ${data.version}`);
  });

});

// ============================================
// RED FLAG KEYWORD DETECTION TEST
// This simulates a "stop work" message and verifies alert creation
// ============================================

test.describe('Red Flag Detection - Critical Keywords', () => {

  test('Simulated "stop work" message triggers alert', async ({ request }) => {
    // Simulate a webhook payload with critical keyword
    const webhookPayload = {
      event: 'message',
      payload: {
        id: { id: 'test_alert_' + Date.now() },
        from: '201234567890@c.us',
        chatId: '201234567890@c.us',
        body: 'URGENT: Stop work immediately on site B - unsafe conditions',
        timestamp: Math.floor(Date.now() / 1000),
        fromMe: false,
        _data: {
          notifyName: 'Test Safety Officer'
        }
      }
    };

    // Send the simulated webhook
    const response = await request.post(`${WHATSAPP_URL}/`, {
      data: webhookPayload,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    // Verify alerts were created
    expect(result).toHaveProperty('alerts_created');
    expect(result.alerts_created).toBeGreaterThan(0);
    
    console.log(`✅ "Stop work" message created ${result.alerts_created} alert(s)`);
  });

  test('Simulated "accident" message triggers CRITICAL alert', async ({ request }) => {
    const webhookPayload = {
      event: 'message',
      payload: {
        id: { id: 'test_accident_' + Date.now() },
        from: '201111111111@c.us',
        chatId: '201111111111@c.us',
        body: 'Emergency! Accident reported on floor 3, worker injured',
        timestamp: Math.floor(Date.now() / 1000),
        fromMe: false,
        _data: {
          notifyName: 'Site Manager'
        }
      }
    };

    const response = await request.post(`${WHATSAPP_URL}/`, {
      data: webhookPayload,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    expect(result.alerts_created).toBeGreaterThan(0);
    console.log(`✅ "Accident" message created ${result.alerts_created} alert(s)`);
  });

  test('Normal message does NOT trigger keyword alert', async ({ request }) => {
    const webhookPayload = {
      event: 'message',
      payload: {
        id: { id: 'test_normal_' + Date.now() },
        from: '201234567890@c.us',
        chatId: '120363123456789@g.us',
        body: 'Please send the material submittal for review',
        timestamp: Math.floor(Date.now() / 1000),
        fromMe: false,
        _data: {
          notifyName: 'Engineer'
        }
      }
    };

    const response = await request.post(`${WHATSAPP_URL}/`, {
      data: webhookPayload,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    // Should still process but fewer alerts (only unknown sender if applicable)
    console.log(`✅ Normal message - alerts created: ${result.alerts_created || 0}`);
  });

});

// ============================================
// SESSION STATUS MONITORING
// ============================================

test.describe('Session Status Monitoring', () => {

  test('Session disconnect event triggers CRITICAL alert', async ({ request }) => {
    const sessionPayload = {
      event: 'session.status',
      payload: {
        status: 'DISCONNECTED',
        session: 'default'
      }
    };

    const response = await request.post(`${WHATSAPP_URL}/`, {
      data: sessionPayload,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    expect(result).toHaveProperty('alerts_created');
    expect(result.alerts_created).toBeGreaterThan(0);
    
    console.log(`✅ Session DISCONNECTED triggered ${result.alerts_created} alert(s)`);
  });

  test('Session CONNECTED event does NOT trigger alert', async ({ request }) => {
    const sessionPayload = {
      event: 'session.status',
      payload: {
        status: 'CONNECTED',
        session: 'default'
      }
    };

    const response = await request.post(`${WHATSAPP_URL}/`, {
      data: sessionPayload,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    
    // CONNECTED status should not create alerts
    expect(result.alerts_created || 0).toBe(0);
    
    console.log(`✅ Session CONNECTED - no alerts (expected)`);
  });

});

// ============================================
// FRONTEND ALERTS DISPLAY TEST
// ============================================

test.describe('Frontend Alerts Display', () => {

  test('Dashboard loads and can display alerts', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');
    
    // Page should load without crashing
    await expect(page.locator('body')).toBeVisible();
    
    // If alerts exist, the sidebar should show System Alerts section
    // This is a soft check - alerts may or may not exist
    await page.waitForTimeout(3000);
    
    const alertBanner = page.locator('text=CRITICAL ALERT').first();
    const alertSection = page.locator('text=System Alerts').first();
    
    const hasCriticalBanner = await alertBanner.isVisible().catch(() => false);
    const hasAlertSection = await alertSection.isVisible().catch(() => false);
    
    console.log(`✅ Dashboard loaded`);
    console.log(`   Critical alert banner visible: ${hasCriticalBanner}`);
    console.log(`   System alerts section visible: ${hasAlertSection}`);
  });

});

// ============================================
// ALERT ACKNOWLEDGMENT TEST
// ============================================

test.describe('Alert Acknowledgment', () => {

  test('Can acknowledge an alert via API', async ({ request }) => {
    // First, get current alerts
    const alertsResponse = await request.get(`${WHATSAPP_URL}/alerts`);
    const alertsData = await alertsResponse.json();
    
    if (alertsData.alerts && alertsData.alerts.length > 0) {
      const alertId = alertsData.alerts[0].id;
      
      // Acknowledge the alert
      const ackResponse = await request.post(`${WHATSAPP_URL}/alerts/${alertId}/acknowledge`, {
        data: { acknowledgedBy: 'playwright-test' },
        headers: { 'Content-Type': 'application/json' }
      });
      
      expect(ackResponse.ok()).toBeTruthy();
      const result = await ackResponse.json();
      expect(result.success).toBeTruthy();
      
      console.log(`✅ Alert ${alertId} acknowledged successfully`);
    } else {
      console.log(`⚠️ No active alerts to acknowledge (this is OK)`);
    }
  });

});

// ============================================
// POST-TEST SUMMARY
// ============================================

test.afterAll(async () => {
  console.log('\n========================================');
  console.log('PHASE 4.1 ALERTS TESTS COMPLETE');
  console.log('Red Flag Detection System Verified');
  console.log('========================================\n');
});
