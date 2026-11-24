"use strict";

/* ---------- Data (no backend: faculty is static, bookings go to localStorage) ---------- */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const STORE_KEY = "fass_bookings_v1";

const FACULTY = [
  { id: 1, name: "Atul Garg", dept: "Computer Science", cabin: "Block 34, Seating 34-204-CH12", subjects: ["CSE326 Internet Programming"],
    hours: { 0: [["10:00", "11:00"]], 2: [["14:00", "15:00"]], 4: [["11:00", "12:00"]] } },
  { id: 2, name: "Kumar Saurabh", dept: "Computer Science", cabin: "Block 34, Seating 34-202-CH8", subjects: ["CSE111 Orientation to Computing"],
    hours: { 1: [["09:30", "10:30"]], 3: [["13:00", "14:00"]] } },
  { id: 3, name: "Dr. Vijay Kumar Garg", dept: "Computer Science", cabin: "Block 36, Seating 36-307-C1", subjects: ["INT108 Python Programming"],
    hours: { 0: [["12:00", "13:00"]], 2: [["10:00", "11:00"]], 3: [["15:00", "16:00"]] } },
  { id: 4, name: "Peram Surendher Reddy", dept: "Computer Science", cabin: "Block 36, Seating 36-307-CH18", subjects: ["INT108 Python Programming"],
    hours: { 1: [["11:00", "12:00"]], 4: [["14:00", "15:00"]] } },
  { id: 5, name: "Gagandeep Kaur", dept: "Innovation & Design", cabin: "Block 34, Seating 34-204-CH5", subjects: ["INT335 Design Thinking"],
    hours: { 0: [["15:00", "16:00"]], 2: [["11:00", "12:00"]], 4: [["10:00", "11:00"]] } },
  { id: 6, name: "Dr. Ravi Kumar", dept: "Mechanical Engineering", cabin: "Block 29, Seating 29-306-C8", subjects: ["MEC136 Engineering Drawing with AutoCAD"],
    hours: { 1: [["14:00", "15:00"]], 3: [["10:00", "11:00"]] } },
  { id: 7, name: "Dr. Vinod Kumar", dept: "Mathematics", cabin: "Block 38, Seating 38-301-CH14", subjects: ["MTH165 Mathematics for Engineers"],
    hours: { 0: [["09:00", "10:00"]], 3: [["16:00", "17:00"]], 4: [["15:00", "16:00"]] } }
];

/* ---------- State ---------- */
let bookings = load();
let selectedId = FACULTY[0].id;
let weekOffset = 0;
let pendingSlot = null;   // {date, time} while the booking form is open
let slipId = null;        // booking shown in the slip dialog

const $ = (id) => document.getElementById(id);

/* ---------- Helpers ---------- */
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(bookings)); } catch { /* storage blocked */ }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const pad = (n) => String(n).padStart(2, "0");
const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
function label12(t) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}
function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function dateFor(dayIdx) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekOffset * 7 + dayIdx);
  return d;
}
const prettyDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
const faculty = (id) => FACULTY.find((f) => f.id === id);
const isPast = (iso, time) => new Date(`${iso}T${time}:00`) < new Date();

/* Demo data: some slots look taken by other students (stable, derived from the slot key). */
function seededBooked(fid, iso, time) {
  const key = `${fid}|${iso}|${time}`;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 5 === 0;
}
const findBooking = (fid, iso, time) => bookings.find((b) => b.facultyId === fid && b.date === iso && b.time === time);

function slotTimes(f, dayIdx) {
  const out = [];
  (f.hours[dayIdx] || []).forEach(([s, e]) => {
    for (let m = toMin(s); m < toMin(e); m += 15) out.push(fromMin(m));
  });
  return out;
}

let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- Directory ---------- */
function initFilters() {
  const depts = ["All departments", ...new Set(FACULTY.map((f) => f.dept))];
  $("dept").innerHTML = depts.map((d, i) => `<option value="${i ? esc(d) : ""}">${esc(d)}</option>`).join("");
}
function renderDirectory() {
  const q = $("search").value.trim().toLowerCase();
  const dept = $("dept").value;
  const list = FACULTY.filter((f) =>
    (!dept || f.dept === dept) &&
    (!q || f.name.toLowerCase().includes(q) || f.subjects.some((s) => s.toLowerCase().includes(q))));
  $("facultyList").innerHTML = list.length
    ? list.map((f) => `
      <button class="fcard" data-id="${f.id}" aria-pressed="${f.id === selectedId}">
        <strong>${esc(f.name)}</strong>
        <span class="meta">${esc(f.dept)} &middot; ${esc(f.cabin)}</span>
        <span class="tags">${f.subjects.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</span>
      </button>`).join("")
    : `<p class="empty">No faculty match. Clear the search or choose another department.</p>`;
}

/* ---------- Weekly grid ---------- */
function renderGrid() {
  const f = faculty(selectedId);
  $("selectedInfo").textContent = `${f.name}, ${f.cabin}`;
  const mon = dateFor(0), fri = dateFor(4);
  const fmt = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  $("weekLabel").textContent = `${fmt(mon)} to ${fmt(fri)}`;
  $("prevWeek").disabled = weekOffset === 0;
  $("nextWeek").disabled = weekOffset === 3;

  const allTimes = [...new Set(DAYS.flatMap((_, i) => slotTimes(f, i)))].sort();
  const head = DAYS.map((d, i) => `<th scope="col">${d}<small>${fmt(dateFor(i))}</small></th>`).join("");
  const rows = allTimes.map((t) => {
    const cells = DAYS.map((_, i) => {
      if (!slotTimes(f, i).includes(t)) return `<td class="off">-</td>`;
      const iso = isoDate(dateFor(i));
      const mine = findBooking(f.id, iso, t);
      let cls = "open", txt = "Open", dis = "";
      if (mine) { cls = "mine"; txt = "Yours"; }
      else if (seededBooked(f.id, iso, t) || isPast(iso, t)) {
        cls = isPast(iso, t) ? "past" : "booked";
        txt = isPast(iso, t) ? "Past" : "Booked";
        dis = "disabled";
      }
      return `<td><button class="slot ${cls}" ${dis} data-date="${iso}" data-time="${t}" aria-label="${DAYS[i]} ${label12(t)} ${txt}">${txt}</button></td>`;
    }).join("");
    return `<tr><th scope="row">${label12(t)}</th>${cells}</tr>`;
  }).join("");
  $("gridWrap").innerHTML = `<table><thead><tr><th scope="col">Time</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

/* ---------- Booking flow ---------- */
function openBooking(date, time) {
  pendingSlot = { date, time };
  const f = faculty(selectedId);
  $("bookSummary").textContent = `${f.name} on ${prettyDate(date)}, ${label12(time)} to ${label12(fromMin(toMin(time) + 15))}`;
  $("bookForm").reset();
  $("formError").textContent = "";
  $("bookDialog").showModal();
  $("fName").focus();
}
function submitBooking(e) {
  e.preventDefault();
  const name = $("fName").value.trim();
  const roll = $("fRoll").value.trim();
  const subject = $("fSubject").value.trim().toUpperCase();
  const topic = $("fTopic").value.trim();
  const err = $("formError");

  if (name.length < 2) return (err.textContent = "Enter your full name.");
  if (!/^\d{8}$/.test(roll)) return (err.textContent = "Roll number must be exactly 8 digits.");
  if (!/^[A-Z]{3}\d{3}$/.test(subject)) return (err.textContent = "Subject code looks like CSE326 (3 letters, 3 digits).");
  if (topic.length < 5) return (err.textContent = "Describe the discussion topic in at least 5 characters.");

  const { date, time } = pendingSlot;
  if (findBooking(selectedId, date, time) || seededBooked(selectedId, date, time))
    return (err.textContent = "This slot was just taken. Close this form and pick another.");
  if (bookings.some((b) => b.roll === roll && b.date === date && b.time === time))
    return (err.textContent = "You already have an appointment at this time with another faculty member.");

  const booking = {
    id: "APT-" + Date.now().toString(36).toUpperCase(),
    facultyId: selectedId, date, time, name, roll, subject, topic
  };
  bookings.push(booking);
  save();
  $("bookDialog").close();
  render();
  showSlip(booking.id);
  toast("Appointment confirmed");
}

/* ---------- Slip + my appointments ---------- */
function showSlip(id) {
  const b = bookings.find((x) => x.id === id);
  if (!b) return;
  const f = faculty(b.facultyId);
  slipId = id;
  $("slip").innerHTML = `
    <h3>Appointment confirmation</h3>
    <p class="muted">Show this slip at the faculty cabin.</p>
    <dl>
      <dt>Reference</dt><dd>${esc(b.id)}</dd>
      <dt>Faculty</dt><dd>${esc(f.name)}</dd>
      <dt>Location</dt><dd>${esc(f.cabin)}</dd>
      <dt>Date</dt><dd>${esc(prettyDate(b.date))}</dd>
      <dt>Time</dt><dd>${label12(b.time)} to ${label12(fromMin(toMin(b.time) + 15))}</dd>
      <dt>Student</dt><dd>${esc(b.name)} (${esc(b.roll)})</dd>
      <dt>Subject</dt><dd>${esc(b.subject)}</dd>
      <dt>Topic</dt><dd>${esc(b.topic)}</dd>
    </dl>`;
  $("slipDialog").showModal();
}
function cancelBooking(id) {
  if (!confirm("Cancel this appointment? The slot will become open again.")) return;
  bookings = bookings.filter((b) => b.id !== id);
  save();
  if ($("slipDialog").open) $("slipDialog").close();
  render();
  toast("Appointment cancelled");
}
function renderMine() {
  const list = [...bookings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  $("myList").innerHTML = list.length
    ? list.map((b) => `
      <div class="appt">
        <div><strong>${esc(faculty(b.facultyId).name)}</strong><br>
          <span class="muted">${esc(prettyDate(b.date))}, ${label12(b.time)} &middot; ${esc(b.subject)} &middot; ${esc(b.id)}</span></div>
        <div class="btns">
          <button class="btn ghost" data-view="${esc(b.id)}">View slip</button>
          <button class="btn danger" data-cancel="${esc(b.id)}">Cancel</button>
        </div>
      </div>`).join("")
    : `<p class="empty">No appointments yet. Pick an open slot in the weekly grid to book one.</p>`;
}

function render() { renderDirectory(); renderGrid(); renderMine(); }

/* ---------- Events ---------- */
$("search").addEventListener("input", renderDirectory);
$("dept").addEventListener("change", renderDirectory);
$("facultyList").addEventListener("click", (e) => {
  const card = e.target.closest(".fcard");
  if (!card) return;
  selectedId = Number(card.dataset.id);
  render();
});
$("gridWrap").addEventListener("click", (e) => {
  const b = e.target.closest(".slot");
  if (!b || b.disabled) return;
  if (b.classList.contains("mine")) return showSlip(findBooking(selectedId, b.dataset.date, b.dataset.time).id);
  openBooking(b.dataset.date, b.dataset.time);
});
$("prevWeek").addEventListener("click", () => { if (weekOffset > 0) { weekOffset--; renderGrid(); } });
$("nextWeek").addEventListener("click", () => { if (weekOffset < 3) { weekOffset++; renderGrid(); } });
$("bookForm").addEventListener("submit", submitBooking);
$("cancelBook").addEventListener("click", () => $("bookDialog").close());
$("slipClose").addEventListener("click", () => $("slipDialog").close());
$("slipPrint").addEventListener("click", () => window.print());
$("slipCancel").addEventListener("click", () => cancelBooking(slipId));
$("myList").addEventListener("click", (e) => {
  const v = e.target.closest("[data-view]"), c = e.target.closest("[data-cancel]");
  if (v) showSlip(v.dataset.view);
  if (c) cancelBooking(c.dataset.cancel);
});

initFilters();
render();
