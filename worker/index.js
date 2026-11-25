/**
 * Vanerum Nederland · portaal (Worker "vanerum-portaal")
 *
 *  - www.vanerumnederland.nl     landingspagina met inloggen en Vimo (vanerumnederland.nl stuurt door naar www)
 *  - account.vanerumnederland.nl centraal inloggen, "Mijn sites", wachtwoord, beheer van collega's en sites
 *  - /api/check?site=<id>        mag deze bezoeker op site X? (andere Workers vragen het via een service binding)
 *  - /api/supabase-sessie        Supabase-sessie voor de Offertes-site, zodat daar geen tweede inlog nodig is
 *
 * Alle accounts staan in Supabase (zelfde project als de Offertes-site):
 *  - wachtwoorden in Supabase Auth; naam, telefoon, rol, sites in public.profiles; sites in public.vn_sites;
 *    persoonlijke code van de 3D-schoolpagina's in public.vn_extra
 *  - de secret key staat als geheim SUPABASE_SECRET bij deze Worker (alleen in de apikey-header gebruikt)
 *
 * Eén inlog geldt voor alle sites: een eigen ondertekende cookie op .vanerumnederland.nl. De sleutel daarvoor staat
 * niet in de code: hij wordt afgeleid van SUPABASE_SECRET (of het geheim SESSIE_GEHEIM, als dat is gezet).
 * Er staan dus geen geheimen in deze repo.
 */
import { pagina } from "./paginas.js";

const DOMEIN = "vanerumnederland.nl";
const ACCOUNT_HOST = "account." + DOMEIN;
const ACCOUNT = "https://" + ACCOUNT_HOST;
const STANDAARD_SITES = [
  { id: "proefplaatsing", naam: "Kaartenmaker proefplaatsing", url: "https://proefplaatsing." + DOMEIN, openbaar: false },
  { id: "offertes", naam: "Offertes en prijslijsten", url: "https://offertes." + DOMEIN, openbaar: false },
  { id: "schermen", naam: "Schermen (tv's en touchscreens)", url: "https://schermen." + DOMEIN, openbaar: false },
  { id: "klaslokaal", naam: "Klaslokaal Lab", url: "https://klaslokaal." + DOMEIN, openbaar: false },
];
const VAST = ["proefplaatsing", "offertes", "schermen", "klaslokaal"]; // niet te verwijderen

const COOKIE = "vn_sessie";
const DAGEN = 30;
const OPEN = ["/fonts/", "/img/logo-geel-wit.png", "/img/logo-zwart.png", "/favicon.png"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = env.TEST ? request.headers.get("x-test-host") || (url.hostname.endsWith(DOMEIN) ? url.hostname : "account.test") : url.hostname;
    const c = { request, env, url, host, pad: url.pathname, m: request.method, account: env.TEST && env.ACCOUNT_URL ? env.ACCOUNT_URL : ACCOUNT };

    if (OPEN.some((p) => c.pad === p || (p.endsWith("/") && c.pad.startsWith(p)))) return env.ASSETS.fetch(request);
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET || !env.SUPABASE_PUBLISHABLE) return pagina("storing", null, {}, 503);
    if (host === DOMEIN) return redirect("https://www." + DOMEIN + c.pad + url.search);
    if (host === "www." + DOMEIN) return wwwHost(c);
    // het workers.dev-adres gedraagt zich als account.vanerumnederland.nl (handig om te testen)
    if (host === ACCOUNT_HOST || host.startsWith("account.") || host.endsWith(".workers.dev")) return accountHost(c);
    return new Response("Onbekend adres", { status: 404 });
  },
};

/* ======================= account.vanerumnederland.nl ======================= */
async function accountHost(c) {
  const { env, pad, m } = c;
  if (pad === "/login") return m === "POST" ? inloggen(c) : pagina("login", null, { terug: veiligTerug(c.url.searchParams.get("terug"), c) });
  if (pad === "/uitloggen") return uitloggen(c);
  if (pad === "/api/check") return check(c);

  const g = await sessieGebruiker(c);
  const navigatie = m === "GET" && !pad.startsWith("/api/");
  if (!g) return navigatie ? naarLogin(c, c.url.href) : json({ fout: "Niet ingelogd" }, 401);

  if (pad === "/wachtwoord") return m === "POST" ? wachtwoordWijzigen(c, g) : pagina("wachtwoord", g, { terug: veiligTerug(c.url.searchParams.get("terug"), c) });
  if (pad === "/api/supabase-sessie") return supabaseSessie(c, g);
  if (g.moetWijzigen && navigatie) return redirect("/wachtwoord" + (c.url.search || ""));

  if (pad === "/") return pagina("sites", g);
  if (pad === "/api/ik") {
    const sites = (await alleSites(env)).filter((s) => magNaar(g, s));
    return json({ email: g.email, naam: g.naam, admin: g.admin, sites });
  }
  if (pad === "/beheer" || pad.startsWith("/api/")) {
    if (!g.admin) return navigatie ? redirect("/") : json({ fout: "Geen toegang" }, 403);
    if (pad === "/beheer") return pagina("beheer", g);
    return beheerApi(c, g);
  }
  return navigatie ? redirect("/") : json({ fout: "Onbekend" }, 404);
}

/* ======================= www.vanerumnederland.nl: landingspagina met inloggen ======================= */
async function wwwHost(c) {
  const { env, pad, m } = c;
  if (pad === "/login" && m === "POST") return inloggen(c);
  if (pad === "/uitloggen") return uitloggen(c, "/");
  if (pad === "/api/ik") {
    const g = await sessieGebruiker(c);
    if (!g) return json({ fout: "Niet ingelogd" }, 401);
    const sites = (await alleSites(env)).filter((s) => magNaar(g, s));
    return json({ naam: g.naam, email: g.email, admin: g.admin, moetWijzigen: g.moetWijzigen, sites });
  }
  if (pad === "/" || pad === "/index.html") {
    const a = await env.ASSETS.fetch(new Request(c.url.origin + "/www/", c.request));
    const h = new Headers(a.headers);
    h.set("Cache-Control", "no-cache");
    return new Response(a.body, { status: a.status, headers: h });
  }
  if (pad.startsWith("/www/")) return env.ASSETS.fetch(c.request);
  return redirect("/");
}

/* Andere sites vragen hier of de bezoeker binnen mag: GET /api/check?site=<id>, met de cookie van de bezoeker. */
async function check(c) {
  const site = await haalSite(c.env, c.url.searchParams.get("site") || "");
  if (!site) return json({ fout: "Onbekende site" }, 404);
  if (site.openbaar) return json({ ok: true, openbaar: true });
  const g = await sessieGebruiker(c, true);
  if (!g) return json({ fout: "Niet ingelogd", login: c.account + "/login" }, 401);
  if (g.moetWijzigen) return json({ fout: "Wachtwoord kiezen", wachtwoord: c.account + "/wachtwoord" }, 401);
  if (!magNaar(g, site)) return json({ fout: "Geen toegang", naam: g.naam }, 403);
  return json({ ok: true, id: g.id, email: g.email, naam: g.naam, admin: g.admin, code: await kmCode(c.env, g) });
}

/* De Offertes-site haalt hier een eigen Supabase-sessie op voor de ingelogde collega (zonder tweede inlog). */
async function supabaseSessie(c, g) {
  if (g.moetWijzigen || !magNaar(g, { id: "offertes", openbaar: false })) return json({ fout: "Geen toegang" }, 403);
  const link = await sb(c.env, "/auth/v1/admin/generate_link", { method: "POST", body: { type: "magiclink", email: g.email } });
  const hashed = link.ok && (link.j.hashed_token || (link.j.properties && link.j.properties.hashed_token));
  if (!hashed) return json({ fout: "Supabase-sessie maken lukt niet (" + link.status + ")" }, 502);
  const v = await sb(c.env, "/auth/v1/verify", { method: "POST", pub: true, body: { type: "magiclink", token_hash: hashed } });
  if (!v.ok || !v.j.access_token) return json({ fout: "Supabase-sessie maken lukt niet (" + v.status + ")" }, 502);
  return json({ access_token: v.j.access_token, refresh_token: v.j.refresh_token, email: g.email });
}

/* ======================= hulpjes ======================= */
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const vanB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));
const json = (d, status = 200, extra = {}) =>
  new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });
const redirect = (naar, extra = {}) => new Response(null, { status: 302, headers: { Location: naar, "cache-control": "no-store", ...extra } });
const naarLogin = (c, terug) => redirect(c.account + "/login?terug=" + encodeURIComponent(terug));
const normEmail = (e) => String(e || "").trim().toLowerCase();
const geldigEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
async function lees(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}
function veiligTerug(t, c) {
  try {
    const u = new URL(t);
    if (u.protocol === "https:" && (u.hostname === DOMEIN || u.hostname.endsWith("." + DOMEIN))) return u.href;
    if (c.env.TEST) return u.href;
  } catch (e) {}
  return "";
}
function tijdelijkWachtwoord() {
  const t = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (x) => t[x % t.length]).join("");
}
const magNaar = (g, site) => !!site && (site.openbaar || (!g.geblokkeerd && (g.admin || g.sites.includes(site.id))));

/* ======================= Supabase ======================= */
async function sb(env, pad, { method = "GET", body, pub = false, prefer } = {}) {
  const headers = { apikey: pub ? env.SUPABASE_PUBLISHABLE : env.SUPABASE_SECRET, "content-type": "application/json" };
  if (prefer) headers.Prefer = prefer;
  let r;
  try {
    r = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + pad, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    return { ok: false, status: 0, j: { message: String(e) } };
  }
  const t = await r.text();
  let j = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch (e) {
    j = { message: t };
  }
  return { ok: r.ok, status: r.status, j };
}
const foutVan = (r) => (r.j && (r.j.msg || r.j.message || r.j.error_description || r.j.error)) || "Supabase gaf fout " + r.status;

// Profielrij → gebruiker zoals de rest van de code hem kent
function gebruikerVan(p) {
  return {
    id: p.id,
    email: normEmail(p.email),
    naam: p.naam || normEmail(p.email).split("@")[0],
    telefoon: p.telefoon || "",
    admin: p.rol === "beheerder" && !p.geblokkeerd,
    sites: Array.isArray(p.sites) ? p.sites : [],
    moetWijzigen: !!p.moet_wijzigen,
    geblokkeerd: !!p.geblokkeerd,
    v: p.sessie_versie || 0,
  };
}
async function profielVan(env, veld, waarde) {
  const r = await sb(env, `/rest/v1/profiles?${veld}=eq.${encodeURIComponent(waarde)}&select=*`);
  return r.ok && r.j && r.j[0] ? gebruikerVan(r.j[0]) : null;
}
async function patchProfiel(env, id, data) {
  const r = await sb(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: data, prefer: "return=minimal" });
  if (!r.ok) throw new Error(foutVan(r));
}
// Rechten → kolommen. actief = mag bij de Offertes-site (dat gebruiken de regels in Supabase).
function rechtenKolommen(admin, sites) {
  return { rol: admin ? "beheerder" : "accountmanager", sites, actief: admin || sites.includes("offertes") };
}
async function kmCode(env, g) {
  const r = await sb(env, `/rest/v1/vn_extra?id=eq.${encodeURIComponent(g.id)}&select=km_code`);
  return (r.ok && r.j && r.j[0] && r.j[0].km_code) || "";
}
async function zetKmCode(env, id, code) {
  const r = await sb(env, "/rest/v1/vn_extra", { method: "POST", body: { id, km_code: code }, prefer: "resolution=merge-duplicates,return=minimal" });
  if (!r.ok) throw new Error(foutVan(r));
}
async function maakSupabaseGebruiker(env, { email, naam, wachtwoord }) {
  const r = await sb(env, "/auth/v1/admin/users", { method: "POST", body: { email, password: wachtwoord, email_confirm: true, user_metadata: { naam } } });
  if (!r.ok) {
    const f = foutVan(r);
    throw new Error(/already|registered|exists/i.test(f) ? "Er bestaat al een account met dit e-mailadres" : f);
  }
  return r.j.id || (r.j.user && r.j.user.id);
}
async function zetSupabaseWachtwoord(env, id, wachtwoord) {
  const r = await sb(env, `/auth/v1/admin/users/${id}`, { method: "PUT", body: { password: wachtwoord } });
  if (!r.ok) throw new Error(foutVan(r));
}
async function wachtwoordKlopt(env, email, wachtwoord) {
  const r = await sb(env, "/auth/v1/token?grant_type=password", { method: "POST", pub: true, body: { email, password: wachtwoord } });
  return r.ok && r.j && r.j.user ? r.j.user.id : null;
}

/* ----- sites ----- */
async function alleSites(env) {
  const r = await sb(env, "/rest/v1/vn_sites?select=id,naam,url,openbaar&order=naam");
  const lijst = r.ok && Array.isArray(r.j) ? r.j : [];
  for (const s of STANDAARD_SITES) if (!lijst.find((x) => x.id === s.id)) lijst.push(s);
  return lijst.sort((a, b) => a.naam.localeCompare(b.naam));
}
async function haalSite(env, id) {
  if (!id) return null;
  const r = await sb(env, `/rest/v1/vn_sites?id=eq.${encodeURIComponent(id)}&select=id,naam,url,openbaar`);
  return (r.ok && r.j && r.j[0]) || STANDAARD_SITES.find((s) => s.id === id) || null;
}

/* ======================= sessie ======================= */
// Sleutel voor de inlogcookie: SESSIE_GEHEIM als dat is gezet, anders afgeleid van SUPABASE_SECRET (staat niet in de code)
let HMAC = null;
async function hmac(env) {
  if (!HMAC) {
    const bron = env.SESSIE_GEHEIM || (await crypto.subtle.digest("SHA-256", enc.encode("vn-sessie|" + env.SUPABASE_SECRET)));
    HMAC = crypto.subtle.importKey("raw", typeof bron === "string" ? enc.encode(bron) : bron, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  }
  return HMAC;
}
function cookieAttr(c) {
  const dom = c.host === DOMEIN || c.host.endsWith("." + DOMEIN) ? `; Domain=.${DOMEIN}` : "";
  return `; Path=/${dom}; HttpOnly; Secure; SameSite=Lax`;
}
async function maakCookie(c, g) {
  const inhoud = b64(enc.encode(JSON.stringify({ i: g.id, v: g.v, t: Date.now() + DAGEN * 864e5 })));
  const sig = b64(await crypto.subtle.sign("HMAC", await hmac(c.env), enc.encode(inhoud)));
  return `${COOKIE}=${inhoud}.${sig}; Max-Age=${DAGEN * 86400}${cookieAttr(c)}`;
}
// Korte cache per Worker-instantie, zodat niet elk plaatje een Supabase-opvraging kost
const CACHE = new Map();
async function sessieGebruiker(c, cache = false) {
  const m = (c.request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!m) return null;
  const waarde = m[1];
  if (cache) {
    const x = CACHE.get(waarde);
    if (x && x.tot > Date.now()) return x.g;
  }
  const [inhoud, sig] = waarde.split(".");
  if (!inhoud || !sig) return null;
  let g = null;
  try {
    if (await crypto.subtle.verify("HMAC", await hmac(c.env), vanB64(sig), enc.encode(inhoud))) {
      const d = JSON.parse(new TextDecoder().decode(vanB64(inhoud)));
      if (d.i && d.t > Date.now()) {
        const p = await profielVan(c.env, "id", d.i);
        if (p && p.v === d.v && !p.geblokkeerd) g = p;
      }
    }
  } catch (e) {}
  if (cache) {
    if (CACHE.size > 500) CACHE.clear();
    CACHE.set(waarde, { g, tot: Date.now() + 30000 });
  }
  return g;
}

/* ======================= inloggen / uitloggen / wachtwoord ======================= */
async function inloggen(c) {
  const { env } = c;
  const b = await lees(c.request);
  const email = normEmail(b.email);
  const wachtwoord = String(b.wachtwoord || "");
  if (!email || !wachtwoord) return json({ fout: "Vul je e-mailadres en wachtwoord in" }, 400);

  const id = await wachtwoordKlopt(env, email, wachtwoord);
  const g = id ? await profielVan(env, "id", id) : null;
  if (!g || g.geblokkeerd) {
    await new Promise((r) => setTimeout(r, 600));
    return json({ fout: "E-mailadres of wachtwoord klopt niet" }, 401);
  }
  const terug = veiligTerug(b.terug, c);
  const naar = g.moetWijzigen ? "/wachtwoord" + (terug ? "?terug=" + encodeURIComponent(terug) : "") : terug || "/";
  return json({ naar }, 200, { "Set-Cookie": await maakCookie(c, g) });
}

function uitloggen(c, naar = "/login") {
  return redirect(naar, { "Set-Cookie": `${COOKIE}=; Max-Age=0${cookieAttr(c)}` });
}

async function wachtwoordWijzigen(c, g) {
  const b = await lees(c.request);
  const nieuw = String(b.nieuw || "");
  if (!(await wachtwoordKlopt(c.env, g.email, String(b.oud || "")))) return json({ fout: "Je huidige wachtwoord klopt niet" }, 400);
  if (nieuw.length < 8) return json({ fout: "Kies een wachtwoord van minstens 8 tekens" }, 400);
  if (nieuw === b.oud) return json({ fout: "Kies een ander wachtwoord dan het huidige" }, 400);
  try {
    await zetSupabaseWachtwoord(c.env, g.id, nieuw);
    g.v += 1;
    await patchProfiel(c.env, g.id, { moet_wijzigen: false, sessie_versie: g.v });
  } catch (e) {
    return json({ fout: "Opslaan lukt niet: " + e.message }, 502);
  }
  return json({ naar: veiligTerug(b.terug, c) || "/" }, 200, { "Set-Cookie": await maakCookie(c, g) });
}

/* ======================= beheer ======================= */
async function beheerApi(c, ik) {
  const { env, pad, m } = c;
  try {
    if (pad === "/api/beheer" && m === "GET") {
      const [p, sites] = await Promise.all([sb(env, "/rest/v1/profiles?select=*&order=naam"), alleSites(env)]);
      if (!p.ok) throw new Error(foutVan(p));
      const x = await sb(env, "/rest/v1/vn_extra?select=id,km_code");
      const metCode = new Set((x.ok && x.j ? x.j : []).filter((r) => r.km_code).map((r) => r.id));
      return json({
        ik: ik.email,
        sites,
        vast: VAST,
        gebruikers: p.j
          .map(gebruikerVan)
          .filter((g) => !g.geblokkeerd)
          .map((g) => ({ email: g.email, naam: g.naam, telefoon: g.telefoon, admin: g.admin, code: metCode.has(g.id), moetWijzigen: g.moetWijzigen, sites: g.sites })),
      });
    }
    const b = await lees(c.request);

    /* --- sites --- */
    if (pad === "/api/sites" && m === "POST") {
      const naam = String(b.naam || "").trim();
      let adres = String(b.url || "").trim();
      if (!naam) return json({ fout: "Vul een naam in" }, 400);
      if (adres && !/^https?:\/\//.test(adres)) adres = "https://" + adres;
      let id, origin;
      try {
        const u = new URL(adres);
        origin = u.origin;
        id = slug(u.hostname.endsWith("." + DOMEIN) ? u.hostname.slice(0, -DOMEIN.length - 1) : u.hostname);
      } catch (e) {
        return json({ fout: "Vul een geldig adres in, bijv. https://schermen.vanerumnederland.nl" }, 400);
      }
      if (!id || (await alleSites(env)).find((s) => s.id === id)) return json({ fout: "Deze site staat er al" }, 409);
      const site = { id, naam, url: origin, openbaar: !!b.openbaar };
      const r = await sb(env, "/rest/v1/vn_sites", { method: "POST", body: site, prefer: "return=minimal" });
      if (!r.ok) throw new Error(foutVan(r));
      return json({ ok: true, site });
    }
    if (pad === "/api/sites" && m === "DELETE") {
      if (VAST.includes(b.id)) return json({ fout: "Deze site kun je hier niet verwijderen" }, 400);
      const r = await sb(env, `/rest/v1/vn_sites?id=eq.${encodeURIComponent(b.id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(foutVan(r));
      return json({ ok: true });
    }
    if (pad === "/api/sites/wijzig" && m === "POST") {
      const site = await haalSite(env, b.id);
      if (!site) return json({ fout: "Site niet gevonden" }, 404);
      if (typeof b.naam === "string" && b.naam.trim()) site.naam = b.naam.trim();
      if (typeof b.openbaar === "boolean") site.openbaar = b.openbaar;
      const r = await sb(env, "/rest/v1/vn_sites", { method: "POST", body: site, prefer: "resolution=merge-duplicates,return=minimal" });
      if (!r.ok) throw new Error(foutVan(r));
      return json({ ok: true });
    }

    /* --- collega's --- */
    const email = normEmail(b.email);
    if (!geldigEmail(email)) return json({ fout: "Vul een geldig e-mailadres in" }, 400);
    const sitesVan = (x) => (Array.isArray(x) ? [...new Set(x.map(String))].slice(0, 100) : []);

    if (pad === "/api/gebruikers" && m === "POST") {
      const naam = String(b.naam || "").trim();
      if (!naam) return json({ fout: "Vul een naam in" }, 400);
      const tijdelijk = tijdelijkWachtwoord();
      const bestaand = await profielVan(env, "email", email);
      if (bestaand && !bestaand.geblokkeerd) return json({ fout: "Er bestaat al een account met dit e-mailadres" }, 409);
      let id;
      if (bestaand) {
        // Eerder verwijderd (geblokkeerd omdat er offertes op zijn naam staan): weer aanzetten
        id = bestaand.id;
        const r = await sb(env, `/auth/v1/admin/users/${id}`, { method: "PUT", body: { ban_duration: "none", password: tijdelijk } });
        if (!r.ok) throw new Error(foutVan(r));
      } else id = await maakSupabaseGebruiker(env, { email, naam, wachtwoord: tijdelijk });
      await patchProfiel(env, id, {
        naam, telefoon: String(b.telefoon || "").trim(), ...rechtenKolommen(!!b.admin, sitesVan(b.sites)),
        moet_wijzigen: true, geblokkeerd: false, sessie_versie: bestaand ? bestaand.v + 1 : 0,
      });
      if (String(b.code || "").trim()) await zetKmCode(env, id, String(b.code).trim());
      return json({ ok: true, tijdelijk });
    }
    const g = await profielVan(env, "email", email);
    if (!g || g.geblokkeerd) return json({ fout: "Account niet gevonden" }, 404);

    if (pad === "/api/gebruikers/reset" && m === "POST") {
      const tijdelijk = tijdelijkWachtwoord();
      await zetSupabaseWachtwoord(env, g.id, tijdelijk);
      await patchProfiel(env, g.id, { moet_wijzigen: true, sessie_versie: g.v + 1 });
      return json({ ok: true, tijdelijk });
    }
    if (pad === "/api/gebruikers/wijzig" && m === "POST") {
      const data = {};
      if (typeof b.naam === "string" && b.naam.trim()) data.naam = b.naam.trim();
      if (typeof b.telefoon === "string") data.telefoon = b.telefoon.trim();
      const admin = typeof b.admin === "boolean" && email !== ik.email ? b.admin : g.admin;
      const sites = Array.isArray(b.sites) ? sitesVan(b.sites) : g.sites;
      Object.assign(data, rechtenKolommen(admin, sites));
      await patchProfiel(env, g.id, data);
      if (typeof b.code === "string") await zetKmCode(env, g.id, b.code.trim());
      return json({ ok: true });
    }
    if (pad === "/api/gebruikers" && m === "DELETE") {
      if (email === ik.email) return json({ fout: "Je kunt je eigen account niet verwijderen" }, 400);
      const r = await sb(env, `/auth/v1/admin/users/${g.id}`, { method: "DELETE" });
      if (r.ok) return json({ ok: true });
      // Heeft offertes op zijn naam: account blokkeren in plaats van weggooien, zodat de offertes blijven kloppen.
      await sb(env, `/auth/v1/admin/users/${g.id}`, { method: "PUT", body: { ban_duration: "876000h" } });
      await patchProfiel(env, g.id, { ...rechtenKolommen(false, []), geblokkeerd: true, sessie_versie: g.v + 1 });
      return json({ ok: true, geblokkeerd: true });
    }
    return json({ fout: "Onbekende actie" }, 400);
  } catch (e) {
    return json({ fout: e.message }, 502);
  }
}
