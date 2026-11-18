const STORAGE_KEY = "dice-n-roll:current-game";
const SAVE_VERSION = 1;
// Only the last moves' undo is saved. Every saved step is a whole copy of the game, so a
// full 8-player Yamb would grow to ~3.7 MB: slow to save after every move and close to
// the ~5 MB some browsers allow. In the open app, undo still goes all the way back.
const SAVED_UNDOS = 50;

// The app used to be called Dice'n'Fun. Values saved under the old names are moved
// to the new ones once, unchanged, so nobody loses their game or theme.
const OLD_KEYS = {
  "dice-n-fun:current-game": STORAGE_KEY,
  "dice-n-fun:theme": "dice-n-roll:theme",
};

export function moveOldSaves() {
  try {
    for (const [oldKey, newKey] of Object.entries(OLD_KEYS)) {
      const value = localStorage.getItem(oldKey);
      if (value === null) continue;
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  } catch (error) {
    console.error("Could not move old saves:", error);
  }
}

export function saveGame(history) {
  const data = {
    version: SAVE_VERSION,
    current: history.current,
    undoStack: history.undoStack.slice(-SAVED_UNDOS), // redo is deliberately not saved
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Could not save the game:", error);
  }
}

export function loadGame() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return null;

    const data = JSON.parse(text);
    if (data.version !== SAVE_VERSION) return null;  // old format: start fresh for now

    return { current: data.current, undoStack: data.undoStack ?? [], redoStack: [] };
  } catch (error) {
    console.error("Saved game could not be read, starting fresh:", error);
    return null;
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Could not clear the saved game:", error);
  }
}