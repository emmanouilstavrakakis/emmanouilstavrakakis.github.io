/* This script only prepares a draft. It never posts a contribution. */
(function () {
  "use strict";
  const root = document.getElementById("math-notebook");
  if (!root) return;
  const q = selector => root.querySelector(selector);
  const preview = root.dataset.preview === "true";
  const repository = root.dataset.repository;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return;
  const github = "https://github.com/" + repository;
  const topicNames = {
    "gaussian-clouds": "Fitting Gaussian clouds in normed spaces",
    "boolean-functions": "On the structure of Boolean functions",
    theorems: "Theorems I find appealing",
    general: "Further directions and connections"
  };
  q("#nb-all-discussion").href = github + "/issues?q=" + encodeURIComponent("is:issue notebook in:title");

  root.querySelectorAll("[data-topic]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      q("#nb-topic").value = link.dataset.topic;
      q("#nb-draft").hidden = true;
      q("#nb-composer").open = true;
      q("#nb-title").focus();
      q("#nb-composer").scrollIntoView({ block: "start" });
    });
  });

  q("#nb-contribution-form").addEventListener("submit", event => {
    event.preventDefault();
    const title = q("#nb-title").value.trim();
    const message = q("#nb-message").value.trim();
    if (!title || !message) {
      const field = !title ? q("#nb-title") : q("#nb-message");
      field.setCustomValidity("Please enter some text.");
      field.reportValidity();
      return;
    }
    const topic = q("#nb-topic").value;
    const origin = q("#nb-origin").value;
    const issueTitle = "[Notebook:" + topic + "] " + title;
    const body = "Topic: " + topicNames[topic] + "\nOrigin: " + origin +
      "\nType: Mathematical remark\n\n## Remark\n\n" + message +
      "\n\n---\nPlease distinguish proved statements from suggestions or unverified claims.";
    const fullUrl = github + "/issues/new?" + new URLSearchParams({ title: issueTitle, body });
    const longDraft = fullUrl.length > 7000;
    q("#nb-draft-body").value = body;
    q("#nb-draft").hidden = false;
    q("#nb-open-draft").hidden = preview;
    q("#nb-open-draft").href = longDraft
      ? github + "/issues/new?" + new URLSearchParams({ title: issueTitle })
      : fullUrl;
    q("#nb-draft-status").textContent = preview
      ? "Preview only: your draft is ready below. Nothing has been posted."
      : longDraft
        ? "This draft is too long to prefill. Copy it, open GitHub, and paste it into the issue body before submitting."
        : "Review the draft on GitHub, then submit it there when ready.";
  });
  ["#nb-title", "#nb-message"].forEach(selector => {
    q(selector).addEventListener("input", event => event.target.setCustomValidity(""));
  });
  // Editing the form hides the previous draft so an older version is not posted by mistake.
  q("#nb-contribution-form").addEventListener("input", () => {
    q("#nb-draft").hidden = true;
  });
  q("#nb-contribution-form").addEventListener("change", () => {
    q("#nb-draft").hidden = true;
  });
  q("#nb-copy-draft").addEventListener("click", async () => {
    const draft = q("#nb-draft-body");
    try {
      await navigator.clipboard.writeText(draft.value);
      q("#nb-draft-status").textContent = "Draft copied. Nothing has been posted.";
    } catch (_) {
      draft.focus();
      draft.select();
      q("#nb-draft-status").textContent = "The draft is selected. Press Ctrl+C (Windows) or Command+C (Mac) to copy.";
    }
  });
  function requestDiscussion(more) {
    if (preview) {
      q("#nb-discussion-status").textContent = "Public comments are not loaded in this preview. You can try preparing a draft above.";
      return;
    }
    if (root.dataset.discussionConnected !== "true") {
      q("#nb-discussion-status").textContent = "Discussion could not be loaded. Please use the GitHub link.";
      return;
    }
    root.dispatchEvent(new CustomEvent("notebook:load-discussion", { detail: { more } }));
  }
  q("#nb-load-discussion").addEventListener("click", () => requestDiscussion(false));
  q("#nb-more-discussion").addEventListener("click", () => requestDiscussion(true));
  ["#nb-filter-paper", "#nb-filter-origin"].forEach(selector => {
    q(selector).addEventListener("change", () => {
      if (preview) return;
      root.dispatchEvent(new CustomEvent("notebook:filter-discussion"));
    });
  });
  if (preview) q("#nb-discussion-status").textContent = "Preview: public comments are not loaded here.";
})();
