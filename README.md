# Vanerum portaal

Worker `vanerum-portaal` voor Vanerum Nederland:

- **www.vanerumnederland.nl**: landingspagina met inloggen en Vimo (`public/www/`). `vanerumnederland.nl` stuurt door naar www.
- **account.vanerumnederland.nl**: inloggen, *Mijn sites*, wachtwoord wijzigen en **Beheer** (collega's, toegang per site, sites).
- **/api/check?site=&lt;id&gt;**: andere sites vragen hier (via een service binding) of een bezoeker binnen mag.
- **/api/supabase-sessie**: de Offertes-site haalt hier een Supabase-sessie op, zodat daar geen tweede inlog nodig is.

## Accounts
Alle accounts staan in Supabase, hetzelfde project als de Offertes-site (repo `prijslijsten`, zie `supabase/centraal.sql` daar):
wachtwoorden in Supabase Auth; naam, telefoon, rol, sites in `public.profiles`; sites in `public.vn_sites`;
persoonlijke code van de 3D-schoolpagina's in `public.vn_extra`. `profiles.actief` = toegang tot de Offertes-site.

## Geheimen
Er staan **geen geheimen** in deze repo. In Cloudflare bij deze Worker:
- **`SUPABASE_SECRET`** (type Secret): de secret key uit Supabase (`sb_secret_...`), alleen in de `apikey`-header gebruikt.
- De sleutel van de inlogcookie wordt daarvan afgeleid. Wil je die los zetten: geheim `SESSIE_GEHEIM`.
`SUPABASE_URL` en `SUPABASE_PUBLISHABLE` staan in `wrangler.jsonc`; die zijn openbaar.

## Een site aankoppelen
1. Zet de site in **Beheer** (naam + adres). Het site-id is het subdomein, bijv. `schermen`.
2. Kopieer `voor-sites/poort.js` naar de Worker van die site, laat die eerst `poort(request, "<id>", env)` aanroepen en
   zet in zijn `wrangler.jsonc`: `"services": [{ "binding": "PORTAAL", "service": "vanerum-portaal" }]`.
3. Koppel het adres als custom domain aan die Worker.

Aangekoppeld: kaartenmaker (proefplaatsing), prijslijsten (offertes), schermen-showroom (schermen), klaslokaallab (klaslokaal).
