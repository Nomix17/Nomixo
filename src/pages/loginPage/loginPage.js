const EXTERNAL_LINKS = {
  tmdb:  "https://developer.themoviedb.org/docs/getting-started",
  wyzie: "https://sub.wyzie.io/redeem",
};

const collectedApiKeys = {};

const card = document.getElementById("card");
const successScreen = document.getElementById("view-success");

const views = [
  document.getElementById("view-tmdb"),
  document.getElementById("view-wyzie"),
];

const fields = {
  tmdb: {
    input: document.getElementById("tmdb-key"),
    error: document.getElementById("tmdb-err"),
    btn: document.getElementById("tmdb-submit"),
  },
  wyzie: {
    input: document.getElementById("wyzie-key"),
    error: document.getElementById("wyzie-err"),
    btn: document.getElementById("wyzie-submit"),
  },
};

function navigateTo(nextIndex) {
  if (nextIndex === views.length) {
    animateCardOut();
    return;
  }

  const currentIndex = views.findIndex(v => !v.classList.contains("view--hidden"));
  if (currentIndex === nextIndex) return;

  slideFromTo(views[currentIndex], views[nextIndex]);
}

function animateCardOut() {
  card.style.transition = "opacity 0.28s ease, transform 0.28s ease";
  card.style.opacity = "0";
  card.style.transform  = "translateY(-6px) scale(0.99)";

  setTimeout(() => {
    card.style.display = "none";
    successScreen.classList.add("visible");
  }, 280);
}

function slideFromTo(fromEl, toEl) {
  fromEl.classList.add("view--exit");

  fromEl.addEventListener("animationend", () => {
    fromEl.classList.add("view--hidden");
    fromEl.classList.remove("view--exit");

    toEl.classList.remove("view--hidden");
    toEl.classList.add("view--enter");

    toEl.addEventListener("animationend", () => {
      toEl.classList.remove("view--enter");
    }, { once: true });
  }, { once: true });
}

function showError(key, message) {
  const { input, error } = fields[key];
  error.textContent = message;
  error.classList.add("show");
  input.classList.add("is-err");
}

function clearError(key) {
  const { input, error } = fields[key];
  error.classList.remove("show");
  input.classList.remove("is-err");
}

function setLoading(key, isLoading) {
  const { btn } = fields[key];
  btn.disabled = isLoading;
  btn.classList.toggle("loading", isLoading);
}

function friendlyErrorMessage(responseCode) {
  const messages = {
    "api-key-not-valid": "Invalid API key",
    "no-internet-connection": "No internet connection.",
  };
  return messages[responseCode] ?? "Something went wrong. Please try again.";
}

function showSuccess() {
  const welcomeEl = document.getElementById("welcome-msg");
  welcomeEl.textContent = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

  navigateTo(views.length);
  setTimeout(() => backToHome(true), 3000);
}

async function submitTmdbKey() {
  const key = fields.tmdb.input.value.trim();
  clearError("tmdb");

  if (!key) {
    showError("tmdb", "Please enter your API key.");
    return;
  }

  setLoading("tmdb", true);
  try {
    const result = await window.electronAPI.validateTMDBApiKey(key);

    if (result.response === "api-key-valid") {
      collectedApiKeys.TMDB_API_KEY = key;
      navigateTo(1);
      setTimeout(() => fields.wyzie.input.focus(), 350);
    } else {
      showError("tmdb", friendlyErrorMessage(result.response));
    }
  } catch {
    showError("tmdb", friendlyErrorMessage());
  } finally {
    setLoading("tmdb", false);
  }
}

async function submitWyzieKey() {
  const key = fields.wyzie.input.value.trim();
  clearError("wyzie");

  if (!key) {
    showError("wyzie", "Please enter your API key.");
    return;
  }

  setLoading("wyzie", true);
  try {
    const result = await window.electronAPI.validateWyzieApiKey(key);

    if (result.response === "api-key-valid") {
      collectedApiKeys.Wyzie_API_KEY = key;
      await window.electronAPI.saveApiKey(collectedApiKeys);
      showSuccess();
    } else {
      showError("wyzie", friendlyErrorMessage(result.response));
    }
  } catch {
    showError("wyzie", friendlyErrorMessage());
  } finally {
    setLoading("wyzie", false);
  }
}


function initEyeButtons() {
  document.querySelectorAll(".eye-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const isHidden = input.type === "password";

      input.type = isHidden ? "text" : "password";
      btn.classList.toggle("shown", isHidden);
      btn.setAttribute("aria-label", isHidden ? "Hide key" : "Show key");
    });
  });
}

function bindEvents() {
  // TMDB
  fields.tmdb.btn.addEventListener("click", submitTmdbKey);
  fields.tmdb.input.addEventListener("keydown", event => {
    if (event.key === "Enter")
      submitTmdbKey(); 
  });
  fields.tmdb.input.addEventListener("input", () => clearError("tmdb"));
  document.getElementById("tmdb-get-key").addEventListener("click", () => {
    window.electronAPI.openExternalLink(EXTERNAL_LINKS.tmdb);
  });

  // Wyzie
  fields.wyzie.btn.addEventListener("click", submitWyzieKey);
  fields.wyzie.input.addEventListener("keydown", event => {
    if (event.key === "Enter")
      submitWyzieKey(); 
  });
  fields.wyzie.input.addEventListener("input", () => clearError("wyzie"));
  document.getElementById("wyzie-get-key").addEventListener("click", () => {
    window.electronAPI.openExternalLink(EXTERNAL_LINKS.wyzie);
  });
  document.getElementById("wyzie-skip").addEventListener("click", async () => {
    await window.electronAPI.saveApiKey(collectedApiKeys);
    showSuccess();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  handleFullScreenIcon();
  initEyeButtons();
  bindEvents();
  fields.tmdb.input.focus();
});
