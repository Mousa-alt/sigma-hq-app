/**
 * Sigma HQ Smoke Tests
 * 
 * MANDATORY: These tests MUST pass before any deployment is considered successful.
 * 
 * Run: npm test
 * Run with UI: npm run test:ui
 */

import { test, expect } from '@playwright/test';

const DASHBOARD_URL = 'https://sigma-hq-app.vercel.app';
const SYNC_WORKER_URL = 'https://sigma-sync-worker-71025980302.europe-west1.run.app';
const WHATSAPP_URL = 'https://sigma-whatsapp-71025980302.europe-west1.run.app';

const TEST_PROJECT = 'Amin_Fattouh';

// ============================================
// CRITICAL BACKEND TESTS
// ============================================

test.describe('Backend API - Critical', () => {

  test('Sync Worker is online', async ({ request }) => {
    const response = await request.get(`${SYNC_WORKER_URL}/`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
    console.log(`✅ Sync Worker: ${data.version}`);
  });

  test('WhatsApp backend is online', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
    console.log(`✅ WhatsApp: ${data.version}`);
  });

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
  });

  test('WhatsApp: /waha/groups returns groups array', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/waha/groups`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('groups');
    console.log(`✅ WhatsApp has ${data.groups.length} groups`);
  });

});

// ============================================
// FRONTEND UI TESTS
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
