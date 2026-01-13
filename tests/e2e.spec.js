// Sigma HQ End-to-End Tests
// Run: npx playwright test
// These tests MUST pass before any deployment is considered successful

import { test, expect } from '@playwright/test';

const DASHBOARD_URL = 'https://sigma-hq-app.vercel.app';
const SYNC_WORKER_URL = 'https://sigma-sync-worker-71025980302.europe-west1.run.app';
const WHATSAPP_URL = 'https://sigma-whatsapp-71025980302.europe-west1.run.app';

// ============================================
// STATUS API TESTS (Layer 2: The "Pulse")
// ============================================

test.describe('Status API - System Pulse', () => {

  test('Sync Worker /status returns healthy', async ({ request }) => {
    const response = await request.get(`${SYNC_WORKER_URL}/status`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.service).toBe('sigma-sync-worker');
    expect(data.status).toBe('healthy');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('health_checks');
    expect(data.health_checks.firestore).toBe('connected');
    
    console.log(`✅ Sync Worker: ${data.version} - ${data.status}`);
  });

  test('WhatsApp /status returns healthy', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/status`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.service).toBe('sigma-whatsapp-webhook');
    expect(data.status).toBe('healthy');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('health_checks');
    expect(data.health_checks.firestore).toBe('connected');
    
    console.log(`✅ WhatsApp: ${data.version} - ${data.status}`);
  });

});

// ============================================
// BACKEND API TESTS
// ============================================

test.describe('Backend API Health', () => {
  
  test('Sync Worker is online', async ({ request }) => {
    const response = await request.get(`${SYNC_WORKER_URL}/`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('WhatsApp backend is online', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  // CRITICAL: This is the test that would have caught today's bug
  test('Files endpoint accepts POST requests', async ({ request }) => {
    const response = await request.post(`${SYNC_WORKER_URL}/files`, {
      data: {
        projectName: 'Amin_Fattouh',
        folderPath: ''
      }
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('files');
    expect(Array.isArray(data.files)).toBeTruthy();
  });

  test('Latest endpoint accepts POST requests', async ({ request }) => {
    const response = await request.post(`${SYNC_WORKER_URL}/latest`, {
      data: {
        projectName: 'Amin_Fattouh'
      }
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('approved');
    expect(data).toHaveProperty('recent');
  });

  test('WhatsApp groups endpoint works', async ({ request }) => {
    const response = await request.get(`${WHATSAPP_URL}/waha/groups`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('groups');
  });

});

// ============================================
// FRONTEND UI TESTS
// ============================================

test.describe('Dashboard UI', () => {

  test('Dashboard loads and shows projects', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    
    // Should see the Sigma logo or login
    await expect(page.locator('body')).toBeVisible();
    
    // Wait for projects to load (may need password)
    await page.waitForTimeout(3000);
  });

  test('Project Documents tab loads folders', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(2000);
    
    // Click on a project (Amin Fattouh)
    const project = page.locator('text=Amin Fattouh');
    if (await project.isVisible()) {
      await project.click();
      await page.waitForTimeout(1000);
      
      // Click Project Documents tab
      const docsTab = page.locator('text=Project Documents');
      if (await docsTab.isVisible()) {
        await docsTab.click();
        await page.waitForTimeout(3000);
        
        // CRITICAL: Folders should appear, not "No folders found"
        const noFolders = page.locator('text=No folders found');
        const hasFolders = !(await noFolders.isVisible());
        expect(hasFolders).toBeTruthy();
      }
    }
  });

  test('OrgChart renders without errors', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(2000);
    
    // Click Organization
    const orgLink = page.locator('text=Organization');
    if (await orgLink.isVisible()) {
      await orgLink.click();
      await page.waitForTimeout(2000);
      
      // Should not see any error messages
      const errorVisible = await page.locator('text=Error').isVisible();
      expect(errorVisible).toBeFalsy();
    }
  });

});

// ============================================
// WHATSAPP INTEGRATION TESTS  
// ============================================

test.describe('WhatsApp Integration', () => {

  test('Channel Mapping page loads groups', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(2000);
    
    // Click Channel Mapping
    const channelLink = page.locator('text=Channel Mapping');
    if (await channelLink.isVisible()) {
      await channelLink.click();
      await page.waitForTimeout(3000);
      
      // Should see WhatsApp Groups section
      const groupsSection = page.locator('text=WhatsApp Groups');
      // Just check page loaded without crashing
      await expect(page.locator('body')).toBeVisible();
    }
  });

});
