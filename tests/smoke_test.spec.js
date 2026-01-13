/**
 * Sigma HQ Smoke Tests
 * 
 * MANDATORY: These tests MUST pass before any deployment is considered successful.
 * If tests fail, investigate before proceeding.
 * 
 * Run: npm test
 * Run with UI: npm run test:ui
 */

import { test, expect } from '@playwright/test';

const DASHBOARD_URL = 'https://sigma-hq-app.vercel.app';
const SYNC_WORKER_URL = 'https://sigma-sync-worker-71025980302.europe-west1.run.app';
const WHATSAPP_URL = 'https://sigma-whatsapp-71025980302.europe-west1.run.app';

// Test project that must exist in GCS
const TEST_PROJECT = 'Amin_Fattouh';

// ============================================
// STATUS API TESTS - The "Pulse" Check
// Run first to verify all backends are healthy
// ============================================

test.describe('Status API - System Pulse', () => {

  test('Sync Worker /status is healthy', async ({ request }) => {
    const response = await request.get(`${SYNC_WORKER_URL}/status`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.service).toBe('sigma-sync-worker');
    expect(data.status).toBe('healthy');
    expect(data.health_checks.firestore).toBe('connected');
    
    console.log(`✅ Sync Worker: v${data.version} - ${data.status}`);
  });

  test('WhatsApp /status is healthy', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/status`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.service).toBe('sigma-whatsapp-webhook');
    expect(data.status).toBe('healthy');
    expect(data.health_checks.firestore).toBe('connected');
    
    console.log(`✅ WhatsApp: v${data.version} - ${data.status}`);
  });

});

// ============================================
// CRITICAL BACKEND TESTS
// These catch issues like the 2026-01-13 Vault outage
// ============================================

test.describe('Backend API - Critical', () => {

  // CRITICAL TEST - This would have caught the 2026-01-13 Vault bug
  test('Vault: /files accepts POST and returns file list', async ({ request }) => {
    const response = await request.post(`${SYNC_WORKER_URL}/files`, {
      data: {
        projectName: TEST_PROJECT,
        folderPath: ''
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('files');
    expect(Array.isArray(data.files)).toBeTruthy();
    
    console.log(`✅ Files endpoint returned ${data.files.length} items`);
  });

  test('Vault: /latest accepts POST and returns approved/recent', async ({ request }) => {
    const response = await request.post(`${SYNC_WORKER_URL}/latest`, {
      data: {
        projectName: TEST_PROJECT
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('approved');
    expect(data).toHaveProperty('recent');
    expect(Array.isArray(data.approved)).toBeTruthy();
    expect(Array.isArray(data.recent)).toBeTruthy();
  });

  test('WhatsApp: /waha/groups returns groups array', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/waha/groups`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('groups');
    expect(Array.isArray(data.groups)).toBeTruthy();
    console.log(`✅ WhatsApp has ${data.groups.length} groups`);
  });

});

// ============================================
// FRONTEND UI TESTS
// NOTE: Using domcontentloaded instead of networkidle because
// Firestore real-time listeners keep connections open forever
// ============================================

test.describe('Dashboard UI - Core', () => {

  test('Dashboard loads successfully', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    
    await expect(page.locator('body')).toBeVisible();
    
    const hasContent = await page.locator('text=sigma').first().isVisible() ||
                       await page.locator('text=Sigma').first().isVisible() ||
                       await page.locator('text=Password').first().isVisible();
    expect(hasContent).toBeTruthy();
    
    console.log('✅ Dashboard loaded');
  });

  test('Vault: Project Documents shows folders (not empty)', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(3000);
    
    const project = page.locator('text=Amin Fattouh').first();
    if (await project.isVisible()) {
      await project.click();
      await page.waitForTimeout(1500);
      
      const docsTab = page.locator('text=Project Documents').first();
      if (await docsTab.isVisible()) {
        await docsTab.click();
        await page.waitForTimeout(3000);
        
        const noFoldersMsg = page.locator('text=No folders found');
        const isEmpty = await noFoldersMsg.isVisible();
        
        if (isEmpty) {
          console.error('❌ CRITICAL: Vault showing "No folders found"');
        }
        expect(isEmpty).toBeFalsy();
        
        console.log('✅ Vault shows folders');
      }
    }
  });

  test('OrgChart: Renders SVG paths', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(3000);
    
    const orgLink = page.locator('text=Organization').first();
    if (await orgLink.isVisible()) {
      await orgLink.click();
      await page.waitForTimeout(3000);
      
      const hasError = await page.locator('text=Error').first().isVisible();
      expect(hasError).toBeFalsy();
      
      const svgElements = page.locator('svg');
      const svgCount = await svgElements.count();
      
      console.log(`✅ OrgChart rendered with ${svgCount} SVGs`);
      expect(svgCount).toBeGreaterThan(0);
    }
  });

});

// ============================================
// POST-TEST SUMMARY
// ============================================

test.afterAll(async () => {
  console.log('\n========================================');
  console.log('SMOKE TEST COMPLETE');
  console.log('If all tests passed, deployment is verified.');
  console.log('========================================\n');
});
