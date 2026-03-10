# VSCode + GitHub Copilot + Playwright: Opzet & Use Cases

## Video Referentie

Gebaseerd op de Playwright CLI workflow (Claude Code), vertaald naar VSCode + GitHub Copilot.

---

## Wat kan VSCode + Copilot dat Claude Code ook kan?

| Feature | Claude Code + Playwright CLI | VSCode + Copilot + Playwright MCP |
|---|---|---|
| Browser automatisering | Ja (via CLI skill) | Ja (via MCP server) |
| Headless browsers | Ja | Ja |
| Headed browsers (zichtbaar) | Ja | Ja |
| Formulier testen | Ja | Ja |
| Screenshots maken | Ja | Ja |
| Accessibility tree gebruiken | Ja (CLI slaat op disk) | Ja (MCP stuurt naar Copilot) |
| Parallelle agents | Ja (sub-agents) | Beperkt (1 chat sessie) |
| Token-efficientie | Zeer hoog (CLI) | Gemiddeld (MCP) |
| Skill/workflow hergebruik | Ja (custom skills) | Ja (copilot-instructions.md) |

**Belangrijkste verschil**: Claude Code met de CLI is ~4x zuiniger in tokens. Copilot gebruikt de MCP-variant die het volledige accessibility tree doorgeeft. Voor de meeste use cases maakt dit weinig uit.

---

## Installatie (3 stappen)

### Stap 1: Playwright installeren

```bash
npm install
npx playwright install chromium
```

### Stap 2: MCP Server configureren (al gedaan)

Het bestand `.vscode/mcp.json` is al geconfigureerd:

```json
{
  "servers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### Stap 3: Copilot Agent Mode activeren

1. Open VSCode
2. Open Copilot Chat (Ctrl+Shift+I)
3. Selecteer **Agent Mode** (niet "Ask" of "Edit")
4. De Playwright MCP tool verschijnt automatisch als beschikbare tool

---

## Gebruik

### Eenvoudig testen via Copilot Chat

Open Agent Mode en typ:

> "Test het contactformulier op localhost:3000. Vul alle velden in en controleer of het succesbericht verschijnt."

Copilot zal automatisch:
1. De Playwright MCP server aanspreken
2. Een browser openen (headless)
3. Het formulier invullen en testen
4. Resultaten rapporteren

### Playwright tests draaien via terminal

```bash
npm test              # Alle tests, headless
npm run test:headed   # Alle tests, zichtbaar in browser
npm run test:ui       # Interactieve UI mode
```

---

## High-Impact Use Cases

### 1. Formulier Validatie Testen (zoals in de video)

**Impact**: Elimineert 30-60 min handmatig testen per formulier-wijziging

Vraag aan Copilot:
> "Test alle validatieregels van het contactformulier: leeg formulier, ongeldig email, te kort bericht, ontbrekende privacy checkbox"

### 2. Cross-Browser Compatibiliteit

**Impact**: Test in 3 browsers tegelijk ipv handmatig switchen

```bash
npm test  # Draait automatisch in Chromium, Firefox en WebKit
```

### 3. Visuele Regressie Detectie

**Impact**: Vang onbedoelde UI-wijzigingen automatisch op

Vraag aan Copilot:
> "Maak screenshots van alle pagina's en vergelijk ze met de vorige versie"

### 4. Accessibility Audit

**Impact**: Zorg dat je site toegankelijk is (WCAG compliance)

Vraag aan Copilot:
> "Analyseer de accessibility tree van het formulier en rapporteer problemen"

### 5. User Flow / E2E Testing

**Impact**: Automatiseer complete gebruikersflows

Vraag aan Copilot:
> "Simuleer een complete gebruiker die het formulier invult, verstuurt, en controleer dat de bevestiging correct is"

### 6. Performance Monitoring

**Impact**: Detecteer trage pagina's vroeg

Vraag aan Copilot:
> "Meet de laadtijd van de pagina en rapporteer Core Web Vitals"

### 7. Automated Smoke Tests na Deployment

**Impact**: Snelle check of productie werkt na elke deploy

Integreer in CI/CD:
```yaml
# .github/workflows/test.yml
- name: Run Playwright Tests
  run: npx playwright test
```

### 8. Data Entry Automatisering

**Impact**: Automatiseer repetitieve browser-taken

Vraag aan Copilot:
> "Vul dit formulier 10x in met verschillende testdata en log de resultaten"

---

## Tips & Best Practices

1. **Begin eenvoudig**: Start met een enkele test, bouw uit naar parallelle tests
2. **Gebruik headed mode voor debugging**: `npm run test:headed` om te zien wat er gebeurt
3. **Sla screenshots op bij failures**: Al geconfigureerd in `playwright.config.js`
4. **Maak herbruikbare instructies**: Gebruik `.github/copilot-instructions.md` als "skills"
5. **Combineer met CI/CD**: Draai tests automatisch bij elke PR

---

## Bronnen

- [Playwright MCP Server (GitHub)](https://github.com/microsoft/playwright-mcp)
- [GitHub Blog: Debug with Playwright MCP + Copilot](https://github.blog/ai-and-ml/github-copilot/how-to-debug-a-web-app-with-playwright-mcp-and-github-copilot/)
- [Microsoft Learn: Test with Playwright + Copilot](https://learn.microsoft.com/en-us/shows/visual-studio-code/test-like-a-pro-with-playwright-and-github-copilot)
