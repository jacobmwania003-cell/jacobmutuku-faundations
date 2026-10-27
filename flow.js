import {getApp, getApps, initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const FLAVORS = ["Mango", "Orange", "Pineapple", "Strawberry", "Ukwaju", "Savings tub"];
const DEFAULT_PRICE = 10;
const START = 1793044800000;

const low = s => String(s || "").toLowerCase();
const keyOf = s => low(s).replace(/[^a-z0-9]/g, "");
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const el = id => document.getElementById(id);
const num = id => Number((el(id) || {}).value) || 0;
const canon = n => FLAVORS.find(f => low(f) === low(n)) || String(n || "").trim();

let isOwner = false, user = null, unsubs = [], loaded = {}, timer = null;
let data = {expenses: [], trips: [], sales: [], products: []};

function stockMap(){
  const m = {};
  const g = n => { const k = low(n); return m[k] || (m[k] = {name: n, made: 0, taken: 0, back: 0, left: 0}); };
  FLAVORS.forEach(g);
  data.expenses.forEach(x => { if (x.items) Object.keys(x.items).forEach(n => { g(n).made += Number(x.items[n]) || 0; }); });
  data.trips.forEach(t => { if (t.items) Object.keys(t.items).forEach(n => {
    const f = g(n), it = t.items[n];
    f.taken += it.taken || 0;
    if (t.returned != null) f.back += it.returned || 0;
  }); });
  Object.keys(m).forEach(k => { m[k].left = m[k].made - m[k].taken + m[k].back; });
  return m;
}

function availFor(name){
  const k = low(name);
  if (isOwner){
    const f = stockMap()[k];
    return f ? Math.max(0, f.left) : 0;
  }
  const p = data.products.find(x => low(x.name) === k);
  return p && typeof p.stock === "number" ? Math.max(0, p.stock) : null;
}

function ready(){
  return isOwner ? (loaded.expenses && loaded.trips) : loaded.products;
}

function tripCheck(){
  if (!ready()) return "Please wait a few seconds for the stock to load, then tap Save trip again.";
  const date = (el("tdate") || {}).value || today();
  if (date < today()) return "";
  const rows = {};
  FLAVORS.forEach((n, i) => { rows[low(n)] = {name: n, tk: num("tk" + i)}; });
  const on = ((el("oname") || {}).value || "").trim();
  if (on){
    const k = low(canon(on));
    if (rows[k]) rows[k].tk += num("tkx"); else rows[k] = {name: on, tk: num("tkx")};
  }
  for (const k of Object.keys(rows)){
    const r = rows[k];
    if (r.tk <= 0) continue;
    const a = availFor(r.name);
    if (a === null) return r.name + " is not in the freezer stock yet. The owner must add it in the Made tab first.";
    if (r.tk > a) return a === 0
      ? "There is no " + r.name + " in the freezer. Add " + r.name + " in the Made tab first."
      : "Only " + a + " " + r.name + " in the freezer. You typed " + r.tk + ". Add more in the Made tab first.";
  }
  return "";
}

function saleCheck(){
  if (!isOwner) return "Sales are added automatically when you end your trip. Record your trip in the Trips tab.";
  const by = el("sby");
  if (by && by.value && by.value !== "__me") return "Sales for a seller are added automatically from the seller's trips. Use this form only for pops you sold yourself from the freezer.";
  if (!ready()) return "Please wait a few seconds for the stock to load, then tap Save again.";
  const flav = ((el("flav") || {}).value || "").trim();
  const q = num("qty");
  if (!flav || !(q > 0)) return "";
  const a = availFor(flav);
  if (a === 0 || a === null) return "There is no " + canon(flav) + " in the freezer. Add " + canon(flav) + " in the Made tab first.";
  if (q > a) return "Only " + a + " " + canon(flav) + " in the freezer. You typed " + q + ". Add more in the Made tab first.";
  return "";
}

function wrap(name, check){
  const tryWrap = () => {
    const orig = window[name];
    if (typeof orig !== "function" || orig.__w) return typeof orig === "function";
    const w = function(){
      const msg = check();
      if (msg){ alert(msg); return Promise.resolve(); }
      return orig.apply(this, arguments);
    };
    w.__w = true;
    window[name] = w;
    return true;
  };
  if (!tryWrap()){
    let n = 0;
    const iv = setInterval(() => { if (tryWrap() || ++n > 100) clearInterval(iv); }, 200);
  }
}
wrap("addTrip", tripCheck);
wrap("addSale", saleCheck);

function priceOf(n){
  const p = data.products.find(x => low(x.name) === low(n));
  return p ? (Number(p.price) || DEFAULT_PRICE) : DEFAULT_PRICE;
}

function autoSales(){
  if (!loaded.trips || !loaded.sales) return;
  const have = new Set(data.sales.map(s => s.id));
  data.trips.forEach(t => {
    if (t.returned == null) return;
    const jobs = [];
    if (t.items && Object.keys(t.items).length){
      Object.keys(t.items).forEach(n => {
        const it = t.items[n];
        const sold = (it.taken || 0) - (it.returned || 0) - (it.damaged || 0);
        if (sold > 0) jobs.push({id: "auto_" + t.id + "_" + keyOf(n), name: canon(n), qty: sold});
      });
    } else {
      const sold = (t.taken || 0) - (t.returned || 0) - (t.damaged || 0);
      if (sold > 0) jobs.push({id: "auto_" + t.id + "_all", name: "Ice pops", qty: sold});
    }
    jobs.forEach(j => {
      if (have.has(j.id)) return;
      have.add(j.id);
      const price = priceOf(j.name);
      setDoc(doc(db, "sales", j.id), {
        uid: t.uid, email: t.email, date: t.date, seller: t.seller || "", product: j.name, customer: "",
        qty: j.qty, price: price, total: j.qty * price, paid: true, auto: true, tripId: t.id, ts: t.ts || Date.now()
      }).catch(e => console.warn("auto sale", e.message));
    });
  });
}

function ownerTasks(){
  if (!isOwner || !(loaded.expenses && loaded.trips && loaded.sales && loaded.products)) return;
  const tripIds = new Set(data.trips.map(t => t.id));
  const saleIds = new Set(data.sales.map(s => s.id));
  const expIds = new Set(data.expenses.map(x => x.id));
  data.sales.forEach(s => {
    if (s.tripId && !tripIds.has(s.tripId)) deleteDoc(doc(db, "sales", s.id)).catch(() => {});
  });
  data.expenses.forEach(x => {
    if (x.saleId && !saleIds.has(x.saleId)) deleteDoc(doc(db, "expenses", x.id)).catch(() => {});
  });
  data.sales.forEach(s => {
    if (s.auto || s.stockDone || low(s.email) !== OWNER || !((s.ts || 0) >= START)) return;
    const id = "dsale_" + s.id;
    if (expIds.has(id)) return;
    expIds.add(id);
    const n = canon(s.product), q = Number(s.qty) || 0;
    if (!(q > 0)) return;
    setDoc(doc(db, "expenses", id), {kind: "made", item: n, amount: 0, qty: -q, items: {[n]: -q}, date: s.date, ts: s.ts, note: "Direct sale", saleId: s.id})
      .then(() => updateDoc(doc(db, "sales", s.id), {stockDone: true}))
      .catch(e => console.warn("direct sale", e.message));
  });
  const sm = stockMap();
  Object.keys(sm).forEach(k => {
    const f = sm[k];
    if (!f.made && !f.taken) return;
    const left = f.left;
    const p = data.products.find(x => low(x.name) === k);
    if (p){
      if (p.stock !== left) updateDoc(doc(db, "products", p.id), {stock: left}).catch(() => {});
    } else {
      setDoc(doc(db, "products", "flavor_" + keyOf(f.name)), {name: f.name, price: DEFAULT_PRICE, stock: left, ts: Date.now()}).catch(() => {});
    }
  });
}

function sellerNote(){
  if (isOwner) return;
  const f = el("sname");
  if (!f || !f.closest) return;
  const card = f.closest(".card");
  if (!card || card.dataset.note) return;
  card.dataset.note = "1";
  card.innerHTML = '<b>Your sales are added for you</b><div class="muted" style="margin-top:6px">When you end a trip in the Trips tab, the pops sold are added here by themselves. You do not need to type them.</div>';
}

function update(){
  autoSales();
  clearTimeout(timer);
  timer = setTimeout(ownerTasks, 1500);
  sellerNote();
}

const appEl = el("app");
if (appEl) new MutationObserver(sellerNote).observe(appEl, {childList: true, subtree: true});

function sub(name, ref){
  unsubs.push(onSnapshot(ref, snap => {
    data[name] = snap.docs.map(d => ({id: d.id, ...d.data()}));
    loaded[name] = true;
    update();
  }, () => {}));
}

onAuthStateChanged(auth, u => {
  unsubs.forEach(f => f()); unsubs = [];
  data = {expenses: [], trips: [], sales: [], products: []};
  loaded = {};
  user = u || null;
  isOwner = !!u && low(u.email) === OWNER;
  if (!u) return;
  if (isOwner){
    ["expenses", "trips", "sales", "products"].forEach(n => sub(n, collection(db, n)));
  } else {
    sub("trips", query(collection(db, "trips"), where("uid", "==", u.uid)));
    sub("sales", query(collection(db, "sales"), where("uid", "==", u.uid)));
    sub("products", collection(db, "products"));
  }
});
