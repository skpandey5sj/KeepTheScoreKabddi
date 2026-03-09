// ────────────────────────────────────────────────
const STORAGE_KEY = "kts-basketball-state-2025";

let state = {
  homeName: "KOLHAPUR KINGS",
  awayName: "SATARA CHAMPS",
  currentQuarter: 1,
  quarters: [
    { homeScore:0, awayScore:0, homeFouls:0, awayFouls:0, homeTO:8, awayTO:8 },
    { homeScore:0, awayScore:0, homeFouls:0, awayFouls:0, homeTO:8, awayTO:8 },
    { homeScore:0, awayScore:0, homeFouls:0, awayFouls:0, homeTO:8, awayTO:8 },
    { homeScore:0, awayScore:0, homeFouls:0, awayFouls:0, homeTO:8, awayTO:8 },
  ],
  possession: "home",
  gameTime: 600,          // seconds
  shotTime: 24,
  gameRunning: false,
  shotRunning: false,
  vmix: {
    connected: false,
    ip: "127.0.0.1",
    port: 8088,
    input: "1"
  }
};

let gameTimerId  = null;
let shotTimerId  = null;
let lastVmixSync = 0;

// ──── DOM elements ───────────────────────────────
const els = {
  homeNamePrev:   document.getElementById("homeNamePrev"),
  awayNamePrev:   document.getElementById("awayNamePrev"),
  homeScorePrev:  document.getElementById("homeScorePrev"),
  awayScorePrev:  document.getElementById("awayScorePrev"),
  quarterPrev:    document.getElementById("quarterPrev"),
  possessionPrev: document.getElementById("possessionPrev"),
  gameTimerPrev:  document.getElementById("gameTimerPrev"),
  shotClockPrev:  document.getElementById("shotClockPrev"),
  homeTOPrev:     document.getElementById("homeTOPrev"),
  awayTOPrev:     document.getElementById("awayTOPrev"),
  homeFoulsPrev:  document.getElementById("homeFoulsPrev"),
  awayFoulsPrev:  document.getElementById("awayFoulsPrev"),

  homeNameCtrl:   document.getElementById("homeNameCtrl"),
  awayNameCtrl:   document.getElementById("awayNameCtrl"),
  homeScoreCtrl:  document.getElementById("homeScoreCtrl"),
  awayScoreCtrl:  document.getElementById("awayScoreCtrl"),
  gameTimerCtrl:  document.getElementById("gameTimerCtrl"),
  shotClockCtrl:  document.getElementById("shotClockCtrl"),

  quarterSelect:  document.getElementById("quarterSelect"),
  vmixModal:      document.getElementById("vmixModal"),
};

// ──── Core logic ─────────────────────────────────
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return;
  try {
    const loaded = JSON.parse(data);
    Object.assign(state, loaded);
    // safety checks
    if (!state.quarters || state.quarters.length !== 4) {
      state.quarters = [{...state.quarters[0]},{...state.quarters[0]},{...state.quarters[0]},{...state.quarters[0]}];
    }
  } catch {}
}

function getQ() {
  return state.quarters[state.currentQuarter - 1];
}

function totalHome()  { return state.quarters.reduce((s,q)=>s+q.homeScore,0); }
function totalAway()  { return state.quarters.reduce((s,q)=>s+q.awayScore,0); }

function pad(n) { return n<10 ? "0"+n : n; }
function formatTimer(s) {
  const m = Math.floor(s/60);
  const sec = s%60;
  return `${m}:${pad(sec)}`;
}

function updateAllDisplays() {
  const q = getQ();

  // Preview scoreboard
  els.homeNamePrev.textContent   = state.homeName;
  els.awayNamePrev.textContent   = state.awayName;
  els.homeScorePrev.textContent  = totalHome();
  els.awayScorePrev.textContent  = totalAway();
  els.quarterPrev.textContent    = ["1ST","2ND","3RD","4TH"][state.currentQuarter-1];
  els.possessionPrev.textContent = (state.possession === "home" ? "HOME" : "AWAY") + " POSSESSION";
  els.gameTimerPrev.textContent  = formatTimer(state.gameTime);
  els.shotClockPrev.textContent  = state.shotTime;
  els.homeTOPrev.textContent     = q.homeTO;
  els.awayTOPrev.textContent     = q.awayTO;
  els.homeFoulsPrev.textContent  = q.homeFouls;
  els.awayFoulsPrev.textContent  = q.awayFouls;

  // Control cards
  els.homeNameCtrl.textContent   = state.homeName;
  els.awayNameCtrl.textContent   = state.awayName;
  els.homeScoreCtrl.textContent  = totalHome();
  els.awayScoreCtrl.textContent  = totalAway();
  els.gameTimerCtrl.textContent  = formatTimer(state.gameTime);
  els.shotClockCtrl.textContent  = state.shotTime;

  // vMix (only when connected and changed)
  if (state.vmix.connected) {
    syncVmixLight();
  }
}

function syncVmixLight() {
  const now = Date.now();
  if (now - lastVmixSync < 900) return; // max ~1 Hz
  lastVmixSync = now;

  const base = `http://${state.vmix.ip}:${state.vmix.port}/api/?`;
  const input = `Input=${encodeURIComponent(state.vmix.input)}`;

  const data = [
    ["MATCH CLOCK.Text",      formatTimer(state.gameTime)],
    ["SHOT CLOCK.Text",       state.shotTime.toString()],
  ];

  data.forEach(([name, val]) => {
    fetch(base + `Function=SetText&${input}&SelectedName=${encodeURIComponent(name)}&Value=${encodeURIComponent(val)}`)
      .catch(()=>{});
  });
}

function syncVmixFull() {
  if (!state.vmix.connected) return;

  const q = getQ();
  const base = `http://${state.vmix.ip}:${state.vmix.port}/api/?`;
  const input = `Input=${encodeURIComponent(state.vmix.input)}`;

  const texts = [
    ["TEAM A NAME.Text",      state.homeName],
    ["TEAM B NAME.Text",      state.awayName],
    ["MATCH CLOCK.Text",      formatTimer(state.gameTime)],
    ["QUARTER NAME.Text",     ["1ST","2ND","3RD","4TH"][state.currentQuarter-1]],
    ["SHOT CLOCK.Text",       state.shotTime.toString()],
    ["TEAM A SCORE.Text",     totalHome().toString()],
    ["TEAM B SCORE.Text",     totalAway().toString()],
    ["TEAM A TIME OUT.Text",  `T:${q.homeTO}`],
    ["TEAM A FOULS.Text",     `F:${q.homeFouls}`],
    ["TEAM B TIME OUT.Text",  `T:${q.awayTO}`],
    ["TEAM B FOULS.Text",     `F:${q.awayFouls}`],
  ];

  texts.forEach(([k,v])=>{
    fetch(base + `Function=SetText&${input}&SelectedName=${encodeURIComponent(k)}&Value=${encodeURIComponent(v)}`)
      .catch(e=>console.warn("vMix set text failed",e));
  });

  // You can add image calls here if needed
}

// ──── Timers ─────────────────────────────────────
function startGameTimer() {
  if (state.gameRunning) return;
  state.gameRunning = true;
  gameTimerId = setInterval(() => {
    if (state.gameTime <= 0) {
      clearInterval(gameTimerId);
      state.gameRunning = false;
      updateAllDisplays();
      // buzzer sound if you want
      return;
    }
    state.gameTime--;
    updateAllDisplays();
  }, 980); // slightly less than 1000 to compensate for drift
}

function pauseGameTimer() {
  clearInterval(gameTimerId);
  state.gameRunning = false;
  updateAllDisplays();
}

function resetGameTimer() {
  pauseGameTimer();
  state.gameTime = 600;
  updateAllDisplays();
}

// ──── Shot clock ─────────────────────────────────
function startShot(val = 24) {
  if (state.shotRunning) clearInterval(shotTimerId);
  state.shotTime = val;
  state.shotRunning = true;
  updateAllDisplays();

  shotTimerId = setInterval(() => {
    if (state.shotTime <= 0) {
      clearInterval(shotTimerId);
      state.shotRunning = false;
      updateAllDisplays();
      return;
    }
    state.shotTime--;
    updateAllDisplays();
  }, 980);
}

function resetShot() {
  clearInterval(shotTimerId);
  state.shotRunning = false;
  state.shotTime = 24;
  updateAllDisplays();
}

// ──── Editable fields ─────────────────────────────
function makeEditable(el, getValue, setValue, isNumber = false) {
  el.addEventListener("click", () => {
    const old = el.innerText;
    const input = document.createElement("input");
    input.type = isNumber ? "number" : "text";
    input.value = getValue();
    input.className = "bg-transparent text-center w-full outline-none border-b-2 border-blue-500 text-inherit font-inherit";
    el.innerHTML = "";
    el.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      let v = input.value.trim();
      if (isNumber) {
        v = parseInt(v,10) || 0;
      }
      setValue(v);
      updateAllDisplays();
      saveState();
    };

    input.onblur = commit;
    input.onkeydown = e => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") {
        el.innerText = old;
      }
    };
  });
}

// ──── Init ───────────────────────────────────────
function init() {
  loadState();

  // Quarter change
  els.quarterSelect.value = state.currentQuarter;
  els.quarterSelect.addEventListener("change", e => {
    state.currentQuarter = parseInt(e.target.value);
    updateAllDisplays();
    saveState();
  });

  // Possession switch
  document.getElementById("switchPosBtn").onclick = () => {
    state.possession = state.possession === "home" ? "away" : "home";
    updateAllDisplays();
    saveState();
  };

  // Save / Reset
  document.getElementById("saveBtn").onclick = () => {
    syncVmixFull();
    saveState();
    // alert("State saved & vMix synchronized");
  };

  document.getElementById("resetBtn").onclick = () => {
    if (!confirm("Reset ALL data to defaults?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };

  // Timer controls
  document.getElementById("startGame").onclick = startGameTimer;
  document.getElementById("pauseGame").onclick = pauseGameTimer;
  document.getElementById("resetGame").onclick = resetGameTimer;

  document.querySelectorAll("[data-timer-adjust]").forEach(btn => {
    btn.onclick = () => {
      const v = parseInt(btn.dataset.timerAdjust);
      state.gameTime = Math.max(0, Math.min(3600, state.gameTime + v));
      updateAllDisplays();
      saveState();
    };
  });

  // Shot clock
  document.getElementById("shot24").onclick   = () => startShot(24);
  document.getElementById("shot14").onclick   = () => startShot(14);
  document.getElementById("resetShot").onclick = resetShot;

  document.querySelectorAll("[data-shot-adjust]").forEach(btn => {
    btn.onclick = () => {
      const v = parseInt(btn.dataset.shotAdjust);
      state.shotTime = Math.max(0, Math.min(30, state.shotTime + v));
      updateAllDisplays();
      saveState();
    };
  });

  // Scoring & fouls & TO
  document.querySelectorAll("[data-home-score]").forEach(b => {
    b.onclick = () => {
      const v = parseInt(b.dataset.homeScore);
      getQ().homeScore = Math.max(0, getQ().homeScore + v);
      updateAllDisplays();
      saveState();
    };
  });

  document.querySelectorAll("[data-away-score]").forEach(b => {
    b.onclick = () => {
      const v = parseInt(b.dataset.awayScore);
      getQ().awayScore = Math.max(0, getQ().awayScore + v);
      updateAllDisplays();
      saveState();
    };
  });

  document.querySelectorAll("[data-home-to]").forEach(b => {
    b.onclick = () => {
      const v = parseInt(b.dataset.homeTo);
      getQ().homeTO = Math.max(0, Math.min(20, getQ().homeTO + v));
      updateAllDisplays();
      saveState();
    };
  });

  document.querySelectorAll("[data-away-to]").forEach(b => {
    b.onclick = () => {
      const v = parseInt(b.dataset.awayTo);
      getQ().awayTO = Math.max(0, Math.min(20, getQ().awayTO + v));
      updateAllDisplays();
      saveState();
    };
  });

  document.querySelectorAll("[data-home-foul]").forEach(b => {
    b.onclick = () => {
      const v = parseInt(b.dataset.homeFoul);
      getQ().homeFouls = Math.max(0, getQ().homeFouls + v);
      updateAllDisplays();
      saveState();
    };
  });

  document.querySelectorAll("[data-away-foul]").forEach(b => {
    b.onclick = () => {
      const v = parseInt(b.dataset.awayFoul);
      getQ().awayFouls = Math.max(0, getQ().awayFouls + v);
      updateAllDisplays();
      saveState();
    };
  });

  // Editable fields
  makeEditable(els.homeNameCtrl,   () => state.homeName,   v => state.homeName = v);
  makeEditable(els.awayNameCtrl,   () => state.awayName,   v => state.awayName = v);
  makeEditable(els.homeScoreCtrl,  totalHome,              v => getQ().homeScore = Math.max(0,v), true);
  makeEditable(els.awayScoreCtrl,  totalAway,              v => getQ().awayScore = Math.max(0,v), true);
  makeEditable(els.gameTimerCtrl,  () => state.gameTime,   v => state.gameTime = Math.max(0,Math.min(3600,v)), true);
  makeEditable(els.shotClockCtrl,  () => state.shotTime,   v => state.shotTime = Math.max(0,Math.min(30,v)),   true);

  // vMix modal
  document.getElementById("vmixBtn").onclick = () => {
    els.vmixModal.classList.remove("hidden");
  };
  document.getElementById("vmixClose").onclick = () => {
    els.vmixModal.classList.add("hidden");
  };
  document.getElementById("vmixForm").onsubmit = e => {
    e.preventDefault();
    state.vmix.ip   = document.getElementById("vmixIP").value.trim();
    state.vmix.port = parseInt(document.getElementById("vmixPort").value) || 8088;
    state.vmix.input = document.getElementById("vmixInput").value.trim();
    state.vmix.connected = true;
    els.vmixModal.classList.add("hidden");
    document.getElementById("vmixStatus").textContent = "Connected ✓";
    syncVmixFull();
    saveState();
  };

  // Prevent accidental close/reload
  window.addEventListener("beforeunload", e => {
    if (state.gameRunning || state.shotRunning) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // First render
  updateAllDisplays();

  // Resume timers if were running
  if (state.gameRunning) startGameTimer();
  if (state.shotRunning) startShot(state.shotTime);
}

document.addEventListener("DOMContentLoaded", init);
