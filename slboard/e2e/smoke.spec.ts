import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const runUploadSmoke = process.env.E2E_SMOKE_UPLOAD === '1';

async function login(page: Page) {
  test.skip(!email || !password, 'E2E_USER_EMAIL und E2E_USER_PASSWORD sind erforderlich.');

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email ?? '');
  await page.locator('input[type="password"]').fill(password ?? '');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('smoke: login and startseite loads', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Schulische Dokumentenverwaltung' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Startseite' })).toBeVisible();
});

test('smoke: documents list and steering analysis UI', async ({ page }) => {
  await login(page);

  await page.goto('/documents');
  await expect(page.getByRole('heading', { name: 'Dokumente' })).toBeVisible();

  const noDocsInfo = page.getByText('Es wurden noch keine Dokumente gefunden.');
  if (await noDocsInfo.isVisible()) {
    await expect(noDocsInfo).toBeVisible();
    return;
  }

  const firstDocumentLink = page.locator('a[href^="/documents/"]').first();
  await expect(firstDocumentLink).toBeVisible();
  await firstDocumentLink.click();

  await expect(page).toHaveURL(/\/documents\/.+/);
  const analysisButton = page.getByRole('button', {
    name: /Analyse des Steuerungsbedarfs( aktualisieren)?/,
  });
  await expect(analysisButton).toBeVisible();
  await expect(
    page.getByText(
      'Prüft das Dokument per KI entlang der Schulentwicklungs-Matrix (u. a. Tragfähigkeit, Belastungsgrad, Entscheidungslogik, Verbindlichkeit) und ermittelt daraus den Steuerungsbedarf.',
    ),
  ).toBeVisible();
});

test('smoke: optional upload flow', async ({ page }) => {
  test.skip(!runUploadSmoke, 'Optionaler Upload-Smoke ist deaktiviert (E2E_SMOKE_UPLOAD != 1).');
  await login(page);

  await page.goto('/upload');
  await expect(page.getByRole('heading', { name: 'Dokument hochladen' })).toBeVisible();

  const now = Date.now();
  const fakePdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf-8');
  await page.locator('#file').setInputFiles({
    name: `e2e-smoke-${now}.pdf`,
    mimeType: 'application/pdf',
    buffer: fakePdf,
  });

  await page.getByRole('button', { name: /Dokumente hochladen/ }).click();
  await expect(page.getByText(/\d+\/\d+ Dokument\(e\) erfolgreich hochgeladen\./)).toBeVisible();
});
