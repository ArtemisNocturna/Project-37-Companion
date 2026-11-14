/* ============================================================
   STATISTIEKEN
   ============================================================
   Dezelfde berekeningen en kaarten als het statistieken-scherm
   van de pc-app (logic/stats.py + ui_qt/stats_screen.py):
     - per game:        tabblad "Stats"
     - per leaderboard: knop "Statistieken" bij een leaderboard
   Tik op een kaart, balk of donut-deel voor de details.
   Gebruikt de hulpjes uit app.js (esc, norm, tijdTekst, ...).
   ============================================================ */
"use strict";

const ST_WEINIG = 3;     // klassen met minder gereden auto's krijgen een *
const ST_WEKEN = 12;     // activiteit: zoveel weken terug
const ST_EXTRA_KLEUREN = ["#22D3EE", "#F472B6", "#FACC15", "#34D399", "#FB923C", "#818CF8", "#F87171", "#A3E635"];
const ST_GAPS = [
  [1000, "binnen 1 s"], [2000, "1 – 2 s"], [5000, "2 – 5 s"],
  [10000, "5 – 10 s"], [20000, "10 – 20 s"], [null, "meer dan 20 s"],
];
const ST_WEINIG_NOOT = `* Gebaseerd op minder dan ${ST_WEINIG} auto's in die klasse, dus minder betrouwbaar.`;

// ------------------------------------------------------------
// Rekenhulpjes
// ------------------------------------------------------------
function stKm(lengte) {
  const n = parseFloat(String(lengte ?? "").replace(",", "."));
  return n > 0 ? n : null;
}
function stKmh(km, ms) { return km && ms ? km / (ms / 3600000) : null; }

// Zelfde regels als parse_time op de pc. Ongeldig -> null
function stTijdMs(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  text = text.trim();
  let delen;
  if (/^\d+$/.test(text)) {
    if (text.length < 4) return null;
    delen = [text.slice(0, -5) || "0", text.slice(-5, -3), text.slice(-3)];
  } else {
    delen = text.split(/[:.,\s]+/).filter((p) => p !== "");
  }
  if (!delen.length || !delen.every((p) => /^\d+$/.test(p))) return null;
  let uren = 0, min, sec, mil;
  if (delen.length === 2) [min, sec, mil] = ["0", delen[0], delen[1]];
  else if (delen.length === 3) [min, sec, mil] = delen;
  else if (delen.length === 4) { uren = +delen[0]; [min, sec, mil] = delen.slice(1); if (+min >= 60) return null; }
  else return null;
  if (mil.length > 3 || +sec >= 60) return null;
  const ms = uren * 3600000 + +min * 60000 + +sec * 1000 + +mil.padEnd(3, "0");
  return ms > 0 ? ms : null;
}

function stDatum(text) {
  if (!text) return null;
  let t = String(text).trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) t += "T00:00:00";   // anders rekent de browser in UTC
  const d = new Date(t);
  return isNaN(d) ? null : d;
}

function stWeekStart(d) {
  const w = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  w.setDate(w.getDate() - ((w.getDay() + 6) % 7));   // maandag
  return w;
}
const stDagKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Aantal tijden per week, de laatste ST_WEKEN weken
function stActiviteit(datums) {
  const deze = stWeekStart(new Date());
  const weken = [];
  for (let i = ST_WEKEN - 1; i >= 0; i--) {
    const w = new Date(deze);
    w.setDate(w.getDate() - 7 * i);
    weken.push(w);
  }
  const tel = new Map(weken.map((w) => [stDagKey(w), 0]));
  for (const d of datums) {
    if (!d) continue;
    const k = stDagKey(stWeekStart(d));
    if (tel.has(k)) tel.set(k, tel.get(k) + 1);
  }
  const p = (n) => String(n).padStart(2, "0");
  return weken.map((w) => [`${p(w.getDate())}-${p(w.getMonth() + 1)}`, tel.get(stDagKey(w))]);
}

// 'Stockcar/Oval' -> Map { 'stockcar' => 'Stockcar', 'oval' => 'Oval' }
function stCategorieen(auto) {
  const m = new Map();
  for (const deel of String(auto?.categorie || "").split(/[/,]/)) {
    if (deel.trim() && !m.has(norm(deel))) m.set(norm(deel), deel.trim());
  }
  return m;
}

// 'Wie doet mee' (allowed_car op de pc): categorieën, klassen per
// categorie en losse klassen (die doen altijd mee).
function stMagMee(a, lb) {
  const cats = new Set((lb.categories || []).map(norm));
  const los = new Set((lb.losse_klassen || []).map(norm));
  const klasse = norm(a.klasse);
  if (klasse && los.has(klasse)) return true;
  if (cats.has("alle")) return true;
  if (!cats.size && !los.size) return true;          // oud leaderboard zonder keuze
  const perCat = new Map(Object.entries(lb.klassen_per_categorie || {})
    .filter(([, k]) => k && k.length).map(([c, k]) => [norm(c), new Set(k.map(norm))]));
  return [...stCategorieen(a).keys()].some((c) => cats.has(c) && (!perCat.has(c) || perCat.get(c).has(klasse)));
}

// Max aantal deelnemers bereikt (is_full op de pc): dan geen nieuwe auto's
function stVol(lb) {
  const max = parseInt(lb.max_deelnemers, 10);
  if (!(max > 0)) return false;
  return new Set(lb.tijden.filter((t) => t.auto).map((t) => norm(t.auto))).size >= max;
}

// Korte tekst: 'GT, Prototype (LMDH GTP) + TSI Cup' (rule_text op de pc)
function stRegelTekst(lb) {
  const perCat = new Map(Object.entries(lb.klassen_per_categorie || {}).filter(([, k]) => k && k.length).map(([c, k]) => [norm(c), k]));
  let t = (lb.categories || []).filter(Boolean).map((c) => perCat.has(norm(c)) ? `${c} (${perCat.get(norm(c)).join(", ")})` : c).join(", ");
  const los = lb.losse_klassen || [];
  if (los.length) t = (!t || norm(t) === "alle") ? los.join(", ") : `${t} + ${los.join(", ")}`;
  return t;
}

// Auto's in bezit die op dit leaderboard mogen en nog geen tijd hebben
// (get_candidates op de pc). Met 'alleen garage': geen auto's die op
// Gekocht staan.
function stNogTeRijden(g, lb) {
  if (stVol(lb)) return [];
  const gebruikt = new Set(lb.tijden.filter((t) => t.auto).map((t) => norm(t.auto)));
  const van = parseInt(lb.bouwjaar_van, 10), tot = parseInt(lb.bouwjaar_tot, 10);
  const metJaar = !isNaN(van) || !isNaN(tot);
  return g.autos.filter((a) => {
    if (!norm(a.naam) || !a.in_bezit || gebruikt.has(norm(a.naam))) return false;
    if (lb.alleen_garage && a.garage === "gekocht") return false;
    if (!stMagMee(a, lb)) return false;
    if (lb.zonder_mods && a.mod) return false;
    if (metJaar) {
      const m = String(a.jaartal || "").match(/(?<!\d)(\d{4})(?!\d)/);
      if (!m) return false;
      const j = +m[1];
      if (!isNaN(van) && j < van) return false;
      if (!isNaN(tot) && j > tot) return false;
    }
    return true;
  });
}

// ------------------------------------------------------------
// Per leaderboard (leaderboard_stats)
// ------------------------------------------------------------
function lbStats(g, lb) {
  const circuit = lb.circuit_id != null ? g._circuitOpId.get(String(lb.circuit_id)) : null;
  const lengte = circuit ? stKm(circuit.lengte) : null;
  const geldig = lb.tijden.filter((t) => t.positie && t.ms).sort((a, b) => a.positie - b.positie);
  const v = lb.voortgang || {};

  const s = {
    circuit, lengte, car_speed: [],
    count: geldig.length,
    invalid: lb.tijden.length - geldig.length,
    done: v.gereden || 0,
    total: v.totaal || 0,
    rows: [], classes: [], categories: [], gaps: [], improvements: [],
    activity: stActiviteit(lb.tijden.filter((t) => !t.geimporteerd).map((t) => stDatum(t.datum))),
  };

  const snelste = geldig.length ? geldig[0].ms : null;
  geldig.forEach((t, i) => {
    s.rows.push({
      pos: i + 1,
      auto: t.auto || "",
      klasse: t.klasse || "Onbekend",
      // Qualy-tijd: de gemiddelde ronde, net als ms
      tijd: Number(t.aantal_rondes ?? 1) !== 1 ? tijdTekst(t.ms) : (t.tijd || ""),
      ms: t.ms,
      gap: t.ms - snelste,
      gap_pct: snelste ? (t.ms - snelste) / snelste * 100 : 0,
      entry: t,
    });
  });
  const rows = s.rows;
  if (!rows.length) return s;

  const tijden = rows.map((r) => r.ms);
  const gem = tijden.reduce((a, b) => a + b, 0) / tijden.length;
  const gesorteerd = [...tijden].sort((a, b) => a - b);
  const mid = Math.floor(gesorteerd.length / 2);
  Object.assign(s, {
    fastest: rows[0],
    slowest: rows[rows.length - 1],
    avg_ms: gem,
    median_ms: gesorteerd.length % 2 ? gesorteerd[mid] : (gesorteerd[mid - 1] + gesorteerd[mid]) / 2,
    spread_ms: rows[rows.length - 1].ms - rows[0].ms,
    top_speed: stKmh(lengte, rows[0].ms),
    avg_speed: stKmh(lengte, gem),
  });
  // Snelheid per auto (alleen als het circuit een lengte heeft)
  s.car_speed = rows.map((r) => ({ ...r, speed: stKmh(lengte, r.ms) }))
    .filter((r) => r.speed).sort((a, b) => b.speed - a.speed);

  // Per klasse
  const klassen = new Map();
  for (const r of rows) { if (!klassen.has(r.klasse)) klassen.set(r.klasse, []); klassen.get(r.klasse).push(r); }
  s.classes = [...klassen].map(([naam, items]) => {
    const avg = items.reduce((a, r) => a + r.ms, 0) / items.length;
    return {
      klasse: naam, count: items.length, few: items.length < ST_WEINIG,
      best_ms: Math.min(...items.map((r) => r.ms)), avg_ms: avg, avg_speed: stKmh(lengte, avg), rows: items,
    };
  }).sort((a, b) => a.avg_ms - b.avg_ms);

  // Verdeling over categorieën (van de auto's in je lijst)
  const cats = new Map();
  for (const r of rows) {
    const auto = g._autoOpNaam.get(norm(r.auto));
    const labels = auto ? [...stCategorieen(auto).values()] : [];
    for (const label of labels.length ? labels : ["Onbekend"]) {
      if (!cats.has(label)) cats.set(label, []);
      cats.get(label).push(r);
    }
  }
  s.categories = [...cats].map(([label, items]) => ({ label, count: items.length, rows: items }))
    .sort((a, b) => b.count - a.count);

  // Hoe ver zitten de auto's achter P1?
  let onder = 0;
  s.gaps = ST_GAPS.map(([boven, label]) => {
    const items = rows.slice(1).filter((r) => r.gap >= onder && (boven === null || r.gap < boven));
    onder = boven ?? onder;
    return { label, count: items.length, rows: items };
  });

  s.improvements = stVerbeteringen(rows);
  return s;
}

// Auto's die sneller werden na opnieuw rijden, grootste winst eerst
function stVerbeteringen(rows) {
  const gevonden = [];
  for (const r of rows) {
    const oud = [];
    for (const o of r.entry.geschiedenis || []) {
      let ms = stTijdMs(o.tijd);
      if (ms === null) continue;
      // Qualy: oude tijd is het totaal van alle rondes -> per ronde
      const rondes = parseInt(o.aantal_rondes, 10) || 1;
      if (rondes > 1) ms = Math.round(ms / rondes);
      oud.push(ms);
    }
    if (oud.length) {
      const winst = Math.max(...oud) - r.ms;
      if (winst > 0) gevonden.push({ ...r, gain: winst });
    }
  }
  return gevonden.sort((a, b) => b.gain - a.gain);
}

// ------------------------------------------------------------
// Per game (game_stats)
// ------------------------------------------------------------
function gameStats(g) {
  const bezitAutos = g.autos.filter((a) => a.in_bezit);
  const s = {
    autos: g.autos.length, owned: bezitAutos.length, circuits: g.circuits.length,
    leaderboards: g.leaderboards.length,
    archived: g.leaderboards.filter((lb) => lb.gearchiveerd).length,
    times: 0, done: 0, total: 0, complete: 0,
  };
  const gereden = new Set();
  const klasseGap = new Map(), klasseAutos = new Map(), klasseSnelheid = new Map(),
    klasseAantal = new Map(), klasseRijen = new Map(), autoRijen = new Map(), autoAantal = new Map(), autoSnelheid = new Map(),
    podium = new Map(), types = new Map();
  const voeg = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const datums = [];
  const verbeteringen = [];

  for (const lb of g.leaderboards) {
    const st = lbStats(g, lb);
    s.times += st.count;
    s.done += st.done;
    s.total += st.total;
    if (st.total && st.done >= st.total) s.complete++;
    voeg(types, (st.circuit && st.circuit.categorie) || "Onbekend", lb);

    for (const r of st.rows) {
      const naam = r.auto, k = r.klasse;
      gereden.add(norm(naam));
      voeg(klasseGap, k, r.gap_pct);
      if (!klasseAutos.has(k)) klasseAutos.set(k, new Set());
      klasseAutos.get(k).add(norm(naam));
      klasseAantal.set(k, (klasseAantal.get(k) || 0) + 1);
      autoAantal.set(naam, (autoAantal.get(naam) || 0) + 1);
      const snel = stKmh(st.lengte, r.ms);
      const rij = { ...r, leaderboard: lb.naam || "", speed: snel };
      voeg(klasseRijen, k, rij);
      voeg(autoRijen, naam, rij);
      if (snel) { voeg(klasseSnelheid, k, snel); voeg(autoSnelheid, naam, rij); }
      if (r.pos <= 3) {
        if (!podium.has(naam)) podium.set(naam, { p1: 0, top3: 0, rows: [] });
        const p = podium.get(naam);
        p.top3++;
        if (r.pos === 1) p.p1++;
        p.rows.push({ ...r, leaderboard: lb.naam || "" });
      }
    }
    for (const v of st.improvements) verbeteringen.push({ ...v, leaderboard: lb.naam || "" });
    for (const t of lb.tijden) if (!t.geimporteerd) datums.push(stDatum(t.datum));
  }

  // Dekking: hoeveel van je auto's (in bezit) is ergens gereden?
  const nooit = bezitAutos.filter((a) => !gereden.has(norm(a.naam)))
    .sort((a, b) => norm(a.naam).localeCompare(norm(b.naam)));
  s.covered = bezitAutos.length - nooit.length;
  s.never_driven = nooit;

  const gem = (l) => l.reduce((a, b) => a + b, 0) / l.length;
  const weinig = (k) => klasseAutos.get(k).size < ST_WEINIG;
  // Snelste klassen: gemiddeld % achter de winnaar (lager = sneller)
  s.class_gap = [...klasseGap].map(([k, v]) => ({
    klasse: k, value: gem(v), cars: klasseAutos.get(k).size, few: weinig(k), rows: klasseRijen.get(k),
  })).sort((a, b) => a.value - b.value);
  s.class_speed = [...klasseSnelheid].map(([k, v]) => ({
    klasse: k, value: gem(v), cars: klasseAutos.get(k).size, few: weinig(k),
    rows: klasseRijen.get(k).filter((r) => r.speed),
  })).sort((a, b) => b.value - a.value);
  // Gemiddelde snelheid per auto over alle leaderboards met een
  // circuitlengte. Op maar één leaderboard = minder betrouwbaar (*).
  s.car_speed = [...autoSnelheid].map(([k, v]) => ({
    auto: k, klasse: v[0].klasse, value: gem(v.map((r) => r.speed)), lbs: v.length, few: v.length < 2,
    rows: [...v].sort((a, b) => b.speed - a.speed),
  })).sort((a, b) => b.value - a.value);
  s.class_count = [...klasseAantal].map(([k, v]) => ({ klasse: k, value: v, rows: klasseRijen.get(k) }))
    .sort((a, b) => b.value - a.value);
  s.car_count = [...autoAantal].map(([k, v]) => ({ auto: k, value: v, rows: autoRijen.get(k) }))
    .sort((a, b) => b.value - a.value);
  s.podium = [...podium].map(([k, v]) => ({ auto: k, ...v }))
    .sort((a, b) => b.p1 - a.p1 || b.top3 - a.top3);
  s.circuit_types = [...types].map(([label, lbs]) => ({ label, count: lbs.length, leaderboards: lbs }))
    .sort((a, b) => b.count - a.count);
  s.activity = stActiviteit(datums);
  s.improvements = verbeteringen.sort((a, b) => b.gain - a.gain);
  return s;
}

// ------------------------------------------------------------
// Opmaak (zelfde teksten als de pc)
// ------------------------------------------------------------
const stMs = (ms) => (ms === null || ms === undefined ? "–" : tijdTekst(Math.round(ms)));
const stSnelheid = (v) => (v ? `${v.toFixed(1)} km/u` : "–");
const stWinst = (ms) => (ms >= 60000 ? "−" + tijdTekst(ms) : `−${(ms / 1000).toFixed(3)} s`);
const stGap = (r) => (r.pos === 1 ? "—" : verschilTekst(r.gap));
const stSter = (label, few) => (few ? `${label} *` : label);
const stAantal = (n) => `${n} auto('s)`;

// Kolommen voor het detailvenster: [kop, functie, rol]
// rol: pos = positie, naam = hoofdregel, rechts = rechts uitgelijnd
const K_LB = ["Leaderboard", (r) => r.leaderboard || ""];
const K_POS = ["Pos", (r) => `P${r.pos}`, "pos"];
const K_AUTO = ["Auto", (r) => r.auto || "", "naam"];
const K_KLASSE = ["Klasse", (r) => r.klasse || ""];
const K_TIJD = ["Tijd", (r) => r.tijd || "", "rechts"];
const K_GAP = ["Achterstand", stGap, "rechts"];
const K_GAP_PCT = ["Achter P1", (r) => (r.pos === 1 ? "—" : `+${r.gap_pct.toFixed(2)}%`), "rechts"];
const K_SNELHEID = ["Snelheid", (r) => stSnelheid(r.speed), "rechts"];
const K_WINST = ["Verbetering", (r) => stWinst(r.gain), "rechts"];

const LB_RIJEN = [K_POS, K_AUTO, K_KLASSE, K_TIJD, K_GAP];
const GAME_RIJEN = [K_LB, K_POS, K_AUTO, K_KLASSE, K_TIJD, K_GAP_PCT];
const SNELHEID_RIJEN = [K_LB, K_POS, K_AUTO, K_KLASSE, K_TIJD, K_SNELHEID];
const LB_SNELHEID_RIJEN = [K_POS, K_AUTO, K_KLASSE, K_TIJD, K_SNELHEID];
const AUTO_SNELHEID_LIJST = [
  ["Auto", (c) => c.auto, "naam"],
  ["Klasse", (c) => c.klasse || "-"],
  ["Leaderboards", (c) => `${c.lbs} leaderboard${c.lbs === 1 ? "" : "s"}`],
  ["Gem. snelheid", (c) => stSnelheid(c.value), "rechts"],
];
const AUTO_LIJST = [
  ["Auto", (a) => a.naam || "", "naam"],
  ["Klasse", (a) => a.klasse || "-"],
  ["Categorie", (a) => a.categorie || "-"],
  ["Bouwjaar", (a) => String(a.jaartal || "-"), "rechts"],
];

// ------------------------------------------------------------
// Klikken: elk klikbaar onderdeel krijgt een nummer
// ------------------------------------------------------------
let stActies = [];
function stKlik(fn) { stActies.push(fn); return stActies.length - 1; }
const stAttr = (fn) => (fn ? `data-st="${stKlik(fn)}"` : "");

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-st]");
  if (!el || el.closest("#sheet-root")) return;
  const fn = stActies[+el.dataset.st];
  if (fn) fn();
});
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("[data-st]")) { e.preventDefault(); e.target.click(); }
});

// Detailvenster: lijst met de rijen van dat onderdeel
function stDetails(titel, kolommen, rijen, samenvatting = "") {
  if (!rijen || !rijen.length) return;
  const waarde = (k, r) => { try { return String(k[1](r)); } catch (e) { return "-"; } };
  let lijst;
  if (window.innerWidth >= 700) {
    lijst = `<div class="st-tabel-wrap"><table class="st-tabel"><thead><tr>${kolommen.map((k) => `<th>${esc(k[0])}</th>`).join("")}</tr></thead>
      <tbody>${rijen.map((r) => `<tr>${kolommen.map((k) => `<td class="${k[2] || ""}">${esc(waarde(k, r))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  } else {
    // Telefoon: per rij een kaartje (positie, naam, rest eronder)
    const pos = kolommen.find((k) => k[2] === "pos");
    const naam = kolommen.find((k) => k[2] === "naam") || kolommen.find((k) => k !== pos);
    const rechts = [...kolommen].reverse().find((k) => k[2] === "rechts" && k !== naam);
    const rest = kolommen.filter((k) => k !== pos && k !== naam && k !== rechts);
    lijst = `<div class="st-lijst">${rijen.map((r) => `<div class="st-lrij ${pos ? "" : "zonder-pos"}">
      ${pos ? `<div class="pos">${esc(waarde(pos, r))}</div>` : ""}
      <div><div class="naam">${esc(waarde(naam, r))}</div><div class="sub">${esc(rest.map((k) => waarde(k, r)).filter((x) => x && x !== "-").join("  ·  "))}</div></div>
      ${rechts ? `<div class="r">${esc(waarde(rechts, r))}</div>` : ""}
    </div>`).join("")}</div>`;
  }
  const root = $("#sheet-root");
  root.innerHTML = `<div class="sluier"><div class="venster st-venster" role="dialog" aria-label="${esc(titel)}">
    <h3>${esc(titel.toUpperCase())}</h3>
    ${samenvatting ? `<p class="st-samen">${esc(samenvatting)}</p>` : ""}
    ${lijst}
    <div class="acties"><button class="knop neon" data-sluit>Sluiten</button></div>
  </div></div>`;
  document.body.style.overflow = "hidden";
  root.onclick = (e) => {
    if (e.target.closest("[data-sluit]") || e.target.classList.contains("sluier")) {
      root.innerHTML = ""; document.body.style.overflow = "";
    }
  };
}

// Grafiek-onderdeel -> details
const stNaarDetails = (prefix, kolommen) => (item) =>
  stDetails(`${prefix}${String(item.label).replace(/ \*$/, "")}`, kolommen, item.payload || [], item.summary || "");

// ------------------------------------------------------------
// Kaarten en grafieken (neon, zoals ChartCard/StatCard/... op de pc)
// ------------------------------------------------------------
// p = breedte op de tablet (van 4 kolommen), t = op de telefoon (van 2)
function stCel(html, p = 1, t = 2) {
  return `<div class="st-cel" style="--p:${p};--t:${t}">${html}</div>`;
}

function stGetal(titel, waarde, sub = "", klik = null) {
  waarde = String(waarde);
  return `<div class="glas st-getal ${klik ? "klik" : ""}" ${stAttr(klik)} ${klik ? 'role="button" tabindex="0"' : ""}>
    <h4>${esc(titel)}</h4>
    <div class="waarde ${waarde.length > 12 ? "lang" : ""}">${esc(waarde)}</div>
    ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
  </div>`;
}

function stKaart(titel, inhoud, noot = "", alle = null) {
  const kop = alle
    ? `<div class="st-kop"><h4>${esc(titel)}</h4><button class="chip st-alle" ${stAttr(alle.klik)}>alle ${alle.aantal}</button></div>`
    : `<h4>${esc(titel)}</h4>`;
  return `<div class="glas st-kaart">${kop}<div class="inhoud">${inhoud}</div>
    ${noot ? `<div class="noot">${esc(noot).replace(/\n/g, "<br>")}</div>` : ""}</div>`;
}

const stLeeg = (t = "Nog geen gegevens") => `<div class="st-leeg">${esc(t)}</div>`;

let stGradNr = 0;
function stRing(deel, midden, sub = "", klik = null) {
  deel = Math.max(0, Math.min(1, deel || 0));
  const id = `stg${stGradNr++}`;
  const r = 80, omtrek = 2 * Math.PI * r;
  const boog = deel > 0 ? Math.max(omtrek * deel, 4) : 0;
  const lijn = (w, stijl) => `<circle cx="100" cy="100" r="${r}" fill="none" stroke-width="${w}" stroke-linecap="round"
      stroke-dasharray="${boog} ${omtrek}" transform="rotate(-90 100 100)" style="${stijl}"/>`;
  return `<div class="st-ring ${klik ? "klik" : ""}" ${stAttr(klik)} ${klik ? 'role="button" tabindex="0"' : ""}>
    <svg viewBox="0 0 200 200">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color:var(--accent-licht)"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient></defs>
      <circle cx="100" cy="100" r="${r}" fill="none" stroke-width="14" style="stroke:rgba(255,255,255,.1)"/>
      ${boog ? lijn(36, "stroke:var(--gloed);opacity:.05") + lijn(28, "stroke:var(--gloed);opacity:.08") + lijn(21, "stroke:var(--gloed);opacity:.12")
        + lijn(14, `stroke:url(#${id})`) : ""}
      <text x="100" y="${sub ? 100 : 112}" text-anchor="middle" class="midden">${esc(midden)}</text>
      ${sub ? `<text x="100" y="126" text-anchor="middle" class="sub">${esc(sub)}</text>` : ""}
    </svg></div>`;
}

// items: {label, value, text, tooltip, payload, summary}
function stBalken(items, { lagerIsBeter = false, klik = null, max = 10 } = {}) {
  items = items.slice(0, max);
  if (!items.length) return stLeeg();
  const waarden = items.map((i) => i.value);
  const top = Math.max(...waarden), laag = Math.min(...waarden);
  return `<div class="st-balken">${items.map((i) => {
    // Bij 'lager is beter' krijgt de laagste de langste balk
    let deel;
    if (lagerIsBeter) deel = top !== laag ? 0.15 + 0.85 * (top - i.value) / (top - laag) : 1;
    else deel = top ? i.value / top : 0;
    const rij = `<span class="l">${esc(i.label)}</span><span class="b"><i style="--d:${deel.toFixed(4)}"></i><em>${esc(i.text)}</em></span>`;
    return klik && i.payload && i.payload.length
      ? `<button class="st-balk" ${stAttr(() => klik(i))} ${i.tooltip ? `title="${esc(i.tooltip)}"` : ""}>${rij}</button>`
      : `<div class="st-balk" ${i.tooltip ? `title="${esc(i.tooltip)}"` : ""}>${rij}</div>`;
  }).join("")}</div>`;
}

function stKleuren(n) {
  const k = ["var(--accent)", "var(--accent-licht)", ...ST_EXTRA_KLEUREN];
  return Array.from({ length: n }, (_, i) => k[i % k.length]);
}

// items: {label, count, payload}
function stDonut(items, klik = null, maxDelen = 8) {
  items = [...items].sort((a, b) => b.count - a.count);
  if (items.length > maxDelen) {
    const rest = items.slice(maxDelen - 1);
    items = [...items.slice(0, maxDelen - 1), {
      label: "Overig", count: rest.reduce((a, i) => a + i.count, 0),
      payload: rest.flatMap((i) => i.payload || []),
    }];
  }
  const totaal = items.reduce((a, i) => a + i.count, 0);
  if (!totaal) return stLeeg();
  const kleuren = stKleuren(items.length);
  const r = 84, omtrek = 2 * Math.PI * r;
  let start = 0;
  const delen = items.map((i, n) => {
    const lengte = omtrek * i.count / totaal;
    const html = `<circle class="deel" cx="100" cy="100" r="${r}" fill="none" stroke-width="27"
      stroke-dasharray="${lengte} ${omtrek}" stroke-dashoffset="${-start}" transform="rotate(-90 100 100)"
      style="stroke:${kleuren[n]}" ${klik ? stAttr(() => klik(i)) : ""}/>`;
    start += lengte;
    return html;
  }).join("");
  const legenda = items.map((i, n) => {
    const inhoud = `<span class="kleur" style="background:${kleuren[n]}"></span>
      <span class="t">${esc(i.label)}  ·  ${i.count}  (${Math.round(i.count / totaal * 100)}%)</span>`;
    return klik ? `<button class="st-leg" ${stAttr(() => klik(i))}>${inhoud}</button>` : `<div class="st-leg">${inhoud}</div>`;
  }).join("");
  return `<div class="st-donut"><svg viewBox="0 0 200 200">${delen}
    <text x="100" y="114" text-anchor="middle" class="midden">${totaal}</text></svg>
    <div class="legenda">${legenda}</div></div>`;
}

// Lijn: punten = [[label, waarde], ...]. Wordt getekend als hij in beeld staat
// (dan weten we hoe breed hij is), zie stTekenLijnen.
function stLijn(punten, eenheid = "tijden") {
  if (!punten.length || !punten.some(([, v]) => v)) {
    return `<div class="st-lijn leeg">${stLeeg("Nog geen tijden met een datum")}</div>`;
  }
  return `<div class="st-lijn" data-punten="${esc(JSON.stringify(punten))}" data-eenheid="${esc(eenheid)}"></div>`;
}

function stTekenLijn(el, actief = -1) {
  const punten = JSON.parse(el.dataset.punten);
  const w = Math.max(240, el.clientWidth || 300), h = 200;
  const vlak = { x: 10, y: 16, w: w - 20, h: h - 46 };
  const top = Math.max(...punten.map(([, v]) => v)) || 1;
  const stap = vlak.w / Math.max(1, punten.length - 1);
  const pos = punten.map(([, v], i) => [vlak.x + i * stap, vlak.y + vlak.h - vlak.h * v / top]);
  let d = `M${pos[0][0]},${pos[0][1]}`;
  for (let i = 1; i < pos.length; i++) {
    const [ax, ay] = pos[i - 1], [bx, by] = pos[i], m = (ax + bx) / 2;
    d += ` C${m},${ay} ${m},${by} ${bx},${by}`;
  }
  const onder = vlak.y + vlak.h;
  const vul = `${d} L${pos[pos.length - 1][0]},${onder} L${pos[0][0]},${onder} Z`;
  const hulp = [0, 1, 2, 3].map((i) => {
    const y = vlak.y + vlak.h * i / 3;
    return `<line x1="${vlak.x}" x2="${vlak.x + vlak.w}" y1="${y}" y2="${y}" style="stroke:rgba(255,255,255,.07)"/>`;
  }).join("");
  const elke = Math.max(1, Math.floor(punten.length / 6));
  const labels = punten.map(([l], i) => (i % elke === 0 || i === punten.length - 1)
    ? `<text x="${Math.min(Math.max(pos[i][0], 22), w - 22)}" y="${onder + 20}" text-anchor="middle" class="as">${esc(l)}</text>` : "").join("");
  const bollen = pos.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === actief ? 6 : 3.5}" style="fill:var(--tekst)"/>`).join("");
  let kader = "";
  if (actief >= 0) {
    const [l, v] = punten[actief];
    const t = `${v} ${el.dataset.eenheid}  ·  week van ${l}`;
    const bw = t.length * 6.6 + 20;
    const bx = Math.min(Math.max(pos[actief][0] - bw / 2, 0), w - bw);
    const by = Math.max(0, pos[actief][1] - 36);
    kader = `<rect x="${bx}" y="${by}" width="${bw}" height="26" rx="8" style="fill:var(--paneel);fill-opacity:.95;stroke:var(--accent-licht)"/>
      <text x="${bx + bw / 2}" y="${by + 17.5}" text-anchor="middle" class="kader">${esc(t)}</text>`;
  }
  const id = `stl${stGradNr++}`;
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--accent);stop-opacity:.55"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:.02"/></linearGradient></defs>
    ${hulp}<path d="${vul}" style="fill:url(#${id})"/>
    <path d="${d}" fill="none" stroke-width="7" style="stroke:var(--accent);stroke-opacity:.35"/>
    <path d="${d}" fill="none" stroke-width="2.5" style="stroke:var(--accent-licht)"/>
    ${bollen}${labels}${kader}</svg>`;
  el._pos = pos.map(([x]) => x / w);
  el._actief = actief;
}

function stTekenLijnen(root = document) {
  root.querySelectorAll(".st-lijn[data-punten]").forEach((el) => stTekenLijn(el, el._actief ?? -1));
}

// Tik of muis op de lijn: waarde van de dichtstbijzijnde week
function stLijnPunt(e) {
  const el = e.target.closest?.(".st-lijn[data-punten]");
  if (!el || !el._pos) return;
  const box = el.getBoundingClientRect();
  const x = (e.clientX - box.left) / box.width;
  let beste = 0;
  el._pos.forEach((p, i) => { if (Math.abs(p - x) < Math.abs(el._pos[beste] - x)) beste = i; });
  if (beste !== el._actief) stTekenLijn(el, beste);
}
document.addEventListener("pointermove", stLijnPunt);
document.addEventListener("pointerdown", stLijnPunt);
document.addEventListener("pointerout", (e) => {
  const el = e.target.closest?.(".st-lijn[data-punten]");
  if (el && e.pointerType === "mouse" && !el.contains(e.relatedTarget)) stTekenLijn(el, -1);
});
let stLijnTimer = null;
window.addEventListener("resize", () => { clearTimeout(stLijnTimer); stLijnTimer = setTimeout(() => stTekenLijnen(), 120); });

function stVerbeterKaart(verbeteringen, kolommen) {
  if (!verbeteringen.length) {
    return stGetal("Meest verbeterd", "–", "Rijd een auto opnieuw en zet een snellere tijd neer");
  }
  const top = verbeteringen[0];
  const waar = top.leaderboard ? `  ·  ${top.leaderboard}` : "";
  return stGetal("Meest verbeterd", stWinst(top.gain), `${top.auto}${waar}`, () =>
    stDetails("Verbeteringen", [...kolommen, K_WINST], verbeteringen,
      "Winst = verschil tussen de oudste (langzaamste) tijd uit de geschiedenis en de huidige tijd."));
}

// ------------------------------------------------------------
// Dashboard per game (tabblad Stats)
// ------------------------------------------------------------
function gameStatsHTML(g) {
  stActies = [];
  const s = gameStats(g);
  const cellen = [];
  const zet = (html, p, t) => cellen.push(stCel(html, p, t));

  // Kerngetallen
  const gekocht = g.garage_stap ? g.autos.filter((a) => a._garage === "gekocht").length : 0;
  zet(stGetal("Auto's", `${s.owned}/${s.autos}`,
    g.garage_stap ? `in bezit  ·  ${s.owned - gekocht} in garage  ·  ${gekocht} gekocht` : "in bezit", g.autos.length ? () =>
    stDetails("Auto's in bezit", AUTO_LIJST, g.autos.filter((a) => a.in_bezit)) : null), 1, 1);
  zet(stGetal("Circuits", s.circuits, "in je lijst"), 1, 1);
  const actief = s.leaderboards - s.archived;
  zet(stGetal("Leaderboards", s.leaderboards, `${actief} actief  ·  ${s.archived} archief  ·  ${s.complete} compleet`), 1, 1);
  zet(stGetal("Tijden", s.times, "over alle leaderboards"), 1, 1);

  // Ringen + snelste klassen
  const nooit = s.never_driven;
  zet(stKaart("Dekking auto's", stRing(s.owned ? s.covered / s.owned : 0,
    `${s.owned ? Math.round(s.covered / s.owned * 100) : 0}%`, `${s.covered} van ${s.owned} gereden`,
    nooit.length ? () => stDetails("Nog nooit gereden", AUTO_LIJST, nooit,
      `${nooit.length} auto's in bezit zonder tijd op een leaderboard.`) : null)), 1, 1);
  zet(stKaart("Voortgang leaderboards", stRing(s.total ? s.done / s.total : 0, `${s.done}/${s.total}`, "plekken gevuld")), 1, 1);

  let noot = "Gemiddeld % achter de snelste tijd van elk leaderboard, zodat korte en lange circuits eerlijk vergeleken worden.";
  if (s.class_gap.some((c) => c.few)) noot += "\n" + ST_WEINIG_NOOT;
  zet(stKaart("Snelste klassen", stBalken(s.class_gap.map((c) => ({
    label: stSter(c.klasse, c.few), value: c.value, text: `+${c.value.toFixed(2)}%`,
    tooltip: `${c.cars} verschillende auto('s)`, payload: c.rows,
    summary: `Gemiddeld ${c.value.toFixed(2)}% achter de winnaar van het leaderboard  ·  ${stAantal(c.cars)}`,
  })), { lagerIsBeter: true, klik: stNaarDetails("Klasse: ", GAME_RIJEN) }), noot), 2, 2);

  // Snelheid + podium
  noot = "Alleen leaderboards waarvan het circuit een lengte heeft.";
  if (s.class_speed.some((c) => c.few)) noot += "\n" + ST_WEINIG_NOOT;
  zet(stKaart("Gemiddelde snelheid per klasse", stBalken(s.class_speed.map((c) => ({
    label: stSter(c.klasse, c.few), value: c.value, text: `${c.value.toFixed(1)} km/u`,
    tooltip: `${c.cars} verschillende auto('s)`, payload: c.rows,
  })), { klik: stNaarDetails("Klasse: ", SNELHEID_RIJEN) }), noot), 2, 2);
  zet(stKaart("Podiumkoningen", stBalken(s.podium.map((p) => ({
    label: p.auto, value: p.top3, text: `${p.p1}× P1  ·  ${p.top3}× top 3`, payload: p.rows,
  })), { klik: stNaarDetails("", GAME_RIJEN) })), 2, 2);

  // Gemiddelde snelheid per auto
  noot = "Gemiddelde van de snelheden op alle leaderboards waarvan het circuit een lengte heeft.";
  if (s.car_speed.some((c) => c.few)) noot += "\n* Op maar één leaderboard gereden, dus minder betrouwbaar.";
  zet(stKaart("Gemiddelde snelheid per auto", stBalken(s.car_speed.map((c) => ({
    label: stSter(c.auto, c.few), value: c.value, text: stSnelheid(c.value),
    tooltip: `${c.klasse}  ·  ${c.lbs} leaderboard(s)`, payload: c.rows,
    summary: `Gemiddeld ${stSnelheid(c.value)} over ${c.lbs} leaderboard(s)`,
  })), { klik: stNaarDetails("", SNELHEID_RIJEN) }), noot,
    s.car_speed.length > 10 ? { aantal: s.car_speed.length,
      klik: () => stDetails("Gemiddelde snelheid per auto", AUTO_SNELHEID_LIJST, s.car_speed) } : null), 4, 2);

  // Meest gereden
  zet(stKaart("Meest gereden klassen", stBalken(s.class_count.map((c) => ({
    label: c.klasse, value: c.value, text: `${c.value}×`, payload: c.rows,
  })), { klik: stNaarDetails("Klasse: ", GAME_RIJEN) })), 2, 2);
  zet(stKaart("Meest gereden auto's", stBalken(s.car_count.map((c) => ({
    label: c.auto, value: c.value, text: `${c.value}×`, payload: c.rows,
  })), { klik: stNaarDetails("", GAME_RIJEN) })), 2, 2);

  // Circuittypes + activiteit
  zet(stKaart("Leaderboards per circuittype", stDonut(s.circuit_types.map((t) => ({
    label: t.label, count: t.count, payload: t.leaderboards,
  })), (item) => stDetails(`Circuittype: ${item.label}`, [
    ["Leaderboard", (lb) => lb.naam || "", "naam"],
    ["Circuit", (lb) => [lb.circuit, lb.layout].filter(Boolean).join(" ")],
    ["Tijden", (lb) => String(lb.tijden.length), "rechts"],
  ], item.payload || []))), 2, 2);
  zet(stKaart("Activiteit (tijden per week)", stLijn(s.activity),
    "Geïmporteerde tijden hebben geen datum en tellen hier niet mee."), 2, 2);

  // Losse weetjes
  zet(stVerbeterKaart(s.improvements, [K_LB, K_AUTO, K_KLASSE, K_TIJD]), 2, 2);
  if (s.car_count.length) {
    const fav = s.car_count[0];
    zet(stGetal("Favoriete auto", fav.auto, `${fav.value}× gereden`, () => stDetails(fav.auto, GAME_RIJEN, fav.rows)), 1, 1);
  }
  if (s.podium.length) {
    const k = s.podium[0];
    zet(stGetal("Meeste overwinningen", k.auto, `${k.p1}× P1  ·  ${k.top3}× top 3`, () => stDetails(k.auto, GAME_RIJEN, k.rows)), 1, 1);
  }

  return `<p class="st-info">${esc(g.naam)}   ·   alle leaderboards van deze game (ook gearchiveerde)</p>
    <div class="st-raster">${cellen.join("")}</div>`;
}

// ------------------------------------------------------------
// Dashboard per leaderboard
// ------------------------------------------------------------
function lbStatsHTML(g, lb) {
  stActies = [];
  const s = lbStats(g, lb);
  const rows = s.rows;
  const c = s.circuit;
  const delen = [g.naam];
  if (c) {
    delen.push([c.circuit, c.layout].filter(Boolean).join(" "));
    if (c.lengte) delen.push(`${c.lengte} km`);
  } else if (lb.circuit) delen.push(lb.circuit);
  const regel = stRegelTekst(lb);
  if (regel) delen.push(regel);
  if (lb.alleen_garage && g.garage_stap) delen.push("alleen uit je garage");
  if (parseInt(lb.max_deelnemers, 10) > 0) delen.push(`max ${parseInt(lb.max_deelnemers, 10)} deelnemers${lbKlaar(lb) ? " · KLAAR" : ""}`);
  const periodeTekst = periode(lb);
  if (periodeTekst) delen.push(periodeTekst.replace("Bouwjaar", "bouwjaar").replace("–", "-"));

  const cellen = [];
  const zet = (html, p, t) => cellen.push(stCel(html, p, t));

  // Kerngetallen
  zet(stGetal("Tijden", s.count, s.invalid ? `${s.invalid} onleesbaar` : "geldige rondetijden",
    rows.length ? () => stDetails("Alle tijden", LB_RIJEN, rows) : null), 1, 1);
  if (rows.length) {
    const f = s.fastest;
    zet(stGetal("Snelste ronde", f.tijd, `${f.auto}  ·  ${f.klasse}`, () => stDetails("Podium", LB_RIJEN, rows.slice(0, 3))), 1, 1);
    zet(stGetal("Gemiddelde ronde", stMs(s.avg_ms), `mediaan ${stMs(s.median_ms)}  ·  langzaamste ${s.slowest.tijd}`), 1, 1);
    zet(s.lengte
      ? stGetal("Gem. snelheid", stSnelheid(s.avg_speed), `snelste ${stSnelheid(s.top_speed)}  ·  ${c.lengte} km`)
      : stGetal("Spreiding P1 – laatste", verschilTekst(s.spread_ms), "Geef het circuit een lengte voor km/u"), 1, 1);
  } else {
    zet(stGetal("Snelste ronde", "–", "nog geen tijden"), 1, 1);
    zet(stGetal("Gemiddelde ronde", "–"), 1, 1);
    zet(stGetal("Gem. snelheid", "–"), 1, 1);
  }

  // Voortgang + snelste klassen
  const open = stNogTeRijden(g, lb);
  const metMax = parseInt(lb.max_deelnemers, 10) > 0;
  zet(stKaart(metMax ? (lbKlaar(lb) ? "Voortgang · KLAAR" : "Voortgang (max deelnemers)") : "Voortgang",
    stRing(s.total ? s.done / s.total : 0, `${s.done}/${s.total}`, metMax ? "plekken gevuld" : "auto's gereden",
    open.length ? () => stDetails("Nog te rijden", AUTO_LIJST, open,
      `${open.length} auto's in bezit die op dit leaderboard mogen en nog geen tijd hebben.`) : null)), 1, 2);
  const klassen = s.classes;
  zet(stKaart("Snelste klassen (gemiddelde rondetijd)", stBalken(klassen.map((k) => ({
    label: stSter(k.klasse, k.few), value: k.avg_ms, text: stMs(k.avg_ms),
    tooltip: `${stAantal(k.count)}  ·  beste ${stMs(k.best_ms)}` + (k.avg_speed ? `  ·  ${stSnelheid(k.avg_speed)}` : ""),
    payload: k.rows,
    summary: `Gemiddeld ${stMs(k.avg_ms)}  ·  beste ${stMs(k.best_ms)}  ·  ${stAantal(k.count)}`,
  })), { lagerIsBeter: true, klik: stNaarDetails("Klasse: ", LB_RIJEN) }), klassen.some((k) => k.few) ? ST_WEINIG_NOOT : ""), 3, 2);

  // Snelheid per auto
  zet(s.lengte
    ? stKaart("Snelheid per auto", stBalken(s.car_speed.map((r) => ({
      label: r.auto, value: r.speed, text: stSnelheid(r.speed),
      tooltip: `${r.klasse}  ·  ${r.tijd}  ·  P${r.pos}`, payload: [r],
    })), { klik: stNaarDetails("", LB_SNELHEID_RIJEN) }),
      `Gemiddelde snelheid over een ronde (${c.lengte} km).`,
      s.car_speed.length > 10 ? { aantal: s.car_speed.length,
        klik: () => stDetails("Snelheid per auto", LB_SNELHEID_RIJEN, s.car_speed) } : null)
    : stKaart("Snelheid per auto", stLeeg("Geef het circuit een lengte, dan zie je hier de snelheid per auto.")), 4, 2);

  // Verdeling klassen en categorieën
  zet(stKaart("Klassen op het leaderboard", stDonut(klassen.map((k) => ({ label: k.klasse, count: k.count, payload: k.rows })),
    stNaarDetails("Klasse: ", LB_RIJEN))), 2, 2);
  zet(stKaart("Categorieën", stDonut(s.categories.map((k) => ({ label: k.label, count: k.count, payload: k.rows })),
    stNaarDetails("Categorie: ", LB_RIJEN)), "Een auto met meerdere categorieën telt bij elk ervan mee."), 2, 2);

  // Achterstand + activiteit
  zet(stKaart("Hoe ver achter P1?", stBalken(rows.length ? s.gaps.map((x) => ({
    label: x.label, value: x.count, text: stAantal(x.count), payload: x.rows,
  })) : [], { klik: stNaarDetails("Achter P1: ", LB_RIJEN) })), 2, 2);
  zet(stKaart("Activiteit (tijden per week)", stLijn(s.activity),
    "Geïmporteerde tijden hebben geen datum en tellen hier niet mee."), 2, 2);

  // Verbeteringen en weetjes
  zet(stVerbeterKaart(s.improvements, LB_RIJEN), 1, 2);
  if (rows.length) {
    const l = s.slowest;
    zet(stGetal("Langzaamste ronde", l.tijd, `${l.auto}  ·  ${verschilTekst(l.gap)} achter P1`), 1, 1);
    const k = klassen[0];
    zet(stGetal("Snelste klasse", stSter(k.klasse, k.few), `gemiddeld ${stMs(k.avg_ms)}  ·  ${stAantal(k.count)}`,
      () => stDetails(`Klasse: ${k.klasse}`, LB_RIJEN, k.rows)), 2, 1);
  }

  return `<p class="st-info">${esc(delen.filter(Boolean).join("   ·   "))}</p>
    <div class="st-raster">${cellen.join("")}</div>`;
}
