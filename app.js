"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const isPC = () => matchMedia("(min-width:900px)").matches;
let data = null, dirty = false, editId = null, barMode = "week";
const charts = {};

/* ---------- 날짜 ---------- */
const pad = n => String(n).padStart(2, "0");
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => fmt(new Date());
const hm = min => min >= 60 ? `${Math.floor(min / 60)}시간${min % 60 ? " " + (min % 60) + "분" : ""}` : `${min}분`;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/* ---------- 불러오기 · 저장 ---------- */
async function load() {
  const draft = LS.get("jt-draft", null);
  if (draft) { data = draft; dirty = true; }
  else {
    try {
      const r = await fetch("data.json?t=" + Date.now(), { cache: "no-store" });
      data = await r.json();
    } catch { data = LS.get("jt-cache", null); }
  }
  if (!data) { toast("data.json을 읽지 못했어요"); data = { settings: { weeklyGoalHours: 10, areas: ["기타"], restDays: [], remind: {} }, projects: [], logs: [] }; }
  data.settings = Object.assign({ weeklyGoalHours: 10, areas: ["기타"], restDays: [], remind: {} }, data.settings);
  if (!dirty) LS.set("jt-cache", data);
  renderAll();
}
function touch() { dirty = true; LS.set("jt-draft", data); renderAll(); }
function sync() {
  $("#syncDot").classList.toggle("dirty", dirty);
  $("#syncTxt").textContent = dirty ? "저장 안 됨" : "저장됨";
}
const b64 = s => { const b = new TextEncoder().encode(s); let t = ""; b.forEach(x => t += String.fromCharCode(x)); return btoa(t); };
async function pushGithub() {
  const c = LS.get("jt-conn", null);
  if (!c || !c.repo || !c.token) { toast("설정에서 GitHub 연결을 먼저 하세요"); return; }
  const url = `https://api.github.com/repos/${c.repo}/contents/data.json`;
  const h = { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" };
  try {
    const g = await fetch(`${url}?ref=${c.branch || "main"}`, { headers: h });
    const sha = g.ok ? (await g.json()).sha : undefined;
    const body = { message: "기록 업데이트 " + new Date().toISOString().slice(0, 16), branch: c.branch || "main", sha,
      content: b64(JSON.stringify(data, null, 2) + "\n") };
    const r = await fetch(url, { method: "PUT", headers: h, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(r.status);
    dirty = false; LS.del("jt-draft"); LS.set("jt-cache", data); sync(); toast("저장했어요. 폰에는 1~2분 뒤 반영돼요");
  } catch (e) { toast("저장 실패: " + e.message); }
}

/* ---------- 계산 ---------- */
const minsByDate = () => { const m = {}; data.logs.forEach(l => m[l.date] = (m[l.date] || 0) + (+l.minutes || 0)); return m; };
const projMins = id => data.logs.filter(l => l.projectId === id).reduce((a, l) => a + (+l.minutes || 0), 0);
function streak() {
  const m = minsByDate(), rest = data.settings.restDays || [];
  let d = new Date(), n = 0;
  if (!m[fmt(d)]) d = addDays(d, -1);
  for (let i = 0; i < 1000; i++, d = addDays(d, -1)) {
    if (m[fmt(d)] > 0) n++;
    else if (!rest.includes(d.getDay())) break;
  }
  return n;
}
function weekMins() {
  const m = minsByDate(), now = new Date(), mon = addDays(now, -((now.getDay() + 6) % 7));
  let t = 0; for (let d = mon; d <= now; d = addDays(d, 1)) t += m[fmt(d)] || 0;
  return t;
}
function missing(p) {
  const x = [];
  if (!p.start) x.push("기간");
  if (!p.tags || !p.tags.length) x.push("기술");
  if (!projMins(p.id)) x.push("시간");
  if (!p.metrics || !p.metrics.length) x.push("성과");
  if (!(p.links && (p.links.github || p.links.demo))) x.push("링크");
  if (!p.retro) x.push("회고");
  return x;
}

/* ---------- 그리기 ---------- */
function renderAll() { renderHome(); renderProjects(); renderStats(); renderSettings(); sync(); }

function renderHome() {
  const m = minsByDate(), total = data.logs.reduce((a, l) => a + (+l.minutes || 0), 0);
  $("#kStreak").textContent = streak();
  $("#kToday").textContent = m[today()] || 0;
  $("#kTotal").textContent = (total / 60).toFixed(1) + "h";
  const goal = data.settings.weeklyGoalHours * 60, wk = weekMins(), pct = Math.min(100, Math.round(wk / goal * 100));
  $("#ringFg").setAttribute("stroke-dasharray", `${264 * pct / 100} 264`);
  $("#ringPct").textContent = pct + "%";
  $("#ringTxt").textContent = `${hm(wk)} / ${data.settings.weeklyGoalHours}시간`;

  const sel = $("#logProject"), keep = sel.value;
  sel.innerHTML = data.projects.filter(p => p.status !== "완료").map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")
    || `<option value="">프로젝트를 먼저 만드세요</option>`;
  if (keep) sel.value = keep;
  $("#todayLogs").innerHTML = data.logs.map((l, i) => ({ l, i })).filter(o => o.l.date === today()).map(({ l, i }) => {
    const p = data.projects.find(p => p.id === l.projectId);
    return `<li><span>${esc(p ? p.name : "?")} · ${hm(l.minutes)}${l.note ? " · " + esc(l.note) : ""}</span><button data-dellog="${i}">✕</button></li>`;
  }).join("");

  const bad = data.projects.filter(p => missing(p).length);
  const al = $("#missAlert"); al.hidden = !bad.length;
  al.textContent = `⚠️ 빈 항목이 있는 프로젝트 ${bad.length}개`;

  // 잔디
  const now = new Date(), start = addDays(addDays(now, -((now.getDay() + 6) % 7 + 1)), -19 * 7 + 1); // 일요일 시작 정렬
  const sun = addDays(now, -now.getDay()), first = addDays(sun, -19 * 7);
  let h = "";
  for (let d = first; d <= addDays(sun, 6); d = addDays(d, 1)) {
    const v = m[fmt(d)] || 0, lv = d > now ? "" : v >= 120 ? "l4" : v >= 60 ? "l3" : v >= 30 ? "l2" : v > 0 ? "l1" : "";
    h += `<i class="${lv}" title="${fmt(d)} ${v}분" ${d > now ? 'style="visibility:hidden"' : ""}></i>`;
  }
  $("#heat").innerHTML = h; void start;
  drawBar();

  const dd = LS.get("jt-dday", []).filter(x => x.date).sort((a, b) => a.date.localeCompare(b.date));
  $("#ddayCard").hidden = !dd.length;
  $("#ddayList").innerHTML = dd.map(x => {
    const n = Math.ceil((parse(x.date) - parse(today())) / 864e5);
    return `<div class="row" style="justify-content:space-between;padding:4px 0"><span>${esc(x.title)}</span><b style="color:${n < 0 ? "var(--sub)" : n <= 3 ? "var(--warn)" : "var(--accent)"}">${n === 0 ? "D-Day" : n > 0 ? "D-" + n : "D+" + (-n)}</b></div>`;
  }).join("");
}

function chartDefaults() {
  Chart.defaults.color = css("--sub"); Chart.defaults.borderColor = css("--line");
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
}
function mk(id, cfg) {
  if (typeof Chart === "undefined") return;
  if (charts[id]) charts[id].destroy();
  chartDefaults();
  charts[id] = new Chart($("#" + id), cfg);
}
function drawBar() {
  const m = minsByDate(), labels = [], vals = [];
  if (barMode === "week") {
    for (let i = 6; i >= 0; i--) { const d = addDays(new Date(), -i); labels.push(`${d.getMonth() + 1}/${d.getDate()}(${DAYS[d.getDay()]})`); vals.push(+((m[fmt(d)] || 0) / 60).toFixed(1)); }
  } else {
    const now = new Date(), mon = addDays(now, -((now.getDay() + 6) % 7));
    for (let w = 7; w >= 0; w--) {
      const s = addDays(mon, -w * 7); let t = 0;
      for (let k = 0; k < 7; k++) t += m[fmt(addDays(s, k))] || 0;
      labels.push(`${s.getMonth() + 1}/${s.getDate()}주`); vals.push(+(t / 60).toFixed(1));
    }
  }
  mk("barChart", { type: "bar", data: { labels, datasets: [{ data: vals, backgroundColor: css("--accent"), borderRadius: 6 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: "시간" } } } } });
}

function renderProjects() {
  $("#projCount").textContent = data.projects.length + "개";
  $("#projList").innerHTML = data.projects.map(p => {
    const miss = missing(p), mins = projMins(p.id);
    return `<div class="card proj">
      <div class="head"><div><h3>${esc(p.name)}</h3><span class="chip">${esc(p.type || "")}</span><span class="chip">${esc(p.area || "")}</span>
        <span class="chip ${p.status === "완료" ? "done" : ""}">${esc(p.status)}</span></div>
        <button class="btn ghost sm pc-only" data-edit="${p.id}">편집</button></div>
      <div class="bar"><div style="width:${p.progress || 0}%"></div></div>
      <div class="row" style="justify-content:space-between;font-size:14px;color:var(--sub)"><span>진행 ${p.progress || 0}%</span><span>누적 ${mins ? hm(mins) : "-"}</span></div>
      <div>${(p.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join("")}${(p.metrics || []).map(x => `<span class="chip done">${esc(x.label)} ${esc(x.value)}${esc(x.unit || "")}</span>`).join("")}</div>
      ${p.retro ? `<div style="font-size:15px">💬 ${esc(p.retro)}</div>` : ""}
      ${miss.length ? `<div>${miss.map(x => `<span class="chip miss">빈 항목 · ${x}</span>`).join("")}</div>` : `<span class="chip done">모두 채움</span>`}
    </div>`;
  }).join("") || `<div class="empty">프로젝트가 없어요</div>`;
}

function renderStats() {
  const tagM = {}, areaM = {};
  data.logs.forEach(l => {
    const p = data.projects.find(p => p.id === l.projectId); if (!p) return;
    const tags = (p.tags && p.tags.length) ? p.tags : ["미분류"];
    tags.forEach(t => tagM[t] = (tagM[t] || 0) + l.minutes / tags.length);
    areaM[p.area || "기타"] = (areaM[p.area || "기타"] || 0) + l.minutes;
  });
  const tk = Object.keys(tagM), sh = ["#2563eb", "#5b8ef0", "#93b4f7", "#64748b", "#94a3b8", "#cbd5e1", "#1e40af", "#3b82f6"];
  if (tk.length) mk("donut", { type: "doughnut", data: { labels: tk, datasets: [{ data: tk.map(k => +(tagM[k] / 60).toFixed(2)), backgroundColor: tk.map((_, i) => sh[i % sh.length]), borderWidth: 0 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } } });
  else if (charts.donut) { charts.donut.destroy(); delete charts.donut; }
  const ar = data.settings.areas;
  mk("radar", { type: "radar", data: { labels: ar, datasets: [{ data: ar.map(a => +((areaM[a] || 0) / 60).toFixed(2)), backgroundColor: css("--accent") + "55", borderColor: css("--accent"), pointBackgroundColor: css("--accent") }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, ticks: { backdropColor: "transparent" } } } } });

  const ps = data.projects.filter(p => p.start), t0 = ps.length ? Math.min(...ps.map(p => +parse(p.start))) : +new Date();
  const t1 = Math.max(+new Date(), ...ps.map(p => p.end ? +parse(p.end) : 0)), span = Math.max(t1 - t0, 864e5);
  $("#timeline").innerHTML = data.projects.map(p => {
    if (!p.start) return `<div class="t"><span>${esc(p.name)}</span><span class="chip miss" style="width:fit-content">기간 비어 있음</span></div>`;
    const a = (+parse(p.start) - t0) / span * 100, b = ((p.end ? +parse(p.end) : +new Date()) - t0) / span * 100;
    return `<div class="t"><span>${esc(p.name)}</span><div class="track"><i class="${p.end ? "" : "open"}" style="left:${a}%;width:${Math.max(b - a, 1.5)}%" title="${p.start} ~ ${p.end || "진행 중"}"></i></div></div>`;
  }).join("") || `<div class="empty">프로젝트가 없어요</div>`;
}

function renderSettings() {
  const s = data.settings, c = LS.get("jt-conn", {});
  if (document.activeElement !== $("#sGoal")) $("#sGoal").value = s.weeklyGoalHours;
  $("#sText").value = (s.remind && s.remind.text) || "";
  $("#sRepo").value = c.repo || ""; $("#sBranch").value = c.branch || "main"; $("#sToken").value = c.token || "";
  $("#sRest").innerHTML = DAYS.map((n, i) => `<label style="margin:0;display:flex;gap:4px;align-items:center;color:var(--ink)"><input type="checkbox" style="width:auto" data-rest="${i}" ${s.restDays.includes(i) ? "checked" : ""}>${n}</label>`).join("");
  const dis = !isPC(); ["sGoal", "sText"].forEach(i => $("#" + i).disabled = dis); $$("[data-rest]").forEach(x => x.disabled = dis);
  $("#ddList").innerHTML = LS.get("jt-dday", []).map((x, i) => `<li><span>${esc(x.title)} · ${x.date}</span><button data-deldd="${i}">✕</button></li>`).join("");
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let tt; function toast(t) { const e = $("#toast"); e.textContent = t; e.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => e.classList.remove("show"), 2600); }

/* ---------- 이벤트 ---------- */
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  $$("#tabs button").forEach(x => x.classList.toggle("on", x === b));
  $$(".view").forEach(v => v.classList.toggle("on", v.id === "v-" + b.dataset.v));
  renderStats();
});
$("#barSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; barMode = b.dataset.m; $$("#barSeg button").forEach(x => x.classList.toggle("on", x === b)); drawBar(); });
$("#logForm").addEventListener("click", e => { const a = e.target.dataset.add; if (a) $("#logMin").value = (+$("#logMin").value || 0) + +a; });
$("#logForm").addEventListener("submit", e => {
  e.preventDefault();
  if (!$("#logProject").value) return;
  data.logs.push({ date: today(), projectId: $("#logProject").value, minutes: +$("#logMin").value, note: $("#logNote").value.trim() });
  $("#logMin").value = ""; $("#logNote").value = ""; touch(); toast("기록했어요");
});
$("#logForm").addEventListener("keydown", e => { if (e.key === "Enter" && e.ctrlKey) $("#logForm").requestSubmit(); });
$("#todayLogs").addEventListener("click", e => { const i = e.target.dataset.dellog; if (i !== undefined) { data.logs.splice(+i, 1); touch(); } });
$("#btnSave").addEventListener("click", pushGithub);
document.addEventListener("keydown", e => { if (e.key === "s" && e.ctrlKey && isPC()) { e.preventDefault(); pushGithub(); } });

// 프로젝트 편집
$("#btnNewProj").addEventListener("click", () => openProj(null));
$("#projList").addEventListener("click", e => { const id = e.target.dataset.edit; if (id) openProj(id); });
function openProj(id) {
  editId = id;
  const p = id ? data.projects.find(x => x.id === id) : { name: "", type: "공부", area: data.settings.areas[0], status: "진행", start: today(), end: "", progress: 0, tags: [], links: {}, metrics: [], retro: "" };
  $("#dlgTitle").textContent = id ? "프로젝트 편집" : "새 프로젝트";
  $("#pArea").innerHTML = data.settings.areas.map(a => `<option>${esc(a)}</option>`).join("");
  $("#pName").value = p.name; $("#pType").value = p.type; $("#pArea").value = p.area; $("#pStatus").value = p.status;
  $("#pStart").value = p.start || ""; $("#pEnd").value = p.end || ""; $("#pProg").value = p.progress || 0;
  $("#pTags").value = (p.tags || []).join(", ");
  $("#pMetrics").value = (p.metrics || []).map(m => `${m.label} ${m.value} ${m.unit || ""}`.trim()).join("\n");
  $("#pGit").value = (p.links || {}).github || ""; $("#pDemo").value = (p.links || {}).demo || ""; $("#pRetro").value = p.retro || "";
  $("#pDel").hidden = !id; updProg(); updRetro(); $("#dlg").showModal();
}
const updProg = () => $("#pProgTxt").textContent = $("#pProg").value + "%";
const updRetro = () => { const n = $("#pRetro").value.trim().split(/\s+/).filter(Boolean).length; $("#retroCnt").textContent = n ? `${n}단어` + (n > 10 ? " (10단어 넘음)" : "") : ""; };
$("#pProg").addEventListener("input", updProg); $("#pRetro").addEventListener("input", updRetro);
$("#pCancel").addEventListener("click", () => $("#dlg").close());
$("#pDel").addEventListener("click", () => {
  if (!confirm("이 프로젝트와 기록을 삭제할까요?")) return;
  data.projects = data.projects.filter(p => p.id !== editId); data.logs = data.logs.filter(l => l.projectId !== editId);
  $("#dlg").close(); touch();
});
$("#pForm").addEventListener("submit", () => {
  const metrics = $("#pMetrics").value.split("\n").map(s => s.trim()).filter(Boolean).map(s => {
    const t = s.split(/\s+/); const vi = t.findIndex((x, i) => i > 0 && /^[\d.,]+$/.test(x));
    return vi < 0 ? { label: s, value: "", unit: "" } : { label: t.slice(0, vi).join(" "), value: t[vi], unit: t.slice(vi + 1).join(" ") };
  });
  const p = {
    id: editId || "p-" + Date.now().toString(36), name: $("#pName").value.trim(), type: $("#pType").value, area: $("#pArea").value,
    status: $("#pStatus").value, start: $("#pStart").value, end: $("#pEnd").value, progress: +$("#pProg").value,
    tags: $("#pTags").value.split(",").map(s => s.trim()).filter(Boolean),
    links: { github: $("#pGit").value.trim(), demo: $("#pDemo").value.trim() }, metrics, retro: $("#pRetro").value.trim()
  };
  const i = data.projects.findIndex(x => x.id === p.id);
  if (i >= 0) data.projects[i] = p; else data.projects.push(p);
  touch(); toast("저장했어요 (GitHub 저장 버튼도 눌러주세요)");
});

// 설정
$("#btnConn").addEventListener("click", () => { LS.set("jt-conn", { repo: $("#sRepo").value.trim(), branch: $("#sBranch").value.trim() || "main", token: $("#sToken").value.trim() }); toast("연결 정보를 저장했어요"); });
$("#btnSet").addEventListener("click", () => {
  data.settings.weeklyGoalHours = Math.max(1, +$("#sGoal").value || 10);
  data.settings.restDays = $$("[data-rest]").filter(x => x.checked).map(x => +x.dataset.rest);
  data.settings.remind = Object.assign(data.settings.remind || {}, { text: $("#sText").value.trim() });
  touch(); toast("설정을 적용했어요");
});
$("#ddForm").addEventListener("submit", e => { e.preventDefault(); const l = LS.get("jt-dday", []); l.push({ title: $("#ddTitle").value.trim(), date: $("#ddDate").value }); LS.set("jt-dday", l); e.target.reset(); renderAll(); });
$("#ddList").addEventListener("click", e => { const i = e.target.dataset.deldd; if (i !== undefined) { const l = LS.get("jt-dday", []); l.splice(+i, 1); LS.set("jt-dday", l); renderAll(); } });
$("#btnExport").addEventListener("click", () => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `job-tracker-${today()}.json`; a.click();
});
$("#fileImport").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  try { const j = JSON.parse(await f.text()); if (!j.projects || !j.logs) throw 0; data = j; touch(); toast("가져왔어요"); } catch { toast("올바른 JSON이 아니에요"); }
});
$("#btnDiscard").addEventListener("click", () => { if (confirm("저장 안 한 변경을 버릴까요?")) { LS.del("jt-draft"); dirty = false; load(); } });

// 알림 켜기
const u8 = b => { const p = "=".repeat((4 - b.length % 4) % 4), s = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, c => c.charCodeAt(0)); };
$("#btnPush").addEventListener("click", async () => {
  const out = $("#pushOut");
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("이 브라우저는 푸시를 지원하지 않아요");
    const key = data.settings.vapidPublicKey;
    if (!key) throw new Error("data.json의 settings.vapidPublicKey가 비어 있어요 (SETUP.md 참고)");
    if (await Notification.requestPermission() !== "granted") throw new Error("알림 권한이 거부됐어요");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(key) });
    out.innerHTML = `<div class="warn">아래 JSON을 GitHub Secret <b>PUSH_SUBSCRIPTION</b>에 붙여넣으세요</div><div class="mono" id="subTxt"></div>`;
    $("#subTxt").textContent = JSON.stringify(sub);
  } catch (e) { out.innerHTML = `<div class="warn">${esc(e.message)}</div>`; }
});

/* ---------- 시작 ---------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
matchMedia("(prefers-color-scheme:dark)").addEventListener("change", () => data && renderAll());
addEventListener("resize", () => data && renderSettings());
load();
