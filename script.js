/* Paradise Lawn Care Operations Suite v3.18 compatibility loader.
   The complete verified v3.18 application core remains pinned below; this file
   adds the unified preferred-contact interface and Smoke Signal experience. */
document.write('<script src="https://cdn.jsdelivr.net/gh/TomT-GoldCoast/paradise-lawn-care-development@756755a7b4fc31b0b1ba52c80bf2ebc4e2fe59c3/script.js"><\/script>');

(() => {
  "use strict";

  const CONTACTS = [
    { value: "Phone", icon: "☎", label: "Phone" },
    { value: "Text", icon: "▣", label: "Text" },
    { value: "Email", icon: "✉", label: "Email" },
    { value: "Smoke Signal", icon: "♨", label: "Smoke Signal" }
  ];

  const css = `
    .preferred-contact.enhanced-contact-select{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
    .preferred-contact-cards{display:grid;grid-template-columns:repeat(4,minmax(105px,1fr));gap:10px;margin:8px 0 4px;grid-column:1/-1}
    .preferred-contact-card{appearance:none;border:2px solid #b7c7b7;background:#fff;color:#183f24;border-radius:14px;padding:13px 9px;min-height:76px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font:inherit;font-weight:800;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.08);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease}
    .preferred-contact-card:hover{transform:translateY(-2px);border-color:#478f52}
    .preferred-contact-card.is-selected{background:#e9f7eb;border-color:#237432;box-shadow:0 0 0 3px rgba(35,116,50,.14),0 6px 16px rgba(0,0,0,.12);transform:translateY(-2px)}
    .preferred-contact-card .contact-icon{font-size:25px;line-height:1}
    .preferred-contact-card .contact-label{font-size:13px;text-align:center}
    .smoke-signal-overlay{position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .35s ease}
    .smoke-signal-overlay.is-open{opacity:1}
    .smoke-signal-stage{position:relative;width:min(100vw,620px);height:100vh;background:#000;overflow:hidden}
    .smoke-signal-player{position:absolute;inset:0;width:100%;height:100%}
    .smoke-signal-player iframe{width:100%!important;height:100%!important}
    .smoke-close{position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;z-index:5;border:1px solid rgba(255,255,255,.75);background:rgba(0,0,0,.68);color:#fff;border-radius:999px;width:46px;height:46px;font-size:25px;line-height:1;cursor:pointer}
    .smoke-status{position:absolute;left:18px;right:18px;bottom:max(22px,env(safe-area-inset-bottom));z-index:4;color:#fff;text-align:center;font-weight:800;text-shadow:0 2px 8px #000;background:rgba(0,0,0,.55);border-radius:12px;padding:10px}
    .smoke-final{position:absolute;inset:0;z-index:6;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:28px;font-size:clamp(24px,5vw,44px);font-weight:900;line-height:1.25;opacity:0;transition:opacity .65s ease;pointer-events:none}
    .smoke-final.show{opacity:1}
    body.smoke-signal-active{overflow:hidden!important}
    @media(max-width:720px){.preferred-contact-cards{grid-template-columns:repeat(2,minmax(120px,1fr))}.smoke-signal-stage{width:100vw;height:100dvh}}
  `;

  const style = document.createElement("style");
  style.id = "preferred-contact-v318-style";
  style.textContent = css;
  document.head.appendChild(style);

  let youtubeApiPromise;
  let activeOverlay = null;
  let activePlayer = null;
  let completedPlays = 0;
  let returnFocus = null;

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (youtubeApiPromise) return youtubeApiPromise;
    youtubeApiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === "function") previous();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube could not be loaded."));
      document.head.appendChild(script);
      window.setTimeout(() => {
        if (!(window.YT && window.YT.Player)) reject(new Error("YouTube loading timed out."));
      }, 12000);
    });
    return youtubeApiPromise;
  }

  function closeSmokeSignal() {
    if (!activeOverlay) return;
    try { if (activePlayer && typeof activePlayer.destroy === "function") activePlayer.destroy(); } catch (_) {}
    const overlay = activeOverlay;
    activeOverlay = null;
    activePlayer = null;
    completedPlays = 0;
    overlay.classList.remove("is-open");
    document.body.classList.remove("smoke-signal-active");
    window.setTimeout(() => overlay.remove(), 360);
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
  }

  function finishSmokeSignal() {
    if (!activeOverlay) return;
    const final = activeOverlay.querySelector(".smoke-final");
    const status = activeOverlay.querySelector(".smoke-status");
    if (status) status.hidden = true;
    if (final) final.classList.add("show");
    window.setTimeout(closeSmokeSignal, 2600);
  }

  async function openSmokeSignal(sourceElement) {
    closeSmokeSignal();
    returnFocus = sourceElement || document.activeElement;
    completedPlays = 0;
    const overlay = document.createElement("div");
    overlay.className = "smoke-signal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Smoke Signal");
    overlay.innerHTML = `
      <div class="smoke-signal-stage">
        <div id="smokeSignalPlayer" class="smoke-signal-player"></div>
        <button type="button" class="smoke-close" aria-label="Close Smoke Signal">×</button>
        <div class="smoke-status">Consulting ancient communication methods…</div>
        <div class="smoke-final">No response received.<br>Try Text or Phone instead.</div>
      </div>`;
    document.body.appendChild(overlay);
    activeOverlay = overlay;
    document.body.classList.add("smoke-signal-active");
    overlay.querySelector(".smoke-close").addEventListener("click", closeSmokeSignal);
    overlay.addEventListener("keydown", event => { if (event.key === "Escape") closeSmokeSignal(); });
    requestAnimationFrame(() => overlay.classList.add("is-open"));
    overlay.querySelector(".smoke-close").focus();

    try {
      const YT = await loadYouTubeApi();
      if (!activeOverlay || activeOverlay !== overlay) return;
      activePlayer = new YT.Player("smokeSignalPlayer", {
        videoId: "HyRSa7rYSRE",
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          fs: 0
        },
        events: {
          onReady: event => {
            const status = overlay.querySelector(".smoke-status");
            if (status) status.textContent = "Smoke signal sent successfully. Actual delivery not guaranteed.";
            try { event.target.playVideo(); } catch (_) {}
          },
          onStateChange: event => {
            if (event.data !== YT.PlayerState.ENDED) return;
            completedPlays += 1;
            if (completedPlays < 2) {
              try { event.target.seekTo(0, true); event.target.playVideo(); } catch (_) { finishSmokeSignal(); }
            } else {
              finishSmokeSignal();
            }
          },
          onError: () => {
            const status = overlay.querySelector(".smoke-status");
            if (status) status.textContent = "The smoke signal video could not be played. Try Text or Phone instead.";
          }
        }
      });
    } catch (_) {
      if (!activeOverlay || activeOverlay !== overlay) return;
      const status = overlay.querySelector(".smoke-status");
      if (status) status.textContent = "Internet access is required for this smoke signal. Try Text or Phone instead.";
    }
  }

  function setSelected(cards, select) {
    cards.querySelectorAll(".preferred-contact-card").forEach(button => {
      const selected = button.dataset.value === select.value;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function enhanceSelect(select) {
    if (!select || select.dataset.contactEnhanced === "true") return;
    select.dataset.contactEnhanced = "true";
    select.classList.add("enhanced-contact-select");
    const cards = document.createElement("div");
    cards.className = "preferred-contact-cards";
    cards.setAttribute("role", "group");
    cards.setAttribute("aria-label", "Preferred Contact Method");
    CONTACTS.forEach(contact => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preferred-contact-card";
      button.dataset.value = contact.value;
      button.innerHTML = `<span class="contact-icon" aria-hidden="true">${contact.icon}</span><span class="contact-label">${contact.label}</span>`;
      button.addEventListener("click", () => {
        select.value = contact.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        setSelected(cards, select);
        if (contact.value === "Smoke Signal") openSmokeSignal(button);
      });
      cards.appendChild(button);
    });
    select.insertAdjacentElement("afterend", cards);
    select.addEventListener("change", () => {
      setSelected(cards, select);
      if (select.value === "Smoke Signal" && !activeOverlay) openSmokeSignal(cards.querySelector('[data-value="Smoke Signal"]'));
    });
    setSelected(cards, select);
  }

  function enhanceAll() {
    document.querySelectorAll("select.preferred-contact, #quotePreferredContact, #customerPreferredContact, #invoicePreferredContact").forEach(enhanceSelect);
  }

  function start() {
    enhanceAll();
    const observer = new MutationObserver(enhanceAll);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  window.openSmokeSignal = openSmokeSignal;
  window.closeSmokeSignal = closeSmokeSignal;
})();
