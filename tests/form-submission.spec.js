const { test, expect } = require('@playwright/test');

// === HAPPY PATH ===
test.describe('Formulier - Happy Path', () => {
  test('succesvol formulier versturen met alle velden', async ({ page }) => {
    await page.goto('/');
    await page.fill('#naam', 'Jan de Vries');
    await page.fill('#email', 'jan@voorbeeld.nl');
    await page.fill('#telefoon', '06-12345678');
    await page.selectOption('#onderwerp', 'vraag');
    await page.fill('#bericht', 'Dit is een testbericht voor het contactformulier.');
    await page.check('#privacy');
    await page.click('#submitBtn');
    await expect(page.locator('#successMsg')).toBeVisible();
  });

  test('succesvol versturen zonder optioneel telefoonnummer', async ({ page }) => {
    await page.goto('/');
    await page.fill('#naam', 'Maria Jansen');
    await page.fill('#email', 'maria@test.nl');
    await page.selectOption('#onderwerp', 'feedback');
    await page.fill('#bericht', 'Feedback over de website, ziet er goed uit!');
    await page.check('#privacy');
    await page.click('#submitBtn');
    await expect(page.locator('#successMsg')).toBeVisible();
  });
});

// === VALIDATIE ===
test.describe('Formulier - Validatie', () => {
  test('toont foutmeldingen bij leeg formulier', async ({ page }) => {
    await page.goto('/');
    await page.click('#submitBtn');
    await expect(page.locator('#naamError')).toBeVisible();
    await expect(page.locator('#emailError')).toBeVisible();
    await expect(page.locator('#onderwerpError')).toBeVisible();
    await expect(page.locator('#berichtError')).toBeVisible();
    await expect(page.locator('#privacyError')).toBeVisible();
    await expect(page.locator('#successMsg')).not.toBeVisible();
  });

  test('toont fout bij ongeldig e-mailadres', async ({ page }) => {
    await page.goto('/');
    await page.fill('#naam', 'Test Gebruiker');
    await page.fill('#email', 'geen-geldig-email');
    await page.selectOption('#onderwerp', 'overig');
    await page.fill('#bericht', 'Dit is een testbericht.');
    await page.check('#privacy');
    await page.click('#submitBtn');
    await expect(page.locator('#emailError')).toBeVisible();
    await expect(page.locator('#successMsg')).not.toBeVisible();
  });

  test('toont fout bij te kort bericht', async ({ page }) => {
    await page.goto('/');
    await page.fill('#naam', 'Test Gebruiker');
    await page.fill('#email', 'test@test.nl');
    await page.selectOption('#onderwerp', 'vraag');
    await page.fill('#bericht', 'Kort');
    await page.check('#privacy');
    await page.click('#submitBtn');
    await expect(page.locator('#berichtError')).toBeVisible();
    await expect(page.locator('#successMsg')).not.toBeVisible();
  });
});

// === EDGE CASES ===
test.describe('Formulier - Edge Cases', () => {
  test('naam met speciale tekens wordt geaccepteerd', async ({ page }) => {
    await page.goto('/');
    await page.fill('#naam', "Jean-François O'Brien");
    await page.fill('#email', 'jean@test.fr');
    await page.selectOption('#onderwerp', 'samenwerking');
    await page.fill('#bericht', 'Bericht met speciale tekens: , , !');
    await page.check('#privacy');
    await page.click('#submitBtn');
    await expect(page.locator('#successMsg')).toBeVisible();
  });

  test('privacy checkbox is verplicht', async ({ page }) => {
    await page.goto('/');
    await page.fill('#naam', 'Test Gebruiker');
    await page.fill('#email', 'test@test.nl');
    await page.selectOption('#onderwerp', 'vraag');
    await page.fill('#bericht', 'Een voldoende lang testbericht.');
    // Privacy NIET aangevinkt
    await page.click('#submitBtn');
    await expect(page.locator('#privacyError')).toBeVisible();
    await expect(page.locator('#successMsg')).not.toBeVisible();
  });

  test('alle onderwerp-opties werken', async ({ page }) => {
    const onderwerpen = ['vraag', 'feedback', 'samenwerking', 'overig'];
    for (const onderwerp of onderwerpen) {
      await page.goto('/');
      await page.fill('#naam', 'Test');
      await page.fill('#email', 'test@test.nl');
      await page.selectOption('#onderwerp', onderwerp);
      await page.fill('#bericht', 'Testbericht voor onderwerp selectie.');
      await page.check('#privacy');
      await page.click('#submitBtn');
      await expect(page.locator('#successMsg')).toBeVisible();
    }
  });
});
