// =====================================================================
// Public review page — talks to the public `submit-review` Edge Function.
// Reads ?r=<reviewId>, lets the client pick 1-5 stars + a comment, and on
// a high rating routes them to the salon's Google review link.
// =====================================================================
const API = "https://hdzmqoslaghgvydykixf.supabase.co/functions/v1/submit-review";

const params = new URLSearchParams(location.search);
const reviewId = params.get("r");

const form = document.getElementById("reviewForm");
const starsBox = document.getElementById("stars");
const rateLabel = document.getElementById("rateLabel");
const submitBtn = document.getElementById("submitBtn");
const toast = document.getElementById("toast");
const thanks = document.getElementById("thanks");
const googleBtn = document.getElementById("googleBtn");

const LABELS = { 1: "לא טוב", 2: "בסדר", 3: "סביר", 4: "טוב מאוד", 5: "מעולה!" };
let rating = 0;

const showToast = (msg, kind) => { toast.textContent = msg; toast.className = "toast show " + kind; };

function paint() {
  starsBox.querySelectorAll("button").forEach((b) =>
    b.classList.toggle("on", Number(b.dataset.v) <= rating));
  rateLabel.textContent = rating ? LABELS[rating] : "";
}
starsBox.querySelectorAll("button").forEach((b) =>
  b.addEventListener("click", () => { rating = Number(b.dataset.v); paint(); }));

// validate the link on load
(async function init() {
  if (!reviewId) { showToast("קישור לא תקין", "err"); form.querySelector(".stars").style.opacity = .4; return; }
  try {
    const res = await fetch(`${API}?r=${encodeURIComponent(reviewId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error();
    if (data.client_name) document.getElementById("subtitle").textContent = `שלום ${data.client_name}, נשמח לשמוע מה דעתך 💜`;
    if (data.already_submitted) {
      form.hidden = true; thanks.hidden = false;
      document.getElementById("thanksSub").textContent = "כבר קיבלנו את הדירוג שלך — תודה!";
    }
  } catch { /* allow submit anyway */ }
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  toast.className = "toast";
  if (!rating) { showToast("בחר/י דירוג בכוכבים", "err"); return; }

  submitBtn.disabled = true; submitBtn.classList.add("loading");
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ r: reviewId, rating, comment: document.getElementById("comment").value.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "שגיאה");

    form.hidden = true; thanks.hidden = false;
    if (data.high && data.google_url) {
      document.getElementById("thanksTitle").textContent = "תודה רבה! 🌟";
      document.getElementById("thanksSub").textContent = "שמחים שנהנית! נשמח אם תשתף/י גם בגוגל:";
      googleBtn.href = data.google_url;
      googleBtn.hidden = false;
    } else {
      document.getElementById("thanksTitle").textContent = "תודה על המשוב 🙏";
      document.getElementById("thanksSub").textContent = "נשתמש בו כדי להשתפר. מעריכים את הזמן שלך!";
    }
  } catch (err) {
    showToast(err.message || "אירעה שגיאה", "err");
    submitBtn.disabled = false; submitBtn.classList.remove("loading");
  }
});
