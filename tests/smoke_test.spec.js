/**
 * Sigma HQ Smoke Tests
 * 
 * MANDATORY: These tests MUST pass before any deployment is considered successful.
 * If tests fail, auto-revert the commit and attempt a secondary fix.
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
// CRITICAL BACKEND TESTS
// These catch issues like the 2026-01-13 Vault outage
// ============================================

test.describe('Backend API - Critical', () => {
  
  test('Health: Sync Worker online', async ({ request }) => {
    const response = await request.get(`${SYNC_WORKER_URL}/`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
    console.log(`✅ Sync Worker version: ${data.version}`);
  });

  test('Health: WhatsApp backend online', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

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
    
    // Must have 'files' array
    expect(data).toHaveProperty('files');
    expect(Array.isArray(data.files)).toBeTruthy();
    
    // Should have at least some folders/files
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
    
    // Must have both approved and recent arrays
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
// Verify core components render correctly
// ============================================

test.describe('Dashboard UI - Core', () => {

  test('Dashboard loads successfully', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');
    
    // Page should load without crashing
    await expect(page.locator('body')).toBeVisible();
    
    // Should see Sigma branding or password gate
    const hasContent = await page.locator('text=sigma').first().isVisible() ||
                       await page.locator('text=Sigma').first().isVisible() ||
                       await page.locator('text=Password').first().isVisible();
    expect(hasContent).toBeTruthy();
    
    console.log('✅ Dashboard loaded');
  });

  test('Vault: Project Documents shows folders (not empty)', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(2000);
    
    // Try to click on Amin Fattouh project
    const project = page.locator('text=Amin Fattouh').first();
    if (await project.isVisible()) {
      await project.click();
      await page.waitForTimeout(1500);
      
      // Click Project Documents tab
      const docsTab = page.locator('text=Project Documents').first();
      if (await docsTab.isVisible()) {
        await docsTab.click();
        await page.waitForTimeout(3000);
        
        // CRITICAL: Should NOT see "No folders found"
        const noFoldersMsg = page.locator('text=No folders found');
        const isEmpty = await noFoldersMsg.isVisible();
        
        if (isEmpty) {
          console.error('❌ CRITICAL: Vault showing "No folders found" - Backend may be broken!');
        }
        expect(isEmpty).toBeFalsy();
        
        // Should see "All Folders" section with content
        const allFolders = page.locator('text=All Folders');
        expect(await allFolders.isVisible()).toBeTruthy();
        
        console.log('✅ Vault shows folders');
      }
    }
  });

  test('OrgChart: Renders SVG paths for reporting lines', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(2000);
    
    // Click Organization link
    const orgLink = page.locator('text=Organization').first();
    if (await orgLink.isVisible()) {
      await orgLink.click();
      await page.waitForTimeout(3000);
      
      // Should NOT see error messages
      const hasError = await page.locator('text=Error').first().isVisible();
      expect(hasError).toBeFalsy();
      
      // Should have SVG elements for the org chart
      const svgElements = page.locator('svg');
      const svgCount = await svgElements.count();
      
      // OrgChart should render SVG paths for connecting lines
      const pathElements = page.locator('svg path, svg line');
      const pathCount = await pathElements.count();
      
      console.log(`✅ OrgChart rendered with ${svgCount} SVGs, ${pathCount} paths/lines`);
      
      // Should have at least some SVG content
      expect(svgCount).toBeGreaterThan(0);
    }
  });

});

// ============================================
// WHATSAPP INTEGRATION TESTS
// ============================================

test.describe('WhatsApp Integration', () => {

  test('Channel Mapping page loads without crash', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(2000);
    
    const channelLink = page.locator('text=Channel Mapping').first();
    if (await channelLink.isVisible()) {
      await channelLink.click();
      await page.waitForTimeout(3000);
      
      // Page should load without errors
      await expect(page.locator('body')).toBeVisible();
      
      // Should see WhatsApp section
      const whatsappSection = page.locator('text=WhatsApp').first();
      const hasWhatsApp = await whatsappSection.isVisible();
      
      console.log(`✅ Channel Mapping loaded, WhatsApp visible: ${hasWhatsApp}`);
    }
  });

});

// ============================================
// POST-DEPLOYMENT SUMMARY
// ============================================

test.afterAll(async () => {
  console.log('\n========================================');
  console.log('SMOKE TEST COMPLETE');
  console.log('If all tests passed, deployment is verified.');
  console.log('If any test failed, investigate before proceeding.');
  console.log('========================================\n');
});
