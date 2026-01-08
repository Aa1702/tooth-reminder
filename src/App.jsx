import React, { useEffect, useMemo, useState } from "react";

// ✅ Sprites
import toofiNormal from "./assets/toofi_normal.png";
import toofiProud from "./assets/toofi_proud.png";
import toofiOuch from "./assets/toofi_ouch.png";

const LS_KEY = "tooth_time_pixel_v4";

const pad2 = (n) => String(n).padStart(2, "0");
const nowHHMM = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);

const minutesBetween = (fromHHMM, toHHMM) => {
  const [fh, fm] = fromHHMM.split(":").map(Number);
  const [th, tm] = toHHMM.split(":").map(Number);
  const a = fh * 60 + fm;
  const b = th * 60 + tm;
  let diff = b - a;
  if (diff < 0) diff += 1440;
  return diff;
};

const addMinutes = (hhmm, add) => {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m + add;
  total = ((total % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
};

const prettyIn = (mins) => {
  if (mins === 0) return "NOW!";
  if (mins < 60) return `${mins} MIN`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}H ${m}M` : `${h}H`;
};

function safeNotify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {}
}

const defaultPlan = {
  friendName: "Aishuu ♥️♥️",
  characterName: "Toofi",
  paracetamol: { enabled: true, everyHours: 6, start: "08:00", lastTaken: null },
  ibuprofen: { enabled: true, everyHours: 8, start: "09:00", lastTaken: null },
  rinse: { enabled: true, times: ["10:30", "15:30", "21:30"], done: {} },
  corsodyl: { enabled: true, times: ["09:30", "21:00"], done: {} },
  streak: 0,
  lastStreakDate: null,
  lastNotifiedAtMinute: null,
  introSeen: false,
  darkMode: false // Persist dark mode preference
};

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function PixelWindow({ title, icon = "★", right, children, className = "" }) {
  return (
    <section className={`pxWin ${className}`}>
      <div className="pxBar">
        <div className="pxBarLeft">
          <span className="pxIcon">{icon}</span>
          <span className="pxTitle">{title}</span>
        </div>
        <div className="pxBarRight">{right}</div>
      </div>
      <div className="pxBody">{children}</div>
    </section>
  );
}

export default function App() {
  const [clock, setClock] = useState(nowHHMM());
  const [toast, setToast] = useState("");
  const [plan, setPlan] = useState(() => loadState() ?? defaultPlan);
  const [introStep, setIntroStep] = useState(() => (plan.introSeen ? 0 : 1));

  // ✅ Night Mode Logic
  useEffect(() => {
    if (plan.darkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [plan.darkMode]);

  useEffect(() => {
    const id = setInterval(() => setClock(nowHHMM()), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(plan));
  }, [plan]);

  const notifStatus = useMemo(() => {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  }, [clock]);

  function toggleDarkMode() {
    setPlan(p => ({ ...p, darkMode: !p.darkMode }));
  }

  function requestNotifications() {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then(() => {
      setToast("NOTIFS: OK ✅");
      setTimeout(() => setToast(""), 1200);
    });
  }

  function bumpStreak() {
    const today = todayISO();
    setPlan((p) => {
      if (p.lastStreakDate === today) return p;
      return { ...p, streak: (p.streak || 0) + 1, lastStreakDate: today };
    });
  }

  function nextDoseEveryHours(start, everyHours, lastTakenISO) {
    const everyMin = everyHours * 60;

    if (lastTakenISO) {
      const d = new Date(lastTakenISO);
      const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      const next = addMinutes(hhmm, everyMin);
      return { next, mins: minutesBetween(clock, next) };
    }

    let candidate = start;
    let guard = 0;
    while (minutesBetween(clock, candidate) > everyMin && guard < 50) {
      candidate = addMinutes(candidate, everyMin);
      guard++;
    }
    return { next: candidate, mins: minutesBetween(clock, candidate) };
  }

  const schedule = useMemo(() => {
    const items = [];
    const today = todayISO();

    if (plan.paracetamol.enabled) {
      const d = nextDoseEveryHours(
        plan.paracetamol.start,
        plan.paracetamol.everyHours,
        plan.paracetamol.lastTaken
      );
      items.push({
        id: "paracetamol",
        title: "PARACETAMOL",
        subtitle: `EVERY ${plan.paracetamol.everyHours}H`,
        when: d.next,
        mins: d.mins,
        type: "pill"
      });
    }

    if (plan.ibuprofen.enabled) {
      const d = nextDoseEveryHours(
        plan.ibuprofen.start,
        plan.ibuprofen.everyHours,
        plan.ibuprofen.lastTaken
      );
      items.push({
        id: "ibuprofen",
        title: "IBUPROFEN",
        subtitle: `EVERY ${plan.ibuprofen.everyHours}H`,
        when: d.next,
        mins: d.mins,
        type: "pill"
      });
    }

    if (plan.corsodyl.enabled) {
      for (const t of plan.corsodyl.times) {
        const key = `${today}_${t}`;
        const done = !!plan.corsodyl.done?.[key];
        items.push({
          id: `corsodyl_${t}`,
          title: "CORSODYL",
          subtitle: done ? "DONE ✅" : "AM/PM",
          when: t,
          mins: minutesBetween(clock, t),
          type: "timed",
          doneKey: key,
          section: "corsodyl"
        });
      }
    }

    if (plan.rinse.enabled) {
      for (const t of plan.rinse.times) {
        const key = `${today}_${t}`;
        const done = !!plan.rinse.done?.[key];
        items.push({
          id: `rinse_${t}`,
          title: "SALT RINSE",
          subtitle: done ? "DONE ✅" : "3X/DAY",
          when: t,
          mins: minutesBetween(clock, t),
          type: "timed",
          doneKey: key,
          section: "rinse"
        });
      }
    }

    items.sort((a, b) => a.mins - b.mins);
    return items;
  }, [plan, clock]);

  const top = schedule[0];

  const mood = useMemo(() => {
    if (!top) return "chill";
    if (top.mins === 0) return "ouch";
    if (top.mins <= 20) return "proud";
    return "chill";
  }, [top]);

  const toofiByMood = useMemo(
    () => ({ chill: toofiNormal, proud: toofiProud, ouch: toofiOuch }),
    []
  );

  useEffect(() => {
    const due = schedule.find((x) => x.mins === 0);
    if (!due) return;

    const stamp = `${todayISO()}_${clock}`;
    if (plan.lastNotifiedAtMinute === stamp) return;

    safeNotify(`${plan.characterName} 🦷`, `${due.title} TIME! TAP DONE ✅`);
    setPlan((p) => ({ ...p, lastNotifiedAtMinute: stamp }));
  }, [clock, schedule]);

  function badge(mins) {
    if (mins === 0) return "NOW";
    if (mins <= 20) return "SOON";
    return "OK";
  }

  function markTakenPill(id) {
    const ts = new Date().toISOString();
    setPlan((p) => {
      const next = { ...p };
      if (id === "paracetamol") next.paracetamol = { ...p.paracetamol, lastTaken: ts };
      if (id === "ibuprofen") next.ibuprofen = { ...p.ibuprofen, lastTaken: ts };
      return next;
    });
    bumpStreak();
    setToast("DONE ✅");
    setTimeout(() => setToast(""), 900);
  }

  function markDoneTimed(section, doneKey) {
    setPlan((p) => {
      const next = { ...p };
      next[section] = { ...p[section], done: { ...(p[section].done || {}), [doneKey]: true } };
      return next;
    });
    bumpStreak();
    setToast("DONE ✅");
    setTimeout(() => setToast(""), 900);
  }

  function resetAll() {
    localStorage.removeItem(LS_KEY);
    setPlan(defaultPlan);
    setIntroStep(1);
  }

  function closeIntroForever() {
    setPlan((p) => ({ ...p, introSeen: true }));
    setIntroStep(0);
  }

  const introMood = introStep === 1 ? "proud" : "chill";

  return (
    <div className="bg">
      {/* HUD */}
      <header className="hud">
        <div className="hudLeft">
          <div className="logo">TOOTH TIME</div>
          <div className="hudMeta">
            <span className="chip">🕒 {clock}</span>
            <span className="chip">🔥 STREAK {plan.streak}</span>
            <span className="chip">🔔 {notifStatus === 'granted' ? 'ON' : 'OFF'}</span>
          </div>
        </div>
        <div className="hudRight">
          <button className="pxBtn" onClick={toggleDarkMode}>
            {plan.darkMode ? "☀ DAY" : "🌙 NIGHT"}
          </button>
          <button className="pxBtn" onClick={requestNotifications} disabled={notifStatus === "granted"}>
            {notifStatus === "granted" ? "NOTIFS OK" : "ENABLE NOTIFS"}
          </button>
          <button className="pxBtn ghost" onClick={resetAll}>
            RESET
          </button>
        </div>
      </header>

      {/* INTRO MODAL */}
      {introStep !== 0 && (
        <div className="backdrop">
          <PixelWindow
            title={introStep === 1 ? "TOOFI CHECK-IN" : "TODAY'S QUESTS"}
            icon="♥"
            className="modalWin"
            right={<span className="miniHint">TAP BUTTONS</span>}
          >
            <div className="introGrid">
              <div className="charScreen">
                <div className="charFrame">
                  <img src={toofiByMood[introMood] || toofiNormal} alt="Toofi" className="sprite" />
                </div>
                <div className="charName">{plan.characterName}</div>
              </div>

              <div>
                {introStep === 1 ? (
                  <>
                    <div className="dialog">
                      <div className="dialogName">{plan.characterName}</div>
                      <div className="dialogText">
                        Heyyy <b>{plan.friendName}</b> 💗<br />
                        I’m here to guard your tooth era 🦷✨<br />
                        We keep pain away like a pro, okay? 🌸<br />
                        Ready to start?
                      </div>
                    </div>

                    <div className="btnRow">
                      <button className="pxBtn" onClick={() => setIntroStep(2)}>OKAY</button>
                      <button className="pxBtn ghost" onClick={closeIntroForever}>SKIP</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="dialog">
                      <div className="dialogName">{plan.characterName}</div>
                      <div className="dialogText">
                        Today’s quest list. Tap DONE ✅
                      </div>
                    </div>

                    <div className="questList">
                      <div className="quest">💊 Paracetamol (as set)</div>
                      <div className="quest">💊 Ibuprofen (as set)</div>
                      <div className="quest">🧂 Warm salt rinse (3x)</div>
                      <div className="quest">🧴 Corsodyl (AM + PM)</div>
                      <div className="quest warn">🚨 Fever / swelling / pus = urgent dentist</div>
                    </div>

                    <div className="btnRow">
                      <button className="pxBtn" onClick={closeIntroForever}>LET’S GO</button>
                      <button className="pxBtn ghost" onClick={() => setIntroStep(1)}>BACK</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </PixelWindow>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <main className="layout">
        {/* LEFT: Character + chat */}
        <PixelWindow
          title="TOOFI SCREEN"
          icon="☺"
          right={toast ? <span className="chip small">✨ {toast}</span> : null}
        >
          <div className="leftGrid">
            <div className="charScreen big">
              <div className="charFrame big">
                <img src={toofiByMood[mood] || toofiNormal} alt="Toofi" className="sprite big" />
              </div>
              <div className="charName">{plan.characterName}</div>
            </div>

            <div>
              <div className="fieldRow">
                <div className="field">
                  <div className="label">FRIEND NAME</div>
                  <input
                    className="pxInput"
                    value={plan.friendName}
                    onChange={(e) => setPlan((p) => ({ ...p, friendName: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <div className="label">MASCOT NAME</div>
                  <input
                    className="pxInput"
                    value={plan.characterName}
                    onChange={(e) => setPlan((p) => ({ ...p, characterName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="dialog">
                <div className="dialogName">{plan.characterName}</div>
                <div className="dialogText">
                  {top ? (
                    <>
                      Next: <b>{top.title}</b> at <b>{top.when}</b>
                      <span className="tag">{prettyIn(top.mins)}</span>
                    </>
                  ) : (
                    <>All caught up ✅</>
                  )}
                  <div className="tiny">
                    Reminders only. If swelling/fever/pus or trouble opening mouth: urgent dentist.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PixelWindow>

        {/* RIGHT: Schedule controls */}
        <PixelWindow title="SCHEDULE SETTINGS" icon="⚙" right={<span className="miniHint">EDIT TIMES</span>}>
          <div className="settingsGrid">
            <div className="setting">
              <div className="label">Paracetamol every (h)</div>
              <input
                className="pxInput"
                type="number"
                min="4"
                max="8"
                value={plan.paracetamol.everyHours}
                onChange={(e) =>
                  setPlan((p) => ({
                    ...p,
                    paracetamol: { ...p.paracetamol, everyHours: Number(e.target.value || 6) }
                  }))
                }
              />
            </div>
            <div className="setting">
              <div className="label">Start</div>
              <input
                className="pxInput"
                type="time"
                value={plan.paracetamol.start}
                onChange={(e) =>
                  setPlan((p) => ({ ...p, paracetamol: { ...p.paracetamol, start: e.target.value } }))
                }
              />
            </div>

            <div className="setting">
              <div className="label">Ibuprofen every (h)</div>
              <input
                className="pxInput"
                type="number"
                min="6"
                max="12"
                value={plan.ibuprofen.everyHours}
                onChange={(e) =>
                  setPlan((p) => ({
                    ...p,
                    ibuprofen: { ...p.ibuprofen, everyHours: Number(e.target.value || 8) }
                  }))
                }
              />
            </div>
            <div className="setting">
              <div className="label">Start</div>
              <input
                className="pxInput"
                type="time"
                value={plan.ibuprofen.start}
                onChange={(e) =>
                  setPlan((p) => ({ ...p, ibuprofen: { ...p.ibuprofen, start: e.target.value } }))
                }
              />
            </div>

            <div className="setting">
              <div className="label">Salt rinse 1</div>
              <input
                className="pxInput"
                type="time"
                value={plan.rinse.times[0]}
                onChange={(e) =>
                  setPlan((p) => {
                    const times = [...p.rinse.times];
                    times[0] = e.target.value;
                    return { ...p, rinse: { ...p.rinse, times } };
                  })
                }
              />
            </div>
            <div className="setting">
              <div className="label">Salt rinse 2</div>
              <input
                className="pxInput"
                type="time"
                value={plan.rinse.times[1]}
                onChange={(e) =>
                  setPlan((p) => {
                    const times = [...p.rinse.times];
                    times[1] = e.target.value;
                    return { ...p, rinse: { ...p.rinse, times } };
                  })
                }
              />
            </div>

            <div className="setting">
              <div className="label">Salt rinse 3</div>
              <input
                className="pxInput"
                type="time"
                value={plan.rinse.times[2]}
                onChange={(e) =>
                  setPlan((p) => {
                    const times = [...p.rinse.times];
                    times[2] = e.target.value;
                    return { ...p, rinse: { ...p.rinse, times } };
                  })
                }
              />
            </div>

            <div className="setting">
              <div className="label">Corsodyl AM / PM</div>
              <div className="two">
                <input
                  className="pxInput"
                  type="time"
                  value={plan.corsodyl.times[0]}
                  onChange={(e) =>
                    setPlan((p) => {
                      const times = [...p.corsodyl.times];
                      times[0] = e.target.value;
                      return { ...p, corsodyl: { ...p.corsodyl, times } };
                    })
                  }
                />
                <input
                  className="pxInput"
                  type="time"
                  value={plan.corsodyl.times[1]}
                  onChange={(e) =>
                    setPlan((p) => {
                      const times = [...p.corsodyl.times];
                      times[1] = e.target.value;
                      return { ...p, corsodyl: { ...p.corsodyl, times } };
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="tiny" style={{ marginTop: 10 }}>
            iPhone tip: best as “Add to Home Screen” (PWA). Notifications depend on browser settings.
          </div>
        </PixelWindow>

        {/* Bottom: Quest log */}
        <PixelWindow title="QUEST LOG: NEXT UP" icon="➤" className="span2">
          <div className="questLog">
            {schedule.slice(0, 10).map((it) => {
              const done = it.type === "timed" && it.section && plan[it.section]?.done?.[it.doneKey];
              return (
                <div className={`questRow ${badge(it.mins).toLowerCase()}`} key={it.id}>
                  <div className="qLeft">
                    <div className="qTitle">{it.title}</div>
                    <div className="qMeta">
                      {it.subtitle} • {it.when} •{" "}
                      <span className="tag">{badge(it.mins)} {prettyIn(it.mins)}</span>
                    </div>
                  </div>

                  {it.type === "pill" ? (
                    <button className="pxBtn" onClick={() => markTakenPill(it.id)}>TAKEN</button>
                  ) : (
                    <button
                      className={`pxBtn ${done ? "ghost" : ""}`}
                      onClick={() => markDoneTimed(it.section, it.doneKey)}
                      disabled={!!done}
                    >
                      {done ? "DONE" : "DONE ✅"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="tiny" style={{ marginTop: 8 }}>
            This app is reminders only. If symptoms worsen, get urgent dental help.
          </div>
        </PixelWindow>
      </main>
    </div>
  );
}