import {getApp, getApps, initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore, collection, onSnapshot} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const DEFAULT_PRICE = 10;

const kes = n => "KSh " + Math.round(Number(n || 0)).toLocaleString();
const kes2 = n => "KSh " + (Math.round(Number(n || 0) * 100) / 100).toFixed(2);
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const low = s => String(s || "").toLowerCase();
const line = (a, b, strong) => '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid #eef2f7' + (strong ? ';font-weight:bold;font-size:17px' : '') + '"><span>' + a + '</span><span>' + b + '</span></div>';

let isOwner = false, unsubs = [];
let data = {sales: [], trips: [], expenses: []};
let loaded = {};

function getSet(){
  let s = {sachet: 5.8, pops: 20};
  try {
    const r = JSON.parse(localStorage.getItem("pnlSet") || "null");
    if (r && r.sachet > 0 && r.pops > 0) s = {sachet: Number(r.sachet), pops: Number(r.pops)};
  } catch(e){}
  return s;
}

function pnlHtml(){
  const set = getSet();
  const unit = set.sachet / set.pops;
  const E = data.expenses, S = data.sales, T = data.trips;
  const produced = sum(E.filter(x => !x.note && Number(x.qty) > 0), x => x.qty);
  const juice = produced * unit;
  const other = sum(E.filter(x => x.kind !== "made"), x => x.amount);
  const cost = juice + other;
  const salesTotal = sum(S, x => x.total), salesQty = sum(S, x => x.qty);
  const sellerSales = sum(S.filter(x => low(x.email) !== OWNER), x => x.total);
  const payOut = Math.round(sellerSales * RATE);
  const net = salesTotal - payOut - cost;
  const made = sum(E, x => x.qty);
  const taken = sum(T, t => t.taken);
  const back = sum(T.filter(t => t.returned != null), t => t.returned);
  const freezer = Math.max(0, made - taken + back);
  const out = sum(T.filter(t => t.returned == null), t => t.taken);
  const stock = freezer + out;
  const avg = salesQty > 0 ? salesTotal / salesQty : DEFAULT_PRICE;
  const keep = 1 - RATE;
  const potentialNet = stock * avg * keep;
  const projected = net + potentialNet;
  const good = net >= 0;

  let h = '<div class="card" style="border:2px solid ' + (good ? '#2e9e4f' : '#c0392b') + '"><b>Profit or loss since you started</b>' +
    '<div style="margin:6px 0;font-size:18px;font-weight:bold;color:' + (good ? '#2e9e4f' : '#c0392b') + '">' +
    (good ? 'Profit so far: ' : 'Loss so far: ') + kes(Math.abs(net)) + '</div>' +
    line("Money from sales", kes(salesTotal)) +
    line("− Seller pay (" + Math.round(RATE * 100) + "%)", kes(payOut)) +
    line("− Juice (" + produced + " pops made × " + kes2(unit) + ")", kes(juice)) +
    line("− Other costs (electricity, food, ...)", kes(other)) +
    line(good ? "= Profit" : "= Loss", kes(Math.abs(net)), true);
  if (other === 0) h += '<div class="out" style="margin-top:6px">No other costs are saved yet. Add electricity, food, packaging, freezer and other money you spent in the Expenses tab, or this profit is too high.</div>';

  h += '<div style="margin-top:12px"><b>Cost of one ice pop</b></div>' +
    line("Juice: " + kes2(set.sachet) + " ÷ " + set.pops + " pops", kes2(unit));
  if (produced > 0){
    const oth = other / produced;
    const all = unit + oth;
    const gain = avg * keep - all;
    h += line("Other costs per pop made", kes2(oth)) +
      line("= Cost of one pop", kes2(all), true) +
      line("You keep from one pop sold by a seller", kes2(avg * keep)) +
      line(gain >= 0 ? "= Profit per pop" : "= Loss per pop", kes2(Math.abs(gain)), true);
  }

  h += '<div style="margin-top:12px"><b>If you sell all the pops you have</b></div>' +
    line("Pops in freezer and with sellers", stock) +
    line("Average price of one pop", kes2(avg)) +
    line("You would keep after seller pay", kes(stock * avg * keep)) +
    line(projected >= 0 ? "= Total profit if all are sold" : "= Total loss even if all are sold", kes(Math.abs(projected)), true);
  h += '<div style="margin-top:6px;font-weight:bold;color:' + (projected >= 0 ? '#2e9e4f' : '#c0392b') + '">' +
    (projected >= 0 ? 'Selling all your stock gives a profit.' : 'Even after selling all your pops you still make a loss. Your costs are bigger than the stock can earn.') + '</div>';

  if (net < 0){
    const need = -net / keep;
    h += '<div style="margin-top:12px"><b>To cover your costs</b></div>' +
      line("You still need sales of", kes(need)) +
      line("That is about", Math.ceil(need / avg) + " pops");
  }

  h += '<div style="margin-top:12px"><b>Juice cost settings</b></div>' +
    '<div class="muted">1 sachet makes 1.5 litres. 1.5 litres make 20 pops. Do not add juice sachets in Expenses. They are counted from the pops you make.</div>' +
    '<div style="display:flex;gap:10px;margin-top:6px"><div style="flex:1"><div class="muted">Price of 1 sachet (KSh)</div><input id="pset1" type="number" step="0.1" value="' + set.sachet + '" style="width:100%;padding:10px;font-size:16px;border-radius:8px;border:1px solid #9aa7b6"></div>' +
    '<div style="flex:1"><div class="muted">Pops from 1 sachet</div><input id="pset2" type="number" step="1" value="' + set.pops + '" style="width:100%;padding:10px;font-size:16px;border-radius:8px;border:1px solid #9aa7b6"></div></div>' +
    '<div class="muted" style="margin-top:8px">Profit = sales − seller pay − juice − all other money spent. It counts everything since you started.</div></div>';
  return h;
}

function inject(){
  if (!isOwner || !(loaded.sales && loaded.trips && loaded.expenses)) return;
  const v = document.getElementById("sumview");
  if (!v) return;
  let el = document.getElementById("pnl");
  if (!el){
    el = document.createElement("div");
    el.id = "pnl";
    v.insertBefore(el, v.firstChild);
  }
  const h = pnlHtml();
  if (el.dataset.v !== h){
    el.innerHTML = h;
    el.dataset.v = h;
    const save = () => {
      const a = Number(document.getElementById("pset1").value), b = Number(document.getElementById("pset2").value);
      if (a > 0 && b > 0){
        try { localStorage.setItem("pnlSet", JSON.stringify({sachet: a, pops: b})); } catch(e){}
        el.dataset.v = "";
        inject();
      }
    };
    ["pset1", "pset2"].forEach(id => { const i = document.getElementById(id); if (i) i.onchange = save; });
  }
}

const appEl = document.getElementById("app");
if (appEl) new MutationObserver(inject).observe(appEl, {childList: true, subtree: true});

function sub(name){
  unsubs.push(onSnapshot(collection(db, name), snap => {
    data[name] = snap.docs.map(d => ({id: d.id, ...d.data()}));
    loaded[name] = true;
    inject();
  }, () => {}));
}

onAuthStateChanged(auth, u => {
  unsubs.forEach(f => f()); unsubs = [];
  data = {sales: [], trips: [], expenses: []};
  loaded = {};
  isOwner = !!u && low(u.email) === OWNER;
  if (!isOwner) return;
  ["sales", "trips", "expenses"].forEach(sub);
});
