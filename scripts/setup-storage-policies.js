/**
 * setup-storage-policies.js
 *
 * Automates the Supabase Dashboard to create Storage RLS policies
 * for the question-packs bucket.
 *
 * Usage:
 *   node setup-storage-policies.js <supabase-email> <supabase-password>
 *
 * Requirements:
 *   - Playwright (npm i -D playwright @playwright/test)
 *   - node >= 18
 *   - Run from the rov-quiz-review-panel directory
 */

const { chromium } = require('playwright');

const SUPABASE_PROJECT_REF = 'pupxceksdjbtbmbfhryw';
const BUCKET_NAME = 'question-packs';
const STORAGE_URL = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/storage/buckets/${BUCKET_NAME}/policies`;

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: node setup-storage-policies.js <email> <password>');
    process.exit(1);
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Sign in
    console.log('Navigating to Supabase Dashboard...');
    await page.goto('https://supabase.com/dashboard', { waitUntil: 'networkidle' });

    // Click sign in
    await page.click('button:has-text("Sign in"), a:has-text("Sign in")');
    await page.waitForURL('**/auth/**', { timeout: 10000 });

    console.log('Filling credentials...');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]:has-text("Sign in"), button:has-text("Sign In")');

    // Wait for dashboard
    await page.waitForURL(`**/project/**`, { timeout: 30000 });
    console.log('Signed in.');

    // 2. Navigate to storage policies
    console.log('Navigating to Storage policies...');
    await page.goto(STORAGE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // 3. Helper to check if we're on the right page
    const pageContent = await page.content();
    if (pageContent.includes('question-packs') || pageContent.includes('question_packs')) {
      console.log('On storage policies page.');
    } else {
      console.log('Page content snippet:', pageContent.slice(0, 200));
    }

    // Try to find "New policy" button
    const newPolicyBtn = page.locator('button:has-text("New policy"), button:has-text("Add policy"), button:has-text("Create policy")').first();
    const btnVisible = await newPolicyBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!btnVisible) {
      console.log('Could not find "New policy" button. Here is the page structure:');
      const buttons = await page.locator('button').all();
      for (const btn of buttons.slice(0, 20)) {
        const text = await btn.textContent().catch(() => '');
        if (text.trim()) console.log('  Button:', text.trim().slice(0, 80));
      }
      await browser.close();
      process.exit(1);
    }

    // 4. Create SELECT policy (authenticated read)
    console.log('Creating SELECT policy (authenticated read)...');
    await newPolicyBtn.click();
    await page.waitForTimeout(1000);

    // Fill in the policy form - the UI varies, so let's capture what fields appear
    const formFields = await page.locator('input, select, textarea').all();
    console.log('Form fields found:', formFields.length);

    // Try to fill policy name
    const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="policy" i]').first();
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('packs_read_authenticated');
    }

    // Try to select operations - look for checkboxes or select
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    console.log('Checkboxes found:', checkboxes.length);

    // Try to find and click operation checkboxes
    for (const cb of checkboxes) {
      const label = await cb.getAttribute('aria-label').catch(() => '') ||
                    await cb.locator('..').textContent().catch(() => '') || '';
      if (label.toLowerCase().includes('select') || label.toLowerCase().includes('read')) {
        await cb.check({ force: true });
      }
    }

    // Try to find Allowed roles select
    const rolesSelect = page.locator('select').first();
    if (await rolesSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Select "authenticated"
      await rolesSelect.selectOption('authenticated');
    }

    // Save
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]:has-text("Save")').first();
    await saveBtn.click();
    await page.waitForTimeout(2000);
    console.log('SELECT policy created.');

    console.log('\nStorage RLS policies must be set manually through the Dashboard UI.');
    console.log('Go to: Project > Storage > question-packs > Policies');
    console.log('Add these two policies:');
    console.log('');
    console.log('Policy 1:');
    console.log('  Name:  packs_read_authenticated');
    console.log('  Operations:  SELECT');
    console.log('  Allowed roles:  authenticated');
    console.log('');
    console.log('Policy 2:');
    console.log('  Name:  packs_write_reviewer_or_admin');
    console.log('  Operations:  INSERT, UPDATE, DELETE');
    console.log('  Allowed roles:  authenticated');
    console.log('  Policy conditions:');
    console.log('    (SELECT role FROM profiles WHERE auth_user_id = auth.uid()) IN (\'reviewer\', \'admin\')');

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    await browser.close();
  }
}

main();
