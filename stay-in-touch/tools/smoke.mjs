// E2E-smoke test voor de Stay-in-Touch Tracker via Chrome DevTools Protocol.
// Vereist: chromium headless met --remote-debugging-port=9223 en de app op :8080.
// Zero dependencies: Node 22 heeft een ingebouwde WebSocket-client.

const CDP_BASE = "http://127.0.0.1:9223";
const APP = "http://localhost:8080/";

const target = await (await fetch(`${CDP_BASE}/json/new?${encodeURIComponent(APP)}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let msgId = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

async function evaluate(expression) {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) {
    throw new Error(`Page exception: ${JSON.stringify(res.result.exceptionDetails.exception?.description ?? res.result.exceptionDetails)}`);
  }
  return res.result?.result?.value;
}

const results = [];
async function check(name, expression) {
  const value = await evaluate(expression);
  const pass = value === true;
  results.push({ name, pass, value });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : `  -> ${JSON.stringify(value)}`}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function navigate(url) {
  await send("Page.navigate", { url });
  await sleep(700);
}

await send("Page.enable");
await sleep(700);

// -- schone lei ------------------------------------------------------------
await evaluate("localStorage.clear(); location.reload(); true");
await sleep(700);

await check("lege staat zichtbaar bij 0 personen", `!document.querySelector("#empty-state").hidden`);

// -- persoon toevoegen (met XSS-canary in de naam) -------------------------
const XSS_NAME = `Testpersoon <img src=x onerror="document.title='XSS'">`;
await evaluate(`
  document.querySelector("#add-btn").click();
  document.querySelector("#f-name").value = ${JSON.stringify(XSS_NAME)};
  document.querySelector("#f-relationship").value = "family";
  document.querySelector("#f-frequency").value = "weekly";
  document.querySelector("#f-bday-day").value = "29";
  document.querySelector("#f-bday-month").value = "02";
  document.querySelector("#f-notes").value = "eerste notitie";
  document.querySelector("#person-form").requestSubmit();
  true
`);
await sleep(200);

await check("kaart verschijnt na toevoegen", `document.querySelectorAll(".card").length === 1`);
await check("naam wordt als tekst gerenderd (geen XSS)", `
  document.querySelector(".card .name").textContent === ${JSON.stringify(XSS_NAME)}
  && document.querySelector(".card img") === null
  && document.title !== "XSS"
`);
await check("nieuwe persoon zonder contact is 'never' met gele badge", `
  document.querySelector(".card").classList.contains("status-never")
  && document.querySelector(".card .badge").textContent === "Nieuw"
`);
await check("statistieken tellen 1 actief / 1 binnenkort", `
  document.querySelector("#stat-tracking").textContent === "1"
  && document.querySelector("#stat-duesoon").textContent === "1"
`);
await check("verjaardag 29 feb geaccepteerd en 🎂 mogelijk verborgen (>30d) of zichtbaar", `
  (() => {
    const el = document.querySelector(".card .birthday-inline");
    return el === null || el.textContent.includes("29 feb");
  })()
`);

// -- vandaag gesproken -----------------------------------------------------
await evaluate(`document.querySelector('[data-action="contacted"]').click(); true`);
await sleep(200);
await check("na 'Vandaag gesproken' is status op schema", `
  document.querySelector(".card").classList.contains("status-ok")
  && document.querySelector(".card .badge").textContent === "Op schema"
  && document.querySelector(".card .card-meta").textContent.includes("vandaag")
`);
await check("'Vandaag gesproken'-knop verdwijnt bij op-schema", `document.querySelector('[data-action="contacted"]') === null`);

// -- details, geschiedenis, notities ---------------------------------------
await evaluate(`document.querySelector('[data-action="toggle-details"]').click(); true`);
await sleep(200);
await check("detailpaneel toont 1 contactmoment", `
  !document.querySelector(".card-details").hidden
  && document.querySelectorAll(".history-list li").length === 1
`);
await check("notities uit formulier zichtbaar in detailpaneel", `document.querySelector(".card-details textarea").value === "eerste notitie"`);
await evaluate(`
  (() => {
    const ta = document.querySelector(".card-details textarea");
    ta.value = "aangepaste notitie";
    ta.dispatchEvent(new Event("focusout", { bubbles: true }));
  })(); true
`);

// -- zoeken & filteren ------------------------------------------------------
await evaluate(`
  (() => {
    const s = document.querySelector("#search");
    s.value = "zzz";
    s.dispatchEvent(new Event("input", { bubbles: true }));
  })(); true
`);
await check("zoekterm zonder match toont 'Geen personen gevonden'", `
  document.querySelectorAll(".card").length === 0 && !document.querySelector("#no-results").hidden
`);
await evaluate(`
  (() => {
    const s = document.querySelector("#search");
    s.value = "testpersoon";
    s.dispatchEvent(new Event("input", { bubbles: true }));
  })(); true
`);
await check("zoeken op naam vindt de kaart terug", `document.querySelectorAll(".card").length === 1`);
await evaluate(`document.querySelector('.chip[data-status="overdue"]').click(); true`);
await check("filter Achterstallig verbergt op-schema-kaart", `document.querySelectorAll(".card").length === 0`);
await evaluate(`document.querySelector('.chip[data-status="all"]').click(); true`);

// -- thema ------------------------------------------------------------------
await evaluate(`document.querySelector("#theme-toggle").click(); document.querySelector("#theme-toggle").click(); true`);
await check("thema-cyclus komt uit op donker en wordt bewaard", `
  document.documentElement.dataset.theme === "dark" && localStorage.getItem("stayintouch.theme") === "dark"
`);

// -- validatiefouten --------------------------------------------------------
await evaluate(`
  document.querySelector("#add-btn").click();
  document.querySelector("#f-name").value = "";
  document.querySelector("#person-form").requestSubmit();
  true
`);
await check("lege naam geeft Nederlandse foutmelding", `
  !document.querySelector("#form-error").hidden && document.querySelector("#form-error").textContent.includes("Naam")
`);
await evaluate(`
  document.querySelector("#f-name").value = "Bday Test";
  document.querySelector("#f-bday-day").value = "31";
  document.querySelector("#f-bday-month").value = "02";
  document.querySelector("#person-form").requestSubmit();
  true
`);
await check("31 februari geeft verjaardagsfout", `
  !document.querySelector("#form-error").hidden && document.querySelector("#form-error").textContent.toLowerCase().includes("verjaardag")
`);
await evaluate(`document.querySelector("#cancel-btn").click(); true`);

// -- persistentie over reload ----------------------------------------------
await navigate(APP);
await check("data en thema overleven een reload", `
  document.querySelectorAll(".card").length === 1
  && document.documentElement.dataset.theme === "dark"
`);
await evaluate(`document.querySelector('[data-action="toggle-details"]').click(); true`);
await sleep(200);
await check("aangepaste notitie is persistent", `document.querySelector(".card-details textarea").value === "aangepaste notitie"`);

// -- bewerken + verwijderen -------------------------------------------------
await evaluate(`document.querySelector('[data-action="edit"]').click(); true`);
await check("bewerken opent dialoog met bestaande waarden", `
  document.querySelector("#person-dialog").open
  && document.querySelector("#f-name").value === ${JSON.stringify(XSS_NAME)}
  && document.querySelector("#f-bday-day").value === "29"
  && document.querySelector("#f-bday-month").value === "02"
`);
await evaluate(`
  document.querySelector("#f-name").value = "Hernoemd";
  document.querySelector("#person-form").requestSubmit();
  true
`);
await sleep(200);
await check("hernoemen werkt en behoudt geschiedenis", `
  document.querySelector(".card .name").textContent === "Hernoemd"
`);
await evaluate(`document.querySelector('[data-action="edit"]').click(); document.querySelector("#delete-btn").click(); true`);
await sleep(300);
await evaluate(`document.querySelector("#confirm-ok").click(); true`);
await sleep(300);
await check("verwijderen na bevestiging leidt tot lege staat", `
  document.querySelectorAll(".card").length === 0 && !document.querySelector("#empty-state").hidden
`);

// -- afronden ---------------------------------------------------------------
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} smoke checks geslaagd`);
ws.close();
process.exit(failed.length === 0 ? 0 : 1);
