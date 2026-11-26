/* Pagina's van het centrale accountsysteem (account.vanerumnederland.nl) */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const STIJL = `
@font-face{font-family:"Neue Montreal";src:url(/fonts/NeueMontreal-Regular.woff2) format("woff2");font-weight:400}
@font-face{font-family:"Neue Montreal";src:url(/fonts/NeueMontreal-Bold.woff2) format("woff2");font-weight:700}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;font-family:"Neue Montreal",Arial,sans-serif;letter-spacing:.03em;color:#1e1e1e;background:#e9e8e4}
.kop{min-height:58px;background:#1e1e1e;display:flex;align-items:center;flex-wrap:wrap;gap:6px 18px;padding:10px 20px;color:#fff}
.kop img{height:17px}.kop a{color:#fff;font-size:13px;text-decoration:none;opacity:.8}.kop a:hover,.kop a.nu{opacity:1}.kop a.nu{box-shadow:0 2px 0 #fbb900}
.kop .r{margin-left:auto;display:flex;flex-wrap:wrap;gap:6px 18px}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:24px}
.kaart{background:#fff;width:100%;max-width:400px;padding:36px 32px 32px;border-top:6px solid #fbb900}
.breed{max-width:1000px;align-self:flex-start}.midden{max-width:720px;align-self:flex-start}
h1{font-size:22px;margin:0 0 6px}h2{font-size:16px;margin:34px 0 10px}
p{margin:0 0 20px;color:#6b6b68;font-size:14px;line-height:1.45}
label{display:block;font-size:13px;font-weight:700;margin:14px 0 6px}
input[type=email],input[type=password],input[type=text],input[type=url]{width:100%;font:inherit;font-size:16px;padding:11px 12px;border:1px solid #dedcd6;background:#f4f4f2;outline:none}
input:focus{border-color:#1e1e1e;background:#fff}
input[type=checkbox]{width:17px;height:17px;accent-color:#1e1e1e;cursor:pointer}
button{font:inherit;font-weight:700;font-size:15px;padding:12px 16px;border:0;background:#fbb900;color:#1e1e1e;cursor:pointer}
button.vol{margin-top:20px;width:100%}button.sec{background:#f4f4f2;font-size:13px;padding:7px 10px}button.weg{background:#fff;color:#c0392b;border:1px solid #e8c4bf;font-size:13px;padding:6px 10px}
button:disabled{opacity:.6;cursor:default}
.fout{color:#c0392b;font-size:13px;min-height:18px;margin-top:10px}
.tabel{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:10px 8px;border-bottom:1px solid #dedcd6;vertical-align:middle}
th{font-size:12px;color:#6b6b68;font-weight:700}th.site,td.site{text-align:center;width:1%;white-space:nowrap}th.site{max-width:110px;white-space:normal;line-height:1.25}
td.acties{text-align:right;white-space:nowrap}td.acties button{margin-left:6px}
small{color:#6b6b68}
.tag{display:inline-block;font-size:11px;padding:2px 6px;background:#f4f4f2;margin:2px 0 0 6px}.tag.geel{background:#fbb900}
.rij{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}@media(max-width:620px){.rij{grid-template-columns:1fr}}
.vink{display:flex;align-items:center;gap:8px;font-weight:400;margin:8px 0}
.vinken{display:flex;flex-wrap:wrap;gap:4px 22px;margin-top:4px}
.melding{background:#fff8e1;border-left:4px solid #fbb900;padding:12px 14px;margin:16px 0;font-size:14px;display:none;line-height:1.5}
.melding code{font-size:16px;font-weight:700;letter-spacing:.06em;user-select:all}
.tegels{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-top:8px}
.tegel{display:block;background:#f4f4f2;padding:20px 18px;text-decoration:none;color:#1e1e1e;border-left:4px solid #fbb900;transition:background .15s}
.tegel:hover{background:#fbb900}.tegel b{display:block;font-size:16px;margin-bottom:4px}.tegel span{font-size:12px;color:#6b6b68;overflow-wrap:anywhere}.tegel:hover span{color:#1e1e1e}
`;

function kop(g, nu) {
  if (!g) return `<div class="kop"><img src="/img/logo-geel-wit.png" alt="Vanerum"></div>`;
  const a = (href, t, k) => `<a href="${href}"${nu === k ? ' class="nu"' : ""}>${t}</a>`;
  return `<div class="kop"><img src="/img/logo-geel-wit.png" alt="Vanerum"><div class="r">${a("https://www.vanerumnederland.nl/", "Mijn sites", "sites")}${
    g.admin ? a("/beheer", "Beheer", "beheer") : ""
  }${a("/wachtwoord", "Wachtwoord", "wachtwoord")}<a href="/uitloggen">Uitloggen</a></div></div>`;
}

export function pagina(soort, g, data = {}, status = 200) {
  const r = {
    login: () => ["Inloggen", kop(null), LOGIN(data)],
    wachtwoord: () => ["Wachtwoord", kop(g, "wachtwoord"), WACHTWOORD(g, data)],
    sites: () => ["Mijn sites", kop(g, "sites"), SITES(g)],
    beheer: () => ["Beheer", kop(g, "beheer"), BEHEER],
    geentoegang: () => ["Geen toegang", kop(null), GEEN_TOEGANG(g, data)],
    storing: () => ["Even niet beschikbaar", kop(null), STORING],
  }[soort]();
  return new Response(
    `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${r[0]} · Vanerum Nederland</title><link rel="icon" href="/favicon.png"><meta name="robots" content="noindex"><style>${STIJL}</style></head>
<body>${r[1]}${r[2]}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

const LOGIN = (d) => `<main><form class="kaart" id="f">
  <h1>Inloggen</h1>
  <p>Log in met je Vanerum-mailadres en je wachtwoord. Met één account kom je op alle Vanerum-tools waar je toegang toe hebt.</p>
  <label for="email">E-mailadres</label><input id="email" type="email" autocomplete="username" autofocus required>
  <label for="ww">Wachtwoord</label><input id="ww" type="password" autocomplete="current-password" required>
  <button class="vol" id="knop">Inloggen</button>
  <div class="fout" id="fout"></div>
</form></main>
<script>
const terug=${JSON.stringify(d.terug || "")};
f.addEventListener("submit",async e=>{
  e.preventDefault();knop.disabled=true;fout.textContent="";
  try{
    const r=await fetch("/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:email.value,wachtwoord:ww.value,terug})});
    const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.fout||"Inloggen lukt niet");
    location.href=j.naar||"/";
  }catch(x){fout.textContent=x.message;knop.disabled=false}
});
</script>`;

const WACHTWOORD = (g, d) => `<main><form class="kaart" id="f">
  <h1>${g.moetWijzigen ? "Kies je eigen wachtwoord" : "Wachtwoord wijzigen"}</h1>
  <p>${g.moetWijzigen ? "Je bent ingelogd met een tijdelijk wachtwoord. Kies nu een eigen wachtwoord van minstens 8 tekens." : "Kies een nieuw wachtwoord van minstens 8 tekens."}</p>
  <input type="email" autocomplete="username" value="${esc(g.email)}" hidden>
  <label for="oud">${g.moetWijzigen ? "Tijdelijk wachtwoord" : "Huidig wachtwoord"}</label><input id="oud" type="password" autocomplete="current-password" required autofocus>
  <label for="n1">Nieuw wachtwoord</label><input id="n1" type="password" autocomplete="new-password" minlength="8" required>
  <label for="n2">Nieuw wachtwoord (nog een keer)</label><input id="n2" type="password" autocomplete="new-password" minlength="8" required>
  <button class="vol" id="knop">Opslaan</button><div class="fout" id="fout"></div>
</form></main>
<script>
const terug=${JSON.stringify(d.terug || "")};
f.addEventListener("submit",async e=>{
  e.preventDefault();fout.textContent="";if(n1.value!==n2.value){fout.textContent="De twee nieuwe wachtwoorden zijn niet hetzelfde";return}
  knop.disabled=true;
  try{
    const r=await fetch("/wachtwoord",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({oud:oud.value,nieuw:n1.value,terug})});
    const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.fout||"Opslaan lukt niet");
    location.href=j.naar||"/";
  }catch(x){fout.textContent=x.message;knop.disabled=false}
});
</script>`;

const SITES = (g) => `<main><div class="kaart midden">
  <h1>Hallo ${esc(g.naam)}</h1>
  <p>Dit zijn de Vanerum-tools waar je toegang toe hebt.</p>
  <div class="tegels" id="tegels"><small>Laden…</small></div>
</div></main>
<script>
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
fetch("/api/ik").then(r=>r.json()).then(j=>{
  tegels.innerHTML=(j.sites||[]).map(s=>'<a class="tegel" href="'+esc(s.url)+'"><b>'+esc(s.naam)+'</b><span>'+esc(s.url.replace(/^https?:\\/\\//,""))+'</span></a>').join("")||"<small>Je hebt nog nergens toegang toe.</small>";
});
</script>`;

const GEEN_TOEGANG = (g, d) => `<main><div class="kaart">
  <h1>Geen toegang</h1>
  <p>Je bent ingelogd als <b>${esc(g.naam)}</b>, maar je hebt geen toegang tot <b>${esc(d.site.naam)}</b>.</p>
  <a href="${esc(d.account)}/"><button class="vol" type="button">Naar mijn sites</button></a>
  <p style="margin:14px 0 0;font-size:13px"><a href="${esc(d.account)}/uitloggen" style="color:#6b6b68">Inloggen met een ander account</a></p>
</div></main>`;

const STORING = `<main><div class="kaart">
  <h1>Even niet beschikbaar</h1>
  <p>Het accountsysteem is nog niet gekoppeld aan Supabase. Zet in Cloudflare bij deze Worker het geheim <b>SUPABASE_SECRET</b> (de secret key uit Supabase) en probeer het daarna opnieuw.</p>
</div></main>`;

const BEHEER = `<main><div class="kaart breed">
  <h1>Beheer</h1>
  <p>Vink per collega aan bij welke sites hij mag. Beheerders mogen overal bij. Wijzigingen gelden meteen.</p>
  <div class="melding" id="melding"></div>

  <h2 style="margin-top:10px">Collega's</h2>
  <div class="tabel"><table><thead id="g-kop"></thead><tbody id="g-lijst"><tr><td>Laden…</td></tr></tbody></table></div>

  <h2>Collega toevoegen</h2>
  <form id="g-nieuw">
    <div class="rij">
      <div><label for="n-naam">Naam</label><input id="n-naam" type="text" required></div>
      <div><label for="n-email">E-mailadres</label><input id="n-email" type="email" required></div>
      <div><label for="n-tel">Telefoon <small>(komt op de offerte)</small></label><input id="n-tel" type="text"></div>
    </div>
    <label>Toegang tot</label><div class="vinken" id="n-sites"></div>
    <label for="n-code">Persoonlijke code 3D-schoolpagina's <small>(optioneel, voor online bewaren in de kaartenmaker)</small></label><input id="n-code" type="text" autocomplete="off">
    <label class="vink"><input id="n-admin" type="checkbox"> Beheerder (mag overal bij en mag dit beheer gebruiken)</label>
    <button style="margin-top:10px" id="n-knop">Account aanmaken</button><div class="fout" id="n-fout"></div>
  </form>

  <h2>Sites</h2>
  <p>Een besloten site is alleen te openen voor collega's met toegang. Een openbare site kan iedereen openen, bijvoorbeeld voor scholen.</p>
  <div class="tabel"><table><thead><tr><th>Site</th><th>Adres</th><th class="site">Openbaar</th><th></th></tr></thead><tbody id="s-lijst"></tbody></table></div>

  <h2>Site toevoegen</h2>
  <form id="s-nieuw">
    <div class="rij">
      <div><label for="s-naam">Naam</label><input id="s-naam" type="text" placeholder="Schermen showroom" required></div>
      <div><label for="s-url">Adres</label><input id="s-url" type="text" placeholder="schermen.vanerumnederland.nl" required></div>
    </div>
    <label class="vink"><input id="s-open" type="checkbox"> Openbaar (iedereen mag erin, zonder inloggen)</label>
    <button style="margin-top:10px" id="s-knop">Site toevoegen</button><div class="fout" id="s-fout"></div>
    <p style="margin-top:10px;font-size:13px">Let op: de site zelf moet ook nog aan de centrale inlog gekoppeld worden. Tot dan is hij alleen zichtbaar in dit overzicht.</p>
  </form>
</div></main>
<script>
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let D={gebruikers:[],sites:[],vast:[],ik:""};
async function api(pad,opt={}){const r=await fetch(pad,{...opt,headers:{"content-type":"application/json"}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.fout||("Fout "+r.status));return j}
function meld(html){const m=$("#melding");m.innerHTML=html;m.style.display="block";m.scrollIntoView({behavior:"smooth",block:"nearest"})}
function teken(){
  const S=D.sites;
  $("#g-kop").innerHTML="<tr><th>Collega</th>"+S.map(s=>'<th class="site">'+esc(s.naam)+(s.openbaar?"<br><small>openbaar</small>":"")+"</th>").join("")+'<th class="site">Beheerder</th><th></th></tr>';
  $("#g-lijst").innerHTML=D.gebruikers.map(g=>{
    const ik=g.email===D.ik;
    return '<tr data-email="'+esc(g.email)+'"><td><b>'+esc(g.naam)+"</b>"+(g.moetWijzigen?'<span class="tag geel">nog niet ingelogd</span>':"")+"<br><small>"+esc(g.email)+(g.telefoon?" · "+esc(g.telefoon):"")+"</small></td>"+
      S.map(s=>'<td class="site"><input type="checkbox" data-site="'+esc(s.id)+'"'+(g.admin||s.openbaar||g.sites.includes(s.id)?" checked":"")+(g.admin||s.openbaar?" disabled":"")+"></td>").join("")+
      '<td class="site"><input type="checkbox" data-admin'+(g.admin?" checked":"")+(ik?" disabled":"")+'></td>'+
      '<td class="acties"><button class="sec" data-bewerk>Bewerken</button><button class="sec" data-reset>Nieuw wachtwoord</button>'+(ik?"":'<button class="weg" data-weg>Verwijderen</button>')+"</td></tr>";
  }).join("")||'<tr><td>Nog geen collega\\'s</td></tr>';
  $("#n-sites").innerHTML=S.filter(s=>!s.openbaar).map(s=>'<label class="vink"><input type="checkbox" value="'+esc(s.id)+'"'+(s.id==="proefplaatsing"?" checked":"")+"> "+esc(s.naam)+"</label>").join("")||"<small>Geen besloten sites</small>";
  $("#s-lijst").innerHTML=S.map(s=>'<tr data-id="'+esc(s.id)+'"><td><b>'+esc(s.naam)+'</b></td><td><a href="'+esc(s.url)+'" target="_blank" style="color:#1e1e1e">'+esc(s.url.replace(/^https?:\\/\\//,""))+'</a></td><td class="site"><input type="checkbox" data-open'+(s.openbaar?" checked":"")+'></td><td class="acties">'+(D.vast.includes(s.id)?"":'<button class="weg" data-sweg>Verwijderen</button>')+"</td></tr>").join("");
}
async function laad(){try{D=await api("/api/beheer");teken()}catch(e){meld(esc(e.message))}}

$("#g-lijst").addEventListener("change",async e=>{
  const tr=e.target.closest("tr"),email=tr.dataset.email,g=D.gebruikers.find(x=>x.email===email);
  try{
    if(e.target.dataset.site){
      const sites=[...tr.querySelectorAll("input[data-site]:checked:not(:disabled)")].map(i=>i.dataset.site);
      await api("/api/gebruikers/wijzig",{method:"POST",body:JSON.stringify({email,sites})});g.sites=sites;
    }else if("admin" in e.target.dataset){
      await api("/api/gebruikers/wijzig",{method:"POST",body:JSON.stringify({email,admin:e.target.checked})});g.admin=e.target.checked;teken();
    }
  }catch(x){meld(esc(x.message));laad()}
});
$("#g-lijst").addEventListener("click",async e=>{
  const tr=e.target.closest("tr");if(!tr)return;const email=tr.dataset.email,g=D.gebruikers.find(x=>x.email===email);
  if("bewerk" in e.target.dataset){
    const cel=tr.cells[0];cel.innerHTML='<input type="text" data-f="naam" value="'+esc(g.naam)+'" style="font-size:14px;padding:7px 9px;margin-bottom:6px"><input type="text" data-f="telefoon" placeholder="Telefoon" value="'+esc(g.telefoon||"")+'" style="font-size:14px;padding:7px 9px"><input type="text" data-f="code" placeholder="'+(g.code?"Persoonlijke code (ingevuld, leeg laten = niet wijzigen)":"Persoonlijke code 3D-schoolpagina's")+'" style="font-size:14px;padding:7px 9px;margin-top:6px">';
    e.target.textContent="Opslaan";e.target.dataset.opslaan="";delete e.target.dataset.bewerk;return;
  }
  if("opslaan" in e.target.dataset){
    const v=f=>tr.querySelector('[data-f="'+f+'"]').value,body={email,naam:v("naam"),telefoon:v("telefoon")};if(v("code").trim())body.code=v("code");
    try{await api("/api/gebruikers/wijzig",{method:"POST",body:JSON.stringify(body)});laad()}catch(x){meld(esc(x.message))}return;
  }
  if("reset" in e.target.dataset){try{const j=await api("/api/gebruikers/reset",{method:"POST",body:JSON.stringify({email})});
    meld("Nieuw tijdelijk wachtwoord voor <b>"+esc(email)+"</b>: <code>"+esc(j.tijdelijk)+"</code><br>Stuur dit door. Het is maar één keer te zien.");laad()}catch(x){meld(esc(x.message))}}
  if("weg" in e.target.dataset){if(e.target.textContent!=="Zeker weten?"){e.target.textContent="Zeker weten?";return}
    try{const j=await api("/api/gebruikers",{method:"DELETE",body:JSON.stringify({email})});meld("Account <b>"+esc(email)+"</b> verwijderd."+(j.geblokkeerd?" Er staan offertes op deze naam, die blijven gewoon in het archief.":""));laad()}catch(x){meld(esc(x.message))}}
});
$("#g-nieuw").addEventListener("submit",async e=>{
  e.preventDefault();$("#n-fout").textContent="";$("#n-knop").disabled=true;
  try{const email=$("#n-email").value.trim();
    const sites=[...$("#n-sites").querySelectorAll("input:checked")].map(i=>i.value);
    const j=await api("/api/gebruikers",{method:"POST",body:JSON.stringify({naam:$("#n-naam").value,email,telefoon:$("#n-tel").value,code:$("#n-code").value,admin:$("#n-admin").checked,sites})});
    meld("Account aangemaakt voor <b>"+esc(email)+"</b>. Tijdelijk wachtwoord: <code>"+esc(j.tijdelijk)+"</code><br>Stuur dit samen met het adres <b>"+esc(location.origin)+"</b> door. Het wachtwoord is maar één keer te zien.");
    e.target.reset();laad();
  }catch(x){$("#n-fout").textContent=x.message}
  $("#n-knop").disabled=false;
});
$("#s-lijst").addEventListener("change",async e=>{
  if(!("open" in e.target.dataset))return;const id=e.target.closest("tr").dataset.id;
  try{await api("/api/sites/wijzig",{method:"POST",body:JSON.stringify({id,openbaar:e.target.checked})});laad()}catch(x){meld(esc(x.message));laad()}
});
$("#s-lijst").addEventListener("click",async e=>{
  if(!("sweg" in e.target.dataset))return;const id=e.target.closest("tr").dataset.id;
  if(e.target.textContent!=="Zeker weten?"){e.target.textContent="Zeker weten?";return}
  try{await api("/api/sites",{method:"DELETE",body:JSON.stringify({id})});laad()}catch(x){meld(esc(x.message))}
});
$("#s-nieuw").addEventListener("submit",async e=>{
  e.preventDefault();$("#s-fout").textContent="";$("#s-knop").disabled=true;
  try{await api("/api/sites",{method:"POST",body:JSON.stringify({naam:$("#s-naam").value,url:$("#s-url").value,openbaar:$("#s-open").checked})});e.target.reset();laad()}
  catch(x){$("#s-fout").textContent=x.message}
  $("#s-knop").disabled=false;
});
laad();
</script>`;
