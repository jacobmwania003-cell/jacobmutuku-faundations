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
const kes1 = n => "KSh " + (Math.round(Number(n || 0) * 10) / 10).toLocaleString();
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const low = s => String(s || "").toLowerCase();
const line = (a, b, strong) => '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid #eef2f7' + (strong ? ';font-weight:bold;font-size:17px' : '') + '"><span>' + a + '</span><span>' + b + '</span></div>';

let isOwner = false, unsubs = [];
let data = {sales: [], trips: [], expenses: []};
let loaded = {};

function pnlHtml(){
  const E = data.expenses, S = data.sales, T = data.trips;
  const invest = sum(E.filter(x => x.kind !== "made"), x => x.amount);
  const salesTotal = sum(S, x => x.total), salesQty = sum(S, x => x.qty);
  const sellerSales = sum(S.filter(x => low(x.email) !== OWNER), x => x.total);
  const payOut = Math.round(sellerSales * RATE);
  const net = salesTotal - payOut - invest;
  const made = sum(E, x => x.qty);
  const taken = sum(T, t => t.taken);
  const back = sum(T.filter(t => t.returned != null), t => t.returned);
  const freezer = Math.max(0, made - taken + back);
  const out = sum(T.filter(t => t.returned == null), t => t.taken);
  const stock = freezer + out;
  const avg = salesQty > 0 ? salesTotal / salesQty : DEFAULT_PRICE;
  const keep = 1 - RATE;
  const potential = stock * avg;
  const potentialNet = potential * keep;
  const projected = net + potentialNet;
  const good = net >= 0;

  let h = '<div class="card" style="border:2px solid ' + (good ? '#2e9e4f' : '#c0392b') + '"><b>Profit or loss since you started</b>' +
    '<div style="margin:6px 0;font-size:18px;font-weight:bold;color:' + (good ? '#2e9e4f' : '#c0392b') + '">' +
    (good ? 'Profit so far: ' : 'Loss so far: ') + kes(Math.abs(net)) + '</div>' +
    line("Money from sales", kes(salesTotal)) +
    line("− Seller pay (" + Math.round(RATE * 100) + "%)", kes(payOut)) +
    line("− Your investment (all money spent)", kes(invest)) +
    line(good ? "= Profit" : "= Loss", kes(Math.abs(net)), true);
  if (invest === 0) h += '<div class="out" style="margin-top:6px">No money spent is saved yet. Add your investment (ingredients, freezer, boxes) in the Expenses tab, or this profit is not real.</div>';

  h += '<div style="margin-top:12px"><b>If you sell all the pops you have</b></div>' +
    line("Pops in freezer and with sellers", stock) +
    line("Average price of one pop", kes1(avg)) +
    line("They would bring", kes(potential)) +
    line("After seller pay (you keep " + Math.round(keep * 100) + "%)", kes(potentialNet)) +
    line(projected >= 0 ? "= Total profit if all are sold" : "= Total loss even if all are sold", kes(Math.abs(projected)), true);
  h += '<div style="margin-top:6px;font-weight:bold;color:' + (projected >= 0 ? '#2e9e4f' : '#c0392b') + '">' +
    (projected >= 0 ? 'Selling all your stock gives a profit.' : 'Even after selling all your pops you still make a loss. Your investment is bigger than the stock can earn.') + '</div>';

  if (net < 0){
    const needSales = -net / keep;
    h += '<div style="margin-top:12px"><b>To cover your investment</b></div>' +
      line("You still need sales of", kes(needSales)) +
      line("That is about", Math.ceil(needSales / avg) + " pops");
  }
  if (made > 0 && invest > 0){
    const cost = invest / made;
    h += '<div style="margin-top:12px"><b>Per pop</b></div>' +
      line("Investment per pop made", kes1(cost)) +
      line("You keep from one pop sold by a seller", kes1(avg * keep)) +
      line(avg * keep - cost >= 0 ? "= Profit per pop" : "= Loss per pop", kes1(Math.abs(avg * keep - cost)), true);
  }
  h += '<div class="muted" style="margin-top:8px">This counts everything since you started, not only this month. Profit = sales − seller pay − all money spent.</div></div>';
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
  if (el.dataset.v !== h){ el.innerHTML = h; el.dataset.v = h; }
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
