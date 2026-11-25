/**
 * Poort voor andere sites op vanerumnederland.nl
 * Zet deze site achter de centrale inlog van account.vanerumnederland.nl.
 *
 * Gebruik in de Worker van een site (met static assets en "run_worker_first": true):
 *
 *   import { poort } from "./poort.js";
 *   export default {
 *     async fetch(request, env) {
 *       const stop = await poort(request, "schermen", env);   // site-id zoals in het beheer
 *       if (stop) return stop;                               // niet ingelogd / geen toegang
 *       return env.ASSETS.fetch(request);                     // gewoon de site
 *     },
 *   };
 *
 * en in wrangler.jsonc een service binding naar het portaal:
 *   "services": [{ "binding": "PORTAAL", "service": "vanerum-portaal" }]
 *
 * De site hoeft zelf geen geheimen of accounts te kennen: hij vraagt bij elke bezoeker
 * aan het portaal of die binnen mag (30 seconden onthouden per bezoeker).
 * /_portaal/ik geeft naam, e-mail (en de persoonlijke code van de 3D-schoolpagina's) van de ingelogde collega.
 */
const ACCOUNT = "https://account.vanerumnederland.nl";
const CACHE = new Map();

export async function poort(request, siteId, env = {}) {
  const account = env.ACCOUNT_URL || ACCOUNT;
  const url = new URL(request.url);
  if (url.pathname === "/uitloggen" || url.pathname === "/login") return Response.redirect(account + url.pathname, 302);

  const cookie = request.headers.get("Cookie") || "";
  const sleutel = siteId + "|" + ((cookie.match(/(?:^|;\s*)vn_sessie=([^;]+)/) || [])[1] || "");
  let r = CACHE.get(sleutel);
  if (!r || r.tot < Date.now()) {
    let status = 502, data = {};
    try {
      const adres = account + "/api/check?site=" + encodeURIComponent(siteId), init = { headers: { Cookie: cookie } };
      const a = env.PORTAAL ? await env.PORTAAL.fetch(new Request(adres, init)) : await fetch(adres, init);
      status = a.status;
      data = await a.json().catch(() => ({}));
    } catch (e) {}
    r = { status, data, tot: Date.now() + (status === 502 ? 0 : 30000) };
    if (CACHE.size > 500) CACHE.clear();
    CACHE.set(sleutel, r);
  }

  if (url.pathname === "/_portaal/ik") {
    return new Response(JSON.stringify(r.status === 200 ? r.data : { fout: "Niet ingelogd" }), {
      status: r.status === 200 ? 200 : 401,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  if (r.status === 200) return null;

  const navigatie = request.method === "GET" && ((request.headers.get("Accept") || "").includes("text/html") || url.pathname === "/" || url.pathname.endsWith(".html"));
  if (r.status === 401 && navigatie) {
    const naar = r.data.wachtwoord ? account + "/wachtwoord" : account + "/login";
    return Response.redirect(naar + "?terug=" + encodeURIComponent(url.href), 302);
  }
  if (r.status === 403 && navigatie) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Geen toegang</title>
<body style="font-family:Arial,sans-serif;background:#e9e8e4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<div style="background:#fff;border-top:6px solid #fbb900;padding:32px;max-width:400px"><h1 style="font-size:22px;margin:0 0 8px">Geen toegang</h1>
<p style="color:#6b6b68">Je bent ingelogd, maar je hebt geen toegang tot deze site. Vraag Paul om je toegang te geven.</p>
<p><a href="${account}/" style="color:#1e1e1e;font-weight:700">Naar mijn sites</a></p></div></body>`,
      { status: 403, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }
  return new Response(r.status === 502 ? "Inlogcontrole even niet bereikbaar, probeer het zo opnieuw" : "Geen toegang", { status: r.status === 502 ? 502 : r.status });
}
