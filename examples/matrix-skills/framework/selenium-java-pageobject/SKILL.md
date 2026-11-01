---
name: selenium-java-pageobject
description: Write UI regression automation in Java with Selenium, page objects, explicit waits and test-data builders. Use for web UI components whose automation repo uses Selenium.
---

# Selenium Java page-object tests

## Rules
- One test class per functional requirement; tag every test: `@Tag("FR-0218")` and `@Tag("matrix")`.
- Declare the role and data need, never an account or record: `@role("ops-maker")`, `@data("card-payment.settled.aed.gt500")`.
- Use page objects in `src/test/java/.../pages`. Reuse existing ones; search the repo before creating a new page object.
- Explicit waits only (`WebDriverWait`); never `Thread.sleep`.
- Never hard-code retry counts, timeouts, URLs or amounts; read them from the app config fixture.
- Assertions must check the expected result stated in the requirement, not just that a page loaded.

## Steps
1. Read the requirement and the existing tests mapped to it (`search_repo`).
2. Find or extend the page objects you need.
3. Write the test, then `compile`.
4. Report which requirement each assertion covers.

## References
- `references/waits.md`: wait strategy
- `references/data-builders.md`: test-data builders
