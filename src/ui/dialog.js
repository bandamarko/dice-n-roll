// ui/dialog.js
// A small popup with a title, a message and buttons. Back closes it like "Cancel".
// Reused for "needs 2–8 players", "Leave the game?", "Start a new game?" and so on.

import { openOverlay } from "./router.js";
import { el, button } from "./dom.js";

// actions: [{ label, kind: "primary" | "secondary" | "danger", onClick }]
// Every button closes the dialog first, then runs its onClick.
export function showDialog(root, { title, message, actions }) {
  const layer = el("div", "dialog-layer");
  const box = el("div", "dialog");
  box.setAttribute("role", "alertdialog");
  box.setAttribute("aria-modal", "true");

  const heading = el("h2", "dialog-title", title);
  heading.id = `dialog-title-${Date.now()}`;
  box.setAttribute("aria-labelledby", heading.id);
  box.append(heading);
  if (message) box.append(el("p", "dialog-message", message));

  const dismiss = openOverlay(() => layer.remove());

  const buttons = el("div", "dialog-actions");
  for (const action of actions) {
    buttons.append(
      button(`dialog-button dialog-${action.kind ?? "secondary"}`, {
        text: action.label,
        onClick: () => {
          dismiss();
          action.onClick?.();
        },
      }),
    );
  }
  box.append(buttons);

  layer.addEventListener("click", (event) => {
    if (event.target === layer) dismiss();
  });

  layer.append(box);
  root.append(layer);
  buttons.querySelector("button")?.focus();
}
