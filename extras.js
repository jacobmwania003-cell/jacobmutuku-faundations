 import {getApp, getApps, initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore, collection, doc, updateDoc, onSnapshot, query, where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const cfg = {
  apiKey: "AIzaSyDLDw73TgCaItVk_F2Nj-Q0VpqWGQCiqKc",
  authDomain: "jacobmutuku-foundations.firebaseapp.com",
  projectId: "jacobmutuku-foundations",
  storageBucket: "jacobmutuku-foundations.firebasestorage.app",
  messagingSenderId: "287620971591",
  appId: "1:287620971591:web:f75597352d897efc368562"
};
const app = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

const OWNER = "jacobmwania003@gmail.com";
const RATE = 0.35;
const LOW_STOCK = 100;
const FLAVORS = ["Mango", "Orange", "Pineapple", "Strawberry", "Ukwaju", "Savings tub"];
const COLORS = {"Mango": "#f5a800", "Orange": "#ff7a00", "Pineapple": "#f4d03f", "Strawberry": "#e0243c", "Ukwaju": "#8a5a3c", "Savings tub": "#2aa5a0"};
const PALETTE = ["#1155c4", "#e0243c", "#f5a800", "#2e9e4f", "#7b4bd6", "#2aa5a0", "#ff7a00", "#8a5a3c"];

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const kes = n => "KSh " + Number(n || 0).toLocaleString();
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const low = s => String(s || "").toLowerCase();
const pay = n => Math.round((Number(n) || 0) * RATE);
const ds = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const dayStr = i => { const d = new Date(); d.setDate(d.getDate() - i); return ds(d); };
const fmtK = v => v >= 1000 ? (Math.round(v / 100) / 10) + "k" : String(Math.round(v));
const dotH = c => '<span style="display:inline-block;width:13px;height:13px;border-radius:50%;margin-right:8px;vertical-align:-2px;background:' + c + '"></span>';

let user = null, isOwner = false, range = 14, lowAlerted = false;
let data = {sales: [], trips: [], expenses: [], users: []};
let loaded = {}, unsubs = [], fixed = new Set(), syncWarned = false;

function niceMax(m){
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  const f = m / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

function lineChart(labels, series){
  const W = 340, H = 220, L = 42, R = 10, T = 12, B = 30;
  const max = Math.max(1, ...series.map(s => Math.max(...s.values)));
  const top = Math.max(4, niceMax(max));
  const x = i => L + (labels.length < 2 ? (W - L - R) / 2 : i * (W - L - R) / (labels.length - 1));
  const y = v => T + (H - T - B) * (1 - v / top);
  let g = "";
  for (let i = 0; i <= 4; i++){
    const v = top * i / 4, yy = y(v);
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#e3e9f2"/>' +
      '<text x="' + (L - 6) + '" y="' + (yy + 4) + '" font-size="10" text-anchor="end" fill="#5b6877">' + fmtK(v) + '</text>';
  }
  const step = Math.ceil(labels.length / 6);
  labels.forEach((l, i) => {
    if (i % step === 0) g += '<text x="' + x(i) + '" y="' + (H - 10) + '" font-size="10" text-anchor="middle" fill="#5b6877">' + esc(l.slice(5)) + '</text>';
  });
  series.forEach(s => {
    g += '<polyline points="' + s.values.map((v, i) => x(i) + "," + y(v)).join(" ") + '" fill="none" stroke="' + s.color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    if (labels.length <= 14) s.values.forEach((v, i) => { g += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3" fill="' + s.color + '"/>'; });
  });
  const legend = series.map(s => '<span style="margin-right:14px">' + dotH(s.color) + esc(s.name) + ': <b>' + kes(sum(s.values, v => v)) + '</b></span>').join("");
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block">' + g + '</svg><div class="muted" style="margin-top:6px">' + legend + '</div>';
}

function pieChart(items){
  items = items.filter(i => i.value > 0);
  const total = sum(items, i => i.value);
  if (!total) return '<div class="muted">No data for these days yet.</div>';
  const cx = 100, cy = 100, r = 90;
  let a0 = -Math.PI / 2, p = "";
  items.forEach(it => {
    const fr = it.value / total;
    if (items.length === 1){ p += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + it.color + '"/>'; return; }
    const a1 = a0 + fr * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    p += '<path d="M' + cx + ',' + cy + ' L' + x0 + ',' + y0 + ' A' + r + ',' + r + ' 0 ' + (fr > 0.5 ? 1 : 0) + ' 1 ' + x1 + ',' + y1 + ' Z" fill="' + it.color + '" stroke="#fff" stroke-width="2"/>';
    a0 = a1;
  });
  const legend = items.map(it =>
    '<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid #eef2f7"><span>' + dotH(it.color) + esc(it.label) +
    '</span><span><b>' + (it.text || kes(it.value)) + '</b> · ' + Math.round(it.value * 100 / total) + '%</span></div>'
  ).join("");
  return '<svg viewBox="0 0 200 200" style="width:100%;max-width:210px;display:block;margin:0 auto 8px">' + p + '</svg>' + legend;
}

function groupItems(arr, keyFn, valFn){
  const m = {};
  arr.forEach(x => { const k = keyFn(x); m[k] = (m[k] || 0) + (Number(valFn(x)) || 0); });
  return Object.keys(m).sort((a, b) => m[b] - m[a]).map((k, i) => ({label: k, value: m[k], color: COLORS[k] || PALETTE[i % PALETTE.length]}));
}

const box = (t, body) => '<div class="card"><b>' + esc(t) + '</b><div style="margin-top:8px">' + body + '</div></div>';

function chartsHtml(){
  const d = ds(new Date());
  const labels = [];
  for (let i = range - 1; i >= 0; i--) labels.push(dayStr(i));
  const from = labels[0];
  const S = data.sales.filter(x => x.date >= from && x.date <= d);
  const salesVals = labels.map(l => sum(S.filter(x => x.date === l), x => x.total));
  const flavKey = x => FLAVORS.find(n => low(n) === low(x.product)) || x.product || "Other";
  const T = data.trips.filter(t => t.returned != null && t.date >= from && t.date <= d);
  const tk = sum(T, t => t.taken), rt = sum(T, t => t.returned), dm = sum(T, t => t.damaged);
  const sold = Math.max(0, tk - rt - dm);
  const pops = [
    {label: "Sold", value: sold, color: "#2e9e4f", text: String(sold)},
    {label: "Returned", value: rt, color: "#f5a800", text: String(rt)},
    {label: "Damaged", value: dm, color: "#e0243c", text: String(dm)}
  ];
  const paidItems = [
    {label: "Paid", value: sum(S.filter(x => x.paid), x => x.total), color: "#2e9e4f"},
    {label: "Not paid yet", value: sum(S.filter(x => !x.paid), x => x.total), color: "#e0243c"}
  ];
  let h = '<div class="card"><b>Business performance</b><div style="color:#5b6877;font-size:14px;margin-top:8px">Show the last</div>' +
    '<select id="crange2" style="width:100%;padding:12px;margin:4px 0;font-size:16px;border-radius:8px;border:1px solid #9aa7b6">' +
    [7, 14, 30].map(n => '<option value="' + n + '"' + (n === range ? " selected" : "") + '>' + n + ' days</option>').join("") + '</select></div>';
  if (isOwner){
    const EX = data.expenses.filter(x => x.kind !== "made" && x.date >= from && x.date <= d);
    const spentVals = labels.map(l => sum(EX.filter(x => x.date === l), x => x.amount));
    h += box("Sales and money spent", lineChart(labels, [
      {name: "Sales", color: "#1155c4", values: salesVals},
      {name: "Money spent", color: "#e0243c", values: spentVals}
    ]));
    const totalSales = sum(S, x => x.total), spent = sum(EX, x => x.amount);
    const by = {};
    S.forEach(x => { const k = low(x.email); if (k && k !== OWNER) by[k] = (by[k] || 0) + (Number(x.total) || 0); });
    const payTotal = sum(Object.keys(by), k => pay(by[k]));
    const profit = totalSales - spent - payTotal;
    h += box("Where the sales money goes", pieChart([
      {label: "Seller pay (" + Math.round(RATE * 100) + "%)", value: payTotal, color: "#2e9e4f"},
      {label: "Money spent", value: spent, color: "#e0243c"},
      {label: "Profit", value: Math.max(0, profit), color: "#1155c4"}
    ]) + (profit < 0 ? '<div style="color:#c0392b;font-weight:bold;margin-top:6px">Loss: money spent and seller pay are ' + kes(-profit) + ' more than sales.</div>' : ""));
    h += box("Sales by flavour", pieChart(groupItems(S, flavKey, x => x.total)));
    h += box("Sales by seller", pieChart(groupItems(S, x => x.seller || x.email || "Unknown", x => x.total)));
    h += box("Pops taken out (finished trips)", pieChart(pops));
    h += box("Paid and not paid sales", pieChart(paidItems));
  } else {
    h += box("My sales and my pay", lineChart(labels, [
      {name: "My sales", color: "#1155c4", values: salesVals},
      {name: "My pay (" + Math.round(RATE * 100) + "%)", color: "#2e9e4f", values: salesVals.map(pay)}
    ]));
    h += box("My sales by flavour", pieChart(groupItems(S, flavKey, x => x.total)));
    h += box("My pops (finished trips)", pieChart(pops));
    h += box("Paid and not paid sales", pieChart(paidItems));
  }
  return h;
}

function renderCharts(){
  const el = document.getElementById("chartsview");
  if (!el || !user) return;
  el.innerHTML = chartsHtml();
  const sel = document.getElementById("crange2");
  if (sel) sel.onchange = () => { range = Number(sel.value) || 14; renderCharts(); };
}

function openCharts(){
  document.querySelectorAll("#app .tabs button").forEach(b => b.classList.toggle("on", b.id === "t_charts"));
  const c = document.getElementById("content");
  if (!c) return;
  c.innerHTML = '<div id="chartsview"></div>';
  renderCharts();
}

function lowBanner(){
  const el = document.getElementById("lowbar");
  if (!el) return;
  if (!isOwner || !loaded.expenses || !loaded.trips){ el.innerHTML = ""; return; }
  const made = sum(data.expenses, x => x.qty);
  const taken = sum(data.trips, x => x.taken);
  const back = sum(data.trips.filter(x => x.returned != null), x => x.returned);
  const raw = made - taken + back, left = Math.max(0, raw);
  if (left >= LOW_STOCK){ el.innerHTML = ""; lowAlerted = false; return; }
  el.innerHTML = '<div class="card" style="border-color:#c0392b;background:#fdecea"><span style="color:#c0392b;font-weight:bold">⚠ Low stock: only ' + left +
    ' ice pops left in the chest freezer.</span><br><span style="color:#5b6877;font-size:13px">It is below ' + LOW_STOCK + '. Time to make more.' +
    (raw < 0 ? ' Add all pops made in the Made tab so this number is exact.' : '') + '</span></div>';
  if (!lowAlerted){
    lowAlerted = true;
    const t = document.getElementById("toast");
    if (t){
      t.style.background = "#c0392b";
      t.textContent = "Low stock: only " + left + " ice pops left. Time to make more!";
      t.style.display = "block";
      setTimeout(() => { t.style.display = "none"; }, 7000);
    }
  }
}

function ensureUI(){
  const tabs = document.querySelector("#app .tabs");
  if (!tabs || !user) return;
  if (!document.getElementById("t_charts")){
    const b = document.createElement("button");
    b.id = "t_charts";
    b.textContent = "Charts";
    b.onclick = openCharts;
    tabs.insertBefore(b, tabs.children[isOwner ? 1 : 2] || null);
  }
  if (!document.getElementById("lowbar")){
    const d = document.createElement("div");
    d.id = "lowbar";
    tabs.parentNode.insertBefore(d, tabs);
    lowBanner();
  }
}

function syncOwned(){
  const uidBy = {};
  data.users.forEach(u => { if (u.email) uidBy[low(u.email)] = u.id; });
  [["sales", data.sales], ["trips", data.trips]].forEach(pair => {
    const col = pair[0];
    pair[1].forEach(x => {
      const k = low(x.email), target = uidBy[k], key = col + "/" + x.id;
      if (!k || k === OWNER || !target || x.uid === target || fixed.has(key)) return;
      fixed.add(key);
      updateDoc(doc(db, col, x.id), {uid: target}).catch(() => {
        if (syncWarned) return;
        syncWarned = true;
        const t = document.getElementById("toast");
        if (t){
          t.style.background = "#c0392b";
          t.textContent = "Could not share an entry with the seller. Tell Claude: Firebase rules may need a change.";
          t.style.display = "block";
          setTimeout(() => { t.style.display = "none"; }, 8000);
        }
      });
    });
  });
}

function update(){
  if (isOwner) syncOwned();
  ensureUI();
  lowBanner();
  renderCharts();
}

const appEl = document.getElementById("app");
if (appEl) new MutationObserver(ensureUI).observe(appEl, {childList: true});

function sub(name, ref){
  unsubs.push(onSnapshot(ref, snap => {
    data[name] = snap.docs.map(d => ({id: d.id, ...d.data()}));
    loaded[name] = true;
    update();
  }, () => {}));
}

onAuthStateChanged(auth, u => {
  unsubs.forEach(f => f()); unsubs = [];
  data = {sales: [], trips: [], expenses: [], users: []};
  loaded = {}; lowAlerted = false; fixed = new Set(); syncWarned = false;
  user = u || null;
  if (!u) return;
  isOwner = low(u.email) === OWNER;
  if (isOwner){
    sub("sales", collection(db, "sales"));
    sub("trips", collection(db, "trips"));
    sub("expenses", collection(db, "expenses"));
    sub("users", collection(db, "users"));
  } else {
    sub("sales", query(collection(db, "sales"), where("uid", "==", u.uid)));
    sub("trips", query(collection(db, "trips"), where("uid", "==", u.uid)));
  }
  setTimeout(ensureUI, 300);
});
