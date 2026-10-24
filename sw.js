const PIN = "1234";
let pinOk = false;
window.setTab = t => {
  if (t === "summary" && !pinOk){
    const p = prompt("Enter PIN");
    if (p !== PIN){ if (p !== null) alert("Wrong PIN"); return; }
    pinOk = true;
  }
  if (t !== "summary") pinOk = false;
  tab = t; selSeller = null;
