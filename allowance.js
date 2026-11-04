(function () {
  var MAX = 6;
  var FLAVOURS = ['Mango', 'Strawberry', 'Pineapple', 'Orange', 'Ukwaju'];
  var KEY = 'alw_saved';

  function fsdb() {
    try {
      if (window.firebase && firebase.apps && firebase.apps.length && firebase.firestore) {
        return firebase.firestore();
      }
    } catch (e) {}
    return null;
  }
  function who() {
    try {
      var u = firebase.auth().currentUser;
      if (u && u.email) return u.email;
    } catch (e) {}
    return 'seller';
  }
  function isOwner() {
    return /profit|loss|dashboard/i.test(document.body.innerText || '');
  }
  function isSaved() { return localStorage.getItem(KEY) === '1'; }
  function setSaved(v) { localStorage.setItem(KEY, v ? '1' : '0'); }

  // ---------- Panel ----------
  function buildPanel() {
    if (document.getElementById('alw-panel')) return;
    var p = document.createElement('div');
    p.id = 'alw-panel';
    p.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:#fff;overflow:auto;padding:16px;font-family:sans-serif';
    var rows = FLAVOURS.map(function (f) {
      return '<label style="display:flex;justify-content:space-between;align-items:center;margin:10px 0;font-size:17px">' + f +
        '<input type="number" min="0" max="6" value="0" data-f="' + f + '" style="width:80px;font-size:17px;padding:8px"></label>';
    }).join('');
    p.innerHTML =
      '<h2 style="color:#0b5ed7;margin-top:0">Allowance ice pop</h2>' +
      '<p>Maximum ' + MAX + ' ice pops.</p>' + rows +
      '<p style="font-size:18px"><b>Total: <span id="alw-total">0</span> / ' + MAX + '</b></p>' +
      '<p id="alw-msg" style="min-height:24px;font-weight:bold"></p>' +
      '<button id="alw-save" style="background:#d62828;color:#fff;border:0;padding:14px 20px;font-size:17px;border-radius:8px">Save allowance</button> ' +
      '<button id="alw-close" style="background:#eee;border:0;padding:14px 20px;font-size:17px;border-radius:8px">Close</button>';
    document.body.appendChild(p);

    function total() {
      var t = 0;
      p.querySelectorAll('input[data-f]').forEach(function (i) { t += Number(i.value) || 0; });
      document.getElementById('alw-total').textContent = t;
      return t;
    }
    p.addEventListener('input', total);
    document.getElementById('alw-close').onclick = function () { p.style.display = 'none'; };
    document.getElementById('alw-save').onclick = function () {
      var msg = document.getElementById('alw-msg');
      var t = total();
      if (t > MAX) { msg.style.color = '#d62828'; msg.textContent = 'Not allowed. Allowance cannot be more than ' + MAX + ' ice pops.'; return; }
      var items = {};
      p.querySelectorAll('input[data-f]').forEach(function (i) { items[i.dataset.f] = Number(i.value) || 0; });
      var rec = { seller: who(), items: items, total: t, date: new Date().toISOString() };
      var db = fsdb();
      if (db) {
        db.collection('allowances').add(rec).then(function () {
          setSaved(true);
          msg.style.color = 'green'; msg.textContent = 'Allowance saved. You can now save your trip.';
        }).catch(function (e) {
          msg.style.color = '#d62828'; msg.textContent = 'Could not save: ' + e.message;
        });
      } else {
        setSaved(true);
        msg.style.color = 'green'; msg.textContent = 'Allowance saved on this phone. You can now save your trip.';
      }
    };
  }

  // ---------- Tab ----------
  function addTab() {
    if (isOwner() || document.getElementById('alw-tab')) return;
    var els = document.querySelectorAll('button, a, li, div, span');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length === 0 && /^\s*sales\s*$/i.test(el.textContent)) {
        var target = el.closest('button, a, li') || el;
        var c = target.cloneNode(true);
        c.id = 'alw-tab';
        c.removeAttribute('onclick');
        Array.prototype.slice.call(c.attributes).forEach(function (a) {
          if (a.name.indexOf('data-') === 0) c.removeAttribute(a.name);
        });
        c.classList.remove('active');
        var leaf = c; while (leaf.firstElementChild) leaf = leaf.firstElementChild;
        leaf.textContent = 'Allowance';
        c.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          buildPanel();
          document.getElementById('alw-panel').style.display = 'block';
        });
        target.parentNode.appendChild(c);
        return;
      }
    }
  }

  // ---------- Lock Save Trip ----------
  function isTripSave(btn) {
    if (!/save/i.test(btn.textContent)) return false;
    var n = btn;
    for (var i = 0; i < 6 && n; i++) {
      n = n.parentElement;
      if (n && /taken/i.test(n.textContent) && /returned/i.test(n.textContent)) return true;
    }
    return false;
  }
  document.addEventListener('click', function (e) {
    if (isOwner()) return;
    var btn = e.target.closest && e.target.closest('button');
    if (!btn || btn.closest('#alw-panel') || !isTripSave(btn)) return;
    if (!isSaved()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      alert('Save the allowance first. Open the Allowance tab.');
      return;
    }
    setTimeout(function () { setSaved(false); }, 1500);
  }, true);

  setInterval(addTab, 1000);
})();
