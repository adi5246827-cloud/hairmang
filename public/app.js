// =====================================================================
// SalonOS booking form — talks to the public `book-appointment` Edge Function.
// Flow: pick service + stylist + date -> load real free slots -> book.
// No keys in the browser; the function writes via service-role server-side.
// =====================================================================
const API = "https://hdzmqoslaghgvydykixf.supabase.co/functions/v1/book-appointment";

const form = document.getElementById("bookingForm");
const serviceSelect = document.getElementById("service_id");
const staffSelect = document.getElementById("staff_id");
const dateInput = document.getElementById("date");
const slotsBox = document.getElementById("slots");
const desiredTime = document.getElementById("desired_time");
const submitBtn = document.getElementById("submitBtn");
const toast = document.getElementById("toast");
const successEl = document.getElementById("success");
const summaryEl = document.getElementById("summary");
const againBtn = document.getElementById("againBtn");

// limit date picker to today..+60 days
(function setupDate() {
  const today = new Date();
  const max = new Date(); max.setDate(max.getDate() + 60);
  dateInput.min = today.toISOString().slice(0, 10);
  dateInput.max = max.toISOString().slice(0, 10);
})();

const showToast = (msg, kind) => { toast.textContent = msg; toast.className = "toast show " + kind; };
const clearToast = () => { toast.className = "toast"; };

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
const fmtFull = (iso) =>
  new Date(iso).toLocaleString("he-IL", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });

// ---- load services + staff ----
async function loadMeta() {
  try {
    const res = await fetch(API);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "load failed");

    serviceSelect.innerHTML = '<option value="" disabled selected>בחרו טיפול…</option>';
    for (const s of data.services) {
      const opt = document.createElement("option");
      opt.value = s.id;
      const price = s.base_price ? ` · ₪${s.base_price}` : "";
      opt.textContent = `${s.name} (${s.duration_minutes} דק׳${price})`;
      serviceSelect.appendChild(opt);
    }
    for (const st of data.staff) {
      const opt = document.createElement("option");
      opt.value = st.id;
      opt.textContent = st.full_name;
      staffSelect.appendChild(opt);
    }
  } catch (err) {
    console.error(err);
    serviceSelect.innerHTML = '<option value="" disabled selected>שגיאה בטעינה</option>';
  }
}

// ---- load available slots ----
let slotsToken = 0;
async function loadSlots() {
  desiredTime.value = "";
  clearToast();
  if (!serviceSelect.value || !dateInput.value) {
    slotsBox.innerHTML = '<p class="slots__hint">בחרו טיפול ותאריך כדי לראות שעות פנויות</p>';
    return;
  }
  const myToken = ++slotsToken;
  slotsBox.innerHTML = '<p class="slots__hint">טוען שעות…</p>';

  const params = new URLSearchParams({
    slots: "1", date: dateInput.value, service_id: serviceSelect.value,
  });
  if (staffSelect.value) params.set("staff_id", staffSelect.value);

  try {
    const res = await fetch(`${API}?${params}`);
    const data = await res.json();
    if (myToken !== slotsToken) return; // a newer request superseded this one

    if (!data.slots || data.slots.length === 0) {
      slotsBox.innerHTML = '<p class="slots__hint">אין שעות פנויות בתאריך זה — נסו תאריך אחר</p>';
      return;
    }
    slotsBox.innerHTML = "";
    for (const iso of data.slots) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "slot";
      chip.textContent = fmtTime(iso);
      chip.dataset.iso = iso;
      chip.addEventListener("click", () => {
        slotsBox.querySelectorAll(".slot").forEach((c) => c.classList.remove("selected"));
        chip.classList.add("selected");
        desiredTime.value = iso;
      });
      slotsBox.appendChild(chip);
    }
  } catch (err) {
    console.error(err);
    slotsBox.innerHTML = '<p class="slots__hint">שגיאה בטעינת שעות</p>';
  }
}

serviceSelect.addEventListener("change", loadSlots);
staffSelect.addEventListener("change", loadSlots);
dateInput.addEventListener("change", loadSlots);

// ---- submit ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearToast();

  if (!desiredTime.value) {
    showToast("נא לבחור שעה פנויה", "err");
    return;
  }
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const payload = {
    full_name: form.full_name.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim() || null,
    service_id: serviceSelect.value,
    staff_id: staffSelect.value || null,
    desired_time: desiredTime.value,
  };

  submitBtn.disabled = true;
  submitBtn.classList.add("loading");

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "אירעה שגיאה");

    const priceHtml = data.price != null
      ? (data.base_price && data.base_price !== data.price
          ? `<s style="opacity:.55">₪${data.base_price}</s> ₪${data.price}`
          : `₪${data.price}`)
      : "";
    summaryEl.innerHTML = `
      <div><dt>טיפול</dt><dd>${data.service}</dd></div>
      <div><dt>ספר/ית</dt><dd>${data.stylist || "כל ספר/ית פנוי/ה"}</dd></div>
      <div><dt>מועד</dt><dd>${fmtFull(data.starts_at)}</dd></div>
      ${priceHtml ? `<div><dt>מחיר</dt><dd>${priceHtml}</dd></div>` : ""}`;
    form.hidden = true;
    successEl.hidden = false;
  } catch (err) {
    showToast(err.message, "err");
    if (err.message.includes("נתפסה")) loadSlots(); // refresh slots on conflict
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove("loading");
  }
});

againBtn.addEventListener("click", () => {
  form.reset();
  desiredTime.value = "";
  slotsBox.innerHTML = '<p class="slots__hint">בחרו טיפול ותאריך כדי לראות שעות פנויות</p>';
  successEl.hidden = true;
  form.hidden = false;
});

loadMeta();
