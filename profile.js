import {getApp, getApps, initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {getFirestore, doc, getDoc, setDoc} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getLS = k => { try { return localStorage.getItem(k); } catch(e){ return null; } };
const setLS = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };

let user = null, isOwner = false, photo = "", redirected = false, timer = null;

const hideOn = () => getLS("hideSummary") !== "0";

function applyStyle(){
  let st = document.getElementById("hs-style");
  if (!st){ st = document.createElement("style"); st.id = "hs-style"; document.head.appendChild(st); }
  st.textContent = (isOwner && hideOn()) ? "#t_summary{display:none !important}" : "";
}

function nameOf(){
  if (!user) return "";
  if (isOwner) return "Jacob";
  return getLS("sellerName") || String(user.email || "").split("@")[0].split("+")[0];
}

function avatarHtml(size){
  const base = "width:" + size + "px;height:" + size + "px;border-radius:50%;flex:0 0 auto;";
  if (photo) return '<img src="' + photo + '" alt="" style="' + base + 'object-fit:cover;border:3px solid #1155c4;display:block">';
  const letter = esc((nameOf() || "?").charAt(0).toUpperCase());
  return '<div style="' + base + 'background:#1155c4;color:#fff;font-size:' + Math.round(size * 0.45) + 'px;font-weight:bold;display:flex;align-items:center;justify-content:center">' + letter + '</div>';
}

function ensureRow(){
  const a = document.getElementById("app");
  if (!a || !user || !a.querySelector(".tabs")) return;
  let row = document.getElementById("profrow");
  if (!row){
    row = document.createElement("div");
    row.id = "profrow";
    row.style.cssText = "display:flex;align-items:center;gap:14px;margin:6px 0 4px;cursor:pointer";
    row.onclick = openMenu;
    a.insertBefore(row, a.firstChild);
  }
  const h = avatarHtml(72) + '<div><div style="font-size:20px;font-weight:bold;color:#1b2430">Welcome, ' + esc(nameOf()) + '</div>' +
    '<div style="color:#5b6877;font-size:13px">' + (isOwner ? "Owner" : "Seller") + ' · tap the picture to change it</div></div>';
  if (row.dataset.v !== h){ row.innerHTML = h; row.dataset.v = h; }
}

function resize(file, cb){
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const s = 160, c = document.createElement("canvas");
      c.width = s; c.height = s;
      const m = Math.min(img.width, img.height);
      c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
      cb(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => cb(null);
    img.src = fr.result;
  };
  fr.onerror = () => cb(null);
  fr.readAsDataURL(file);
}

function savePhoto(p){
  photo = p || "";
  setLS("photo_" + user.uid, photo);
  setDoc(doc(db, "users", user.uid), {photo: photo}, {merge: true}).catch(() => {});
  ensureRow();
}

function closeMenu(){
  const m = document.getElementById("profmenu");
  if (m) m.remove();
}

function openMenu(){
  if (!user || document.getElementById("profmenu")) return;
  const m = document.createElement("div");
  m.id = "profmenu";
  m.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:50;display:flex;align-items:center;justify-content:center;padding:20px";
  const btn = "width:100%;padding:13px;margin:6px 0;font-size:16px;border:none;border-radius:8px;color:#fff;";
  m.innerHTML = '<div style="background:#fff;border-radius:14px;padding:18px;width:100%;max-width:340px;text-align:center">' +
    '<div style="display:flex;justify-content:center;margin-bottom:10px">' + avatarHtml(110) + '</div>' +
    '<b>' + esc(nameOf()) + '</b>' +
    '<input id="pfile" type="file" accept="image/*" style="display:none">' +
    '<button id="pchange" style="' + btn + 'background:#1155c4">Change photo</button>' +
    (photo ? '<button id="premove" style="' + btn + 'background:#c0392b">Remove photo</button>' : '') +
    (isOwner ? '<label style="display:flex;align-items:center;gap:10px;text-align:left;margin:10px 0;font-size:15px"><input id="pshow" type="checkbox" style="width:auto"' + (hideOn() ? "" : " checked") + '> Show the Summary tab</label>' : '') +
    '<button id="pclose" style="' + btn + 'background:#5b6877">Close</button></div>';
  document.body.appendChild(m);
  m.onclick = e => { if (e.target === m) closeMenu(); };
  document.getElementById("pclose").onclick = closeMenu;
  const f = document.getElementById("pfile");
  document.getElementById("pchange").onclick = () => f.click();
  f.onchange = () => {
    const file = f.files && f.files[0];
    if (!file) return;
    resize(file, p => {
      if (!p){ alert("Could not read that picture. Try another one."); return; }
      savePhoto(p);
      closeMenu();
    });
  };
  const rm = document.getElementById("premove");
  if (rm) rm.onclick = () => { savePhoto(""); closeMenu(); };
  const sh = document.getElementById("pshow");
  if (sh) sh.onchange = () => {
    setLS("hideSummary", sh.checked ? "0" : "1");
    applyStyle();
    redirected = false;
    landing(true);
  };
}

function landing(now){
  if (!isOwner || !hideOn() || redirected) return;
  const s = document.getElementById("t_summary");
  if (!s || !s.classList.contains("on")) return;
  const t = document.getElementById("t_charts") || (now || tries > 8 ? document.getElementById("t_trips") : null);
  if (t){ redirected = true; t.click(); }
}

let tries = 0;
function loop(){
  tries++;
  ensureRow();
  landing(false);
  if (tries > 40) clearInterval(timer);
}

const appEl = document.getElementById("app");
if (appEl) new MutationObserver(() => { ensureRow(); }).observe(appEl, {childList: true});

onAuthStateChanged(auth, u => {
  clearInterval(timer);
  user = u || null;
  isOwner = !!u && low(u.email) === OWNER;
  photo = "";
  redirected = false;
  tries = 0;
  applyStyle();
  closeMenu();
  const r = document.getElementById("profrow");
  if (r) r.remove();
  if (!u) return;
  photo = getLS("photo_" + u.uid) || "";
  if (!photo){
    getDoc(doc(db, "users", u.uid)).then(s => {
      const p = s.exists() ? s.data().photo : "";
      if (p && user && user.uid === u.uid){ photo = p; setLS("photo_" + u.uid, p); ensureRow(); }
    }).catch(() => {});
  }
  timer = setInterval(loop, 400);
});
