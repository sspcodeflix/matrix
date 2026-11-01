/* Local interaction model for the design hand-off. No API calls or real work. */
(() => {
  "use strict";
  const fixture = window.MATRIX_WORKFLOW_FIXTURE;
  const byId = (id) => document.getElementById(id);
  if (!fixture) {
    byId("preview-error").hidden = false;
    byId("preview-controls").hidden = true;
    return;
  }
  const query = new URLSearchParams(location.search);
  let workflow = query.get("workflow") === "acceptance" ? "acceptance" : "regression";
  let state = "running";
  let completed = fixture.initialCompleted;
  let sequence = 1;
  let parentAttempt = null;
  let stopTimer = null;
  let showResults = false;
  let history = [];
  let sessionRevision = 0;
  const scenario = () => fixture[workflow];
  const attemptId = () => `${scenario().attemptPrefix}-${String(sequence).padStart(2, "0")}`;
  const announce = (message) => { byId("status-message").textContent = message; };
  const createText = (tag, content, className) => {
    const element = document.createElement(tag);
    element.textContent = content;
    if (className) element.className = className;
    return element;
  };

  function render() {
    const current = scenario();
    const total = current.units.length;
    byId("app-name").textContent = fixture.appName;
    byId("breadcrumb-workflow").textContent = current.label;
    byId("page-title").textContent = `${current.label} processing`;
    byId("workflow-scope").textContent = current.scope;
    byId("activity-title").textContent = state === "stopped" ? "Processing stopped" : state === "completed" ? "Draft work complete" : current.activity;
    byId("attempt-id").textContent = attemptId();
    byId("source-version").textContent = fixture.sourceVersion;
    byId("parent-attempt").hidden = !parentAttempt;
    byId("parent-attempt").textContent = parentAttempt ? `Continues ${parentAttempt}` : "";
    const badge = byId("processing-status");
    badge.dataset.state = state;
    byId("status-label").textContent = state.charAt(0).toUpperCase() + state.slice(1);
    byId("completed-count").textContent = completed;
    byId("remaining-count").textContent = total - completed;
    byId("active-count").textContent = state === "running" || state === "stopping" ? "1" : "0";
    byId("progress-text").textContent = `${completed} of ${total} ${current.output} saved`;
    byId("progress-percent").textContent = `${Math.round(completed / total * 100)}%`;
    byId("work-progress").max = total;
    byId("work-progress").value = completed;
    byId("work-progress").setAttribute("aria-label", `${completed} of ${total} ${current.output} saved`);
    byId("stop-processing").hidden = state === "stopped" || state === "completed";
    byId("stop-processing").disabled = state === "stopping";
    byId("stop-processing").textContent = state === "stopping" ? "Stopping…" : "Stop processing";
    byId("continue-processing").hidden = state !== "stopped" || !current.checkpointSupported;
    byId("start-new").hidden = state !== "stopped" && state !== "completed";
    byId("view-results").textContent = showResults ? "Hide partial results" : "View partial results";
    byId("view-results").setAttribute("aria-expanded", String(showResults));
    byId("output-list").hidden = !showResults;
    byId("checkpoint-info").hidden = state !== "stopped";
    byId("checkpoint-id").textContent = `${fixture.checkpointPrefix}-${workflow.toUpperCase()}-${sequence}`;
    byId("checkpoint-detail").textContent = current.checkpointSupported
      ? "This example has unchanged pinned inputs and a valid checkpoint. Continue creates a new linked attempt and reuses saved drafts; the stopped attempt stays in history."
      : "This example cannot safely reuse its checkpoint. Start a new attempt with freshly checked inputs; saved drafts remain available in the stopped attempt.";
    byId("external-note").textContent = workflow === "regression"
      ? "Existing branches and PRs remain unchanged. Harness executions already triggered from Git continue independently. Matrix cannot stop or rerun them."
      : "Existing reviews and UAT sign-offs remain unchanged. Only accepted, signed-off test versions qualify for the separate Octane import sheet.";
    byId("output-summary").textContent = `${current.output.charAt(0).toUpperCase() + current.output.slice(1)} are saved with their source references. Drafts still need review; partial work is not a completed coverage snapshot.`;
    byId("action-note").textContent = state === "stopping" ? "Stop requested. Waiting for the current operation to reach a safe boundary." : state === "stopped" ? "No new units will start in this attempt." : state === "completed" ? "Continue to human review in the real workflow." : "Completed work is kept. Stop takes effect at the next safe boundary.";
    document.querySelectorAll("[data-workflow]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.workflow === workflow)));
    document.querySelectorAll("[data-workflow-nav]").forEach((link) => {
      if (link.dataset.workflowNav === workflow) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    byId("process-steps").replaceChildren(...current.steps.map((name, index) => {
      const step = createText("li", name, index < 2 ? "done" : index === 2 ? "current" : "");
      step.append(createText("span", index < 2 ? "Saved" : index === 2 ? (state === "completed" ? "Drafts saved" : state.charAt(0).toUpperCase() + state.slice(1)) : "Not started by this preview"));
      return step;
    }));
    byId("output-list").replaceChildren(...current.units.slice(0, completed).map(([id, title]) => {
      const row = document.createElement("li");
      const text = document.createElement("div");
      text.append(createText("strong", title), createText("code", `${id} · ${fixture.sourceVersion}`));
      row.append(text, createText("span", "✓ Saved draft", "saved-label"));
      return row;
    }));
    byId("attempt-history").hidden = history.length === 0;
    byId("history-list").replaceChildren(...history.map((attempt) => {
      const item = document.createElement("li");
      const link = createText("a", `${attempt.id} · ${attempt.completed} drafts saved · ${attempt.state === "completed" ? "Completed" : "Stopped"}`);
      link.href = "#history-detail";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const detail = byId("history-detail");
        detail.replaceChildren(createText("strong", `${attempt.id} · ${attempt.state === "completed" ? "Completed" : "Stopped"} demo attempt`), createText("p", `Its ${attempt.completed} saved drafts remain unchanged. The current attempt is ${attemptId()}.`));
        const outputs = document.createElement("ul");
        scenario().units.slice(0, attempt.completed).forEach(([id, title]) => outputs.append(createText("li", `${id}: ${title} · Saved draft`)));
        detail.append(outputs);
        detail.hidden = false;
        detail.focus();
      });
      item.append(link);
      return item;
    }));
    const themeTarget = document.documentElement.dataset.theme === "dark" ? "WorkflowProcessing.html" : "Dark-WorkflowProcessing.html";
    byId("theme-link").href = `${themeTarget}?workflow=${workflow}`;
    const prefix = document.documentElement.dataset.theme === "dark" ? "Dark-" : "";
    byId("back-link").href = `${prefix}${workflow === "acceptance" ? "Acceptance" : "Workspace"}.html`;
    byId("back-link").textContent = `Back to ${current.label}`;
  }

  function reset(nextWorkflow = workflow) {
    clearTimeout(stopTimer);
    sessionRevision += 1;
    workflow = nextWorkflow;
    state = "running";
    completed = fixture.initialCompleted;
    sequence = 1;
    parentAttempt = null;
    history = [];
    showResults = false;
    byId("history-detail").hidden = true;
    render();
    announce(`Local ${scenario().label} example running. ${completed} drafts are saved; one draft is in progress. No live job is connected.`);
  }

  byId("stop-processing").addEventListener("click", () => {
    if (state !== "running") return;
    const revision = sessionRevision;
    state = "stopping";
    render();
    announce("Stop requested. The current demo unit is finishing safely; no new units will start. Completed work remains saved.");
    stopTimer = setTimeout(() => {
      if (revision !== sessionRevision || state !== "stopping") return;
      const focusWasAtStop = document.activeElement === byId("stop-processing") || document.activeElement === document.body;
      completed = Math.min(completed + 1, scenario().units.length);
      state = completed === scenario().units.length ? "completed" : "stopped";
      render();
      announce(state === "completed" ? "The final demo unit finished before stopping. All drafts are saved; human review is still required." : `Stopped at a safe checkpoint. ${completed} drafts are saved; ${scenario().units.length - completed} units remain. Nothing already published was undone.`);
      if (focusWasAtStop) (state === "completed" ? byId("start-new") : scenario().checkpointSupported ? byId("continue-processing") : byId("start-new")).focus();
    }, fixture.stopDelayMs);
  });

  byId("continue-processing").addEventListener("click", () => {
    if (state !== "stopped" || !scenario().checkpointSupported) return;
    const prior = attemptId();
    history.push({ id: prior, completed, state });
    sequence += 1;
    parentAttempt = prior;
    state = "running";
    render();
    announce(`New linked demo attempt ${attemptId()} continues ${prior}. ${completed} saved drafts are reused; only the remaining units are scheduled.`);
    byId("stop-processing").focus();
  });

  byId("start-new").addEventListener("click", () => {
    if (state !== "stopped" && state !== "completed") return;
    history.push({ id: attemptId(), completed, state });
    sequence += 1;
    parentAttempt = null;
    completed = 0;
    state = "running";
    render();
    announce(`New demo attempt ${attemptId()} starts with freshly checked inputs. Previous saved drafts remain in history.`);
    byId("stop-processing").focus();
  });

  byId("view-results").addEventListener("click", () => { showResults = !showResults; render(); });
  document.querySelectorAll("[data-workflow]").forEach((button) => button.addEventListener("click", () => reset(button.dataset.workflow)));
  byId("reset-preview").addEventListener("click", () => reset());
  reset();
})();
