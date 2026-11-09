/* ============================================================
   PROJECT 37 COMPANION
   ============================================================
   Leest de zip van "Exporteer voor mobiel" (Project 37 op de pc)
   en laat je games, auto's, circuits en leaderboards zien.
   Alleen bekijken: er wordt niets aangepast.

   Alles blijft op dit apparaat (IndexedDB in de browser).
   ============================================================ */
"use strict";

const COMPANION_VERSIE = "1.0.8";
const FORMAAT = "project37-mobiel";
const HOOGSTE_VERSIE = 1;

// Velden in het infovenster van een auto (zelfde als de pc-app)
const AUTO_INFO = [
  ["vermogen", "Vermogen"],
  ["koppel", "Koppel"],
  ["gewicht", "Gewicht"],
  ["motor", "Motor"],
  ["aandrijving", "Aandrijving"],
  ["versnellingen", "Versnellingen"],
  ["versnellingsbak", "Type versnellingsbak"],
  ["stuur", "Stuur"],
];
const KM_PER_MIJL = 1.609344;
// Volgorde van de leaderboards: "recent" = laatst bijgewerkt bovenaan, "az" = op naam
const LB_VOLGORDE = "recent";

// ------------------------------------------------------------
// Kleine hulpjes
// ------------------------------------------------------------
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (v) => String(v ?? "").trim().toLocaleLowerCase("nl");
const tekst = (v) => (v === null || v === undefined ? "" : String(v).trim());
const bezit = (item) => item.in_bezit !== false;
const meervoud = (n, een, veel) => `${n} ${n === 1 ? een : veel}`;

function datumTekst(iso, metTijd = true) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const p = (n) => String(n).padStart(2, "0");
  const dag = `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
  return metTijd ? `${dag}  ${p(d.getHours())}:${p(d.getMinutes())}` : dag;
}

function lengteTekst(km) {
  if (km === null || km === undefined || km === "") return "";
  const n = parseFloat(String(km).replace(",", "."));
  if (isNaN(n)) return String(km);
  return n.toFixed(3).replace(".", ",") + " km";
}

function tijdTekst(ms) {
  ms = Math.round(ms);
  const u = Math.floor(ms / 3600000); ms -= u * 3600000;
  const m = Math.floor(ms / 60000); ms -= m * 60000;
  const s = Math.floor(ms / 1000); const mil = ms - s * 1000;
  const p2 = (n) => String(n).padStart(2, "0");
  const p3 = String(mil).padStart(3, "0");
  return u ? `${u}:${p2(m)}:${p2(s)}.${p3}` : `${m}:${p2(s)}.${p3}`;
}

function verschilTekst(ms) {
  return ms >= 60000 ? "+" + tijdTekst(ms) : "+" + (ms / 1000).toFixed(3);
}

function circuitTitel(naam, layout) {
  return layout ? `${naam} – ${layout}` : (naam || "");
}

const ICOON = {
  terug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/></svg>',
  laden: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>',
  hart: '<svg class="hart" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M2 15.5l2-.5 3-3.5h7l4 3.5 4 .8V17H2z"/><circle cx="6.5" cy="17" r="2"/><circle cx="17.5" cy="17" r="2"/></svg>',
  circuit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M5 18c-2-2-1-6 1-8s3-5 6-5 4 2 6 2 3 2 2 4-4 2-4 4 3 3 1 5-5 0-7-1-3 1-5-1z"/></svg>',
  beker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4c0 3 1.5 4.5 3.5 4.5M17 6h3c0 3-1.5 4.5-3.5 4.5M12 14v4M8 20h8"/></svg>',
};


// Ferrari F2004 van opzij, als neon-lijntekening (zelfde als de
// randomizer-knop in de pc-app). Voor games zonder cover.
const F2004_ROMP = "100,903 282,903 284,1000 330,990 420,962 480,945 600,905 700,872 760,855 765,822 842,820 848,850 855,935 900,955 990,998 1100,1003 1400,1010 1640,1028 1760,1060 1850,1100 1893,1132 1875,1150 1875,1206 1640,1206 1400,1208 450,1206 205,1210 145,1210 145,1100 100,1095";
function f2004SVG() {
  const romp = `<polygon points="${F2004_ROMP}"/><circle cx="945" cy="962" r="45"/>`;
  const wielen = `<circle cx="328" cy="1108" r="124"/><circle cx="1520" cy="1110" r="125"/>`;
  return `<svg class="f2004" viewBox="60 780 1873 470" aria-hidden="true">
    <g class="gloed" fill="none">${romp}${wielen}</g>
    <g class="lijn-dubbel">${romp}</g>
    <g class="lijn" fill="none">${wielen}</g>
  </svg>`;
}

// Circuit Zandvoort als neon-lijntekening (zelfde als de circuit-randomizer
// in de pc-app, met het rechte stuk onderaan)
const ZANDVOORT = "502,965 164,966 40,964 24,959 11,948 3,933 0,918 4,901 11,887 23,876 39,870 75,870 182,870 230,864 277,850 318,830 337,827 352,832 375,844 391,861 436,907 452,917 470,914 484,908 496,897 502,882 502,866 493,846 419,758 390,715 372,675 360,638 352,602 349,574 341,531 329,494 313,470 292,442 257,413 210,381 184,357 165,333 147,300 136,272 95,154 90,125 92,96 100,72 111,54 125,36 144,21 165,10 188,3 213,0 242,4 336,27 377,33 490,37 506,55 520,80 530,106 537,137 539,172 537,212 527,254 513,283 501,292 486,295 462,290 444,277 423,255 397,213 368,174 337,141 313,126 291,125 270,132 253,148 243,174 244,192 269,282 305,367 353,453 405,522 439,563 480,608 523,649 564,680 577,692 579,704 569,720 554,739 550,757 558,776 574,791 591,796 607,794 635,778 858,636 874,629 892,627 909,628 920,631 940,644 952,661 986,739 992,756 998,781 1000,808 999,832 989,868 973,894 958,914 935,934 913,947 873,960 843,964 519,965 502,965";
function zandvoortSVG() {
  return `<svg class="zandvoort" viewBox="-60 -60 1120 1086" aria-hidden="true">
    <polygon class="gloed" points="${ZANDVOORT}"/><polygon class="lijn" points="${ZANDVOORT}"/></svg>`;
}

// ------------------------------------------------------------
// Schalen op grote schermen (tablets): alles groeit mee met de breedte
// ------------------------------------------------------------
function schaal() {
  const w = window.innerWidth;
  const z = w >= 900 ? Math.min(1.6, Math.max(1, w / 1380)) : 1;
  document.body.style.zoom = z === 1 ? "" : String(z);
  document.documentElement.style.setProperty("--z", String(z));
  // Beschikbare hoogte in "app-pixels" (na het vergroten)
  document.documentElement.style.setProperty("--hoogte", `${Math.round(window.innerHeight / z)}px`);
}

// ------------------------------------------------------------
// Opslag op het apparaat (IndexedDB)
// ------------------------------------------------------------
const Opslag = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((ok, fout) => {
      const req = indexedDB.open("project37", 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("kv");
        req.result.createObjectStore("plaatjes");
      };
      req.onsuccess = () => { this.db = req.result; ok(this.db); };
      req.onerror = () => fout(req.error);
    });
  },
  async get(store, key) {
    const db = await this.open();
    return new Promise((ok, fout) => {
      const req = db.transaction(store).objectStore(store).get(key);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fout(req.error);
    });
  },
  // Alles in één keer vervangen: de oude export blijft staan tot de
  // nieuwe helemaal binnen is.
  async vervang(data, plaatjes) {
    const db = await this.open();
    return new Promise((ok, fout) => {
      const tx = db.transaction(["kv", "plaatjes"], "readwrite");
      const ps = tx.objectStore("plaatjes");
      ps.clear();
      for (const [pad, blob] of plaatjes) ps.put(blob, pad);
      tx.objectStore("kv").put(data, "data");
      tx.oncomplete = () => ok();
      tx.onerror = () => fout(tx.error);
      tx.onabort = () => fout(tx.error || new Error("Opslaan afgebroken"));
    });
  },
};

const plaatjeCache = new Map();
async function plaatjeURL(pad) {
  if (!pad) return null;
  if (plaatjeCache.has(pad)) return plaatjeCache.get(pad);
  const blob = await Opslag.get("plaatjes", pad).catch(() => null);
  const url = blob ? URL.createObjectURL(blob) : null;
  plaatjeCache.set(pad, url);
  return url;
}

// Plaatjes pas laden als ze in beeld komen
const kijker = "IntersectionObserver" in window
  ? new IntersectionObserver((items) => {
      for (const it of items) {
        if (!it.isIntersecting) continue;
        kijker.unobserve(it.target);
        vulPlaatje(it.target);
      }
    }, { rootMargin: "400px" })
  : null;

async function vulPlaatje(el) {
  const url = await plaatjeURL(el.dataset.img);
  if (!url || !el.isConnected) return;
  const img = new Image();
  img.alt = "";
  img.decoding = "async";
  img.src = url;
  el.replaceChildren(img);
}

function activeerPlaatjes(root) {
  root.querySelectorAll("[data-img]").forEach((el) => {
    if (kijker) kijker.observe(el); else vulPlaatje(el);
  });
}

// ------------------------------------------------------------
// Toestand
// ------------------------------------------------------------
const staat = {
  data: null,       // de export
  filters: {},      // per game + tabblad
  scroll: {},       // scrollpositie per lijst
};

function game(id) {
  return staat.data?.games.find((g) => String(g.id) === String(id));
}

function zetThema(thema) {
  const r = document.documentElement.style;
  const map = {
    accent: "--accent", accent_licht: "--accent-licht", achtergrond: "--achtergrond",
    paneel: "--paneel", tekst: "--tekst", tekst_zacht: "--tekst-zacht", fout: "--fout",
  };
  for (const [k, v] of Object.entries(map)) {
    if (thema && /^#[0-9a-f]{6}$/i.test(thema[k] || "")) r.setProperty(v, thema[k]);
  }
  const gloed = thema && (thema.gloed || thema.accent);
  if (gloed && /^#[0-9a-f]{6}$/i.test(gloed)) r.setProperty("--gloed", gloed);
  const kleur = (thema && thema.achtergrond) || "#030206";
  $('meta[name="theme-color"]').setAttribute("content", kleur);
}

// Extra gegevens die de schermen vaak nodig hebben, één keer uitrekenen
function bereidVoor(data) {
  for (const g of data.games) {
    g.autos = g.autos || [];
    g.circuits = g.circuits || [];
    g.leaderboards = g.leaderboards || [];
    g._autoOpId = new Map(g.autos.map((a) => [String(a.id), a]));
    g._autoOpNaam = new Map();
    for (const a of g.autos) if (!g._autoOpNaam.has(norm(a.naam))) g._autoOpNaam.set(norm(a.naam), a);
    g._circuitOpId = new Map(g.circuits.map((c) => [String(c.id), c]));
    g._lbOpId = new Map(g.leaderboards.map((lb) => [String(lb.id), lb]));
    // Altijd netjes op volgorde, ook als nieuwe auto's achteraan zijn toegevoegd
    const abc = (a, b) => a.localeCompare(b, "nl", { numeric: true, sensitivity: "base" });
    g.autos.sort((a, b) => abc(tekst(a.naam), tekst(b.naam)));
    g.circuits.sort((a, b) => abc(circuitTitel(a.circuit, a.layout), circuitTitel(b.circuit, b.layout)));
    for (const a of g.autos) a._zoek = norm([a.naam, a.klasse, a.categorie, a.jaartal].join(" "));
    for (const c of g.circuits) c._zoek = norm([c.circuit, c.layout, c.land, c.categorie].join(" "));
    for (const lb of g.leaderboards) {
      lb.tijden = lb.tijden || [];
      // Laatst bijgewerkt: de datum van het leaderboard of de nieuwste tijd
      lb._laatst = [lb.last_update, ...lb.tijden.map((t) => t.datum)]
        .filter(Boolean).map((d) => Date.parse(d) || 0).reduce((a, b) => Math.max(a, b), 0);
      lb._zoek = norm([lb.naam, lb.circuit, lb.layout, (lb.categories || []).join(" ")].join(" "));
    }
  }
  return data;
}

// ------------------------------------------------------------
// Export inlezen
// ------------------------------------------------------------
async function leesExport(bestand) {
  const bezig = toonBezig("Gegevens inlezen…");
  try {
    const zip = await JSZip.loadAsync(bestand);
    const json = zip.file("project37_mobiel.json");
    if (!json) throw new Error("Dit is geen export voor de mobiele app. Maak hem in Project 37 met Instellingen > Gegevens > Exporteer voor mobiel.");
    const data = JSON.parse(await json.async("string"));
    if (data.formaat !== FORMAAT) throw new Error("Dit bestand komt niet uit 'Exporteer voor mobiel'.");
    if ((data.versie || 0) > HOOGSTE_VERSIE) {
      throw new Error("Deze export is gemaakt met een nieuwere Project 37. Ververs de companion (even online openen) en probeer het opnieuw.");
    }
    const paden = [];
    zip.forEach((pad, f) => { if (!f.dir && pad.startsWith("plaatjes/")) paden.push(pad); });
    const plaatjes = [];
    let klaar = 0;
    for (const pad of paden) {
      const type = pad.endsWith(".png") ? "image/png" : "image/jpeg";
      const buf = await zip.file(pad).async("arraybuffer");
      plaatjes.push([pad, new Blob([buf], { type })]);
      klaar += 1;
      if (klaar % 20 === 0 || klaar === paden.length) bezig.stap(`Plaatjes: ${klaar} van ${paden.length}`, klaar / Math.max(1, paden.length));
    }
    bezig.stap("Opslaan op dit apparaat…", 1);
    data.geladen = new Date().toISOString();
    await Opslag.vervang(data, plaatjes);
    for (const url of plaatjeCache.values()) if (url) URL.revokeObjectURL(url);
    plaatjeCache.clear();
    staat.data = bereidVoor(data);
    staat.filters = {};
    staat.scroll = {};
    zetThema(data.thema);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    bezig.weg();
    melding(`Gegevens van ${datumTekst(data.gemaakt)} geladen`);
    if (location.hash && location.hash !== "#/") location.hash = "#/"; else teken();
  } catch (err) {
    bezig.weg();
    console.error(err);
    const uitleg = err && err.message && !/zip|end of central/i.test(err.message)
      ? err.message
      : "Dit bestand kon niet gelezen worden. Kies de zip die Project 37 heeft gemaakt.";
    melding(uitleg, true);
  }
}

function kiesExport() {
  const input = $("#file");
  input.value = "";
  input.click();
}

// ------------------------------------------------------------
// Meldingen en bezig-scherm
// ------------------------------------------------------------
let meldingTimer = null;
function melding(t, fout = false) {
  const el = $("#toast");
  el.textContent = t;
  el.classList.toggle("fout", fout);
  el.classList.add("zichtbaar");
  clearTimeout(meldingTimer);
  meldingTimer = setTimeout(() => el.classList.remove("zichtbaar"), fout ? 6000 : 3000);
}

function toonBezig(t) {
  const el = document.createElement("div");
  el.className = "bezig";
  el.innerHTML = `<div class="doos"><div class="titel" style="font-size:18px">PROJECT 37</div>
    <p class="subkop" style="margin-top:12px">${esc(t)}</p><div class="balk"><i></i></div></div>`;
  document.body.append(el);
  return {
    stap(t2, deel) { $(".subkop", el).textContent = t2; $(".balk i", el).style.width = `${Math.round(deel * 100)}%`; },
    weg() { el.remove(); },
  };
}

// ------------------------------------------------------------
// Routes:  #/                       games
//          #/g/<game>/<tab>          lijst (autos, circuits, lbs)
//          #/g/<game>/<tab>/<id>     met iets geopend
// ------------------------------------------------------------
function route() {
  const delen = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  if (delen[0] === "g" && delen[1]) {
    const tab = ["autos", "circuits", "lbs"].includes(delen[2]) ? delen[2] : "autos";
    return { scherm: "game", game: delen[1], tab, id: delen[3] || null };
  }
  if (delen[0] === "controle") return { scherm: "controle" };
  return { scherm: "home" };
}
const pad = (...d) => "#/" + d.map((x) => encodeURIComponent(String(x))).join("/");
const breed = () => window.matchMedia("(min-width: 900px)").matches;

function ga(hash, vervangen = false) {
  if (vervangen) { history.replaceState(null, "", hash); teken(); }
  else location.hash = hash;
}

// ------------------------------------------------------------
// Tekenen
// ------------------------------------------------------------
const app = $("#app");

function teken() {
  const r = route();
  document.body.style.overflow = "";
  if (r.scherm === "controle") return tekenControle();
  if (!staat.data) return tekenWelkom();
  if (r.scherm === "game" && game(r.game)) return tekenGame(r);
  return tekenHome();
}

function kop(titel, sub, links = "", rechts = "") {
  return `<header class="kop">
    <div>${links}</div>
    <div><h1 class="titel">${esc(titel)}</h1>${sub ? `<p class="subkop">${esc(sub)}</p>` : ""}</div>
    <div>${rechts}</div>
  </header>`;
}

function tekenWelkom() {
  app.innerHTML = `${kop("Project 37", "Companion")}
  <main><div class="welkom">
    <img src="icons/icon-512.png" alt="">
    <p>Hier bekijk je je auto's, circuits en leaderboards van Project 37, ook zonder internet.</p>
    <ol>
      <li>Open Project 37 op je pc.</li>
      <li>Ga naar <b>Instellingen › Gegevens › Exporteer voor mobiel</b> en zet de zip bijvoorbeeld in Google Drive.</li>
      <li>Tik hieronder op <b>Gegevens laden</b> en kies die zip.</li>
    </ol>
    <p style="margin-top:22px"><button class="knop neon" data-actie="laden">${ICOON.laden} Gegevens laden</button></p>
    ${installKnop()}
    <p class="voet">Je gegevens blijven op dit apparaat en gaan nergens naartoe.<br>Companion ${COMPANION_VERSIE} · <a class="link" href="#/controle">Installatie controleren</a></p>
  </div></main>`;
}

// Per apparaat onthouden (los van de pc-app)
function bewaard(key, standaard) {
  try { const v = localStorage.getItem(key); return v === null ? standaard : JSON.parse(v); }
  catch (e) { return standaard; }
}
function bewaar(key, waarde) {
  try { localStorage.setItem(key, JSON.stringify(waarde)); } catch (e) { /* geen opslag: niet erg */ }
}
function onthoudGame(id) {
  const lijst = bewaard("p37_recent", []).filter((x) => x !== String(id));
  lijst.unshift(String(id));
  bewaar("p37_recent", lijst.slice(0, 50));
}
function gesorteerdeGames(games) {
  const lijst = [...games];
  if (bewaard("p37_volgorde", "recent") === "az") {
    return lijst.sort((a, b) => (a.naam || "").localeCompare(b.naam || "", "nl", { numeric: true }));
  }
  const recent = bewaard("p37_recent", []);
  const plek = (g) => { const i = recent.indexOf(String(g.id)); return i < 0 ? 1e6 : i; };
  return lijst.sort((a, b) => plek(a) - plek(b));   // nooit geopend: volgorde van de export
}

function tekenHome() {
  const d = staat.data;
  const volgorde = bewaard("p37_volgorde", "recent");
  const tegels = gesorteerdeGames(d.games).map((g) => `
    <button class="tegel" data-ga="${esc(pad("g", g.id, "autos"))}">
      ${g.plaatje ? `<div style="width:100%;height:100%" data-img="${esc(g.plaatje)}"></div>` : `<div class="leeg">${f2004SVG()}</div>`}
      <div class="onder"><div class="naam">${esc(g.naam)}</div>
      <div class="tel">${meervoud(g.autos.length, "auto", "auto's")} · ${meervoud(g.circuits.length, "circuit", "circuits")} · ${meervoud(g.leaderboards.length, "leaderboard", "leaderboards")}</div></div>
    </button>`).join("");
  app.innerHTML = `${kop("Project 37", "")}
  <main>
    ${d.games.length > 1 ? `<div class="schakel" role="group" aria-label="Volgorde">
      <button class="${volgorde === "recent" ? "aan" : ""}" data-volgorde="recent">Laatst gebruikt</button>
      <button class="${volgorde === "az" ? "aan" : ""}" data-volgorde="az">A-Z</button>
    </div>` : ""}
    ${d.games.length ? `<div class="tegels">${tegels}</div>` : `<div class="leegtekst">Er staan nog geen games in je gegevens.</div>`}
    <div class="exportregel onderaan">
      <span>Gegevens van ${esc(datumTekst(d.gemaakt))}${d.app_versie ? ` · Project 37 ${esc(d.app_versie)}` : ""}</span>
      <button class="knop" data-actie="laden">${ICOON.laden} Gegevens bijwerken</button>
    </div>
    ${installKnop()}
    <p class="voet">Companion ${COMPANION_VERSIE} · alleen bekijken · je gegevens blijven op dit apparaat<br><a class="link" href="#/controle">Installatie controleren</a></p>
  </main>`;
  activeerPlaatjes(app);
  window.scrollTo(0, staat.scroll.home || 0);
}

// ---------- Filters ----------
function filters(g, tab) {
  const key = `${g.id}|${tab}`;
  if (!staat.filters[key]) {
    staat.filters[key] = { zoek: "", klasse: new Set(), categorie: new Set(), land: new Set(), bezit: "alle", fav: false, status: "actief" };
  }
  return staat.filters[key];
}

function aantalFilters(f, tab) {
  if (tab === "lbs") return f.status !== "actief" ? 1 : 0;
  return f.klasse.size + f.categorie.size + f.land.size + (f.bezit !== "alle") + (f.fav ? 1 : 0);
}

function gefilterd(g, tab) {
  const f = filters(g, tab);
  const z = norm(f.zoek).split(/\s+/).filter(Boolean);
  const pastZoek = (s) => z.every((w) => s.includes(w));
  if (tab === "autos") {
    return g.autos.filter((a) =>
      pastZoek(a._zoek) &&
      (!f.klasse.size || f.klasse.has(tekst(a.klasse))) &&
      (!f.categorie.size || f.categorie.has(tekst(a.categorie))) &&
      (f.bezit === "alle" || (f.bezit === "ja") === bezit(a)) &&
      (!f.fav || a.favoriet));
  }
  if (tab === "circuits") {
    return g.circuits.filter((c) =>
      pastZoek(c._zoek) &&
      (!f.land.size || f.land.has(tekst(c.land))) &&
      (!f.categorie.size || f.categorie.has(tekst(c.categorie))) &&
      (f.bezit === "alle" || (f.bezit === "ja") === bezit(c)) &&
      (!f.fav || c.favoriet));
  }
  return g.leaderboards.filter((lb) =>
    pastZoek(lb._zoek) &&
    (f.status === "alle" || (f.status === "archief") === !!lb.gearchiveerd))
    .sort(LB_VOLGORDE === "az"
      ? (a, b) => tekst(a.naam).localeCompare(tekst(b.naam), "nl", { numeric: true, sensitivity: "base" })
      : (a, b) => (b._laatst || 0) - (a._laatst || 0));
}

function waarden(lijst, veld) {
  return [...new Set(lijst.map((x) => tekst(x[veld])).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "nl", { numeric: true }));
}

function openFilters(g, tab) {
  const f = filters(g, tab);
  const items = tab === "autos" ? g.autos : g.circuits;
  const chipGroep = (naam, veld, set) => {
    const w = waarden(items, veld);
    if (!w.length) return "";
    return `<div class="groep"><div class="gnaam">${naam}</div><div class="chips">${
      w.map((v) => `<button class="chip ${set.has(v) ? "aan" : ""}" data-set="${veld}" data-v="${esc(v)}">${esc(v)}</button>`).join("")
    }</div></div>`;
  };
  const keuze = (naam, veld, opties) => `<div class="groep"><div class="gnaam">${naam}</div><div class="chips">${
    opties.map(([v, t]) => `<button class="chip ${f[veld] === v ? "aan" : ""}" data-keuze="${veld}" data-v="${v}">${t}</button>`).join("")
  }</div></div>`;

  let inhoud;
  if (tab === "lbs") {
    inhoud = keuze("Leaderboards", "status", [["actief", "Actief"], ["archief", "Archief"], ["alle", "Alle"]]);
  } else {
    inhoud = (tab === "autos" ? chipGroep("Klasse", "klasse", f.klasse) : chipGroep("Land", "land", f.land)) +
      chipGroep("Categorie", "categorie", f.categorie) +
      keuze("Bezit", "bezit", [["alle", "Alle"], ["ja", "In bezit"], ["nee", "Niet in bezit"]]) +
      `<div class="groep"><div class="chips"><button class="chip ${f.fav ? "aan" : ""}" data-fav>${ICOON.hart} Alleen favorieten</button></div></div>`;
  }

  const root = $("#sheet-root");
  root.innerHTML = `<div class="sluier"><div class="venster" role="dialog" aria-label="Filters">
    <h3>FILTERS</h3>${inhoud}
    <div class="acties"><button class="knop" data-wis>Alles wissen</button><button class="knop neon" data-sluit>Klaar</button></div>
  </div></div>`;
  document.body.style.overflow = "hidden";

  const sluit = () => { root.innerHTML = ""; document.body.style.overflow = ""; tekenLijstDeel(g, tab); };
  root.onclick = (e) => {
    const el = e.target.closest("button");
    if (!el) { if (e.target.classList.contains("sluier")) sluit(); return; }
    if (el.dataset.set) {
      const set = f[el.dataset.set]; const v = el.dataset.v;
      set.has(v) ? set.delete(v) : set.add(v);
      el.classList.toggle("aan");
    } else if (el.dataset.keuze) {
      f[el.dataset.keuze] = el.dataset.v;
      el.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.toggle("aan", c === el));
    } else if ("fav" in el.dataset) {
      f.fav = !f.fav; el.classList.toggle("aan");
    } else if ("wis" in el.dataset) {
      f.klasse.clear(); f.categorie.clear(); f.land.clear(); f.bezit = "alle"; f.fav = false; f.status = "actief";
      sluit();
    } else if ("sluit" in el.dataset) sluit();
  };
}

// ---------- Game-scherm ----------
function tekenGame(r) {
  const g = game(r.game);
  onthoudGame(g.id);
  const tabs = [["autos", "Auto's", g.autos.length], ["circuits", "Circuits", g.circuits.length], ["lbs", "Leaderboards", g.leaderboards.length]];
  const f = filters(g, r.tab);
  const zoekHint = { autos: "Zoek op auto, klasse of jaar…", circuits: "Zoek op circuit, layout of land…", lbs: "Zoek op leaderboard of circuit…" }[r.tab];

  // Telefoon met iets geopend: alleen het detail laten zien
  if (r.id && !breed()) {
    app.innerHTML = `<div class="detailscherm">${kop(g.naam, "", `<button class="icoonknop" data-terug aria-label="Terug">${ICOON.terug}</button>`)}
      <main><div class="paneel">${detailHTML(g, r.tab, r.id)}</div></main></div>`;
    activeerPlaatjes(app);
    $(".detailscherm").scrollTop = 0;
    if (staat.schuif) { $(".detailscherm .detail").classList.add("schuif-" + staat.schuif); staat.schuif = null; }
    return;
  }

  app.innerHTML = `${kop(g.naam, "", `<button class="icoonknop" data-ga="#/" aria-label="Terug naar games">${ICOON.terug}</button>`)}
  <main>
    <nav class="tabs">${tabs.map(([k, t, n]) =>
      `<button class="tab ${k === r.tab ? "actief" : ""}" data-tab="${k}">${t}<span class="n">${n}</span></button>`).join("")}</nav>
    <div class="werk">
      <div class="lijstkant">
        <div class="zoekbalk">
          <input class="zoek" type="search" placeholder="${zoekHint}" value="${esc(f.zoek)}" enterkeyhint="search" aria-label="Zoeken">
          <button class="icoonknop" data-filters aria-label="Filters">${ICOON.filter}<span class="badge" hidden></span></button>
        </div>
        <div class="aantal"></div>
        <div class="paneel lijst"></div>
      </div>
      <div class="detailkant paneel">${r.id ? detailHTML(g, r.tab, r.id) : `<div class="detail-leeg">${
        { autos: "Tik op een auto om het plaatje en de info te zien.", circuits: "Tik op een circuit om de plattegrond en de info te zien.", lbs: "Tik op een leaderboard om de tijden te zien." }[r.tab]}</div>`}</div>
    </div>
  </main>`;
  if (!breed()) $(".detailkant").hidden = true;

  const zoek = $(".zoek");
  zoek.addEventListener("input", () => { f.zoek = zoek.value; tekenLijstDeel(g, r.tab); });
  tekenLijstDeel(g, r.tab);
  activeerPlaatjes($(".detailkant"));
  if (staat.schuif) {
    (r.id ? $(".detailkant .detail") || $(".lijstkant") : $(".lijstkant")).classList.add("schuif-" + staat.schuif);
    staat.schuif = null;
  }
  const key = `${g.id}|${r.tab}`;
  if (!r.id || breed()) window.scrollTo(0, staat.scroll[key] || 0);
  if (staat.volgLijst) {
    staat.volgLijst = false;
    const rij = $(".rij.gekozen");
    if (rij) {
      const box = rij.getBoundingClientRect();
      const kop = $(".kop").getBoundingClientRect().bottom;
      if (box.top < kop + 20 || box.bottom > window.innerHeight - 40) rij.scrollIntoView({ block: "center" });
    }
  }
}

function tekenLijstDeel(g, tab) {
  const r = route();
  const f = filters(g, tab);
  const lijst = gefilterd(g, tab);
  const totaal = tab === "autos" ? g.autos.length : tab === "circuits" ? g.circuits.length : g.leaderboards.length;
  const n = aantalFilters(f, tab);
  const badge = $(".badge"); badge.hidden = !n; badge.textContent = n;
  $("[data-filters]").classList.toggle("aan", n > 0);
  const soort = { autos: ["auto", "auto's"], circuits: ["circuit", "circuits"], lbs: ["leaderboard", "leaderboards"] }[tab];
  $(".aantal").textContent = lijst.length === totaal
    ? meervoud(totaal, ...soort)
    : `${lijst.length} van ${meervoud(totaal, ...soort)}`;

  const el = $(".lijst");
  if (!lijst.length) {
    el.innerHTML = `<div class="leegtekst">${totaal ? "Niets gevonden met deze zoekopdracht of filters." : `Nog geen ${soort[1]} in deze game.`}</div>`;
    return;
  }
  const gekozen = String(r.id || "");
  if (tab === "autos") el.innerHTML = lijst.map((a) => autoRij(g, a, gekozen)).join("");
  else if (tab === "circuits") el.innerHTML = lijst.map((c) => circuitRij(g, c, gekozen)).join("");
  else el.innerHTML = lijst.map((lb) => lbRij(g, lb, gekozen)).join("");
  activeerPlaatjes(el);
}

// Zonder plaatje: neon-lijntekening (auto = F2004, circuit = Zandvoort)
function plaatsvervanger(soort) {
  return soort === "circuit" ? zandvoortSVG() : f2004SVG();
}

function duim(plaatje, soort) {
  const cls = soort === "circuit" ? "duim circuit" : "duim";
  return plaatje ? `<div class="${cls}" data-img="${esc(plaatje)}"></div>` : `<div class="${cls} leeg">${plaatsvervanger(soort)}</div>`;
}

function autoSub(a) {
  return [a.klasse, a.categorie, tekst(a.jaartal)].filter(Boolean).join(" · ");
}
function circuitSub(c) {
  return [c.land, lengteTekst(c.lengte), tekst(c.jaartal), c.categorie].filter(Boolean).join(" · ");
}

function autoRij(g, a, gekozen) {
  return `<button class="rij ${bezit(a) ? "" : "niet-bezit"} ${String(a.id) === gekozen ? "gekozen" : ""}" data-ga="${esc(pad("g", g.id, "autos", a.id))}">
    ${duim(a.plaatje, "auto")}
    <div><div class="naam">${esc(a.naam)}</div><div class="sub">${esc(autoSub(a))}</div></div>
    <div class="rechts">${a.mod ? '<span class="label">MOD</span>' : ""}${bezit(a) ? "" : '<span class="label">NIET IN BEZIT</span>'}${a.favoriet ? ICOON.hart : ""}</div>
  </button>`;
}

function circuitRij(g, c, gekozen) {
  return `<button class="rij ${bezit(c) ? "" : "niet-bezit"} ${String(c.id) === gekozen ? "gekozen" : ""}" data-ga="${esc(pad("g", g.id, "circuits", c.id))}">
    ${duim(c.plaatje, "circuit")}
    <div><div class="naam">${esc(circuitTitel(c.circuit, c.layout))}</div><div class="sub">${esc(circuitSub(c))}</div></div>
    <div class="rechts">${c.mod ? '<span class="label">MOD</span>' : ""}${bezit(c) ? "" : '<span class="label">NIET IN BEZIT</span>'}${c.favoriet ? ICOON.hart : ""}</div>
  </button>`;
}

function lbCircuit(g, lb) {
  const c = lb.circuit_id != null ? g._circuitOpId.get(String(lb.circuit_id)) : null;
  return { circuit: c, titel: c ? circuitTitel(c.circuit, c.layout) : circuitTitel(lb.circuit, lb.layout) };
}

function periode(lb) {
  const van = lb.bouwjaar_van, tot = lb.bouwjaar_tot;
  if (van && tot) return van === tot ? `Bouwjaar ${van}` : `Bouwjaar ${van}–${tot}`;
  if (van) return `Bouwjaar vanaf ${van}`;
  if (tot) return `Bouwjaar t/m ${tot}`;
  return "";
}

function voortgangHTML(lb) {
  const v = lb.voortgang;
  if (!v || !v.totaal) return "";
  const deel = Math.min(1, v.gereden / v.totaal);
  return `<div class="voortgang" title="${v.gereden} van ${v.totaal}"><i style="width:${(deel * 100).toFixed(1)}%"></i></div>`;
}

function lbRij(g, lb, gekozen) {
  const { titel } = lbCircuit(g, lb);
  const v = lb.voortgang || {};
  const sub = [titel, (lb.categories || []).join(", "), periode(lb)].filter(Boolean).join(" · ");
  return `<button class="rij ${String(lb.id) === gekozen ? "gekozen" : ""}" data-ga="${esc(pad("g", g.id, "lbs", lb.id))}" style="grid-template-columns:1fr auto">
    <div><div class="naam">${esc(lb.naam)} ${lb.soort === "qualy" ? '<span class="label accent">QUALY</span>' : ""} ${lb.gearchiveerd ? '<span class="label">ARCHIEF</span>' : ""}</div>
      <div class="sub">${esc(sub)}</div>${voortgangHTML(lb)}</div>
    <div class="rechts" style="flex-direction:column;align-items:flex-end;gap:2px">
      <span>${meervoud(lb.tijden.filter((t) => t.positie).length, "tijd", "tijden")}</span>
      ${v.totaal ? `<span>${v.gereden} van ${v.totaal}</span>` : ""}
    </div>
  </button>`;
}

// ---------- Details ----------
function detailHTML(g, tab, id) {
  if (tab === "autos") {
    const a = g._autoOpId.get(String(id));
    return a ? autoDetail(g, a) : `<div class="leegtekst">Deze auto staat niet (meer) in je gegevens.</div>`;
  }
  if (tab === "circuits") {
    const c = g._circuitOpId.get(String(id));
    return c ? circuitDetail(g, c) : `<div class="leegtekst">Dit circuit staat niet (meer) in je gegevens.</div>`;
  }
  const lb = g._lbOpId.get(String(id));
  return lb ? lbDetail(g, lb) : `<div class="leegtekst">Dit leaderboard staat niet (meer) in je gegevens.</div>`;
}

function grootPlaatje(plaatje, soort) {
  const cls = soort === "circuit" ? "groot circuit" : "groot";
  return plaatje ? `<div class="${cls}" data-img="${esc(plaatje)}"></div>` : `<div class="${cls} leeg">${plaatsvervanger(soort)}</div>`;
}

function autoDetail(g, a) {
  const sub = [a.klasse, a.categorie, tekst(a.jaartal), bezit(a) ? "In bezit" : "Niet in bezit", a.mod ? "Mod" : ""].filter(Boolean).join("  ·  ");
  const rijen = AUTO_INFO.filter(([k]) => tekst(a[k])).map(([k, t]) => `<dt>${t}</dt><dd>${esc(a[k])}</dd>`).join("");
  // Tijden van deze auto op leaderboards
  const naam = norm(a.naam);
  const tijden = [];
  for (const lb of g.leaderboards) {
    for (const t of lb.tijden) {
      if ((t.auto_id != null && String(t.auto_id) === String(a.id)) || (t.auto_id == null && norm(t.auto) === naam)) {
        tijden.push([lb, t]);
      }
    }
  }
  tijden.sort((x, y) => (x[1].positie || 9999) - (y[1].positie || 9999));
  return `<div class="detail">
    ${grootPlaatje(a.plaatje, "auto")}
    <h2>${esc(a.naam)} ${a.favoriet ? ICOON.hart : ""}</h2>
    <div class="sub">${esc(sub)}</div>
    ${rijen ? `<dl class="gegevens">${rijen}</dl>` : `<p class="sub" style="margin-top:14px">Nog geen extra info voor deze auto.</p>`}
    ${tijden.length ? `<div class="kopje">Op leaderboards</div>${tijden.map(([lb, t]) => `
      <button class="koppeling" data-ga="${esc(pad("g", g.id, "lbs", lb.id))}">
        <span>${esc(lb.naam)}${lb.gearchiveerd ? ' <span class="label">ARCHIEF</span>' : ""}</span>
        <span class="r">${t.positie ? `P${t.positie} · ` : ""}${esc(t.tijd || "")}</span>
      </button>`).join("")}` : ""}
  </div>`;
}

function circuitDetail(g, c) {
  const rijen = [["Land", c.land], ["Lengte", lengteTekst(c.lengte)], ["Jaartal", tekst(c.jaartal)], ["Categorie", c.categorie],
    ["In bezit", bezit(c) ? "Ja" : "Nee"], ["Mod", c.mod ? "Ja" : ""]]
    .filter(([, v]) => tekst(v)).map(([t, v]) => `<dt>${t}</dt><dd>${esc(v)}</dd>`).join("");
  const lbs = g.leaderboards.filter((lb) => lb.circuit_id != null && String(lb.circuit_id) === String(c.id));
  return `<div class="detail">
    ${grootPlaatje(c.plaatje, "circuit")}
    <h2>${esc(circuitTitel(c.circuit, c.layout))} ${c.favoriet ? ICOON.hart : ""}</h2>
    <dl class="gegevens">${rijen}</dl>
    ${lbs.length ? `<div class="kopje">Leaderboards op dit circuit</div>${lbs.map((lb) => `
      <button class="koppeling" data-ga="${esc(pad("g", g.id, "lbs", lb.id))}">
        <span>${esc(lb.naam)}${lb.gearchiveerd ? ' <span class="label">ARCHIEF</span>' : ""}</span>
        <span class="r">${meervoud(lb.tijden.filter((t) => t.positie).length, "tijd", "tijden")}</span>
      </button>`).join("")}` : ""}
  </div>`;
}

function snelheid(lengteKm, gemMs, eenheid) {
  const km = parseFloat(String(lengteKm ?? "").replace(",", "."));
  if (!km || !gemMs) return null;
  const kmu = km / (gemMs / 3600000);
  return eenheid === "kmh" ? kmu : kmu / KM_PER_MIJL;
}

function lbDetail(g, lb) {
  const { circuit, titel } = lbCircuit(g, lb);
  const qualy = lb.soort === "qualy";
  const eenheid = lb.eenheid === "kmh" ? "kmh" : "mph";
  const eenheidTekst = eenheid === "kmh" ? "km/u" : "mph";
  const grid = qualy ? (lb.grid === 0 ? 0 : parseInt(lb.grid ?? 33, 10) || 0) : 0;
  const geldig = lb.tijden.filter((t) => t.positie);
  const ongeldig = lb.tijden.filter((t) => !t.positie);
  const beste = geldig.length ? geldig[0].ms : null;
  const lengte = circuit ? circuit.lengte : null;
  const v = lb.voortgang || {};

  const labels = [
    titel ? `<button class="label link" data-ga="${circuit ? esc(pad("g", g.id, "circuits", circuit.id)) : ""}" ${circuit ? "" : "disabled"}>${esc(titel)}</button>` : "",
    (lb.categories || []).length ? `<span class="label">${esc(lb.categories.join(", "))}</span>` : "",
    periode(lb) ? `<span class="label">${esc(periode(lb))}</span>` : "",
    lb.zonder_mods ? `<span class="label">Zonder mods</span>` : "",
    qualy ? `<span class="label accent">Qualy · ${esc(lb.rondes || 4)} rondes${grid ? ` · grid van ${grid}` : ""}</span>` : "",
    lb.gearchiveerd ? `<span class="label">Archief</span>` : "",
  ].filter(Boolean).join("");

  const rij = (t) => {
    const pos = t.positie;
    let status = "";
    if (qualy && pos) status = grid && pos > grid ? "GEBUMPT" : pos === 1 ? "★ POLE" : pos <= 6 ? "FAST SIX" : "";
    let rechtsOnder = "";
    if (pos && beste != null) {
      if (qualy) {
        const s = snelheid(lengte, t.ms, eenheid);
        const s1 = snelheid(lengte, beste, eenheid);
        if (s) rechtsOnder = pos === 1 ? `${s.toFixed(3).replace(".", ",")} ${eenheidTekst}` :
          `${s.toFixed(3).replace(".", ",")} ${eenheidTekst} · −${(s1 - s).toFixed(3).replace(".", ",")}`;
      } else if (pos > 1) {
        rechtsOnder = verschilTekst(t.ms - beste);
      }
    }
    const auto = t.auto_id != null ? g._autoOpId.get(String(t.auto_id)) : g._autoOpNaam.get(norm(t.auto));
    const sub = [status, t.klasse, datumTekst(t.datum, false)].filter(Boolean).join("  ·  ");
    const cls = ["lb-rij", pos === 1 ? "eerste" : "", qualy && grid && pos > grid ? "gebumpt" : ""].join(" ");
    const doel = auto ? `data-ga="${esc(pad("g", g.id, "autos", auto.id))}"` : "";
    return `<${auto ? "button" : "div"} class="${cls}" ${doel}>
      <div class="pos">${pos || "–"}</div>
      <div><div class="auto">${esc(t.auto)}</div><div class="sub">${esc(sub)}</div></div>
      <div><div class="tijd">${esc(t.tijd || "")}</div><div class="delta">${esc(rechtsOnder || (pos ? "" : "ongeldig"))}</div></div>
      ${Array.isArray(t.rondes) && t.rondes.length ? `<div class="rondes">Rondes: ${t.rondes.map(esc).join("  ")}</div>` : ""}
      ${tekst(t.opmerking) ? `<div class="opm">“${esc(t.opmerking)}”</div>` : ""}
    </${auto ? "button" : "div"}>`;
  };

  return `<div class="detail">
    <h2 style="margin-top:0">${esc(lb.naam)}</h2>
    <div class="lb-info">${labels}</div>
    ${v.totaal ? `<div class="sub" style="margin-top:12px">${v.gereden} van ${v.totaal} auto's gereden${v.gereden >= v.totaal ? " · compleet!" : ""}</div>${voortgangHTML(lb)}` : ""}
    ${lb.last_update ? `<div class="sub" style="margin-top:8px">Bijgewerkt ${esc(datumTekst(lb.last_update))}</div>` : ""}
    <div class="lb-tabel">
      ${geldig.length || ongeldig.length ? geldig.map(rij).join("") + ongeldig.map(rij).join("") : `<div class="leegtekst">Nog geen tijden op dit leaderboard.</div>`}
    </div>
  </div>`;
}

// ------------------------------------------------------------
// Klikken
// ------------------------------------------------------------
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-ga],[data-actie],[data-tab],[data-terug],[data-filters],[data-volgorde]");
  if (!el || el.closest("#sheet-root")) return;
  const r = route();
  if (el.dataset.ga) {
    if (r.scherm === "home") staat.scroll.home = window.scrollY;
    if (r.scherm === "game" && !r.id) staat.scroll[`${r.game}|${r.tab}`] = window.scrollY;
    // Op een tablet: een andere auto kiezen vervangt de vorige (geen
    // lange rij om terug door te bladeren)
    const zelfdeLijst = r.scherm === "game" && breed() && r.id && el.closest(".lijst");
    ga(el.dataset.ga, !!zelfdeLijst);
  } else if (el.dataset.volgorde) {
    bewaar("p37_volgorde", el.dataset.volgorde);
    staat.scroll.home = 0;
    teken();
  } else if (el.dataset.actie === "installeer") {
    installeer();
  } else if (el.dataset.actie === "laden") {
    kiesExport();
  } else if (el.dataset.tab) {
    staat.scroll[`${r.game}|${r.tab}`] = window.scrollY;
    ga(pad("g", r.game, el.dataset.tab), true);
  } else if ("terug" in el.dataset) {
    history.length > 1 ? history.back() : ga(pad("g", r.game, r.tab), true);
  } else if ("filters" in el.dataset) {
    openFilters(game(r.game), r.tab);
  }
});

$("#file").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) leesExport(f);
});

window.addEventListener("hashchange", () => { $("#sheet-root").innerHTML = ""; teken(); });

// Van telefoon- naar tabletweergave (draaien, scherm splitsen): opnieuw tekenen
let breedNu = breed();
window.addEventListener("resize", () => {
  schaal();
  if (breed() !== breedNu) { breedNu = breed(); teken(); }
});


// ------------------------------------------------------------
// Swipen tussen de tabbladen (Auto's, Circuits, Leaderboards)
// ------------------------------------------------------------
const TABS = ["autos", "circuits", "lbs"];
let veeg = null;
document.addEventListener("touchstart", (e) => {
  veeg = null;
  const r = route();
  if (r.scherm !== "game" || e.touches.length !== 1) return;
  if (e.target.closest(".kop, input, .sluier, #sheet-root")) return;
  // In het detail (los scherm op de telefoon, rechterkant op de tablet):
  // naar de vorige of volgende uit de lijst
  const inDetail = r.id && (!breed() || e.target.closest(".detailkant"));
  if (!inDetail && e.target.closest(".detailkant")) return;
  const t = e.touches[0];
  const rand = 28;   // vlak bij de rand = het terug-gebaar van Android
  if (t.clientX < rand || t.clientX > window.innerWidth - rand) return;
  veeg = { x: t.clientX, y: t.clientY, tijd: Date.now(), detail: !!inDetail };
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!veeg) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - veeg.x, dy = t.clientY - veeg.y;
  const snel = Date.now() - veeg.tijd < 700;
  const detail = veeg.detail;
  if (!snel || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) { veeg = null; return; }
  veeg = null;
  const r = route();
  if (detail) {
    const g = game(r.game);
    const lijst = gefilterd(g, r.tab);
    const i = lijst.findIndex((x) => String(x.id) === String(r.id)) + (dx < 0 ? 1 : -1);
    if (i < 0 || i >= lijst.length) { melding(dx < 0 ? "Dit is de laatste" : "Dit is de eerste"); return; }
    staat.schuif = dx < 0 ? "links" : "rechts";
    staat.scroll[`${r.game}|${r.tab}`] = window.scrollY;
    staat.volgLijst = true;   // tablet: de lijst links meeschuiven
    ga(pad("g", r.game, r.tab, lijst[i].id), true);
    return;
  }
  const i = TABS.indexOf(r.tab) + (dx < 0 ? 1 : -1);
  if (i < 0 || i >= TABS.length) return;
  staat.scroll[`${r.game}|${r.tab}`] = window.scrollY;
  staat.schuif = dx < 0 ? "links" : "rechts";
  ga(pad("g", r.game, TABS[i]), true);
}, { passive: true });

// ------------------------------------------------------------
// Installeren + controle
// ------------------------------------------------------------
let installVraag = null;      // het installeer-aanbod van de browser
let installGezien = false;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installVraag = e;
  installGezien = true;
  const r = route();
  if (r.scherm !== "game") teken();
});
window.addEventListener("appinstalled", () => {
  installVraag = null;
  melding("Project 37 is geïnstalleerd");
  teken();
});

const alsApp = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function installKnop() {
  if (!installVraag || alsApp()) return "";
  return `<p style="margin-top:14px;text-align:center"><button class="knop" data-actie="installeer">${ICOON.laden} App installeren</button></p>`;
}

async function installeer() {
  if (!installVraag) return;
  installVraag.prompt();
  const keuze = await installVraag.userChoice.catch(() => null);
  if (keuze && keuze.outcome === "accepted") installVraag = null;
  teken();
}

async function controleer() {
  const uit = [];
  const zet = (ok, naam, info = "") => uit.push({ ok, naam, info });
  zet(window.isSecureContext, "Beveiligde verbinding (https)", location.origin);
  zet(alsApp() ? true : null, "Geopend als app", alsApp() ? "ja" : "nee, in de browser");
  zet(installGezien ? true : null, "Browser biedt installeren aan", installGezien ? "ja" : "nog niet (nee)");

  const link = document.querySelector('link[rel="manifest"]');
  let manifest = null;
  try {
    const res = await fetch(link.href, { cache: "no-store" });
    const type = res.headers.get("content-type") || "?";
    const txt = await res.text();
    zet(res.ok, "App-paspoort (manifest) bereikbaar", `${res.status} · ${type}`);
    try { manifest = JSON.parse(txt); zet(true, "App-paspoort leesbaar", `naam: ${manifest.name || "?"}`); }
    catch (e) { zet(false, "App-paspoort leesbaar", "geen geldige JSON: " + txt.slice(0, 60)); }
  } catch (e) {
    zet(false, "App-paspoort (manifest) bereikbaar", String(e));
  }
  if (manifest) {
    zet(!!manifest.start_url && ["standalone", "fullscreen", "minimal-ui"].includes(manifest.display),
      "Start en weergave", `${manifest.start_url} · ${manifest.display}`);
    for (const icon of manifest.icons || []) {
      const url = new URL(icon.src, link.href).href;
      const maat = await new Promise((ok) => {
        const img = new Image();
        img.onload = () => ok(`${img.naturalWidth}x${img.naturalHeight}`);
        img.onerror = () => ok(null);
        img.src = url + (url.includes("?") ? "&" : "?") + "c=" + Date.now();
      });
      zet(!!maat, `Logo ${icon.sizes} (${icon.purpose || "any"})`, maat ? `geladen, ${maat}` : `niet te laden: ${icon.src}`);
    }
  }
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
    zet(!!reg, "Offline-hulp (service worker) aangemeld", reg ? (reg.active ? "actief" : "wordt gestart") : "nee");
    zet(!!navigator.serviceWorker.controller ? true : null, "Offline-hulp regelt deze pagina", navigator.serviceWorker.controller ? "ja" : "nog niet (pagina een keer verversen)");
  } else {
    zet(false, "Offline-hulp (service worker)", "niet ondersteund");
  }
  zet(null, "Browser", navigator.userAgent);
  return uit;
}

async function tekenControle() {
  app.innerHTML = `${kop("Controle", "Installatie", `<button class="icoonknop" data-ga="#/" aria-label="Terug">${ICOON.terug}</button>`)}
    <main><div class="paneel detail" id="controle"><p class="sub">Bezig met controleren…</p></div></main>`;
  const uit = await controleer();
  const teken1 = (x) => x.ok === true ? '<b style="color:#4ADE80">✓</b>' : x.ok === false ? '<b style="color:var(--fout)">✗</b>' : '<b style="color:var(--tekst-zacht)">•</b>';
  const tekstVoorKopie = uit.map((x) => `${x.ok === true ? "OK" : x.ok === false ? "FOUT" : "--"}  ${x.naam}: ${x.info}`).join("\n");
  $("#controle").innerHTML = `
    <p class="sub">Maak hier een screenshot van en stuur die naar Claude.</p>
    <dl class="gegevens" style="grid-template-columns:auto 1fr;gap:10px 12px">
      ${uit.map((x) => `<dt>${teken1(x)}</dt><dd><div>${esc(x.naam)}</div><div class="sub" style="font-weight:400;overflow-wrap:anywhere">${esc(x.info)}</div></dd>`).join("")}
    </dl>
    ${installKnop()}
    <p style="text-align:center;margin-top:16px"><button class="knop" id="kopieer">Kopiëren als tekst</button></p>`;
  $("#kopieer").onclick = () => {
    (navigator.clipboard ? navigator.clipboard.writeText(tekstVoorKopie) : Promise.reject())
      .then(() => melding("Gekopieerd"), () => melding("Kopiëren lukte niet, maak een screenshot", true));
  };
}

// ------------------------------------------------------------
// Starten
// ------------------------------------------------------------
(async function start() {
  schaal();
  try {
    const data = await Opslag.get("kv", "data");
    if (data && data.formaat === FORMAAT) {
      staat.data = bereidVoor(data);
      zetThema(data.thema);
    }
  } catch (err) {
    console.error(err);
    melding("De opgeslagen gegevens konden niet gelezen worden. Laad ze opnieuw.", true);
  }
  teken();
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
