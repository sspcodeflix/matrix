# matrix-skills (example layout)

The real repository is the source of truth for how Matrix writes tests. Changes go through PRs, CI runs each skill's evals against the golden datasets and logs scores to MLflow, and an admin promotes a version only if it passes the 90% gate.

```
matrix-skills/
  framework/
    selenium-java-pageobject/   SKILL.md, references/, scripts/, evals/
    karate-api/
    hyperexecute-yaml/
    octane-case-format/
  apps/
    payments-hub-conventions/
  CODEOWNERS   framework skills: harness engineering; app skills: app QA leads
```

Keep each `SKILL.md` short (a few hundred lines); put detail in `references/` loaded on demand with `read_skill_file`. No secrets in skills.
