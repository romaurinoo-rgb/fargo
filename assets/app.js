
/**
 * FAMILY Recruitment — demo front-end
 * Важно: тут нет сервера, поэтому всё хранится в localStorage (на этом ПК/браузере).
 * Если хочешь, я могу подключить реальную БД/сервер позже.
 */

// --------- Progress Bar - Instant Load ---------
class ResourceTracker {
  }

  const STORAGE_KEY = 'family_state_v1';
  const LAST_CODE_KEY = 'family_last_code_v1';

  // --- Helper DOM functions ---
  function $(selector, context) { 
    if(!context) return typeof selector === 'string' && selector.startsWith('#') ? document.getElementById(selector.slice(1)) : document.querySelector(selector);
    return context.querySelector(selector);
  }
  function $$(selector, context) { 
    const els = (context || document).querySelectorAll(selector);
    return Array.from(els);
  }

  // --- Helper utilities ---
  function makeCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
  function nowLabel() { const d = new Date(); return d.toLocaleDateString("ru-RU", {year: "numeric", month: "2-digit", day: "2-digit"}).replace(/\//g, "."); }
  function setStatus(id, status) {
    const it = state.items.find(x => x.id === id);
    if(!it) return;
    it.status = status;
    saveState();
    renderAdmin();
    popToast("Статус изменен ✅", "good");
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && (Array.isArray(parsed.items) || Array.isArray(parsed.members) || Array.isArray(parsed.logs))){
          return {
            adminAuthed: parsed.adminAuthed || false,
            tab: parsed.tab || 'all',
            items: Array.isArray(parsed.items) ? parsed.items : [],
            members: Array.isArray(parsed.members) ? parsed.members : [],
            logs: Array.isArray(parsed.logs) ? parsed.logs : []
          };
        }
      }
    }catch(_){ }

    // default demo state
    return {
      adminAuthed: false,
      tab: "all",
      members: [
        { id: 1, name: "Roma Fargo", role: "Доверенный", rank: "10", mid: "188009", discord: "roma#1234" },
      ],
      items: [
        {
          id: 1,
          code: "9Q7K2A",
          nick: "ya",
          date: nowLabel(),
          status: "pending",
          age: "16",
          discord: "ya#0001",
          online: "3-5 часов",
          majestic: "1 месяц",
          tz: "+2",
          interests: "RP + тулл контент",
          surname: "Да",
          comment: "Напиши в Discord, проверим информацию."
        }
      ],
      logs: []
    };
  }

function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items, members: state.members, logs: state.logs }));
  }catch(_){}
}

const state = loadState();

/* ---------- Page nav ---------- */
function go(page){
  $$(".page").forEach(p => p.classList.remove("is-active"));
  const pageEl = $("#page-" + page);
  if(pageEl) pageEl.classList.add("is-active");
  window.scrollTo({top:0, behavior:"smooth"});
  if(page === "admin") renderAdmin();
  if(page === "roster") renderRoster();
}

$$("[data-nav]").forEach(el=>{
  // skip the brand element — it has a custom click sequence handler below
  if(el.classList && el.classList.contains('brand')) return;
  el.addEventListener("click", ()=> go(el.dataset.nav));
});

// Brand click (handled with click sequencing below)

// Secret access: Ctrl+Alt+A opens admin login (hidden in nav)
window.addEventListener('keydown', (e)=>{
  try{
    if(e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')){
      window.location.href = 'pages/admin/Админ.html';
    }
  }catch(_){ }
});

// Brand click sequence: single-click -> go apply (after short delay),
// double-click -> do nothing, triple-click within window -> open admin.
{
  const BTN = document.querySelector('.brand');
  if(BTN){
    let seq = 0;
    let last = 0;
    let singleTimer = null;
    BTN.addEventListener('click', ()=>{
      const now = Date.now();
      // reset sequence if too much time passed
      if(now - last > 1200) seq = 0;
      seq++; last = now;

      // cancel any pending single-click action
      if(singleTimer){ clearTimeout(singleTimer); singleTimer = null; }

      // triple click -> admin immediately
      if(seq >= 3){
        seq = 0;
        window.location.href = 'pages/admin/Админ.html';
        return;
      }

      const onApply = document.getElementById('page-apply')?.classList.contains('is-active');

      if(seq === 1){
        // if already on apply page, do not schedule navigation (prevents repeated redirects)
        if(onApply){
          // reset sequence shortly after
          singleTimer = setTimeout(()=>{ seq = 0; singleTimer = null; }, 350);
          return;
        }

        // schedule single-click action: only run if no quick second click
        singleTimer = setTimeout(()=>{
          if(seq === 1){
            try{ go('apply'); }catch(_){ window.location.href = 'pages/user/Заявка.html'; }
          }
          seq = 0;
          singleTimer = null;
        }, 350);
      }else{
        // seq === 2 (double click) -> do nothing; reset shortly
        singleTimer = setTimeout(()=>{ seq = 0; singleTimer = null; }, 350);
      }
    });
  }
}

/* ---------- Form ---------- */
function clearForm(){
  ["nick","realName","age","discord","online","majestic","tz","interests","surname"].forEach(id=>{
    const el = $("#" + id);
    if(el) el.value = "";
  });
}

function submitApp(){
  const required = ["nick","realName","age","discord","online","majestic","tz","interests","surname"];
  for(const id of required){
    const field = $("#" + id);
    const v = (field.value || "").trim();
    if(!v){
      const label = field.closest(".field").querySelector("label").innerText;
      popToast("Заполни поле: " + label, "bad");
      field.focus();
      return;
    }
  }

  const discordVal = $("#discord").value.trim();
  const gameNickVal = ($("#nick").value || "").trim();
  const nick = (gameNickVal ? gameNickVal : (discordVal.split("#")[0] || "user")).slice(0,16);

  // генерим код и сохраняем
  let code = makeCode();
  // избегаем коллизий
  const used = new Set(state.items.map(x => (x.code||"").toUpperCase()));
  while(used.has(code)) code = makeCode();

  const item = {
    id: Date.now(),
    gameNick: gameNickVal,
    realName: $("#realName").value.trim(),
    code,
    nick,
    date: nowLabel(),
    status: "pending",
    age: $("#age").value.trim(),
    discord: discordVal,
    online: $("#online").value.trim(),
    majestic: $("#majestic").value.trim(),
    tz: $("#tz").value.trim(),
    interests: $("#interests").value.trim(),
    surname: $("#surname").value.trim(),
    comment: "" // comment for player
  };

  state.items.unshift(item);
  saveState();

  // remember last code to help user
  try{ localStorage.setItem(LAST_CODE_KEY, code); }catch(_){}

  // show code on sent page
  const box = $("#trackBox");
  const out = $("#trackCode");
  if(box && out){
    out.textContent = code;
    box.style.display = "block";
  }

  clearForm();
  go("sent");
  popToast("Заявка отправлена ✅", "good");
}

$("#submitBtn")?.addEventListener("click", submitApp);
$("#clearBtn")?.addEventListener("click", ()=>{ clearForm(); popToast("Очищено", ""); });

/* ---------- Status lookup ---------- */
function normDiscord(s){
  return (s||"").trim().toLowerCase();
}
function normCode(s){
  return (s||"").trim().toUpperCase().replace(/\s+/g,"");
}

function statusLabel(s){
  if(s==="pending") return {cls:"badgeS--pending", text:"На рассмотрении"};
  if(s==="accepted") return {cls:"badgeS--accepted", text:"Принято"};
  return {cls:"badgeS--rejected", text:"Отклонено"};
}

function findByCodeOrDiscord(code, discord){
  const c = normCode(code);
  const d = normDiscord(discord);
  if(c){
    const it = state.items.find(x => normCode(x.code) === c);
    if(it) return it;
  }
  if(d){
    // берем самую новую заявку по дискорду
    const list = state.items.filter(x => normDiscord(x.discord) === d);
    if(list.length) return list[0];
  }
  return null;
}

function renderStatusResult(item){
  const el = $("#statusResult");
  if(!el) return;

  if(!item){
    el.style.display = "block";
    el.innerHTML = `
      <div class="result__top">
        <div class="result__k">РЕЗУЛЬТАТ</div>
        <div class="badgeS badgeS--rejected">Не найдено</div>
      </div>
      <div class="muted" style="margin-top:10px">
        Заявка не найдена. Проверь код/Discord и попробуй снова.
      </div>
    `;
    return;
  }

  const s = statusLabel(item.status);
  const comment = (item.comment || "").trim();

  el.style.display = "block";
  el.innerHTML = `
    <div class="result__top">
      <div>
        <div class="result__k">КОД</div>
        <div class="result__v" style="letter-spacing:.18em">${escapeHtml(item.code || "—")}</div>
      </div>
      <div class="badgeS ${s.cls}">${s.text}</div>
    </div>

    <div class="grid2">
      <div>
        <div class="result__k">DISCORD</div>
        <div class="result__v">${escapeHtml(item.discord)}</div>
      </div>
      <div>
        <div class="result__k">ДАТА</div>
        <div class="result__v">${escapeHtml(item.date)}</div>
      </div>
      <div>
        <div class="result__k">НИК</div>
        <div class="result__v">${escapeHtml(item.nick)}</div>
      </div>
      <div>
        <div class="result__k">ЧАСОВОЙ ПОЯС</div>
        <div class="result__v">${escapeHtml(item.tz)}</div>
      </div>
    </div>

    <div style="margin-top:12px; padding: 12px; border-radius:14px; border:1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.05)">
      <div class="result__k">КОММЕНТАРИЙ ДЛЯ ИГРОКА</div>
      <div class="result__v" style="margin-top:8px; font-weight:800">
        ${comment ? escapeHtml(comment) : "<span style='color:rgba(255,255,255,.55); font-weight:700'>Комментария пока нет.</span>"}
      </div>
    </div>
  `;
}

async function doLookup(){
  const code = $("#lookupCode")?.value || "";
  const discord = $("#lookupDiscord")?.value || "";

  if(!normCode(code) && !normDiscord(discord)){
    popToast("Введи код или Discord", "bad");
    return;
  }

  // try server search first
  try{
    const q = code || discord;
    const resp = await fetch('/api/apps/search?q=' + encodeURIComponent(q));
    if(resp.ok){
      const data = await resp.json();
      renderStatusResult(data);
      return;
    }
  }catch(_){ /* ignore server errors and fallback */ }

  const it = findByCodeOrDiscord(code, discord);
  renderStatusResult(it);
}

$("#lookupBtn")?.addEventListener("click", doLookup);
$("#lookupCode")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") doLookup(); });
$("#lookupDiscord")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") doLookup(); });

$("#fillLastBtn")?.addEventListener("click", ()=>{
  let last = "";
  try{ last = localStorage.getItem(LAST_CODE_KEY) || ""; }catch(_){}
  if(!last){
    popToast("Нет сохранённого кода на этом устройстве", "bad");
    return;
  }
  $("#lookupCode").value = last;
  popToast("Код вставлен", "good");
});

/* ---------- Admin auth ---------- */
const ADMIN_CREDENTIALS = [
  { user: 'Fortina', pass: 'Roma101000', role: 'Владелец' },
  { user: 'Alina',   pass: 'Alina2026',   role: 'Модератор' },
  { user: 'Daniil',  pass: 'Daniil2026',  role: 'Помощник' }
];

async function login(){
  const user = ((document.querySelector("#adminUser")?.value) || "").trim();
  const pass = ((document.querySelector("#adminPass")?.value) || "");

  if(!user || !pass){
    popToast('Введи логин и пароль', 'bad');
    return;
  }

  // try server login first
  let serverSuccess = false;
  try{
    const resp = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass })
    });
    if(resp.ok){
      const data = await resp.json();
      // Store token in localStorage as fallback (because cookies don't transmit reliably)
      if(data.token){
        localStorage.setItem('admin_token', data.token);
      }
      setAdminName(data.user || user);
      setAdminRole(data.role || 'Администратор');
      state.adminAuthed = true;
      serverSuccess = true;
      try{ attachTopbarProfile(); }catch(_){ }
      go('admin');
      popToast('Вход выполнен ✅', 'good');
      return;
    }
  }catch(_){ /* server unavailable, fallback below */ }

  // fallback: local credentials (always try as backup)
  const found = ADMIN_CREDENTIALS.find(c => c.user === user && c.pass === pass);
  if(found){
    try{ setAdminName(found.user); }catch(_){ }
    try{ setAdminRole(found.role); }catch(_){ }
    state.adminAuthed = true;
    try{ attachTopbarProfile(); }catch(_){ }
    go('admin');
    popToast('Вход выполнен (локально) ✅', 'good');
  }else{
    popToast('Неверный логин или пароль!', 'bad');
  }
}
document.querySelector("#loginBtn")?.addEventListener("click", ()=> login());
document.querySelector("#adminPass")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") login(); });
document.querySelector("#adminUser")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") login(); });

function logout(){
  state.adminAuthed = false;
  try{ $("#adminPass").value = ""; }catch(_){ }
  try{ $("#adminUser").value = ""; }catch(_){ }
  try{ setAdminRole(''); }catch(_){}
  try{ attachTopbarProfile(); }catch(_){}
  go("login");
  popToast("Вы вышли", "");
}
$("#logoutBtn")?.addEventListener("click", logout);

// try to inform server about logout (clear server cookie)
async function serverLogout(){
  try{
    await fetch('/api/admin/logout', { method: 'POST' });
  }catch(_){ }
}

// Removed demo reset functionality (button and auto-reset via URL parameter)

/* ---------- Admin UI ---------- */
function setTab(tab){
  state.tab = tab;
  $$(".tab").forEach(t=>t.classList.remove("is-active"));
  const tabEl = $(`.tab[data-tab="${tab}"]`);
  if(tabEl) tabEl.classList.add("is-active");
  renderAdmin();
}
$$(".tab").forEach(t=>{
  t.addEventListener("click", ()=> setTab(t.dataset.tab));
});

function counts(){
  const all = (state.items || []).length;
  const pending = (state.items || []).filter(x=>x.status === 'pending').length;
  const accepted = (state.items || []).filter(x=>x.status === 'accepted').length;
  const rejected = (state.items || []).filter(x=>x.status === 'rejected').length;
  return { all, pending, accepted, rejected };
}

// showConfirm: returns a Promise<boolean> and renders a styled modal matching site theme
function showConfirm(message){
  return new Promise(resolve => {
    try{
      const overlay = document.createElement('div'); overlay.className = 'confirm-overlay';
      const modal = document.createElement('div'); modal.className = 'confirm-modal card';
      modal.innerHTML = `
        <div class="confirm-title">${escapeHtml(message)}</div>
        <div class="confirm-sub">Выберите действие</div>
        <div class="confirm-actions">
          <button class="btn btn--ghost" data-role="cancel">Отмена</button>
          <button class="btn btn--primary" data-role="ok">Подтвердить</button>
        </div>
      `;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const btnOk = modal.querySelector('[data-role="ok"]');
      const btnCancel = modal.querySelector('[data-role="cancel"]');

      const cleanup = (val)=>{
        try{ document.body.removeChild(overlay); }catch(_){ }
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };

      function onKey(e){ if(e.key === 'Escape') cleanup(false); if(e.key === 'Enter') cleanup(true); }
      document.addEventListener('keydown', onKey);

      btnOk.focus();
      btnOk.addEventListener('click', ()=> cleanup(true));
      btnCancel.addEventListener('click', ()=> cleanup(false));
    }catch(_){ resolve(window.confirm(message)); }
  });
}

function removeItem(id){
  const idx = state.items.findIndex(x=>x.id===id);
  if(idx === -1) return;
  const code = state.items[idx].code || "";
  state.items.splice(idx, 1);
  saveState();
  renderAdmin();
  popToast("Заявка удалена", "");
  try{ logAdmin('Удалил заявку', { code }); }catch(_){ }
}

function setComment(id, v){
  const it = state.items.find(x=>x.id===id);
  if(!it) return;
  it.comment = v;
  saveState();
}

function renderAdmin(){
  try{ ensureAdminName(); }catch(_){ }
  try{ attachAdminProfile(); }catch(_){ }

  const c = counts();
  $("#stAll") && ($("#stAll").textContent = c.all);
  $("#stPending") && ($("#stPending").textContent = c.pending);
  $("#stAccepted") && ($("#stAccepted").textContent = c.accepted);
  $("#stRejected") && ($("#stRejected").textContent = c.rejected);

  $("#tAll") && ($("#tAll").textContent = c.all);
  $("#tPending") && ($("#tPending").textContent = c.pending);
  $("#tAccepted") && ($("#tAccepted").textContent = c.accepted);
  $("#tRejected") && ($("#tRejected").textContent = c.rejected);

  const list = $("#list");
  if(!list) return;
  list.innerHTML = "";

  let items = state.items.slice();
  if(state.tab !== "all") items = items.filter(x=>x.status===state.tab);

  items.forEach(item=>{
    const s = (item.status==="pending") ? {cls:"status--pending", text:"На рассмотрении"} :
              (item.status==="accepted") ? {cls:"status--accepted", text:"Принято"} :
              {cls:"status--rejected", text:"Отклонено"};

    const wrap = document.createElement("div");

    wrap.innerHTML = `
      <div class="reqCard">
        <div class="who">
          <div class="avatar">${escapeHtml((item.nick||"U")[0].toUpperCase())}</div>
          <div style="min-width:0">
            <div class="who__nm">${escapeHtml(item.nick)} <span style="opacity:.45;font-weight:900">•</span> <span style="opacity:.75">${escapeHtml(item.code||"—")}</span></div>
            <div class="who__dt">${escapeHtml(item.date)}</div>
          </div>
        </div>

        <div class="rowR">
          <div class="status ${s.cls}">${s.text}</div>
          <button class="chev" aria-label="Подробнее">▾</button>
        </div>
      </div>

      <div class="details">
        <div class="kv">
          <div class="k"><div class="k__k">КОД</div><div class="k__v">${escapeHtml(item.code || "—")}</div></div>
          <div class="k"><div class="k__k">DISCORD</div><div class="k__v">${escapeHtml(item.discord)}</div></div>
          <div class="k"><div class="k__k">OOC ВОЗРАСТ</div><div class="k__v">${escapeHtml(item.age)}</div></div>
          <div class="k"><div class="k__k">ОНЛАЙН</div><div class="k__v">${escapeHtml(item.online)}</div></div>
          <div class="k"><div class="k__k">СКОЛЬКО ИГРАЕТ</div><div class="k__v">${escapeHtml(item.majestic)}</div></div>
          <div class="k"><div class="k__k">ЧАСОВОЙ ПОЯС</div><div class="k__v">${escapeHtml(item.tz)}</div></div>
          <div class="k"><div class="k__k">ГОТОВ СМЕНИТЬ ФАМИЛИЮ</div><div class="k__v">${escapeHtml(item.surname)}</div></div>
          <div class="k" style="grid-column:1/-1;"><div class="k__k">ИНТЕРЕСЫ</div><div class="k__v">${escapeHtml(item.interests)}</div></div>
        </div>

        <div class="k" style="margin-top:12px">
          <div class="k__k">КОММЕНТАРИЙ ДЛЯ ИГРОКА</div>
          <input class="field__input" placeholder="Напиши комментарий игроку..." value="${escapeAttr(item.comment||"")}" />
        </div>

        <div class="adminActions">
          <button class="mini mini--good" data-action="accept">✅ Принять</button>
          <button class="mini mini--bad" data-action="reject">❌ Отказать</button>
          <button class="mini" data-action="pending">⏳ На рассмотрение</button>
          <button class="mini mini--bad" data-action="delete">🗑️ Удалить</button>
        </div>
      </div>
    `;

    const details = $(".details", wrap);
    const chev = $(".chev", wrap);
    const commentInput = $('.k input', wrap);
    const btnAccept = $('.adminActions [data-action="accept"]', wrap);
    const btnReject = $('.adminActions [data-action="reject"]', wrap);
    const btnPending = $('.adminActions [data-action="pending"]', wrap);
    const btnDelete = $('.adminActions [data-action="delete"]', wrap);

    if(chev && details) chev.addEventListener("click", ()=> details.classList.toggle("is-open"));
    if(commentInput) commentInput.addEventListener("input", (e)=> setComment(item.id, e.target.value));

    if(btnAccept) btnAccept.addEventListener("click", ()=>{
      showConfirm('Вы уверены, что хотите принять эту заявку?').then(ok=>{
        if(!ok) return;
        setStatus(item.id, "accepted");
        try{ logAdmin('Принял заявку', { code: item.code, discord: item.discord, status: 'accepted' }); }catch(_){ }
      });
    });
    if(btnReject) btnReject.addEventListener("click", ()=>{
      showConfirm('Вы уверены, что хотите отклонить эту заявку?').then(ok=>{
        if(!ok) return;
        setStatus(item.id, "rejected");
        try{ logAdmin('Отклонил заявку', { code: item.code, discord: item.discord, status: 'rejected' }); }catch(_){ }
      });
    });
    if(btnPending) btnPending.addEventListener("click", ()=>{
      showConfirm('Установить статус "На рассмотрение" для этой заявки?').then(ok=>{
        if(!ok) return;
        setStatus(item.id, "pending");
        try{ logAdmin('Вернул на рассмотрение', { code: item.code, discord: item.discord, status: 'pending' }); }catch(_){ }
      });
    });
    if(btnDelete) btnDelete.addEventListener("click", ()=>{
      showConfirm('Удалить эту заявку навсегда?').then(ok=>{ if(!ok) return; removeItem(item.id); });
    });

    list.appendChild(wrap);
  });
  try{ attachStatInteractions(); }catch(_){ }
}

/* Add clickable interactions for stat cards: press animation + number pulse */
function attachStatInteractions(){
  $$(".stat").forEach(s=>{
    // avoid adding multiple handlers
    if(s._hasStatBind) return; s._hasStatBind = true;
    s.addEventListener('click', ()=>{
      s.classList.add('pressed');
      setTimeout(()=> s.classList.remove('pressed'), 160);
      const num = s.querySelector('.stat__num');
      if(num){
        num.classList.remove('pulse');
        // force reflow to restart animation
        void num.offsetWidth;
        num.classList.add('pulse');
      }
      // If this stat has a data-tab attribute, switch admin tab to it
      try{
        const tab = s.dataset && s.dataset.tab;
        if(tab && typeof setTab === 'function') setTab(tab);
      }catch(_){ }
    });
    s.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.click(); } });
    s.setAttribute('tabindex', '0');
  });
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  })[s]);
}
function escapeAttr(str){
  return escapeHtml(str).replace(/"/g,"&quot;");
}

/* ---------- Toast ---------- */
let toastTimer = null;
function popToast(text, tone){
  let t = document.getElementById("toast");
  if(!t){
    t = document.createElement("div");
    t.id = "toast";
    t.style.position="fixed";
    t.style.left="50%";
    t.style.bottom="22px";
    t.style.transform="translateX(-50%)";
    t.style.padding="12px 14px";
    t.style.borderRadius="14px";
    t.style.border="1px solid rgba(255,255,255,.12)";
    t.style.background="rgba(10,4,18,.66)";
    t.style.backdropFilter="blur(14px)";
    t.style.color="rgba(255,255,255,.92)";
    t.style.fontWeight="900";
    t.style.letterSpacing=".02em";
    t.style.boxShadow="0 24px 70px rgba(0,0,0,.55)";
    t.style.zIndex="60";
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.style.opacity="1";
  t.style.transition="opacity .25s ease, transform .25s ease";
  t.style.transform="translateX(-50%) translateY(0)";

  if(tone==="good"){
    t.style.borderColor="rgba(71,224,143,.28)";
  }else if(tone==="bad"){
    t.style.borderColor="rgba(255,59,109,.28)";
  }else{
    t.style.borderColor="rgba(255,255,255,.12)";
  }

  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{
    t.style.opacity="0";
    t.style.transform="translateX(-50%) translateY(8px)";
  }, 1800);
}

/* ---------- FX Canvas ---------- */
(function initFX(){
  const c = document.getElementById("fx");
  if(!c) return; // no FX canvas on this page — skip visual effect
  const ctx = c.getContext("2d", { alpha:true });

  let w=0,h=0, dpr=1;
  const particles = [];
  const MAX = 130;
  let mouse = {x:0,y:0, vx:0, vy:0};
  let last = performance.now();

  function resize(){
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = c.width = Math.floor(innerWidth * dpr);
    h = c.height = Math.floor(innerHeight * dpr);
    c.style.width = innerWidth + "px";
    c.style.height = innerHeight + "px";
  }
  window.addEventListener("resize", resize, {passive:true});
  resize();

  function rand(a,b){ return a + Math.random()*(b-a); }

  function spawn(){
    particles.length = 0;
    for(let i=0;i<MAX;i++){
      particles.push({
        x: rand(0,w),
        y: rand(0,h),
        r: rand(0.6, 2.2)*dpr,
        s: rand(0.22, 1.15)*dpr,
        a: rand(0.10, 0.55),
        hue: rand(265, 295),
        tw: rand(0, Math.PI*2)
      });
    }
  }
  spawn();

  window.addEventListener("pointermove", (e)=>{
    const x = e.clientX * dpr;
    const y = e.clientY * dpr;
    mouse.vx = (x - mouse.x) * 0.08;
    mouse.vy = (y - mouse.y) * 0.08;
    mouse.x = x; mouse.y = y;
  }, {passive:true});

  function draw(now){
    const dt = Math.min(0.032, (now-last)/1000);
    last = now;

    ctx.clearRect(0,0,w,h);

    // soft vignette
    const g = ctx.createRadialGradient(w*0.5,h*0.45, 0, w*0.5,h*0.45, Math.max(w,h)*0.7);
    g.addColorStop(0, "rgba(178,76,255,0.09)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    // particles
    for(const p of particles){
      p.tw += dt * 1.6;
      p.y += p.s * (0.55 + Math.sin(p.tw)*0.35);
      p.x += (Math.sin(p.tw*0.7) * 0.18 + mouse.vx*0.0010);

      if(p.y > h + 10*dpr){ p.y = -10*dpr; p.x = rand(0,w); }

      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${p.a})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    }

    // streaks (subtle)
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = "rgba(178,76,255,0.25)";
    ctx.lineWidth = 1.2*dpr;
    for(let i=0;i<10;i++){
      const x = (i/10)*w + (mouse.vx*0.12);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 30*dpr, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    mouse.vx *= (1 - dt*4.5);
    mouse.vy *= (1 - dt*4.5);

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

// initial counts if someone opens admin after refresh
// also keep status page empty on open


/* ---------- Roster (Состав) ---------- */
function renderRoster(){
  const q = ($("#rosterSearch")?.value || "").trim().toLowerCase();
  const list = $("#rosterList");
  const cnt = $("#rosterCount");
    if (!list) return;

  let rows = (state.members || []).slice();
  if(q){
    rows = rows.filter(m=>{
      const s = `${m.name||""} ${m.role||""} ${m.rank||""} ${m.mid||""}`.toLowerCase();
      return s.includes(q);
    });
  }
  cnt && (cnt.textContent = rows.length);

  list.innerHTML = "";
  rows.forEach(m=>{
    const el = document.createElement("div");
    el.className = "rosterRow";
    // determine crown for owners/deputies — check role text OR numeric rank
    const roleText = (m.role||"").toLowerCase();
    const rankText = String(m.rank||"").trim();
    let crownHtml = "";
    const isOwnerRole = roleText.includes('owber') || roleText.includes('owner');
    const isDepRole = roleText.includes('dep') || roleText.includes('deputy');
    const isOwnerRank = rankText === '5' || rankText.startsWith('5');
    const isDepRank = rankText === '4' || rankText.startsWith('4');

    if(isOwnerRole || isOwnerRank){
      // gold crown
      crownHtml = `<svg class="crown" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" title="Owber"><path d="M2 17l3-9 4 6 4-8 4 6 3-5v9H2z" fill="#ffd700"/></svg>`;
    }else if(isDepRole || isDepRank){
      // silver crown
      crownHtml = `<svg class="crown" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" title="Dep Owber"><path d="M2 17l3-9 4 6 4-8 4 6 3-5v9H2z" fill="#c0c0c0"/></svg>`;
    }

    el.innerHTML = `
      <div class="rosterRow__left">
        <div class="avatar">${escapeHtml((m.name||"U")[0].toUpperCase())}</div>
        <div style="min-width:0">
          <div class="rosterRow__nm">${escapeHtml(m.name||"—")} ${crownHtml}</div>
          <div class="rosterRow__meta">
            <span class="pill pill--role"><svg class="pill__ico" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2l7 4v6c0 5-3.582 9-7 10-3.418-1-7-5-7-10V6l7-4z" fill="currentColor"/></svg><span class="pill__text">${escapeHtml(m.role||"—")}</span></span>
            <span class="pill pill--rank"><svg class="pill__ico" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2l2.9 6.59L22 9.24l-5 4.73L18.18 22 12 18.77 5.82 22 7 14l-5-4.73 7.1-0.65L12 2z" fill="currentColor"/></svg><span class="pill__text">${escapeHtml(m.rank||"—")}</span></span>
            <span class="pill pill--id"><svg class="pill__ico" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="7" cy="10" r="2" fill="currentColor"/><rect x="13" y="9" width="6" height="2" rx="1" fill="currentColor"/></svg><span class="pill__text">${escapeHtml(m.mid||"—")}</span></span>
            <span class="pill pill--ds"><svg class="pill__ico" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 6H3v11h4v3l5-3h9V6z" fill="currentColor"/></svg><span class="pill__text">${escapeHtml(m.discord||"—")}</span></span>
          </div>
        </div>
      </div>
    `;
    list.appendChild(el);
  });
}

$("#rosterSearch")?.addEventListener("input", renderRoster);

/* ---------- Admin Members ---------- */
let adminView = "apps";
let editingMemberId = null;

function setAdminView(view){
  adminView = view;
  const appsPane = $("#adminAppsPane");
  const memPane = $("#adminMembersPane");
  const bApps = $("#adminViewApps");
  const bMems = $("#adminViewMembers");
  if(view === "members"){
    appsPane && (appsPane.style.display = "none");
    memPane && (memPane.style.display = "");
    bApps && bApps.classList.remove("is-active");
    bMems && bMems.classList.add("is-active");
    renderAdminMembers();
  }else{
    appsPane && (appsPane.style.display = "");
    memPane && (memPane.style.display = "none");
    bMems && bMems.classList.remove("is-active");
    bApps && bApps.classList.add("is-active");
    renderAdmin();
  }
}

$("#adminViewApps")?.addEventListener("click", ()=> setAdminView("apps"));
$("#adminViewMembers")?.addEventListener("click", ()=> setAdminView("members"));

function clearMemberForm(){
  editingMemberId = null;
  $("#mName").value = "";
  $("#mRole").value = "";
  $("#mRank").value = "";
  $("#mId").value = "";
  $("#mDiscord").value = "";
  $("#saveMemberBtn").style.display = "none";
  $("#cancelEditMemberBtn").style.display = "none";
  $("#addMemberBtn").style.display = "";
}

function renderAdminMembers(){
  const list = $("#adminMembersList");
  if(!list) return;
  list.innerHTML = "";
    (state.members || []).forEach(m => {
    const row = document.createElement("div");
    row.className = "rosterRow";
    row.innerHTML = `
      <div class="rosterRow__left">
        <div class="avatar">${escapeHtml((m.name||"U")[0].toUpperCase())}</div>
        <div style="min-width:0">
          <div class="rosterRow__nm">${escapeHtml(m.name||"—")}</div>
          <div class="rosterRow__meta">
            <span class="pill pill--role"><svg class="pill__ico" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2l7 4v6c0 5-3.582 9-7 10-3.418-1-7-5-7-10V6l7-4z" fill="currentColor"/></svg><span class="pill__text">${escapeHtml(m.role||"—")}</span></span>
            <span class="pill pill--rank"><svg class="pill__ico" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2l2.9 6.59L22 9.24l-5 4.73L18.18 22 12 18.77 5.82 22 7 14l-5-4.73 7.1-0.65L12 2z" fill="currentColor"/></svg><span class="pill__text">${escapeHtml(m.rank||"—")}</span></span>
            <span class="pill pill--id"><svg class="pill__ico" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="7" cy="10" r="2" fill="currentColor"/><rect x="13" y="9" width="6" height="2" rx="1" fill="currentColor"/></svg><span class="pill__text">${escapeHtml(m.mid||"—")}</span></span>
            <span class="pill pill--ds"><svg class="pill__ico" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 6H3v11h4v3l5-3h9V6z" fill="currentColor"/></svg><span class="pill__text">${escapeHtml(m.discord||"—")}</span></span>
          </div>
        </div>
      </div>
      <div class="rosterBtns">
        <button class="mini">✏️</button>
        <button class="mini mini--bad">🗑</button>
      </div>
    `;
    const btns = $$(".rosterBtns .mini", row);
    const btnEdit = btns[0];
    const btnDel = btns[1];
    if(btnEdit){
      btnEdit.addEventListener("click", ()=>{
      editingMemberId = m.id;
      $("#mName").value = m.name || "";
      $("#mRole").value = m.role || "";
      $("#mRank").value = m.rank || "";
      $("#mId").value = m.mid || "";
      $("#mDiscord").value = m.discord || "";
      $("#addMemberBtn").style.display = "none";
      $("#saveMemberBtn").style.display = "";
      $("#cancelEditMemberBtn").style.display = "";
      window.scrollTo({top:0, behavior:"smooth"});
    });
    }
    if(btnDel){
      btnDel.addEventListener("click", ()=>{
      state.members = (state.members||[]).filter(x=>x.id !== m.id);
      saveState();
      renderAdminMembers();
      renderRoster();
    });
    }
    list.appendChild(row);
  });
}

$("#addMemberBtn")?.addEventListener("click", ()=>{
  const name = ($("#mName").value||"").trim();
  const role = ($("#mRole").value||"").trim();
  const rank = ($("#mRank").value||"").trim();
  const mid = ($("#mId").value||"").trim();
  const discord = ($("#mDiscord").value||"").trim();
  if(!name || !role || !rank || !mid || !discord) return popToast("Заполни все поля", "bad");
  const member = { id: Date.now(), name, role, rank, mid, discord };
  state.members = [member, ...(state.members||[])];
  saveState();
  clearMemberForm();
  renderAdminMembers();
  renderRoster();
  popToast("Добавлено ✅", "good");
});

$("#saveMemberBtn")?.addEventListener("click", ()=>{
  const name = ($("#mName").value||"").trim();
  const role = ($("#mRole").value||"").trim();
  const rank = ($("#mRank").value||"").trim();
  const mid = ($("#mId").value||"").trim();
  const discord = ($("#mDiscord").value||"").trim();
  if(!name || !role || !rank || !mid || !discord) return popToast("Заполни все поля", "bad");
  const idx = (state.members||[]).findIndex(x=>x.id === editingMemberId);
  if(idx < 0) return popToast("Не найдено", "bad");
  state.members[idx] = { ...state.members[idx], name, role, rank, mid, discord };
  saveState();
  clearMemberForm();
  renderAdminMembers();
  renderRoster();
  popToast("Сохранено ✅", "good");
});

$("#cancelEditMemberBtn")?.addEventListener("click", clearMemberForm);

/* ---------- CSV: Name,Role,Rank,ID ---------- */
function csvEscape(v){
  const s = String(v ?? "");
  if(/[",\n\r]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}

function parseCSV(text){
  const lines = text.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").filter(l=>l.trim());
  if(!lines.length) return [];
  const header = lines[0].trim();
  const sep = header.includes(",") ? "," : (header.includes(";") ? ";" : (header.includes("\t") ? "\t" : ","));
  const splitLine = (line)=>{
    const out=[]; let cur=""; let q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch === '"'){
        if(q && line[i+1] === '"'){ cur += '"'; i++; }
        else q=!q;
      }else if(ch === sep && !q){
        out.push(cur); cur="";
      }else cur += ch;
    }
    out.push(cur);
    return out.map(x=>x.trim());
  };
  const headers = splitLine(header).map(h=>h.trim().toLowerCase());

  const findIndex = (candidates)=>{
    for(let i=0;i<headers.length;i++){
      const h = headers[i];
      for(const cand of candidates){
        const c = cand.toLowerCase();
        if(h === c) return i;
        if(h.includes(c)) return i;
        // compare simplified alphanumeric forms
        const hs = h.replace(/[^a-z0-9а-яё]/g,"");
        const cs = c.replace(/[^a-z0-9а-яё]/g,"");
        if(hs.includes(cs)) return i;
      }
    }
    return -1;
  };

  const iName = findIndex(["name","имя","fullname","full name","full_name"]);
  const iRole = findIndex(["role","роль","position","должность"]);
  const iRank = findIndex(["rank","ранг","level","уровень"]);
  const iId = findIndex(["id","mid","steamid","айди","ид","identifier"]);
  const iDiscord = findIndex(["discord","дискорд","discordid","discord id"]);

  if(iName<0 || iRole<0 || iRank<0 || iId<0) return [];
  const out=[];
  for(let i=1;i<lines.length;i++){
    const cols = splitLine(lines[i]);
    const name = (cols[iName]||"").trim();
    const role = (cols[iRole]||"").trim();
    const rank = (cols[iRank]||"").trim();
    const mid = (cols[iId]||"").trim();
    const discord = (iDiscord>=0 ? (cols[iDiscord]||"") : "").trim();
    if(name && role && rank && mid){
      out.push({ id: Date.now()+i, name, role, rank, mid, discord });
    }
  }
  return out;
}

$("#exportMembersCsv")?.addEventListener("click", ()=>{
  const sep = ",";
  const header = ["Name","Role","Rank","ID","Discord"].join(sep);
  const rows = (state.members||[]).map(m=>[m.name,m.role,m.rank,m.mid,(m.discord||"")].map(csvEscape).join(sep));
  const csv = [header, ...rows].join("\r\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "roster.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1200);
  popToast("CSV скачан ✅", "good");
});

$("#downloadMembersTemplate")?.addEventListener("click", ()=>{
  const sep = ",";
  const header = ["Name","Role","Rank","ID","Discord"].join(sep);
  const sample = [
    "Roma Fargo,Доверенный,10,188009,roma#1234",
    "Daniil Fargo,Доверенный,3,174658,",
    "Santos Fargo,Owner,5,89969,"
  ];
  const csv = [header, ...sample].join("\r\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "roster_template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1200);
  popToast("Шаблон CSV скачан ✅", "good");
});

// Quick helper: insert sample rows into roster (local state) — useful for testing
$("#loadSampleToRoster")?.addEventListener("click", ()=>{
  const sampleRows = [
    { name: "Roma Fargo", role: "Доверенный", rank: "10", mid: "188009", discord: "roma#1234" },
    { name: "Daniil Fargo", role: "Доверенный", rank: "3", mid: "174658", discord: "" },
    { name: "Santos Fargo", role: "Owner", rank: "5", mid: "89969", discord: "" }
  ];
  try{
    const map = new Map((state.members||[]).map(m=>[String(m.mid), m]));
    sampleRows.forEach((r, i)=>{
      const key = String(r.mid);
      if(map.has(key)){
        const m = map.get(key);
        m.name = r.name; m.role = r.role; m.rank = r.rank; m.discord = r.discord;
      }else{
        state.members.unshift({ id: Date.now()+i, name: r.name, role: r.role, rank: r.rank, mid: r.mid, discord: r.discord });
      }
    });
    saveState();
    renderAdminMembers();
    renderRoster();
    popToast("Пример добавлен в состав ✅", "good");
    try{ logAdmin('Импорт примера в состав', {count: sampleRows.length}); }catch(_){ }
  }catch(e){
    popToast("Не удалось добавить пример", "bad");
  }
});

$("#importMembersCsv")?.addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const rows = parseCSV(text);
    if(!rows.length){ popToast("CSV должен быть: Name,Role,Rank,ID,Discord", "bad"); e.target.value=""; return; }
    // ask for confirmation before merging (prevent accidental immediate import)
    showConfirm(`Импортировать ${rows.length} участников в состав?`).then(ok=>{
      if(!ok){ e.target.value = ""; popToast("Импорт отменён", ""); return; }
      try{
        const map = new Map((state.members||[]).map(m=>[String(m.mid), m]));
        rows.forEach(r=>{
          const key = String(r.mid);
          if(map.has(key)){
            const m = map.get(key);
            m.name = r.name; m.role = r.role; m.rank = r.rank; m.discord = r.discord;
          }else{
            state.members.unshift(r);
          }
        });
        saveState();
        renderAdminMembers();
        renderRoster();
        popToast("Импортировано ✅", "good");
        try{ logAdmin('Импортировал CSV', {count: rows.length}); }catch(_){ }
      }catch(_){ popToast("Не удалось выполнить импорт", "bad"); }
      e.target.value = "";
    });
  }catch(_){
    popToast("Не удалось прочитать CSV", "bad");
    e.target.value = "";
  }
});
/* ---------- Admin Identity & Log ---------- */
const ADMIN_NAME_KEY = "family_admin_name_v1";
const ADMIN_ROLE_KEY = "family_admin_role_v1";
function getAdminName(){
  const v = (localStorage.getItem(ADMIN_NAME_KEY)||"").trim();
  return v || "Admin";
}
function setAdminName(name){
  localStorage.setItem(ADMIN_NAME_KEY, (name||"Admin").trim() || "Admin");
}
function getAdminRole(){
  return (localStorage.getItem(ADMIN_ROLE_KEY)||"").trim() || "";
}
function setAdminRole(role){
  if(!role) localStorage.removeItem(ADMIN_ROLE_KEY);
  else localStorage.setItem(ADMIN_ROLE_KEY, String(role));
}
function logAdmin(action, meta={}){
  const entry = {
    id: Date.now(),
    at: new Date().toLocaleString("ru-RU", {hour12:false}),
    admin: getAdminName(),
    action,
    meta
  };
  state.logs = [entry, ...(state.logs||[])].slice(0, 200);
  saveState();
}
function renderAdminLog(){
  const box = $("#adminLogList");
  if(!box) return;
  const rows = (state.logs||[]);
  if(!rows.length){
    box.innerHTML = `<div class="empty">Лог пуст</div>`;
    return;
  }
  box.innerHTML = rows.map(l=>{
    const a = escapeHtml(l.action||"");
    const who = escapeHtml(l.admin||"");
    const at = escapeHtml(l.at||"");
    let extra = "";
    try{
      const m = l.meta||{};
      if(m.code) extra += ` • код: <b>${escapeHtml(m.code)}</b>`;
      if(m.discord) extra += ` • discord: <b>${escapeHtml(m.discord)}</b>`;
      if(m.status) extra += ` • статус: <b>${escapeHtml(m.status)}</b>`;
    }catch(_){}
    return `<div class="item">
      <div class="item__top">
        <div class="item__title">${a}</div>
        <div class="item__pill">${who}</div>
      </div>
      <div class="item__sub">${at}${extra}</div>
    </div>`;
  }).join("");
}

function ensureAdminName(){
  // Do not force a default admin name. Only set UI if a name exists in storage.
  if(localStorage.getItem(ADMIN_NAME_KEY)){
    try{ if($("#adminNameText")) $("#adminNameText").textContent = getAdminName(); }catch(_){ }
  }
}

function attachAdminProfile(){
  const box = document.getElementById('adminProfile');
  if(!box) return;
  try{
    const nameEl = document.getElementById('adminNameText');
    const avatarEl = document.getElementById('adminAvatar');
    const roleEl = document.getElementById('adminRoleText');

    // hide full admin profile if not authenticated
    if(!state.adminAuthed){
      box.style.display = 'none';
      return;
    }
    box.style.display = '';

    if(nameEl) nameEl.textContent = getAdminName() || '';
    if(avatarEl) avatarEl.textContent = (getAdminName()||'A').slice(0,1).toUpperCase();
    if(roleEl){ const r = getAdminRole(); if(r){ roleEl.textContent = r; roleEl.style.display = ''; } else { roleEl.style.display = 'none'; } }

    const editBtn = document.getElementById('editAdminBtn');
    if(editBtn){
      editBtn.addEventListener('click', ()=>{
        const cur = getAdminName() || '';
        const input = document.createElement('input');
        input.value = cur;
        input.className = 'field__input';
        input.style.width = '140px';
        nameEl.replaceWith(input);
        input.focus();

        const save = ()=>{
          const v = (input.value||'').trim() || 'Admin';
          setAdminName(v);
          try{ if(document.getElementById('adminNameText')) document.getElementById('adminNameText').textContent = getAdminName(); }catch(_){ }
          try{ renderAdminLog(); }catch(_){ }
        };

        const onKey = (e)=>{ if(e.key === 'Enter'){ save(); input.removeEventListener('keydown', onKey); input.replaceWith(document.getElementById('adminNameText') || (()=>{ const d=document.createElement('div'); d.id='adminNameText'; d.textContent=getAdminName(); return d; })()); } };
        input.addEventListener('keydown', onKey);
        input.addEventListener('blur', ()=>{ save(); try{ input.replaceWith(document.getElementById('adminNameText') || (()=>{ const d=document.createElement('div'); d.id='adminNameText'; d.textContent=getAdminName(); return d; })()); }catch(_){ } });
      }, { once:true });
    }
    // If owner, show button to create new admin users
    try{
      const role = getAdminRole();
      if(role === 'Владелец'){
        let addBtn = document.getElementById('addAdminBtn');
        if(!addBtn){
          addBtn = document.createElement('button');
          addBtn.className = 'mini mini--good';
          addBtn.id = 'addAdminBtn';
          addBtn.textContent = 'Добавить логин';
          editBtn.parentNode && editBtn.parentNode.insertBefore(addBtn, editBtn.nextSibling);
        }
        addBtn.removeEventListener('click', createAdminUser);
        addBtn.addEventListener('click', createAdminUser);
        addBtn.style.display = '';
      }else{
        const addBtn = document.getElementById('addAdminBtn'); if(addBtn) addBtn.style.display = 'none';
      }
    }catch(_){ }
  }catch(_){ }
}

async function createAdminUser(){
  // Show modal instead of prompts
  const modal = document.getElementById('addAdminUserModal');
  if(!modal) return popToast('Модаль не найдена', 'bad');
  
  // Clear form
  const userInput = document.getElementById('newAdminUser');
  const passInput = document.getElementById('newAdminPass');
  const roleSelect = document.getElementById('newAdminRole');
  if(userInput) userInput.value = '';
  if(passInput) passInput.value = '';
  if(roleSelect) roleSelect.value = 'Модератор';
  
  // Show modal
  modal.style.display = 'flex';
  if(userInput) userInput.focus();
}

// Handle form submission for new admin user
async function submitNewAdminUser(){
  try{
    const user = (document.getElementById('newAdminUser')?.value || '').trim();
    const pass = (document.getElementById('newAdminPass')?.value || '').trim();
    const role = (document.getElementById('newAdminRole')?.value || 'Модератор').trim();
    
    if(!user){
      popToast('Введи логин', 'bad');
      document.getElementById('newAdminUser')?.focus();
      return;
    }
    if(!pass){
      popToast('Введи пароль', 'bad');
      document.getElementById('newAdminPass')?.focus();
      return;
    }

    // Get token from localStorage
    const token = localStorage.getItem('admin_token');
    if(!token){
      popToast('Не авторизирован. Перезагрузи страницу и залогинься заново.', 'bad');
      return;
    }

    // Check auth status with token first
    try{
      const statusResp = await fetch('/api/admin/status-token', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const status = await statusResp.json();
      if(!status.authed){
        localStorage.removeItem('admin_token');
        popToast(`Не авторизирован: ${status.reason}. Залогинься заново.`, 'bad');
        return;
      }
      if(status.role !== 'Владелец'){
        popToast(`Твоя роль: ${status.role}. Только владелец может создавать пользователей.`, 'bad');
        return;
      }
    }catch(_){
      // If status check fails, continue and let the create endpoint handle it
    }
    
    const resp = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass, role, token })
    });
    if(resp.ok){
      const modal = document.getElementById('addAdminUserModal');
      if(modal) modal.style.display = 'none';
      popToast('Аккаунт создан ✅', 'good');
      try{ logAdmin('Создал аккаунт', { user, role }); }catch(_){ }
    }else{
      const data = await resp.json().catch(()=>({}));
      if(data && data.error === 'exists') popToast('Пользователь уже существует', 'bad');
      else if(data && data.error === 'not allowed') popToast('Недостаточно прав (только владелец)', 'bad');
      else if(data && data.error === 'missing') popToast('Не указаны логин или пароль', 'bad');
      else popToast('Ошибка: ' + (data?.error || 'неизвестная ошибка'), 'bad');
    }
  }catch(e){ popToast('Ошибка сети: ' + (e?.message || 'не удалось подключиться'), 'bad'); }
}

// Bind submit button
document.getElementById('submitNewAdminBtn')?.addEventListener('click', submitNewAdminUser);
document.getElementById('newAdminPass')?.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') submitNewAdminUser(); });
document.getElementById('newAdminUser')?.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') document.getElementById('newAdminPass')?.focus(); });

// Delete admin user modal
async function deleteAdminUser(){
  try{
    const modal = document.getElementById('deleteAdminUserModal');
    if(!modal) return popToast('Модаль не найдена', 'bad');
    
    // Load list of admins
    const token = localStorage.getItem('admin_token');
    if(!token){
      popToast('Не авторизирован. Залогинься заново.', 'bad');
      return;
    }

    const resp = await fetch('/api/admin/users-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    
    const data = await resp.json().catch(()=>({}));
    const users = Array.isArray(data) ? data : (data?.users || []);
    
    if(!Array.isArray(users) || users.length === 0){
      popToast('Не удалось загрузить список администраторов', 'bad');
      return;
    }

    // Populate dropdown
    const select = document.getElementById('adminToDelete');
    if(select){
      select.innerHTML = '<option value="">-- Выберите пользователя --</option>';
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id || u.user;
        opt.textContent = `${u.user} (${u.role})`;
        select.appendChild(opt);
      });
    }

    // Show modal
    modal.style.display = 'flex';
  }catch(e){ 
    popToast('Ошибка: ' + (e?.message || 'не удалось загрузить список'), 'bad');
  }
}

// Confirm delete admin user
async function confirmDeleteAdmin(){
  try{
    const select = document.getElementById('adminToDelete');
    const userId = select?.value;
    
    if(!userId){
      popToast('Выберите пользователя для удаления', 'bad');
      return;
    }

    const token = localStorage.getItem('admin_token');
    if(!token){
      popToast('Не авторизирован', 'bad');
      return;
    }

    const resp = await fetch('/api/admin/users/' + userId, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if(resp.ok){
      const modal = document.getElementById('deleteAdminUserModal');
      if(modal) modal.style.display = 'none';
      popToast('Администратор удалён ✅', 'good');
      try{ logAdmin('Удалил администратора', { userId }); }catch(_){ }
    }else{
      const data = await resp.json().catch(()=>({}));
      if(data?.error === 'not allowed') popToast('Недостаточно прав', 'bad');
      else if(data?.error === 'not found') popToast('Пользователь не найден', 'bad');
      else popToast('Ошибка: ' + (data?.error || 'неизвестная ошибка'), 'bad');
    }
  }catch(e){ 
    popToast('Ошибка сети: ' + (e?.message || 'не удалось подключиться'), 'bad');
  }
}

// Bind delete button
document.getElementById('confirmDeleteAdminBtn')?.addEventListener('click', confirmDeleteAdmin);

/* ---------- Topbar admin profile (visible on all pages) ---------- */
function attachTopbarProfile(){
  const wrap = document.getElementById('topbarProfile');
  if(!wrap) return;
  const nameEl = document.getElementById('topAdminName');
  const avatarEl = document.getElementById('topAdminAvatar');
  const roleEl = document.getElementById('topAdminRole');
  const btn = document.getElementById('topAdminBtn');
  const openBtn = document.getElementById('topAdminOpen');

  try{ if(nameEl) nameEl.textContent = getAdminName(); }catch(_){ }
  try{ if(avatarEl) avatarEl.textContent = (getAdminName()||'A').slice(0,1).toUpperCase(); }catch(_){ }
  try{ if(roleEl) roleEl.textContent = (state.adminAuthed ? 'Администратор' : 'Гость'); }catch(_){ }

  if(state.adminAuthed){
    if(btn) btn.style.display = '';
    if(openBtn) openBtn.style.display = '';
  }else{
    if(btn) btn.style.display = 'none';
    if(openBtn) openBtn.style.display = 'none';
  }

  if(btn){
    btn.removeEventListener('click', logout);
    btn.addEventListener('click', ()=>{
      logout();
      attachTopbarProfile();
    });
  }
  if(openBtn){
    openBtn.removeEventListener('click', ()=>{});
    openBtn.addEventListener('click', ()=>{
      // open admin page in new tab; server will only serve it if token cookie exists
      window.open('pages/admin/Админ.html', '_blank');
    });
  }
}

// ensure topbar updates on state changes
try{ attachTopbarProfile(); }catch(_){ }



$("#clearAdminLog")?.addEventListener("click", ()=>{
  showConfirm("Очистить лог действий?").then(ok=>{
    if(!ok) return;
    state.logs = [];
    saveState();
    renderAdminLog();
    popToast("Лог очищен ✅","good");
  });
});

// Sync state across browser tabs/windows: when STORAGE_KEY changes, reload members/items/logs and re-render
window.addEventListener('storage', (e)=>{
  try{
    if(!e.key) return;
    if(e.key !== STORAGE_KEY) return;
    const parsed = JSON.parse(e.newValue || '{}');
    // merge into in-memory state
    if(parsed && Array.isArray(parsed.members)) state.members = parsed.members;
    if(parsed && Array.isArray(parsed.items)) state.items = parsed.items;
    if(parsed && Array.isArray(parsed.logs)) state.logs = parsed.logs;
    // try re-rendering if elements are present on this page
    try{ renderAdminMembers(); }catch(_){ }
    try{ renderAdmin(); }catch(_){ }
    try{ renderRoster(); }catch(_){ }
  }catch(_){ }
});

// Ensure `login` is available on window for pages that call it directly
try{ if(typeof login === 'function') window.login = login; }catch(_){ }
