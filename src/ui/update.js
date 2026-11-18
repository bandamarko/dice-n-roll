// ui/update.js
// Tells you when a new version of the app has been downloaded.
// The service worker (public/sw.js) keeps the saved copy; this side asks it to look for
// a new version when the app starts and whenever you come back to it, and compares the
// saved copy's files with its own. A different file means the saved copy is newer, so a
// small "New version ready · Reload" bar appears. Nothing reloads until you tap it.

import { el, button } from "./dom.js";
import { CLOSE } from "./icons.js";

const ME = import.meta.url; // the built file running right now: …/assets/index-3fa9c1.js
const WAIT = 60 * 1000; // at most one check a minute, however often you switch back

let lastCheck = 0;
let dismissed = false;

export function startUpdates() {
  const worker = navigator.serviceWorker;

  worker.addEventListener("message", (event) => {
    if (event.data?.type !== "saved") return;
    const files = event.data.files;
    if (files.length > 0 && !files.includes(ME)) showBar();
  });

  check();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
}

async function check() {
  if (dismissed || Date.now() - lastCheck < WAIT) return;
  lastCheck = Date.now();
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage("check");
}

function showBar() {
  if (dismissed || document.querySelector(".update-bar")) return;

  const bar = el("div", "update-bar");
  bar.setAttribute("role", "status"); // screen readers announce it
  const reload = button("update-reload", { text: "Reload", onClick: () => location.reload() });
  const close = button("update-close", {
    icon: CLOSE,
    label: "Not now",
    onClick: () => {
      dismissed = true; // not again until the app is opened next time
      bar.remove();
    },
  });
  bar.append(el("span", "update-text", "New version ready"), reload, close);
  document.body.append(bar);
}