import {getApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore,collection,onSnapshot,query,where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const TOPIC = "jm-icepops-k7x92qpw4t";
const OWNER = "jacobmwania003@gmail.com";
const KEY = "ntfyQueue";
const low = s => String(s || "").toLowerCase();
const num = n => Number(n) || 0;
const kes = n => "KSh " + num(n).toLocaleString();
const todayStr = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };

async function flush(){
  let q = [];
  try { q = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch(e){}
  localStorage.removeItem(KEY);
  const failed = [];
  for (const m of q){
    try { await fetch("https://ntfy.sh/" + TOPIC, {method:"POST", headers:{Title:m.title, Priority:"high"}, body:m.body}); }
    catch(e){ failed.push(m); }
  }
  if (failed.length) localStorage.setItem(KEY, JSON.stringify(failed));
}
function send(title, body){
  let q = [];
  try { q = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch(e){}
  q.push({title, body});
  localStorage.setItem(KEY, JSON.stringify(q));
  flush();
}
window.addEventListener("online", flush);
flush();

let app;
for (let i = 0; i < 40 && !app; i++){
  try { app = getApp(); }
  catch(e){ await new Promise(r => setTimeout(r, 500)); }
}
const auth = getAuth(app);
const db = getFirestore(app);
let stops = [];

onAuthStateChanged(auth, user => {
  stops.forEach(s => s());
  stops = [];
  if (!user) return;
  const mine = name => low(user.email) === OWNER
    ? collection(db, name)
    : query(collection(db, name), where("uid", "==", user.uid));

  let salesDocs = [], tripDocs = [];
  const seen = new Map();
  let first = true;

  stops.push(onSnapshot(mine("sales"), snap => {
    salesDocs = snap.docs.map(d => d.data());
  }, e => send("Notify error sales", String(e.code || e))));

  stops.push(onSnapshot(mine("trips"), snap => {
    tripDocs = snap.docs.map(d => d.data());
    snap.docChanges().forEach(ch => {
      const t = ch.doc.data(), id = ch.doc.id;
      const local = ch.doc.metadata.hasPendingWrites;
      const before = seen.get(id);
      seen.set(id, t.returned == null ? null : t.returned);
      send("Debug trip", ch.type + " local=" + local + " first=" + first);
      if (first || !local) return;
      const who = String(t.email || "Seller").split("@")[0];
      const items = Object.keys(t.items || {}).map(n => n + " " + (t.items[n].taken || 0)).join(", ");
      const isNew = ch.type === "added";
      if (isNew && t.returned == null){
        send("Trip taken", who + " took " + num(t.taken) + " pops" + (items ? ": " + items : ""));
      } else if (t.returned != null && (isNew || before == null)){
        const sold = num(t.taken) - num(t.returned) - num(t.damaged);
        send("Trip returned", who + " took " + num(t.taken) + ", returned " + num(t.returned) + ", damaged " + num(t.damaged) + ", sold " + sold);
        const d = todayStr(), k = low(t.email);
        const sales = salesDocs.filter(x => x.date === d && low(x.email) === k);
        const dmg = tripDocs.filter(x => x.date === d && low(x.email) === k && x.returned != null)
          .reduce((a, x) => a + num(x.damaged), 0);
        send("Evening summary", who + ": total sales today " + kes(sales.reduce((a, x) => a + num(x.total), 0)) +
          " (" + sales.reduce((a, x) => a + num(x.qty), 0) + " pops), damaged " + dmg);
      }
    });
    first = false;
  }, e => send("Notify error trips", String(e.code || e))));
});
