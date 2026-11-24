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

    // 5. Create Automation
    console.log("[Playwright] Navigating to /automations/new...");
    await page.goto("/automations/new");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("#automation-name", { timeout: 15000 });

    // Fill Basic Settings
    await page.fill("#automation-name", "Playwright Web Automation");

    // Select connected Instagram account or fill input
    const accountSelect = page.locator("select").first();
    const accountInput = page.locator('input[placeholder*="Instagram Account UUID"]');

    if ((await accountSelect.count()) > 0) {
      const options = accountSelect.locator("option");
      if ((await options.count()) > 0) {
        const optionValue = await options.first().getAttribute("value");
        if (optionValue) {
          await accountSelect.selectOption(optionValue);
        }
      }
    } else if ((await accountInput.count()) > 0) {
      await accountInput.fill("ig_pw_account_777");
    }

    // Media ID
    await page.fill("#instagram-media-id", "media_pw_999");

    // Click "Any Comment" trigger type
    await page.click('button:has-text("Any Comment")');

    // Public Reply Text
    await page.fill("#public-reply-to-comment", "Thanks for commenting! Check your DM.");

    // DM Message Text
    await page.fill('textarea[id*="private-direct-message"]', "Here is your exclusive link!");

    // DM Link
    await page.fill("#dm-action-link", "https://example.com/promo");

    // Submit form
    console.log("[Playwright] Submitting automation creation form...");
    await page.click('button[type="submit"]');

    // Should redirect to /automations
    await page.waitForURL((url) => url.pathname.includes("/automations"), { timeout: 15000 });
    expect(page.url()).toContain("/automations");

    // Verify automation appears in list
    const automationCard = page.locator('div', { hasText: "Playwright Web Automation" }).first();
    await expect(automationCard).toBeVisible({ timeout: 10000 });

    // 6. Activate then Pause Automation
    console.log("[Playwright] Activating and Pausing automation...");
    const activateBtn = page.locator('button[title="Activate automation"]').first();
    if (await activateBtn.isVisible()) {
      await activateBtn.click();
      await expect(page.locator('button[title="Pause automation"]').first()).toBeVisible({ timeout: 5000 });
    }

    // Now click "Pause"
    const pauseBtn = page.locator('button[title="Pause automation"]').first();
    await pauseBtn.click();

    // Verify status transitions to PAUSED (Activate button reappears)
    await expect(page.locator('button[title="Activate automation"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span', { hasText: "PAUSED" }).first()).toBeVisible();

    // 7. Logout
    console.log("[Playwright] Signing out...");
    const logoutBtn = page.locator('button[aria-label="Sign out"], button[title="Sign out"]').first();
    await logoutBtn.click();

    // Should redirect to /login
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 10000 });
    expect(page.url()).toContain("/login");
    console.log("[Playwright] Successfully logged out!");
  });
});
