# GitHub Copilot Instructies

## Playwright Browser Automatisering

Dit project gebruikt de Playwright MCP server voor browser-automatisering via GitHub Copilot in VSCode.

### Beschikbare commando's in Copilot Chat (Agent Mode)

Gebruik deze prompts in Copilot Chat (`@workspace`) met agent mode aan:

- **UI Test uitvoeren**: "Test het contactformulier op localhost:3000 met de Playwright MCP tool"
- **Headed browser**: "Open een headed browser en test het formulier zodat ik het kan zien"
- **Validatie testen**: "Test alle validatieregels van het formulier met edge cases"
- **Screenshot**: "Maak een screenshot van het formulier na het invullen"

### Workflow

1. Start de dev server: `npm run dev`
2. Open Copilot Chat in Agent Mode
3. Vraag Copilot om het formulier te testen via Playwright MCP
4. Copilot gebruikt automatisch de MCP server om de browser aan te sturen
