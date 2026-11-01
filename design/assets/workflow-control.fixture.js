/* Sample data for the local design preview only. No production identifiers. */
window.MATRIX_WORKFLOW_FIXTURE = Object.freeze({
  appName: "Sample application",
  sourceVersion: "context-demo-v1",
  checkpointPrefix: "CP-DEMO",
  stopDelayMs: 1600,
  initialCompleted: 3,
  acceptance: {
    label: "Acceptance",
    scope: "Sample release · 8 acceptance criteria",
    activity: "Writing acceptance tests",
    output: "test drafts",
    attemptPrefix: "ACC-DEMO",
    checkpointSupported: true,
    steps: ["Pull stories", "Understand", "Write tests", "Sign off and export"],
    units: [
      ["AC-DEMO-01", "Valid request is accepted"],
      ["AC-DEMO-02", "Missing required details are explained"],
      ["AC-DEMO-03", "Duplicate submission is handled"],
      ["AC-DEMO-04", "User receives a confirmation"],
      ["AC-DEMO-05", "Cancelled requests remain traceable"],
      ["AC-DEMO-06", "Restricted actions need the correct role"],
      ["AC-DEMO-07", "Changes appear in the activity record"],
      ["AC-DEMO-08", "A temporary error can be recovered"]
    ]
  },
  regression: {
    label: "Regression",
    scope: "Whole sample application · 8 selected gaps",
    activity: "Writing automation drafts",
    output: "automation drafts",
    attemptPrefix: "REG-DEMO",
    checkpointSupported: true,
    steps: ["Understand", "Identify gaps", "Write automation", "Harness execution"],
    units: [
      ["FR-DEMO-01", "Valid request follows the expected route"],
      ["FR-DEMO-02", "Invalid details produce a useful error"],
      ["FR-DEMO-03", "Repeated requests do not duplicate work"],
      ["FR-DEMO-04", "A completed request has an audit record"],
      ["FR-DEMO-05", "A timed-out request can be retried"],
      ["FR-DEMO-06", "Restricted actions enforce the user role"],
      ["FR-DEMO-07", "A cancelled request retains its history"],
      ["FR-DEMO-08", "The result matches the source requirement"]
    ]
  }
});
