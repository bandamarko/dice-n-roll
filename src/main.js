// main.js: connects the screens to the router and starts the app
import "./style.css";
import { startTheme } from "./ui/theme.js";
import { defineScreens, startRouter } from "./ui/router.js";
import { showWelcome } from "./ui/welcome.js";
import { showPicker } from "./ui/picker.js";
import { showSetup } from "./ui/setup.js";
import { showGame } from "./ui/game.js";
import { showEnd } from "./ui/end.js";

defineScreens({
  welcome: showWelcome,
  picker: showPicker,
  setup: showSetup,
  game: showGame,
  end: showEnd,
});

startTheme();
startRouter(document.querySelector("#app"), "welcome");

// Offline + installable. Only in the built app: during "npm run dev" a service worker
// would keep serving old copies of the files you're editing.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

document.addEventListener("gesturestart", (event) => event.preventDefault());