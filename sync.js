import {getApp, getApps, initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore, collection, doc, updateDoc, onSnapshot} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const low = s => String(s || "").toLowerCase();

let isOwner = false, unsubs = [], fixed = new Set(), warned = false;
let data = {sales: [], trips: [], users: []};

function warn(){
  if (warned) return;
  warned = true;
  const t = document.getElementById("toast");
  if (!t) return;
  t.style.background = "#c0392b";
  t.textContent = "Could not share an entry with the seller. Tell Claude: the Firebase rules may need a change.";
  t.style.display = "block";
  setTimeout(() => { t.style.display = "none"; }, 8000);
}

function run(){
  if (!isOwner) return;
  const uidBy = {};
  data.users.forEach(u => { if (u.email) uidBy[low(u.email)] = u.id; });
  [["sales", data.sales], ["trips", data.trips]].forEach(pair => {
    const col = pair[0];
    pair[1].forEach(x => {
      const k = low(x.email), target = uidBy[k], key = col + "/" + x.id;
      if (!k || k === OWNER || !target || x.uid === target || fixed.has(key)) return;
      fixed.add(key);
      updateDoc(doc(db, col, x.id), {uid: target}).catch(warn);
    });
  });
}

function sub(name){
  unsubs.push(onSnapshot(collection(db, name), snap => {
    data[name] = snap.docs.map(d => ({id: d.id, ...d.data()}));
    run();
  }, () => {}));
}

onAuthStateChanged(auth, u => {
  unsubs.forEach(f => f()); unsubs = [];
  data = {sales: [], trips: [], users: []};
  fixed = new Set(); warned = false;
  isOwner = !!u && low(u.email) === OWNER;
  if (!isOwner) return;
  ["sales", "trips", "users"].forEach(sub);
});
