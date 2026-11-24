import { test, expect } from "@playwright/test";

test.describe("Web Application End-to-End Smoke Test", () => {
  test("register -> login -> reload stays logged in -> create automation -> pause -> logout", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const email = `playwright_${timestamp}@example.com`;
    const password = "StrongPassword123!";

    // Setup interception for Meta OAuth dialog to prevent real external calls
    await page.route(/facebook\.com/, (route) => {
      const parsed = new URL(route.request().url());
      const state = parsed.searchParams.get("state");
      console.log("[Playwright] Intercepted Facebook OAuth dialog. Redirecting to callback with state...");
      route.fulfill({
        status: 302,
        headers: {
          Location: `http://localhost:4000/api/v1/instagram/oauth/callback?code=mock_playwright_code&state=${state}`,
        },
      });
    });

    // 1. Register
    console.log("[Playwright] Navigating to /register...");
    await page.goto("/register");
    await page.fill('input[type="email"]', email);
    await page.fill('input[placeholder*="At least 12"]', password);
    await page.fill('input[placeholder*="Re-enter"]', password);
    await page.click('button[type="submit"]');

    // Should redirect to /login with ?registered=1
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 10000 });
    expect(page.url()).toContain("/login");

    // 2. Login
    console.log("[Playwright] Logging in...");
    await page.waitForSelector('input[autocomplete="current-password"]');
    await page.fill('input[type="email"]', email);
    await page.fill('input[autocomplete="current-password"]', password);
    await page.click('button[type="submit"]');

    // Should navigate to /dashboard
    await page.waitForURL((url) => url.pathname.includes("/dashboard"), { timeout: 10000 });
    expect(page.url()).toContain("/dashboard");

    // Verify user profile/email appears in sidebar
    await expect(page.locator("aside")).toContainText(email);

    // 3. Reload stays logged in
    console.log("[Playwright] Reloading to verify persistent session...");
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard");
    await expect(page.locator("aside")).toContainText(email);

    // 4. Connect Instagram via UI
    console.log("[Playwright] Navigating to /instagram...");
    await page.goto("/instagram");
    await page.waitForLoadState("networkidle");

    console.log("[Playwright] Clicking 'Connect Instagram with Meta'...");
    await page.click('button:has-text("Connect Instagram with Meta")');

    // Should complete intercepted OAuth and return to /instagram?instagram=connected
    await page.waitForURL((url) => url.pathname.includes("/instagram") && url.search.includes("instagram=connected"), {
      timeout: 15000,
    });
    expect(page.url()).toContain("instagram=connected");
    await page.waitForLoadState("networkidle");

    // 5. Verify Media Library and Start Automation from Media
    console.log("[Playwright] Navigating to /media (Media Library)...");
    await page.goto("/media");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Instagram Media Library" })).toBeVisible({ timeout: 10000 });

    // Verify media item rendered from mock Meta
    const mediaCard = page.locator('div', { hasText: "Exclusive launch discount!" }).first();
    await expect(mediaCard).toBeVisible({ timeout: 10000 });

    // Click "Automate Post" on the media card
    console.log("[Playwright] Clicking 'Automate Post' on media card...");
    await mediaCard.getByRole("link", { name: "Automate Post" }).click();

    // Should navigate to /automations/new with mediaId pre-selected (Step 2: Template)
    await page.waitForURL((url) => url.pathname.includes("/automations/new") && url.search.includes("mediaId="), {
      timeout: 10000,
    });
    expect(page.url()).toContain("mediaId=");

    // Step 2: Choose Template
    console.log("[Playwright] Step 2: Choosing template...");
    await page.waitForSelector('button:has-text("Choose Template")', { timeout: 10000 });
    const chooseTemplateBtn = page.locator('button:has-text("Choose Template")').first();
    await chooseTemplateBtn.click();

    // Step 3: Trigger settings
    console.log("[Playwright] Step 3: Configuring trigger...");
    await page.waitForSelector("#auto-name", { timeout: 10000 });
    await page.fill("#auto-name", "Playwright Web Automation");

    // Click Next Step
    await page.click('button:has-text("Next Step")');

    // Step 4: Craft Responses
    console.log("[Playwright] Step 4: Reviewing responses...");
    await page.waitForSelector('textarea', { timeout: 10000 });
    await page.click('button:has-text("Next Step")');

    // Step 5: Follow Gate & Link
    console.log("[Playwright] Step 5: Setting link destination...");
    await page.waitForSelector("#target-link", { timeout: 10000 });
    await page.fill("#target-link", "https://example.com/promo");
    await page.click('button:has-text("Next Step")');

    // Step 6: Live Preview & Launch
    console.log("[Playwright] Step 6: Verifying preview & activating...");
    await page.waitForSelector('button:has-text("Activate Automation")', { timeout: 10000 });

    // Activate the automation
    await page.click('button:has-text("Activate Automation")');

    // Should redirect to /automations
    await page.waitForURL((url) => url.pathname.includes("/automations"), { timeout: 15000 });
    expect(page.url()).toContain("/automations");

    // Verify automation appears in list
    const automationRow = page.locator('div', { hasText: "Playwright Web Automation" }).first();
    await expect(automationRow).toBeVisible({ timeout: 10000 });

    // 6. Pause Automation
    console.log("[Playwright] Pausing automation...");
    const pauseBtn = page.locator('button[title="Pause automation"]').first();
    await pauseBtn.click();

    // Verify status transitions to PAUSED (Activate button reappears)
    await expect(page.locator('button[title="Activate automation"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span', { hasText: "PAUSED" }).first()).toBeVisible();

    // 7. Verify Templates Page
    console.log("[Playwright] Navigating to /templates...");
    await page.goto("/templates");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Automation Templates" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('div', { hasText: "Free Resource Guide" }).first()).toBeVisible();

    // 8. Logout
    console.log("[Playwright] Signing out...");
    const logoutBtn = page.locator('button[aria-label="Sign out"], button[title="Sign out"]').first();
    await logoutBtn.click();

    // Should redirect to /login
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 10000 });
    expect(page.url()).toContain("/login");
    console.log("[Playwright] Successfully logged out!");
  });
});
