# Makeyev Finance: Mortgage Simulation Master Plan

**Purpose:** One implementation-ready document combining the supplied mortgage-calculation plan, compare-saving requirements, and the extended personal-finance, recommendation, CRM, document, partner, alert, feedback, API and optional AI roadmap.

**Review scope:** This review is based on the uploaded brief and its description of the project archive from October 20, 2026. The actual repository was not attached for a fresh code-level audit. Treat every "shipped" or "gap" status below as a claim from the supplied notes until Step 0 verifies it against the live repository.

## Instructions for the implementation agent

1. First inspect `AGENTS.md` at the repository root, the current implementation, tests, storage schemas, profile/saved-mix workflow, and existing calculator unsaved-changes modal. Verify the actual repo before editing.
2. Use this file as the unified task brief. The **Updated priority order**, **Additional product scope**, and **Compare lifecycle requirements** near the top are authoritative additions. The detailed reference material below is retained so no original technical requirement is lost. Where duplicated old priority lists differ, follow the updated order below, then preserve the existing phase dependencies.
3. Reuse the project's existing patterns for dialogs, forms, profile records, persistence, authentication, charts, localization, and tests. Do not add dependencies or replace working architecture without a concrete need.
4. Keep one shared monthly calculation schedule as the source of truth. Do not implement mortgage arithmetic independently in React components or in separate calculator/compare formulas.
5. Do not change existing calculation results by accident. Optional fields must default safely for old saved data, and existing golden tests must remain valid unless a deliberate correction is documented and reviewed.
6. Never invent missing financial data, label scenario assumptions as official forecasts, or present an incomplete statutory early-repayment fee as a complete fee estimate.
7. Complete each logical step with focused tests and a review before moving on. Include Hebrew RTL, English LTR, accessibility, dark/light theme, narrow viewport, persistence, and regression coverage as applicable.
8. Follow the repository's existing style rules. Do not use em dash characters in project files or user-facing copy.

## Persistent progress tracking and resume protocol

**This is mandatory.** Track progress in this same master-plan file. Do not create a separate progress tracker, checklist, or status file.

- Before starting or resuming work, read this section and the checklist below, then inspect the repository to verify what is actually implemented. The first unchecked item is the default next step, but verify its code and acceptance criteria first. If it was already completed outside this tracker, validate it and update the checkbox rather than redoing it blindly.
- Work on one logical step at a time. Do not mark a step complete just because code was written or the UI looks right. Complete its stated acceptance criteria and applicable tests first.
- **Immediately after each step is verified**, edit this file and change its checkbox from `[ ]` to `[x]`. Add a short completion note with the date, key files changed, tests run and their results. Keep the note concise and factual.
- If a step is partially done or blocked, leave its checkbox unchecked and add a `Blocked / partial` note stating what remains and why. Do not skip it silently or claim it is complete. A later step may proceed only when its dependencies are satisfied.
- At the end of each work session, update the `Resume point` below to the first unchecked or blocked step and add the next action. The next session must read this file and continue from that point, after verifying repository state. Never rely on chat history as the only record of progress.
- Keep this progress ledger in sync with the implementation. If the plan changes, update this same file before proceeding, preserve completed history, and explain any changed scope. Do not mark future steps complete in advance.
- The checkboxes in this delivered copy start unchecked because the repository was not available for a fresh code audit. This does **not** mean every feature is unimplemented; verify the actual repository before choosing the first task.

**Resume point:** Step 0, verify the repository and baseline first. Update this line after every completed or blocked step.

### Persistent implementation checklist

- [ ] **Step 0:** Establish baseline; inspect repository, tests, saved mixes, profile persistence and calculator unsaved-changes modal.
- [ ] **Step 0A:** Audit existing URLs and design the one-domain, multi-experience information architecture, route/layout boundaries, navigation and data ownership before expanding account, CRM and shop areas. This design step must not delay isolated mortgage-engine work.
- [ ] **Step 0B:** Inventory the approximately 10,000-line global stylesheet, CSS entry points, import order, existing modules, tokens, responsive rules and cascade dependencies. Produce a migration map without changing styles.
- [ ] **Step 1:** Add shared payment-composition helper with reconciled CPI accounting.
- [ ] **Step 2:** Update calculator amortization chart.
- [ ] **Step 3:** Update compare payment-composition charts.
- [ ] **Step 4:** Expose total indexation in calculator results.
- [ ] **Step 5:** Separate compare scenario limit from track limit (`MAX_MIXES` vs `MAX_TRACKS`).
- [ ] **Step 5A:** Add compare-page unsaved-changes modal with Save changes, Discard changes and Stay on page.
- [ ] **Step 5B:** Save independent comparison snapshots in the user profile; support opening, renaming, duplicating and deleting them.
- [ ] **Phase 0 exit check:** Verify accounting, capacity, persistence, old-data compatibility and responsive behavior.
- [ ] **Step 6:** Add backward-compatible grace fields.
- [ ] **Step 7:** Implement partial/full grace calculations.
- [ ] **Step 8:** Separate first payment from representative payment and PTI behavior.
- [ ] **Step 9:** Define and validate monthly CPI and rate-reset forecast inputs.
- [ ] **Step 10:** Apply monthly assumptions in the calculation engine using the documented event order.
- [ ] **Step 11:** Show forecast assumptions and the exact calculation path.
- [ ] **Step 12:** Add full-mix and full-track payoff events, initially internal-only.
- [ ] **Step 13:** Add partial prepayment modes: shorten term and reduce payment.
- [ ] **Step 14:** Keep fee-dependent payoff prototypes gated until the statutory fee model is verified.
- [ ] **Step 15:** Verify official early-repayment fee rules and worked examples.
- [ ] **Step 16:** Implement and validate supported statutory fee calculations.
- [ ] **Step 17:** Release the supported payoff flow with explicit fee components.
- [ ] **Step 18:** Add baseline/candidate cash-flow comparison metrics.
- [ ] **Step 19:** Add fee-aware cumulative savings and break-even analysis.
- [ ] **Step 20:** Model the existing mortgage while preserving historical reset dates.
- [ ] **Step 21:** Build and compare a proposed refinance without modifying the existing mortgage.
- [ ] **Step 22:** Add explicit full and partial balloon schedules.
- [ ] **Step 23:** Add staged loan-disbursement events.
- [ ] **Step 24:** Add verified cash-flow and advisor metrics.
- [ ] **Step 25:** Add reviewed OCR extraction for in-principle approvals and payoff statements.
- [ ] **Step 26:** Add verified bank-anchor refresh and an explicitly indicative rate-suggestion model, if reliable data supports it.
- [ ] **Step 27:** Add a combined-loan/merge view that preserves each source schedule and does not bypass track limits.
- [ ] **Step 28:** Add the Ministry of Housing eligibility workflow using current official rules/source data.
- [ ] **Step 29:** Add the advisor/deal overview, case notes and consent-based support-ticket flow where in scope.
- [ ] **Step 30:** Complete modular client reports, report-language coverage, and rate-validity notifications.
- [ ] **Step 31:** Audit and implement secure account/profile roles and record ownership using existing auth and MongoDB patterns.
- [ ] **Step 31A:** Add distinct public, client, professional and shop route shells/layouts/navigation inside the existing site, preserving current URLs and applying server-side access checks.
- [ ] **Step 31B:** Refactor the large global stylesheet into a documented, staged CSS architecture without changing visual behavior or adding a styling dependency.
- [ ] **Step 32:** Persist the consumer's mortgage, other loans, pension/retirement records, insurance and chosen household-finance details.
- [ ] **Step 33:** Build the personal financial dashboard with balances, remaining terms, payment obligations, renewal/reset dates, source and freshness labels.
- [ ] **Step 34:** Add an explicit owner-occupied versus investment-property objective and collect relevant constraints.
- [ ] **Step 35:** Add calculation-backed mix/track explanations, Spitzer versus equal-principal comparisons, rental stress cases and a verified payoff-priority analysis.
- [ ] **Step 36:** Expand the advisor overview into a secure CRM workspace with client cases, pipeline, assignment and controlled team sharing.
- [ ] **Step 37:** Add configurable tasks, reminders, workflow automation and advisor productivity reports.
- [ ] **Step 38:** Add the secure case document vault, document checklist and client portal.
- [ ] **Step 39:** Add reviewed bank-letter generation, document package export and only the bank submission integrations that are verified and supported.
- [ ] **Step 40:** Add a controlled partner/affiliate directory, clear referral disclosures, client consent and insurance records/reminders.
- [ ] **Step 41:** Add opt-in email subscriptions for verified rate changes and personal mortgage reset/expiry alerts.
- [ ] **Step 42:** Add configurable customer feedback surveys and properly scoped business analytics/reports.
- [ ] **Step 43:** Design and implement a secure, versioned API and selected external integrations where there is a verified need.
- [ ] **Step 44:** Evaluate and, if justified, implement a read-only, source-grounded AI assistant with strict authorization and explicit confirmation for actions.
- [ ] **Step 45:** Build the merchandise storefront at `/shop` as an isolated commerce module under the same domain, with product variants, cart, inventory/order handling and secure payment-provider integration.

**Step completion note template:** `Completed YYYY-MM-DD: <files/features>; tests: <commands and results>; exceptions: <none or details>.`

**Blocked/partial note template:** `Blocked at Step N: <what is incomplete>; reason: <blocker>; next action: <specific action>.`

## Project review and recommended improvements

The foundation of the plan is good: it prioritizes calculation integrity, separates CPI indexation from cash-payment components, calls for shared calculator/compare logic, protects old saved mixes, and gates regulated fee estimates until the rules are verified. The order that puts the cash-flow engine ahead of OCR, reporting polish, and advanced advisor metrics is appropriate.

The main improvements are:

- Make this master document the working source of truth instead of splitting work between several documents that can drift. The legacy roadmap and step lists are retained below for completeness; follow the updated order in this opening section.
- Add the compare-page unsaved-changes guard and persistent saved comparisons as explicit product requirements, not optional polish. A calculation scenario is valuable only if the user can safely leave it and return to it.
- Store comparison **inputs and configuration** as a versioned snapshot, then recalculate derived results from the shared calculation engine when loading. Avoid treating chart output or cached results as the financial source of truth.
- Save compare scenarios as independent snapshots. A saved comparison must not silently change when one of its source mixes is later edited or deleted. Optional source-mix identifiers may be retained for traceability, but saved snapshot data is authoritative.
- Treat `MAX_TRACKS` and `MAX_MIXES` as separate constraints, including server validation, load/restore, duplication, profile persistence, and tests.
- For financial changes, specify event order and accounting definitions before UI work. In particular, interest accrued is not always the same as interest paid once full grace is supported, and CPI must not be counted twice in a balance or payment composition.
- Verify current official Bank of Israel rules and worked examples before implementing statutory early-repayment fees. The tutorial summary is a feature reference, not a legal specification.
- Keep external data failures visible. Show source, as-of date, stale/unavailable state, and assumptions rather than fabricating current or future values.
- Avoid unrelated rewrites. Preserve Better Auth, existing custom SVG charts, current routes, saved-mix behavior, and the existing dependency stack unless the repository audit establishes a specific reason to change them.

## One website, separate experiences: recommended architecture

**Decision:** Keep Makeyev Finance under one brand and one primary domain, but divide it into distinct product areas with their own navigation, page layouts, permissions and feature modules. Do not put marketing, public calculators, a consumer financial portal, advisor CRM and merchandise checkout into one crowded interface. Also do not create separate sites or microservices at the outset without a demonstrated need.

Start with a modular monolith: one existing Next.js application, one deployment and shared authentication/backend conventions, with clear boundaries between modules. Reuse the same domain and session where authorized, while keeping each experience visually and functionally distinct. Next.js App Router route groups can organize code without appearing in URLs, and nested layouts can provide different shells for each area. Prefer one root layout plus nested layouts initially; multiple root layouts can cause a full page reload when navigating between them. See the official [Next.js Route Groups documentation](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups), checked 2026-10-23. Verify the actual router in Step 0 before choosing the implementation.

### Suggested URL map

| URL | Experience | Intended access |
|---|---|---|
| `/` | Public brand homepage, overview and entry points | Public |
| `/calculators/...` | Selected free mortgage calculators and educational tools | Public; sign-in only for saving or personalizing persistent work |
| `/learn/...` | Mortgage explanations, guides and public content | Public |
| `/shop` and `/shop/products/[slug]` | Merchandise catalogue, product pages, variants and cart | Public; account optional unless needed for a chosen checkout workflow |
| `/account/...` | Consumer portal: financial overview, own mortgage records, saved mixes/comparisons, documents and reminders | Authenticated consumer, own records only |
| `/pro/...` | Professional workspace: advanced simulator, CRM cases, assigned clients, documents, tasks and reports | Authenticated advisor with explicit permissions |
| `/admin/...` | Internal operations such as managing products, provider links, workflows and user access | Authorized admin only |

These are proposed routes, not permission to rename existing routes blindly. Step 0 must inventory current URLs and saved links. Preserve them where practical; otherwise add tested redirects and avoid breaking bookmarks, search indexing or existing navigation.

### Keep the experiences visually separate

- **Public website:** simple marketing navigation to calculators, learning content and the shop. Do not expose client or advisor data in public pages.
- **Public calculators:** lightweight tools designed for discovery and SEO. Use the shared mortgage calculation engine. Clearly explain which inputs are temporary and require sign-in to save.
- **Consumer portal:** its own dashboard/sidebar focused on the user's household finances, mortgage status, saved mixes and comparisons, documents, alerts and settings.
- **Professional workspace:** its own denser advisor navigation for clients, cases, mortgage simulations, compare, documents, tasks and reports. Do not show professional menu items to consumers.
- **Shop:** its own product-focused header, product pages, cart and checkout flow. Do not mix CRM controls or sensitive financial data into shopping UI.
- **Shared sign-in:** use the existing auth system where possible. After login, route users to an appropriate permitted landing page, but allow one person to have multiple authorized contexts when needed. Do not use one mutually exclusive global role if the same person can be both a consumer and an advisor.

### Architecture boundaries

- Organize by product/domain, not only by generic UI component type. Candidate boundaries are public site/content, calculators, consumer portal, advisor CRM, commerce, and shared platform services. Match actual project conventions during Step 0 rather than forcing a wholesale directory restructure.
- Keep one canonical mortgage calculation engine and shared schedule for public calculators, consumer views, advisor simulation, compare, reports and recommendations. Public and professional features may expose different controls, but must not independently implement the same financial formulas.
- Use separate server-side modules and schemas for commerce products/orders versus financial profiles, advisor cases and mortgage scenarios. A shared MongoDB cluster may be adequate initially, but collections, validation, retention and service-access rules must remain distinct. Do not copy financial records into shop/customer records simply because the person uses the same login.
- Enforce access on the server for every record operation. Public URLs and hidden navigation are not security boundaries. Client records must be scoped by owner and, where relevant, organization, assignment or explicit share. Commerce order access must be scoped to the order's customer or authorized commerce staff.
- Keep payment processing with a reputable payment provider. Never store raw card numbers or security codes. Decide between a hosted secure checkout and an embedded provider UI after reviewing the actual storefront needs; a provider-hosted payment page is a checkout step, not a second storefront.
- Treat login identity as shared platform identity, not permission to merge every data category. Keep marketing consent, store orders, financial records and advisor-client relationships separately scoped, and do not use financial profile data for marketing without an appropriate, explicit basis and consent.
- Do not split into microservices or separate deployments initially. Consider independent deployments later only if real operational, security, scaling or team constraints justify the cost. A single domain does not require every area to share one page layout or one set of permissions.

### Merchandise shop approach

Build the storefront UI at `/shop` in the same website, while isolating product/order logic behind a commerce module. Before choosing an integration, compare a managed commerce backend with a small custom catalogue/cart backed by a supported payment provider. Choose based on real requirements for product variants (size/color), inventory, shipping, returns/refunds, taxes, order emails, discounts and operational effort. Do not build a full custom commerce engine merely to sell a small first batch of shirts.

The first version should support catalogue and product details, available variants, stock-aware add-to-cart, shipping details where needed, a secure checkout, order confirmation based on provider confirmation, and an admin workflow to update products and stock. Store order/payment status separately from mortgage/profile models. Never claim a payment succeeded based only on a client redirect; verify provider-side payment status/webhook signatures, use idempotent order updates and record failures safely. Make guest checkout possible unless a concrete requirement justifies forcing account creation. Keep the storefront on the main domain and branded consistently, even if the secure payment step is hosted by the payment provider.

### Rollout order and done criteria

1. At Step 0A, document current paths, the proposed URL map, layouts, roles, domain ownership and migration/redirect constraints. Do not move working routes yet.
2. At Step 31, verify the account and role model. At Step 31A, create only the distinct route shells, navigation and server-side guards needed for the existing public, consumer and professional features. Preserve all working paths and share design primitives without forcing identical layouts.
3. Implement client and advisor pages in their respective shells as their existing steps are reached. Keep public calculators public where appropriate and make saving a deliberate sign-in action.
4. Implement Step 45 after the storefront and commerce requirements have been confirmed. Keep it independently testable and deploy it as part of the same site initially.
5. Later, consider a separate commerce provider/backend or split deployment only when measurement or operational requirements justify it. Keep the primary URL and customer experience coherent.

Acceptance criteria: public, consumer, advisor and shop navigation are distinct; URLs remain on the main domain; existing routes work or have tested redirects; the correct role can enter each protected area; cross-user and cross-organization access is denied server-side; public and professional mortgage calculations reconcile to the same engine; shop orders cannot leak financial records; and the shop does not handle raw payment-card data.

### Global stylesheet refactor: approximately 10,000 lines

**Recommendation:** Refactor the large global stylesheet, but treat this as a controlled maintainability change, not a rewrite or a performance fix by assumption. A 10,000-line source file is difficult to navigate and makes cascade ownership harder to reason about. Splitting the source does not automatically reduce the CSS shipped to the browser; bundle size and route delivery must be measured separately.

**Step 0B: audit only, no CSS behavior changes.**
- Locate the actual stylesheet and record its line count, byte size, all import sites, the root layout or app entry point, the router type, CSS/PostCSS configuration and any existing CSS Modules or Sass conventions. The current notes mention `src/styles/globals.css`, but verify that path rather than assuming it is still correct.
- Inventory logical sections: resets/base element styles, design tokens and themes, typography, layout primitives, utilities, shared components, page/feature-specific rules, responsive breakpoints, RTL/LTR handling, print styles and third-party overrides.
- Identify repeated selectors, duplicate declarations, high-specificity selectors, `!important`, broad element selectors, global state classes and order-sensitive media rules. Search component markup before classifying any selector as unused.
- Create a mapping from existing CSS ranges/sections to proposed destination files. Capture representative baseline screenshots or visual references and record any existing failing checks. Do not delete duplicates or reorder declarations during this inventory.

**Step 31B: refactor incrementally after the route/layout boundaries are understood.**
- Keep one clear global stylesheet entry point imported in the project's supported root entry point. Move the existing rules into a small, documented set of logical files, with an explicit deterministic import order. Confirm the supported import pattern in the actual Next.js router and build configuration before choosing CSS `@import`, JavaScript imports or another existing mechanism. Next.js CSS ordering can depend on import order and production chunking, so verify with a production build, not only `next dev`. Reference: [Next.js CSS documentation](https://nextjs.org/docs/pages/getting-started/css).
- A reasonable target grouping, adjusted to fit the actual codebase, is: `tokens-and-themes.css`, `reset-and-base.css`, `typography.css`, `layout.css`, `utilities.css`, and a limited set of shared-component styles. Keep global CSS for genuinely app-wide rules such as CSS custom properties, theme/dir state, reset, body defaults and shared utilities. Do not create a separate file for every small block.
- Move component- or feature-owned styles into nearby `.module.css` files when practical, especially for calculator, compare, account, professional CRM and shop components. CSS Modules provide local class scoping and are supported by Next.js; adopt them gradually and only where existing selectors can be mapped safely. Do not mechanically convert all selectors or force a new CSS framework.
- Preserve existing selectors, class names, custom properties, media queries, selector specificity, directionality and cascade semantics during the first extraction pass. Move rules with minimal edits and keep source order stable. Avoid renaming classes, combining similar-looking rules or changing selectors in the same patch as file moves unless the effect is separately tested and documented.
- Keep responsive and stateful rules next to the styles they modify where safe, but do not reorder `@media`, dark-theme, RTL/LTR, hover/focus, reduced-motion or print rules without checking their cascade effect. Do not introduce `@layer`, Sass, Tailwind or another styling dependency solely to split the file.
- Remove dead or duplicate CSS only after searching for usage across the entire repository and verifying dynamic class construction, portals/dialogs, SVGs, data attributes and test-only states. If usage is ambiguous, keep it and record it for later cleanup. Do not use broad selector changes or new `!important` declarations as a shortcut.
- Make small, reviewable commits or substeps: extract an identified section, run checks, compare screenshots, then continue. Keep a mapping or concise extraction note in this master plan's completion note so future edits know where styles belong. Do not leave the old rules duplicated in both old and new files after a migration slice is verified.

**Required validation for each CSS extraction slice:**
- Run formatting/lint, typecheck and the existing relevant tests where configured; run `npm run build` or the repository's production build command after changing CSS imports.
- Compare before/after visuals for the homepage and public calculators, calculator results, compare page and save/discard modal, account/profile, professional workspace and shop shell as those routes exist. Check Hebrew RTL and English LTR, light and dark themes, narrow widths around 360px, desktop widths, dialogs/portals, charts/tables, keyboard focus and print behavior where applicable.
- Test in production build output because CSS ordering/chunking may differ from development. Check browser console/build warnings and verify that route navigation does not cause missing, late or conflicting styles.
- Remove a legacy rule only when repository-wide usage searches and rendered checks show it is safe. Document any known baseline difference instead of silently accepting it.

**Step 31B acceptance criteria:** `globals.css` becomes a manageable entry point or is replaced by a clearly documented equivalent; each stylesheet has clear ownership; feature-specific selectors are locally scoped where appropriate; global import/order behavior is explicit; all existing routes remain visually and functionally equivalent; no unapproved dependency is added; and relevant production build, unit, e2e and RTL/LTR/theme/responsive checks pass. Record exactly which files were created, which sections moved and the test results before marking the checklist item complete.

## Updated priority order

1. **Step 0: Baseline audit.** Verify repository state, tests, current save/restore behavior, existing unsaved-changes modal in the calculator, and the actual profile/saved-mix data model.
   Complete Step 0A at the planning level as well: map current URLs and document the separate same-domain experiences. This must not delay the calculation-only phases.
2. **Phase 0: Calculation integrity and compare capacity.** Fix additive CPI/payment chart composition, expose total indexation, and separate `MAX_MIXES = 4` from the existing per-mix `MAX_TRACKS` limit.
3. **Phase 0B: Compare lifecycle and profile persistence.** Add the compare-page save/discard/stay prompt and saved comparisons in the profile, using the same persistence/authentication conventions as saved mixes. This phase is a required addition to the supplied roadmap.
4. **Phase 1: Grace periods.** Implement partial/full grace and separate first versus representative payment.
5. **Phase 2: CPI forecast paths and variable-rate resets.** Use explicit scenario assumptions and one shared monthly event order.
6. **Phase 3: Internal early-repayment and payoff events.** Keep the user-facing fee-dependent flow gated.
7. **Phase 4: Complete, officially verified early-repayment-fee calculation.** Do not release unsupported cases as complete quotes.
8. **Phase 5: Compare cash flows, cumulative savings, and break-even analysis.** Include fees only when verified.
9. **Phase 6: Refinancing with historical reset dates and explicit fee treatment.**
10. **Phase 7: Explicit balloon schedules and staged releases.**
11. **Phase 8: Verified advisor metrics and reviewed OCR extraction.**
12. **Phase 9: Additional mortgage-advisory foundations.** Complete the verified rate/anchor workflow, combined-loan view, eligibility flow, advisor overview/case notes/support, reports and notifications through Steps 26-30.
13. **Phase 10: Accounts, site shells and CSS architecture.** Reuse the existing Better Auth and MongoDB patterns after Step 0 verifies them. Establish secure roles and route/layout boundaries. Complete the CSS inventory in Step 0B, then perform the staged stylesheet refactor in Step 31B before adding substantial new interface areas.
14. **Phase 11: Goal-based mortgage scenarios and explanations.** Distinguish an owner-occupied home from an investment property; generate transparent, calculation-backed alternatives only after the related engine features are trusted.
15. **Phase 12: Advisor CRM and collaboration.** Expand client records, pipeline, team access, tasks, reminders and advisor reporting without duplicating the financial source of truth.
16. **Phase 13: Documents and client portal.** Add document checklists, private uploads, digital document workflows, reviewed bank-letter generation and supported bank submission paths.
17. **Phase 14: Partner directory, insurance and rate-change email alerts.** Build consent-based referrals and configurable, deduplicated rate notifications with clear source and effective-date information.
18. **Phase 15: Feedback, API integrations and optional AI assistant.** Add business feedback/reporting and external integrations with authorization and audit trails. Add AI only after data access boundaries and source-grounded answer behavior are established.

The phases may be split into smaller pull requests, but do not skip prerequisites. Existing rate-validity behavior and the Bank of Israel average-rate tables must not regress. The later CRM, document, partner and AI features are planned scope, not a claim that comparable features are already implemented.

## Additional product scope: personal finance, mortgage guidance, advisor CRM and service workflows

This section integrates the additional product ideas supplied for Makeyev Finance and feature categories described in the user-provided SmartNPV material. Public SmartNPV API documentation also exposes concepts for client records, client workflows, document uploads, reminders, simulations and related integration endpoints. Use these as capability references, not as permission to copy SmartNPV's UI, texts, document library or implementation. Build Makeyev Finance's own UX and data model. Source reviewed 2026-10-23: [SmartNPV API documentation](https://api.snpv.co.il/). Verify current provider endpoint contracts, product availability and commercial permissions before any integration.

### Product principles and dependencies

- Treat the core mortgage schedule and verified source data as the calculation source of truth. Recommendations, graphs, reports, emails and AI answers must use that same data and must not create their own mortgage calculations.
- Build in layers. Secure persistence and role boundaries come before exposing mortgage, pension, insurance or client data in additional screens. Calculation-backed recommendations come after the relevant calculation phases. Do not let CRM polish delay core calculation and compare lifecycle work.
- Keep one primary domain with distinct public, consumer, professional and shop experiences. Follow the route/layout and module-boundary decisions in "One website, separate experiences"; do not collapse them into one UI or create separate deployments by default.
- At Step 0, inspect the actual repository and decide which existing user/profile/database/auth features already exist. Reuse Better Auth, current MongoDB models, mail delivery configuration and existing UI patterns where present. Do not create a second auth system or database layer by default.
- Treat the global CSS refactor as a separate staged engineering task. Inventory selectors and import order first, preserve the cascade during extraction, and gradually scope feature-owned styles with CSS Modules where practical. The stylesheet's line count is a maintainability signal, not proof that runtime performance is poor.
- Separate a consumer's personal financial workspace from an advisor's workspace. An advisor may see a consumer's records only through explicit, revocable authorization or a valid case/team assignment. Organization membership does not automatically grant unrestricted access to every client.
- Use least-privilege server-side authorization for every read, update, export, upload, download, sharing action and notification. Hiding controls in the UI is not access control. Audit sensitive access and sharing actions.
- Distinguish manually entered, OCR-extracted, official-source and estimated data. Store source, as-of date, last-verified date and unknown status where relevant. Never invent missing balances, pension values, rates or insurance data.
- Treat suggestions as explainable scenarios, not guaranteed outcomes or individualized professional advice. Show inputs, assumptions, risks and data coverage. Do not automatically change a user's real records or submit information to a third party without explicit confirmation.
- Persistently track each implementation step using the existing checklist and resume protocol. Add a completion note only after acceptance criteria and tests pass.

### Consumer account, roles and MongoDB persistence

Create or extend account capabilities after inspecting the actual project. Keep the current auth stack unless the audit proves it cannot support the required role and session model.

Minimum access concepts:
- **Consumer:** manages their own profile, household financial records, saved mixes/comparisons, documents, reminders, notifications and sharing permissions.
- **Advisor:** views and manages only clients/cases assigned to them or explicitly shared, subject to permissions.
- **Organization admin:** manages team membership, permitted case assignments and organization-level reports, but cannot bypass case-sharing and audit rules.
- **Platform admin:** add only if a real operational need exists. Keep platform administration separate from customer organization roles.

Define final role names and policies after checking existing models. Persist profile data, mortgage/loan/pension/insurance records, tasks/reminders, CRM case metadata, document metadata and notification preferences through the existing MongoDB data layer. Store uploaded file bytes in the repository's supported secure file/object storage when appropriate, with MongoDB retaining the metadata and authorization links, rather than assuming large binaries belong in a document record. Add indexes for ownership, organization/case lookups and due dates where justified.

Enforce owner, organization and share boundaries in server/database operations. Never trust a user ID, advisor ID, organization ID or role supplied by a client request. Use schema validation, safe migrations, audit records for sensitive changes, data minimization, secure file access and predictable deletion/export behavior. Avoid logging full financial profiles, identity numbers, documents, credentials or secrets.

### Personal financial profile and dashboard

Allow the user to save and maintain a private view of the household finances they choose to provide:
- Current mortgage and tracks, remaining balance, estimated remaining term, next variable-rate reset, linkage type, payment, rate and last verification date.
- Other loans and recurring debt obligations, with balances, rates, payments, maturity and optional payoff information.
- Pension and retirement-savings details, with provider/product, reported balance, contribution fields where appropriate, investment track, fees, report date and source. Do not assume a live pension-provider connection exists. Begin with reviewed manual entry/import unless a supported integration is confirmed.
- Insurance details, especially mortgage life insurance and property/structure insurance, including provider, premium, coverage, renewal date and documents. Keep insurance records distinct from mortgage cash flows unless a calculation explicitly includes the premium.
- Property value/equity and household income/expenses only where the user elects to store them.

Dashboard summary should surface known liabilities, monthly debt payments, mortgage balance/remaining term, insurance renewal dates and the date each figure was last confirmed. Label estimates, stale data and missing details clearly. Do not present pension balances as guaranteed future income or estimate retirement benefits from incomplete inputs.

Acceptance criteria: a signed-in user can create, edit, review, export where supported, and delete their own records; another user cannot access them; data survives reload; timestamps/source labels display correctly; unsupported integrations are not implied; and legacy user accounts still work.

#### Suggested persistence boundaries

Adapt this conceptual model to the application's existing MongoDB collections and naming conventions. It is a design guide, not an instruction to create duplicate collections if equivalent records already exist.
- `User` and existing Better Auth records remain the identity source. Keep roles/memberships and profile data separate where that fits the existing adapter.
- `FinancialProfile` stores user-selected goals/preferences and links to personal `MortgageRecord`, `LoanRecord`, `PensionSnapshot` and `InsurancePolicy` records. Financial records carry owner, source/as-of metadata and created/updated timestamps.
- `SavedMix` and `SavedComparison` keep their existing persistence contracts, including the independent comparison snapshot requirements above.
- `AdvisorOrganization`, `OrganizationMembership`, `ClientCase` and `CaseShare` represent team scope, assignments and explicit sharing. `CaseNote` keeps author/time metadata and belongs to a case.
- `WorkflowTask` and `Reminder` link to a case/client, owner, due time, state, channel preference and delivery status. `NotificationSubscription` stores opt-in, watched source, thresholds, locale and unsubscribe state.
- `DocumentMetadata` and `DocumentRequirement` store secure file references, case/owner, type, status, source/version, review and retention metadata. Do not store a public raw file URL as an authorization mechanism.
- `Partner` and `ReferralEvent` store provider categories, disclosure/consent status and referral history. `FeedbackSurvey` and `FeedbackResponse` retain their own access and retention policies.

All records must have a documented ownership and deletion/retention policy. Prefer references to canonical source records over duplicated values. Use immutable snapshots only where reproducibility requires them, such as saved comparisons or approved exports.

### Goal-based mortgage recommendations: home to live in vs investment property

At the start of a recommendation flow, explicitly ask for the property purpose:
- **Owner-occupied home:** prioritize sustainable affordability, payment resilience, total financing cost, rate/indexation exposure, flexibility and desired payoff horizon. Where affordable, compare a shorter-term option with a lower-payment option and show the extra monthly burden versus interest/time saved. Do not recommend the shortest term regardless of affordability or emergency reserves.
- **Investment/rental property:** collect expected monthly rent, expected vacancy, recurring property/management/maintenance costs, insurance, optional user-entered tax/other costs, available equity, financing details and the investor's cash-flow/risk goal. Model a 30-year mortgage as one possible scenario, not a mandatory recommendation. Compare shorter and longer terms on a common horizon and show effects on monthly cash flow, lifetime cost, equity and remaining balance.

For rental properties, calculate and explain at least:
- Gross rent minus mortgage payment as a simple first view.
- Estimated net monthly property cash flow after user-entered recurring expenses, insurance and vacancy allowance.
- Rent coverage of the mortgage payment, with numerator and included/excluded expenses clearly labelled.
- Stress scenarios such as lower rent, vacancy, higher expenses and future payment increases when the forecast engine can represent them.
- Break-even and remaining debt/equity on a common horizon.

Do not claim a rental property is profitable merely because gross rent exceeds the mortgage payment. Taxes, vacancy, repairs, insurance, transaction costs and terminal debt can change the result. If key inputs are missing, show a partial analysis with an explicit list of missing assumptions rather than a confident recommendation.

For an owner-occupied property, do not optimize only for lowest lifetime interest. Show payment volatility, CPI exposure, affordability, liquidity needs and flexibility alongside total cost. Recommendations must be generated from scenarios computed by the shared engine, not from a single hard-coded rule.

Acceptance criteria: the interface captures purpose and constraints; produces reproducible alternatives; every recommended metric links to inputs and assumptions; identical inputs return identical results; missing assumptions and stress cases are visible; and the user can save alternatives as independent mixes or comparisons.

### Mix and track explanations, amortization-method choice and what to repay first

Provide a plain-language explanation for every mix and track. Each explanation should identify the structure, expected payment path, nominal interest assumptions, CPI/indexation exposure, reset risk, grace period, term, expected total repayment and main trade-offs. State whether figures are forecast-based or verified current data. Do not guarantee that one mix is best for every borrower.

Explain schedule methods:
- **Spitzer:** generally offers a more level scheduled payment while rate and assumptions remain unchanged.
- **Equal principal (קרן שווה):** repays a more uniform amount of principal, so payments generally start higher and decline as interest falls. At the same rate and term, it commonly pays less interest than Spitzer because more principal is repaid earlier, but CPI, changing rates, fees and contract rules must be simulated rather than approximated.
- **Balloon and grace:** explicitly explain that a balloon leaves a maturity balance due, while grace is a separate period followed by amortization within the original term. Do not conflate them.

When asked which track to close first, generate a payoff-priority analysis from supported payoff scenarios. Compare interest avoided, CPI/indexation avoided, expected future reset risk, remaining term/balance, verified early repayment fees, monthly payment changes, cash reserves and the user's alternative use of cash. Rank only supported cases and show assumptions and trade-offs. Do not automatically recommend the highest nominal-rate track, or claim a definitive ranking if its statutory fee cannot be calculated reliably. Keep fee-dependent recommendations gated until the existing prepayment-fee phase is complete.

Acceptance criteria: explanations reconcile to outputs; the user can see why each option is ranked; method choice is simulated per track rather than assigned by a blanket rule; payoff recommendations include verified fees and common-horizon comparisons where supported; unsupported cases say that verified data is insufficient rather than inventing precision.

### Advisor panel and CRM workspace

Expand the existing deal overview and case-note foundation into an advisor workspace, reusing current persistence and UI patterns. A case should support client profile/contact details, household/deal summary, property and mortgage details, saved mixes/comparisons, reviewed offers and documents; configurable pipeline stages, stage history, owner/assignee, next action, follow-up date and dated notes; and tasks/reminders linked to the client, case or document.

Add a quick-action area for frequently used bank portals and official forms. Use an allowlisted, admin-maintained link registry with labels and checked URLs. Do not imply an external bank action completed merely because a link was opened. Provide client/business reports such as cases by stage, upcoming deadlines and task backlog only when metrics are available from stored data.

Support sharing a client/case between authorized advisors with explicit share/unshare actions, role/organization checks, visible collaborators and audit trail. Do not duplicate mortgage or comparison data into competing CRM-only records. Store references to canonical records and preserve independent snapshots only where the saved-comparison requirement calls for them. Define assignment transfer, revocation, archival and deletion. Add pagination and search for larger lists.

Acceptance criteria: access is limited by owner/team/share permission; task and stage history persists; reminder sends do not duplicate; case records survive reload; reassignment/revocation takes effect immediately; reports agree with source records.

### Digital documents, document checklist and customer portal

Build a document center with clear separation between:
- Private case documents and reviewed bank statements.
- A configurable checklist of documents required for a case, with required/optional status, requested/received/needs-correction/verified state, owner, due date and reviewer note.
- A digital document/reference library containing only official, licensed or otherwise authorized material. Store source, publication/effective date, version, locale and review/expiry status. Do not scrape or copy SmartNPV's document library.
- A client portal where clients can securely view requests, upload documents and see case status under specifically granted permissions. Share links must be revocable, scoped, expiring where appropriate and protected against enumeration.
- A bank-letter generator that fills an editable template from known client/deal data, flags missing fields and requires advisor approval before export/sending.
- Bank submission only where a supported and authorized integration exists. Otherwise prepare a download package/checklist and link to the bank's official channel. Never claim a bank received or approved an application without verified acknowledgement.

OCR-extracted figures remain untrusted candidates until a reviewer accepts them. Keep the original file, extraction uncertainty/confidence and source page/field where practical, plus reviewer approval history. Upload validation, private storage, size/type limits, malware scanning where available, retention rules, access logging and secure deletion are required before production use.

Acceptance criteria: checklist and files are case-linked; client/advisor permissions are tested; document changes are auditable; bank letters have a preview/approval path; uploads are never public by default; unsupported bank submission is clearly distinguished from a completed submission.

### Professional partners, affiliates and insurance

Add a service-provider directory next to the relevant client-service workflow. Configurable categories may include real-estate lawyers, mortgage/lending lawyers, realtors, mortgage/structure/life insurance agents, appraisers, accountants/tax professionals, pension/retirement professionals and other approved providers.

Support internal notes, contact details, service region/specialty, enabled state, referral tracking and optional affiliate terms. Clearly disclose when Makeyev Finance or an advisor may receive a referral fee or other benefit. The user must be able to decline a referral. Do not rank partners as objectively best based on payment or commission, and do not share client contact or financial data until the client explicitly consents to the specific sharing.

Insurance should initially support records, coverage/premium reminders and optional referrals. A future comparison feature must use current, comparable policy data and display exclusions, cover limits, fees and source/as-of timestamps. Do not present generic insurance information as an individualized coverage recommendation or assume a policy is suitable because it is affiliated.

Acceptance criteria: referral source and disclosures are visible; consent is recorded and revocable where applicable; only necessary data is shared; partner records are permission-controlled; commissions cannot silently influence financial recommendations.

### Email subscriptions and rate-change alerts

Support opt-in email alerts in two distinct categories:
1. **Public/reference rate updates:** alerts when a watched official benchmark or published dataset actually changes.
2. **Personal mortgage alerts:** reminders about a saved mortgage's known reset date, a manually updated offer, an expiring rate commitment, or a recalculation triggered by a relevant verified rate change when supported by the model.

For each subscription, store the watched source/rate/track, threshold if used, frequency/digest preference, locale, consent timestamp and unsubscribe state. Identify old and new values, percentage-point change, source, as-of/effective date, and whether a value is official or merely indicative. Do not describe a benchmark change as an automatic change to the bank's offer or a borrower's contractual rate.

Implement idempotent scheduled checks or webhooks only after verifying the source update mechanism. Deduplicate alerts, record send status and failures, retry safely, prevent repeated notifications for the same published change, and provide one-click unsubscribe/preferences. Email contents must not expose sensitive loan/pension data by default. Reuse the existing mail provider after auditing it, and keep credentials server-side.

Acceptance criteria: opt-in/out works; one source update produces at most the intended alert; stale/unavailable sources do not generate false alerts; source and dates are present; failures are observable/retryable; unsubscribe suppresses future sends.

### Customer feedback and business analytics

Allow an advisor or organization to create a short feedback survey linked to a client/case and workflow milestone. Support configurable questions, completion status, optional anonymous/attributed responses and clear purpose/consent. Report response rates and aggregated trends. Do not expose one client's response to unrelated advisors or treat a small sample as representative. Retain feedback under a documented policy.

Business reports should include only metrics calculable from trusted data, such as case stages, overdue tasks, processing times, reminder completion, mix/comparison activity and survey outcomes. Define each metric and denominator. Restrict organization-wide reports to authorized roles, minimize personal information, and ensure exports apply the same access rules as on-screen data.

Acceptance criteria: survey permissions, localization, aggregation rules and retention are tested; reports reconcile to source records; exports do not bypass authorization.

### API and external integrations

Design a versioned server-side API only after the core data model and authorization policy stabilize. Initial integrations may create/update leads and clients and retrieve authorized case/simulation summaries or workflow status. Add webhooks only when an event contract, signature validation and retry strategy are defined.

API keys/tokens must never be embedded in the browser bundle. Secrets are stored server-side. Keys need scopes, rotation/revocation and rate limits; endpoints validate payloads and enforce the same owner/team permissions as the UI; logs redact financial/personal values; and create/update operations use idempotency where retries could duplicate records. Document versioning, errors, permissions and limits. Integrate with SmartNPV or any bank/provider only if there is a clear product need, valid authorization and a supported contract. Do not use sample credentials or build to undocumented endpoints.

Acceptance criteria: documented API contract and permission tests exist; secrets remain private; repeated requests behave safely; errors are stable; all data access is auditable.

### Optional AI assistant

AI chat is a later, optional layer, not a prerequisite. Start with a read-only assistant that explains an existing mortgage, saved mix, chart or comparison using the exact records and assumptions selected by the user. It may summarize verified data and propose scenarios for review, but it must not invent rates/balances, guarantee savings, autonomously change a profile, send email, share documents or submit to a bank.

Every calculation-based answer should identify the saved record/scenario and as-of data used, state important assumptions, and link to the detailed calculation. If data is missing or unsupported, say so. If the assistant proposes an alternative mix, run the shared calculation engine and save it only after explicit user action. Enforce the same authorization boundaries as the rest of the application; never expose another user's records. Minimize third-party data transfer, exclude sensitive records by default and obtain explicit consent before processing sensitive financial documents. Treat document text as untrusted input rather than instructions. Provide a way to report incorrect answers and test against known calculations.

Acceptance criteria: access is scoped to authorized data; grounded answers identify selected records/assumptions; calculations are reproducible; no external action occurs without confirmation; privacy, prompt-injection and unsupported-answer tests pass.

### Source and scope notes

- User-provided feature descriptions are the source for the requested digital documents, feedback, overview, customer documents, bank letter, checklist, case notes, bank submission, client portal, business reports, workflow automation/reminders, advisor collaboration and API ideas.
- The public [SmartNPV API documentation](https://api.snpv.co.il/) is a reference for categories such as clients, status/workflow, documents, reminders, products and simulations. Confirm current endpoint contracts and commercial permissions before integration.
- These are product goals, not claims that SmartNPV's current service or Makeyev Finance's repository implements every feature. Build original components and wording; do not copy proprietary UI or content.

## Required feature: protect unsaved compare changes

When the user tries to leave the compare page while compare inputs have unsaved changes, show a confirmation modal consistent with the existing calculator's unsaved-changes experience. Inspect and reuse the actual calculator modal/component and navigation guard rather than creating a visually or behaviorally different mechanism.

### Dirty-state behavior

- Establish a canonical persisted-input baseline. Loading a saved comparison sets the baseline to that saved snapshot. A new comparison that already contains meaningful scenarios but has never been saved is unsaved and must be treated as dirty from initialization; a truly empty, untouched compare editor may remain clean until data is entered. Reset the baseline only after a successful save or successful load.
- Mark the comparison dirty when the user changes persisted comparison data, including scenario names, scenario count, scenario order, loan tracks, amounts, rates, terms, grace settings, approval dates that belong to the compare scenario, forecast assumptions, early-repayment settings, baseline selection, or other saved comparison options that actually exist in the application.
- Do not mark it dirty for transient presentation state such as a tooltip being open, hover, chart animation, or a tab change unless the project already saves that preference as comparison data.
- If the comparison matches its persisted baseline, navigate away without showing a prompt. A populated new comparison with no saved comparison ID has no persisted baseline and must prompt before its data is abandoned, even if the user has not edited it since opening compare. A blank, untouched compare editor should not prompt.
- Intercept internal app navigation using the app's established navigation mechanism. When the user attempts to reload or close the browser tab, use the native `beforeunload` warning if supported. Browsers do not permit a custom app modal for tab close, reload, or navigation outside the app, so do not promise one there.

### Modal actions

Provide three safe actions, with wording consistent with the calculator:

- **Save changes:** Save the current comparison. If this is a new, not-yet-saved comparison, create a saved comparison and request or confirm its title using the existing naming UX. Navigate only after persistence succeeds.
- **Discard changes:** Drop the unsaved changes and continue to the requested destination. Do not mutate a previously saved snapshot.
- **Stay on page:** Close the modal and keep all current edits intact.

If saving fails, show the normal error state, keep the user on the compare page, keep the edits intact, and do not continue navigation. Prevent duplicate submissions and duplicate prompts. A failed save must never clear the dirty state. After a successful save, reset the baseline to the saved snapshot. When discarding a previously saved comparison, restore that last persisted snapshot in the store before navigating; when discarding a new unsaved comparison, clear/dispose its draft so it cannot reappear when the user returns.

The guard must cover app navigation actions and the browser back/forward path where the routing framework allows interception. Add the native browser warning for true page unloads. Do not create an unsafe navigation loop or break the calculator's current modal behavior.

## Required feature: save comparison details in the profile

Add a **Saved comparisons** section to the user's profile using the existing saved-mixes UX and persistence conventions. A saved comparison contains up to four scenarios and must reopen as the same editable comparison, not merely as a screenshot or flattened results table.

### Persistence and data model

- Inspect the existing saved-mix model, server validation, API/actions, database conventions, and Better Auth session usage first. Extend the existing patterns rather than adding a separate auth or database stack.
- Store a stable comparison ID, authenticated owner, title, schema version, creation/update timestamps, scenario order, selected baseline (if applicable), and the complete supported editable inputs for every scenario. Include all calculation-relevant inputs needed to recreate the result, including rates/anchors/margins, track type, schedule type, principal, term, CPI assumptions, reset assumptions, grace and repayment settings when implemented, plus per-scenario approval-date inputs where present.
- Persist the input snapshot, not only derived totals or rendered chart points. Recalculate outputs through the same shared calculation engine after load. If result caching is retained for performance, treat it as disposable and validate it against the inputs/schema version.
- Save an independent snapshot. Editing/deleting a source saved mix later must not silently alter or invalidate a saved comparison. Source-mix IDs may be optional provenance only; never rely on them as the only stored scenario representation.
- Add schema validation and explicit versioned migrations for older records. Reject invalid, non-finite, oversized, or unsupported data rather than silently dropping values. If a record uses a newer schema the app cannot read, explain that it cannot be opened safely and preserve the original record; do not downgrade or overwrite it. Do not trust a client-supplied owner ID; derive ownership from the authenticated server session and enforce ownership on every read, update, and delete operation.
- Persist only data needed to reproduce the compare. Do not persist ephemeral UI state unless there is a clear existing convention for doing so.

### Profile and comparison actions

- List saved comparisons with title, updated date, scenario count, and a useful compact summary, following the saved-mix profile design.
- Open/load a saved comparison and restore all editable values, scenario order, and selected baseline.
- Rename, duplicate, and delete a saved comparison. Confirm destructive deletion, and keep deleting a comparison separate from deleting any saved mix.
- Allow saving a new comparison and saving changes back to the current comparison. Make **Save as new** available when it is useful to preserve a variant without overwriting the current snapshot.
- Show loading, empty, success, and error states. Do not display a saved-success state until the server confirms persistence.
- A loaded comparison becomes the clean baseline. Editing it makes it dirty. Saving updates the baseline. Duplicating creates a new identity and timestamp while preserving the scenario data. A populated unsaved comparison is dirty until its first successful save; an empty untouched editor can remain clean.
- Keep the maximum at four scenarios, and verify each stored comparison is still valid when loaded after a schema change.

### Acceptance criteria

- Leaving a dirty compare opens the modal; leaving a clean compare does not.
- Save succeeds and navigates only after the server confirms success. Save failure retains every edit and keeps the page open.
- Discard abandons only the unsaved draft. Stay preserves it.
- New and existing comparisons can be saved, listed in the profile, reopened, renamed, duplicated, and deleted.
- Saving/loading preserves scenario inputs, order, selected baseline, and calculation-relevant assumptions. Results after reload reconcile to the shared schedule.
- Editing or deleting an original saved mix does not change a previously saved comparison snapshot.
- Cross-user reads/updates/deletes are denied by server-side ownership checks.
- The feature is tested for Hebrew RTL and English LTR, light and dark themes, keyboard/accessibility behavior, error states, browser navigation, and a narrow viewport around 360px.
- Saved mixes, existing routes, calculator save behavior, and financial golden tests remain intact.

## Notes on statuses and correctness

- The source notes claim that the Bank of Israel average-rate tables and the first rate-validity slice are already shipped. Verify this in the live repository and preserve it if present.
- The approval date is described in the supplied notes as session-only for saved mixes. The new saved-comparison snapshot should preserve the date as part of that comparison's own scenario so reopening a saved comparison recreates its prior state. This does not automatically require changing the separate saved-mix schema.
- Early-repayment event simulation and statutory fees are separate. A payoff simulation without a verified applicable statutory fee must remain internal/test-only or explicitly marked incomplete.
- Monthly CPI indexation is a balance movement, not a separate cash payment. Any chart claiming payment composition must follow the reconciled components defined below.
- SmartNPV is a product reference for capabilities, not a source for copying its UI or wording. Build original UI and copy.

---


## Validation audit and corrections (reviewed 2026-10-23)

### Scope and confidence

This is a review of the written master plan plus checks against current public Bank of Israel pages. It is **not** a source-code audit: the repository itself was not provided in this review. File paths, shipped-status claims, test counts, APIs, current calculation behavior, and schema descriptions below remain assertions from the supplied October 20, 2026 archive notes until Step 0 verifies them against the actual repository.

The corrections in this section and the calculation specification below override conflicting statements in the retained tutorial notes. Tutorial-derived details are useful feature discovery, not proof of a current legal rule or the reference product's exact internal formula.

### Findings that are supported by current official sources

- **Approval-in-principle validity:** The Bank of Israel says the approval in principle is valid for 24 days from issue, subject to the customer information being correct and policy-rate changes affecting the prime component as specified. Do not repeat the unsupported additional claim that the document itself has a separate validity of approximately three months. Source: [Bank of Israel mortgage-transparency reform](https://www.boi.org.il/en/information-and-service-to-the-public/banking-customer-service-information/financial-education/the-reform-to-increase-information-transparency-and-competition-in-mortgages/).
- **Prime rate:** Prime is the Bank of Israel policy rate plus 1.5 percentage points. The model must still represent when the policy rate changes and how the contractual prime margin applies. Source: [Bank of Israel mortgage-transparency reform](https://www.boi.org.il/en/information-and-service-to-the-public/banking-customer-service-information/financial-education/the-reform-to-increase-information-transparency-and-competition-in-mortgages/).
- **Bank of Israel average mortgage rates:** The published mortgage average rates are effective annual rates, published monthly, with separate indexed and non-indexed tables and an applicability period. They are not a universal current bank offer. Any use in discounting or statutory fee calculations must preserve the rate basis, linkage class, remaining-term bucket and effective date. Source: [Bank of Israel average mortgage rates](https://www.boi.org.il/information/interestrates/mortgage).
- **Payment-to-income (PTI):** The Bank of Israel consumer guidance describes PTI above 40% as high-risk. It does not support treating 40% as a universal hard validation limit for every application. The product must implement the currently applicable regulatory definition and display a high-risk warning where appropriate. Source: [Bank of Israel mortgage-transparency reform](https://www.boi.org.il/en/information-and-service-to-the-public/banking-customer-service-information/financial-education/the-reform-to-increase-information-transparency-and-competition-in-mortgages/).
- **Early-repayment fees:** Bank of Israel publishes mortgage rate tables specifically for the fee calculation and identifies the rates as effective annual. Circular 2103 is a source for the formula, but must be checked together with the currently applicable Banking Order and subsequent amendments. Do not implement the simplified `min(original rate, average rate at origination)` rule or the tutorial's age-based discount tiers as a universal legal formula. Sources: [BOI mortgage average rates](https://www.boi.org.il/information/interestrates/mortgage) and [BOI Circular 2103](https://www.boi.org.il/roles/supervisionregulation/circulars/cir2103/).
- **Capital risk-weight claims:** The tutorial's 35% / 50% / 60% capital-allocation figures and the asserted 100% treatment for selected borrowers are not approved current rules for this application. An older official BOI publication described a 35% / 50% / 75% risk-weight framework, illustrating that the supplied 60% figure is not safe to hard-code. Verify the current operative directives, separate regulatory risk weights from bank pricing, and do not map a risk weight directly to an interest-rate increase without a documented, calibrated pricing model. Historical reference: [BOI guidance on housing-credit risk weights](https://www.boi.org.il/en/communication-and-publications/press-releases/draft-guidelines-on-credit-for-housing-and-real-estate/).

### Calculation and product corrections required by this review

1. **The imported equation block was corrupted by formatting.** It has been rewritten below as readable formulas. Never implement from the broken fragments that appeared in the pasted source.
2. **Rate bases must be explicit.** `annualRate / 12` is a nominal-annual-rate convention, not a universal conversion. For an effective annual rate, the equivalent monthly rate is `(1 + annualEffectiveRate)^(1/12) - 1`. Bank of Israel average mortgage rates are effective annual rates. Do not feed them into a nominal-rate formula without conversion where conversion is required.
3. **Annual CPI must not accidentally be applied as a full annual rate every month.** If the simulation uses an annual-effective CPI assumption as an approximation, convert it to a monthly-effective rate with `(1 + annualCpi)^(1/12) - 1`. For a more faithful Israeli mortgage model, use the appropriate published CPI index levels, base index and contractual publication/indexation lag. Preserve the current month-one behavior only as a verified compatibility rule, not as an assumption about every real mortgage contract.
4. **Payment composition is valid only under its stated field definitions.** The three-way chart identity is `netPrincipal + indexation + interestPaid = scheduledPayment` for the existing no-capitalized-interest model. Once grace, capitalization, extra payments or staged draws exist, track accrued interest, interest paid, capitalized interest, cash principal repayment, indexation, draw events, fees and payoff events separately. Do not reuse the old identity blindly.
5. **Return per shekel is not a time-value-of-money metric.** `sum(all scheduled cash payments) / amount borrowed` is an undiscounted nominal repayment ratio. It does not discount early versus late payments. Keep it separately named from NPV, IRR and duration.
6. **NPV and duration need a consistent time basis.** For monthly cash flows and an effective annual zero-coupon yield `y_t`, use a discount factor consistent with `t / 12` years, e.g. `(1 + y_t)^(t/12)`, or use exact dates/day-count conventions when available. Do not exponentiate an annual yield by the number of months.
7. **A lower lifetime payment total does not automatically mean refinancing is better.** Use a common comparison horizon. If either loan has a remaining balance at that horizon, include the terminal debt position or an appropriately defined payoff value. Show cash-flow break-even separately from economic/NPV break-even. Account for fees paid in cash versus capitalized into principal exactly once.
8. **PTI is not automatically the first post-grace payment divided by income.** Keep first payment and representative/planning payment as distinct outputs. Calculate regulatory PTI from the current applicable legal definition and required payment measure, which may differ from both.
9. **Rate-reset behavior is track-specific.** Prime follows changes in the policy/prime path subject to the contract. Other variable tracks update at their contractual reset dates. Fixed tracks do not reset. Do not force every track through one generic periodic reset rule.
10. **Mortgage-linked CPI is not just an arbitrary monthly percentage.** The detailed model should document the CPI series, base index, publication lag, index ratio, floors/negative-index treatment where relevant, and which event date applies. A monthly percentage forecast is acceptable as a transparent scenario simplification but must not be described as a bank-accurate payoff statement.
11. **OCR can reduce manual entry but cannot eliminate errors.** Extracted data must be shown for human review, with source-page/field confidence where practical. Missing values remain unknown; never silently guess them.
12. **Automatic rate suggestions are estimates unless a verified bank-specific offer is loaded.** Distinguish official public data, derived curves, internal pricing heuristics and a bank's actual offer. Show source and as-of date, stale/unavailable states, and model assumptions.
13. **Risk-weight and LTV data are different concepts.** Do not place capital risk weights in a generic pricing dropdown or infer loan eligibility from them. Every regulatory value needs a current source, effective date and test fixture.
14. **Legacy calculations should be preserved only if verified as correct.** Golden tests protect against accidental change, but a confirmed financial bug requires an explicitly reviewed correction and updated golden fixtures, not indefinite preservation of the bug.

### Reference status labels

Use these labels when reviewing the plan or implementation:

- **Verified externally:** Supported by an official source linked above, for the scope stated.
- **Source-derived:** Described in the supplied SmartNPV tutorial summary, not independently established as a legal or technical specification.
- **Repository-claimed:** Described as shipped or missing in the October 20, 2026 archive notes; must be checked in source code during Step 0.
- **Requires official verification:** Do not ship as a complete legal/regulatory calculation until the current official rule and worked examples are documented.

## Supplied reference brief and detailed implementation requirements
The following normalizes the original SmartNPV tutorial analysis, architecture sketch, data-model idea, formulas, chart list and advisor workflow into readable form. The tutorial is a product-capability reference. It is not a legal specification, and it does not override the validation corrections above or the phased implementation plan below.

### Product and workflow capability inventory

#### 1. Mix construction and setup (video: 00:03-05:18)

- Give each mortgage mix a descriptive name, optionally including bank, date or strategy (video 00:18).
- Allocate the requested loan amount across tracks either by exact ILS amounts or percentages (video 00:40). The tutorial's example uses a 33% allocation. Show unallocated or over-allocated amounts clearly and validate that percentages/amounts reconcile to the intended total.
- Track setup includes repayment schedule, track/rate type, principal amount, percentage of total, term in months, contractual anchor/margin where applicable, and reset frequency for eligible variable tracks (video 01:36; example reset periods are 12, 36 or 60 months).
- Referenced track families include fixed unindexed (קל"צ), fixed CPI-linked (ק"צ), variable unindexed (מל"צ), variable CPI-linked (מ"צ), prime, and Ministry eligibility loans.
- Referenced schedules include Spitzer, equal principal, partial balloon and full balloon, plus bank-specific variants. Implement a bank-specific schedule only when its mechanics have been documented and tested.
- The tutorial demonstrates scanning an in-principle approval PDF to prefill bank, tracks, amounts, terms, anchors and rates (video 02:12). OCR reduces manual work but must not be claimed to eliminate input errors; the user reviews extracted fields before accepting them.
- The Ministry of Housing eligibility flow takes applicable borrower/eligibility details, including the source-mentioned points, marital status, children, years married and location (video 03:39), and uses verified official rules or an official eligibility source. It may populate an eligibility track only after review.
- The reference product uses explicit saving and a support-ticket modal (video 04:28). Keep unsaved changes visible and protect navigation. A support-ticket workflow may allow the user to attach/share a case only after explicit consent.

#### 2. Rates, anchors, margins, grace and payment summaries (video: 05:18-14:45)

- When a track is created, an indicative rate may be suggested from validated current data and a documented model (video 05:20). The tutorial claims BOI published averages may lag the current market by about two months and contrasts them with daily estimates; treat this as a tutorial claim, not a fixed latency fact. Do not claim real-time bank rates unless the data source and refresh cadence substantiate that claim. Public BOI averages are reference data, not a bank's guaranteed quote.
- The tutorial cites LTV buckets up to 45%, 45%-60% and above 60%, with claimed capital weights of 35%, 50% and 60%, and says some large (over ILS 5 million), high-debt-to-income or all-purpose/pledge loans can receive a 100% weight (video 06:55). These figures are **unverified and must not be implemented as current rules or direct rate multipliers**; see the audit above.
- An anchor is the benchmark defined by the relevant track/contract; a margin is the contractual addition or subtraction (video 09:00). A user can negotiate the bank margin, but should not be allowed to rewrite a market anchor as if it were negotiable. The available anchor and reset rule depend on the actual track.
- An anchor-refresh action may sync the selected bank/product's published anchor (video 10:08), displaying its source and as-of date. Missing or stale data must be explicit.
- Partial grace means scheduled interest payments without scheduled principal amortization, subject to contract-specific indexation. Full grace means no scheduled payment and accrued unpaid interest is capitalized if that is the contract assumption (video 11:25). Grace remains separate from a balloon schedule.
- Show the first actual scheduled payment separately from a representative/planning payment (video 13:46). Do not treat the post-grace payment alone as regulatory PTI unless the applicable current rule says to do so.

#### 3. Staged releases and early repayment (video: 14:45-30:14)

- Staged releases support construction and phased-purchase scenarios (video 14:45). The video demonstrates milestones such as 1, 5 and 8 months, either a uniform percentage (example: 20% per milestone) or manually entered amounts per track. Interest and CPI apply only from the applicable draw date under the selected date/day-count convention. The tutorial describes a safety lock while staged release is active (video 18:38); implement it only with a clear exit/recovery path and prevent inconsistent partial state.
- Support a full mix payoff, full track payoff and partial extra-principal payment at a selected event time (video 19:15). The plan's default monthly convention places the event after that month's scheduled payment and must say so in the UI.
- Partial prepayment has two common modes (video 20:07): shorten the remaining term while keeping the payment basis as constant as the contract permits, or keep the original maturity and recalculate the payment. For CPI-linked or variable-rate tracks, do not promise a constant nominal ILS payment if CPI or the rate can change.
- A regulatory prepayment-fee tool may include an interest-differential/discounting component and other applicable fee components, discounts or exemptions (video 22:51). The tutorial's simplified condition and its suggested age bands (no discount in years 1-3, 20% in years 3-5 and 30% after year 5) are not a formula to implement. Verify the current order, amendments, supported loan type and official examples before public release.
- A hypothetical rate-drop stress test (video 26:30; examples: 0.5, 1 or 2 percentage points, or a labeled historical-minimum scenario) must be labeled as a scenario assumption. A penalty trajectory (video 27:10) is recalculated for each date/rate scenario and is not guaranteed to decrease monotonically.
- An effective-rate surcharge may be considered only after a complete fee calculation is verified; define exactly what cash flows and fee treatment it compares. The tutorial's proposed calculation is `annualized IRR with the verified fee capitalized - base annualized IRR`; validate the fee capitalization, IRR basis, and comparison scenario before using or labeling this derived metric.

#### 4. Financial data, forecasts and advisor metrics (video: 30:14-48:19)

- The proposed financial repository includes historical Bank of Israel rates, CPI and construction-cost indices, and nominal/real government zero-coupon curves (video 29:18). Each dataset needs source, as-of date, availability/staleness status, validation and a safe fallback.
- Scenario forecasts can contain up to 360 monthly CPI assumptions, policy/prime rates and variable-rate anchors. The tutorial describes BOI research forecasts (video 31:40) and custom forecasts with autocomplete/interpolation (video 38:39). User-entered milestones may be filled using deterministic interpolation. A curve inferred from market prices is an implied market scenario, not an authoritative prediction of future CPI or policy rates.
- The effective loan IRR (שת"פ) is calculated from borrower cash flows, including the actual schedule, indexation and rate changes represented by the scenario (video 30:31). The source gives an illustrative 2.7% initial-rate scenario that could have a higher projected IRR than prime after forecast changes; that example is illustrative, not a verified result. Its nominal/real interpretation and fee treatment must be stated.
- Return per shekel is the undiscounted lifetime scheduled payments divided by the initial amount borrowed. It is useful for nominal-total comparison, but does not encode timing or present value. The tutorial gives example values of 1.60 versus 1.83 and claims a time/duration element; that claim conflicts with the supplied ratio formula. Preserve the values only as illustrative source examples. Before implementing this metric, either keep the plain undiscounted ratio or define a separate, explicitly named time-value metric with its own tested formula.
- An app-defined market-spread metric may compare a track's rate with a matched nominal or real government zero-coupon benchmark at a compatible duration (video 33:46 and 41:50). The source proposes `trackSpread_i = compatibleTrackRate_i - matchedCurveYield_i`, then `mixSpread = sum(w_i * trackSpread_i)` using `w_i = trackPrincipal_i / totalPrincipal`. Treat that weighting as a source-proposed convention, not a proven standard. Before implementation, confirm the annualization/compounding and nominal-versus-real basis, define whether weights use original principal or current outstanding balance, document curve interpolation and duration, and test the result. It is not the same as the bank's contractual margin and is not a regulated universal measure.
- PTI is shown in the source video around 47:45 and requires its own source-verified rule and relevant payment measure. The BOI consumer page characterizes PTI over 40% as high-risk; do not implement 40% as a universal absolute rejection rule based only on the tutorial.

#### 5. Compare tools and comparative charts (video: 48:19-58:52)

- Duplicate a mix to test one controlled change, such as reallocating ILS 50,000 from variable to fixed (video 48:30).
- The source demonstrates a head-to-head comparison (video 49:17), a multi-mix summary for up to four mixes (video 50:17), and merging a standard mortgage with a supplementary loan (video 51:00), for example a loan that supports the borrower's equity. A combined view must preserve each original schedule.
- Compare two mixes head-to-head and support a multi-mix table/chart for up to four scenarios if accepted by the app's design. Blue/red/green were the reference video's color convention only; use the app's existing accessible palette.
- A merged/consolidated view may show the combined obligation of multiple loans. Preserve each original track's separate schedule, dates and contractual assumptions. Do not bypass `MAX_TRACKS` by pretending several loans are one ordinary mix; use a separate loan-group/portfolio aggregation model if needed.
- Useful charts include monthly repayment, remaining debt, reconciled payment composition (nominal principal reduction, CPI indexation and interest actually paid), annual cash-flow difference, cumulative savings/break-even, estimated payoff fees, and scenario forecast curves.
- A cumulative-savings chart (video 55:40-57:35) must use an explicit sign convention and a common comparison horizon. The source gives an illustrative case with ILS 700 higher monthly payments over the first ten years but ILS 31,000 cumulative savings by years 20-30; this is a video example, not a verified model result. If remaining balances differ at the horizon, include the terminal debt position or clearly label the chart as cash-flow-only. A lower monthly payment caused by extending the term must not automatically be presented as net financial savings.

#### 6. Reports and advisor workflow (video: 58:52-64:05)

- Suggested outputs include a single-mix report, 1-on-1 comparison, multi-mix summary, and monthly amortization schedule (video 59:00). The reference supports Hebrew, English and Russian; the project should implement all languages it actually supports and not add a language without complete translations.
- Allow report sections/metrics to be included or hidden where appropriate (the source mentions IRR/שת"פ, NPV/ענ"ן and market spread), but do not hide legally or financially material assumptions without a clear indication that the report is abbreviated.
- A compact overview may show client/property details, equity, property value, requested loan and income alongside simulation results (video 63:00).
- A case log can record client notes, requests and advisor recommendations (video 63:16). Support-case sharing must be opt-in and should expose only the selected case data.
- Rate validity should show the issue date, status, expiry date and an actionable warning (video 63:26). A notification countdown can be added after the underlying date logic and notification delivery are verified; the tutorial's seven-days-before-expiry reminder is an example of a configurable threshold, not a legal rule.

#### 7. Refinancing workflow (video: 64:05-75:29)

- Model the existing mortgage separately using the payoff statement's date, outstanding balance, track details, current and historical rates where available, next reset date, remaining term and each applicable fee (existing-mortgage view video 64:18; payoff statement scan video 65:16). Extract monetary values no more precisely than the source supports and require review. Multiple reports must be merged deliberately without overwriting earlier tracks (video 65:55).
- Bank-specific document handling, including the tutorial's noted Mizrahi Tefahot report nuance (video 67:44), requires fixtures for each supported document version. The tutorial claims some report layouts may bundle operational management fees into quoted interest/spread figures; only normalize this when the source layout and mapping are verified. OCR must not infer anchors/margins that are not present or derivable from verified fields.
- Duplicate the existing mortgage into a proposed comparison without modifying the source record. Make fee handling explicit: cash-paid fees enter the comparison cash flows once; capitalized fees increase the new principal and must not also be counted as a separate paid cash outflow.
- A visual marker for historical tracks (the video's "purple dot", video 69:22) is useful only if the calculations actually preserve the old rate-reset calendar. For a variable track, the next reset is determined from the original reset schedule and current as-of date, not blindly from month zero.
- Compare keep-versus-refinance cash flows on the same horizon, accounting for fees and end-of-horizon liabilities (feasibility video 71:00). The source also proposes a break-even IRR for refinancing (שת"פ לצורך מחזור, video 73:16), but does not provide a sufficiently specified equation; its stated link to total lifetime repayment is not enough to implement this as an IRR threshold. Break-even is a cash-flow/NPV comparison, not simply a comparison of two lifetime repayment totals. Any proposed break-even IRR must have a separately documented equation and test cases.

### Suggested data model (conceptual, adapt to the actual repository)

These interfaces describe the required concepts, not a mandate to copy them literally. Reuse the current app's types, schema validation and database conventions.

```ts
interface Deal {
  id: string
  clientName: string
  propertyValue: number
  requestedLoanAmount: number
  ltv: number
  monthlyNetIncome: number
  dealType: 'FIRST_HOME' | 'UPGRADER' | 'INVESTMENT' | 'ALL_PURPOSE'
  eligibilityPoints?: number
  mixes: MortgageMix[]
  existingMortgage?: ExistingMortgage
}

interface MortgageMix {
  id: string
  name: string
  bankCode?: string
  approvalDate?: string // YYYY-MM-DD; rate validity is derived from this and the current date
  tracks: MortgageTrack[]
  stagedReleases?: StagedRelease[]
  isLocked: boolean
}

interface MortgageTrack {
  id: string
  type: 'PRIME' | 'FIXED_UNLINKED' | 'FIXED_LINKED' | 'VARIABLE_UNLINKED' | 'VARIABLE_LINKED' | 'ELIGIBILITY'
  scheduleType: 'SPITZER' | 'EQUAL_PRINCIPAL' | 'BALLOON_PARTIAL' | 'BALLOON_FULL'
  principal: number
  percentageOfLoan?: number // derived from principal and mix total, or validated against it
  termMonths: number
  baseAnchor?: number
  margin?: number
  contractedAnnualRate?: number // authoritative for fixed-rate tracks; derived for anchor/prime tracks
  rateBasis: 'ANNUAL_NOMINAL' | 'ANNUAL_EFFECTIVE'
  balloonAmount?: number // required for a partial balloon when using an amount-based structure
  balloonPercentage?: number // alternative to balloonAmount; validate that only one representation is authoritative
  adjustmentFrequencyMonths?: number
  gracePeriodMonths?: number
  graceType?: 'PARTIAL' | 'FULL'
  historicalReferenceDate?: string // YYYY-MM-DD when relevant to existing-loan reset timing
}

interface StagedRelease {
  id: string
  monthIndex: number // one-based; use an actual date instead when day-level accrual is supported
  mode: 'PERCENTAGE' | 'TOTAL_AMOUNT' | 'PER_TRACK_AMOUNT'
  percentageOfApprovedAmount?: number
  totalAmount?: number
  trackAllocations?: Array<{ trackId: string; amount: number }>
}

interface ExistingMortgageTrack extends MortgageTrack {
  currentBalance?: number // unknown until verified from a payoff statement or entered and reviewed
  originalPrincipal?: number
  originalStartDate?: string
  lastRateResetDate?: string
  nextRateResetDate?: string
  maturityDate?: string
  dataStatus: 'VERIFIED' | 'USER_REVIEWED' | 'PARTIAL' | 'UNKNOWN'
}

interface ExistingMortgage {
  id: string
  asOfDate: string
  totalPayoffBalance?: number // unknown if not supported by verified source data
  tracks: ExistingMortgageTrack[]
  sourceDocumentIds?: string[]
  dataStatus: 'VERIFIED' | 'USER_REVIEWED' | 'PARTIAL' | 'UNKNOWN'
}

interface ValidatedAssumptionsSnapshot {
  schemaVersion: number
  capturedAt: string
  items: Array<{
    id: string
    kind: 'CPI_MONTHLY' | 'POLICY_RATE' | 'PRIME_RATE' | 'VARIABLE_ANCHOR' | 'ZERO_CURVE'
    scope: 'MIX' | 'TRACK'
    trackId?: string
    monthValues?: number[]
    datedValues?: Array<{ date: string; value: number }>
    rateBasis?: 'ANNUAL_NOMINAL' | 'ANNUAL_EFFECTIVE' | 'MONTHLY'
    sourceKind: 'USER_ENTERED' | 'OFFICIAL' | 'MARKET_DERIVED' | 'APP_DEFAULT'
    sourceUrl?: string
    asOfDate?: string
    effectiveFrom?: string
    effectiveTo?: string
  }>
}

interface SavedComparison {
  id: string
  ownerId: string // assigned by the authenticated server, never trusted from client input
  title: string
  schemaVersion: number
  calculationModelVersion: string
  createdAt: string
  updatedAt: string
  scenarioOrder: string[]
  baselineScenarioId?: string
  scenarios: MortgageMix[] // store full editable snapshots, not only source-mix IDs or chart output
  assumptionsSnapshot: ValidatedAssumptionsSnapshot // versioned forecast/rate inputs, provenance, and as-of metadata actually used
}
```

Notes:
- The source's `capitalAllocationRate` and `rateHoldExpiryDays` should not be copied as unqualified persisted facts. A capital risk weight needs a verified current legal source and a distinct meaning. Remaining days are derived from `approvalDate` and `now`, not stored as a value that quickly becomes stale.
- Avoid persisting both allocation amount and percentage as independent truth. Use the amount or percentage selected by the user as the authoritative input and derive the other value, with a visible unallocated remainder.
- Avoid storing rate, anchor and margin as three independently editable fields with no reconciliation. Use a track-type-specific rate definition and derive its current effective rate from the applicable contract terms.
- `isLocked` may be derived from a validated staged-release state rather than persisted as a free-standing value that can become inconsistent. If it is stored, define and test how it is reconciled after load/migration.
- Persist date-only values as normalized strings where they represent calendar dates. Use real timestamps for events that require time-of-day or day-count accrual.
- Define `ValidatedAssumptionsSnapshot` with a schema/version, the exact values or curves used, date/month alignment, source kind (user-entered, official, market-derived or app default), source URL where available, and as-of/capture timestamps. Validate the payload server-side; do not treat an arbitrary `Record<string, unknown>` as validated merely because it is typed as unknown. A saved compare is an independent input snapshot. Store source-mix IDs only as optional provenance; changing or deleting a saved mix must not mutate a saved comparison.

### Calculation specification: formulas and units

The following definitions are the mathematical starting point for tests. The legal contract, indexation method and actual app's verified conventions determine which variant is used for a given track.

#### 1. Rates and repayment schedules

Use one internal periodic-rate unit, and convert input rates explicitly:

- If a contract rate is specified as an annual nominal rate compounded monthly, `r = annualNominalRate / 12`.
- If a source gives an effective annual rate, its equivalent monthly rate is `r = (1 + annualEffectiveRate)^(1/12) - 1`.
- Do not mix these conventions. In particular, BOI's average mortgage-rate tables are effective annual rates.

For a standard fully amortizing Spitzer schedule with opening balance `P`, periodic rate `r` and `n` remaining monthly payments:

`PMT = P * r / (1 - (1 + r)^(-n))`, when `r != 0`.

For `r = 0`, use `PMT = P / n`. Use numerically stable handling for rates close to zero. This formula is the baseline for an unindexed constant-rate track; CPI linkage and rate resets require their explicit balance/payment update convention.

For equal-principal amortization on an unindexed track, the scheduled principal installment is `opening amortizable principal / remaining amortization periods`; the payment is scheduled principal plus interest for that period. For indexed or resettable tracks, define how the contract adjusts the nominal principal installment and payment rather than assuming the nominal ILS amount stays fixed.

For the source brief's illustrative 100,000 ILS loan over 360 months at a 6% annual nominal rate, `r = 0.06 / 12` and the standard Spitzer payment is approximately **599.55 ILS per month**, before fees and any indexation. At a zero rate, 100,000 / 360 is approximately **277.78 ILS per month**. These are formula sanity checks, not complete bank quote reproductions.

#### 2. CPI indexation and balance ledger

Let `B_open` be the opening balance, and let `q_t` be the contractual index ratio for the period. Then, in a simplified monthly model, `B_after_index = B_open * q_t` and `indexation_t = B_after_index - B_open`. The index ratio should be based on the relevant published CPI index levels, contractual base index and applicable lag. If the product offers a simpler user-entered monthly-rate scenario, label it as an approximation.

Keep these concepts separate in the calculation ledger:

- `indexation`: change in balance caused by CPI linkage; not a separate cash payment by itself.
- `interestAccrued`: interest earned by the lender during the period.
- `interestPaid`: interest covered by the actual scheduled payment in the period.
- `interestCapitalized`: accrued interest not paid and added to the balance.
- `cashPrincipalPaid`: cash applied to principal/balance repayment.
- `scheduledPayment`, `extraPrincipalPaid`, `fullPayoffAmount`, `drawAmount` and `feeAmount`: explicit cash flows/events.

Validate each month's balance with an explicit roll-forward. For a model that records the components above separately, a general form is `B_close = B_open + indexation + interestCapitalized + drawAmount + capitalizedFeeAmount - scheduledPrincipalPaid - extraPrincipalPaid - payoffPrincipalPaid`. Omit event terms that do not occur in the period. A fee paid in cash is not added to the balance; a fee capitalized into a refinance balance is added exactly once as `capitalizedFeeAmount` and remains separately identifiable as a fee. Do not include interest already paid in `interestCapitalized`. Every term must follow the app's declared event order and contract convention.

For the current fully amortizing model only, where no interest is capitalized and row `principal` means `scheduledPayment - interestPaid`, the chart components are:

- `netPrincipal = row.principal - row.indexation`
- `indexation = row.indexation`
- `interestPaid = row.interest`

Therefore `netPrincipal + indexation + interestPaid = scheduledPayment`, within a specified floating-point tolerance. Preserve negative `netPrincipal` if it occurs; do not clamp it to zero. Both the calculator and compare charts must call the same pure helper.

The lifetime identity `sum(cashPrincipalPaid) = original principal + total indexation` is only valid for a fully amortized indexed loan with zero ending balance and no other principal events or capitalized interest. The corresponding `total payments = original principal + total indexation + total interest` identity also assumes the same simplified case, with no fees or external cash-flow events. Tests must encode the scope, not apply these equations unconditionally to grace, payoff, staged-release or refinance cases.

#### 3. Monthly event order

Use one documented event order across calculator, compare, payoff and refinance schedules:

1. Validate input values and resolve events effective at the start of the period, including eligible disbursements and contractual rate resets.
2. Determine the rate effective for the period. Prime follows the modeled BOI/prime path; other variable tracks reset only on their contractual dates; fixed tracks do not reset.
3. Apply the contract-appropriate CPI index ratio to eligible balances. Preserve the current month-one behavior only if Step 0 verifies it and compatibility requires it; document any deviation from contract-level indexation.
4. Accrue interest under the selected periodic-rate/day-count convention on the contractually correct balance.
5. Calculate scheduled payment using current balance, remaining term, schedule type, rate and grace state.
6. Apply the scheduled payment. Record interest actually paid and cash principal separately; in full grace, scheduled payment may be zero and unpaid accrued interest may capitalize.
7. Apply a configured extra principal payment or full payoff after that month's scheduled payment. The UI must state this timing convention. Apply the payoff balance and any verified statutory fee as separate amounts.
8. Record closing balance, all component ledger movements and cash flows. Validate the balance roll-forward.

For events occurring mid-month, either support actual dates and day-count accrual correctly or constrain them to documented month boundaries. Do not silently model a mid-month release or payoff as if it occurred on day one.

#### 4. IRR, NPV, duration and return per shekel

- **Effective loan IRR (שת"פ):** Construct borrower-perspective dated cash flows. Loan advances are positive inflows to the borrower; repayments and borrower-paid fees are negative outflows. For uniform monthly periods, place the initial loan advance at `t = 0` and monthly repayments/fees at their corresponding period indexes, then solve `0 = sum(CF_t / (1 + r_m)^t)` for the monthly rate and annualize as `(1 + r_m)^12 - 1`. With dated/irregular cash flows, use a date-aware XIRR-style equation and state the day-count basis. For staged draws, include each draw on its actual modeled date. IRR solvers must detect missing or non-unique roots; prefer a bracketed/safeguarded method over unguarded Newton-Raphson alone.
- **NPV against a government zero curve:** For a cash flow at month `t`, if `y_t` is an effective annual spot yield matched to that maturity, discount using the matching annual time fraction, for example `PV_t = CF_t / (1 + y_t)^(t/12)`. Prefer actual payment dates and the curve's required compounding/day-count convention when supported. Do not use `(1 + annualYield)^t` where `t` is counted in months.
- **Macaulay duration:** `DurationYears = sum((t/12) * PV(payment_t)) / sum(PV(payment_t))`, where `payment_t` is a positive future repayment cash flow and the initial loan advance is excluded from this duration weighting. For conventional Macaulay duration, discount payments consistently at the loan's yield/IRR basis so the positive repayment PV denominator corresponds to the loan value; if discounting each maturity at a government spot curve, label the result as a curve-discounted weighted-average time unless the chosen definition explicitly calls for it. Do not use the signed borrower IRR cash-flow stream whose PV sums to zero as the duration denominator.
- **Return per shekel:** `sum(scheduled borrower payments) / original amount disbursed` is an undiscounted nominal total ratio. Decide and document whether it includes indexation, fees and payoff payments. Do not describe it as accounting for time value.
- **Market spread:** Only compare rates with matching annualization/compounding and a matching nominal versus real curve, linkage, duration and date. For example, compare unindexed nominal loan rates with nominal yields and CPI-linked real loan rates with real yields. Define interpolation and portfolio weighting. Label this as an app-defined benchmark metric, not the contractual bank margin or a statutory metric.

#### 5. Grace, payoff, fees and refinance comparisons

- **Partial grace:** scheduled principal is zero during the grace months; interest is paid under the assumed contract convention. CPI linkage may continue on indexed tracks.
- **Full grace:** scheduled payment is zero; accrued unpaid interest capitalizes if that is the scenario's stated contract assumption. The post-grace schedule amortizes the resulting balance over the remaining original term, not an automatically extended term.
- **First versus representative payment:** first payment is the actual first scheduled cash payment. Representative payment is a separate planning output. It must not be treated as the legally required PTI amount unless the current rule has been verified.
- **Payoff events:** after the scheduled payment, apply the extra principal or full closure to the remaining balance. Report future scheduled payments avoided separately from cash paid today. Keep the statutory fee separate from principal/indexation/interest.
- **Prepayment fee:** use the currently applicable official order, amendments, correct BOI rate table and term/linkage buckets, all applicable fee components, discounts, exemptions and rounding rules. Document source/version/date and fixtures. A fee model that covers only selected loan types must say unsupported for all others and stay gated from public complete-fee wording.
- **Refinancing and break-even:** compare keeping the current loan with refinancing using the same analysis date and horizon. Include any cash-paid fees at the refinance date once; if fees are capitalized, reflect them in the new balance once. At the comparison horizon, account for the remaining debt of each scenario or compare present values including terminal liabilities. Distinguish monthly-payment relief, cumulative cash-flow break-even and economic/NPV break-even. Do not decide that refinancing is beneficial solely from a lower monthly payment, lower nominal lifetime payments, or a comparison of two standalone IRRs.

### Forecast data and charts

- Support monthly CPI scenario values and month-specific rate assumptions over the modeled horizon. The common UI autofill can interpolate milestone values deterministically, but must show the exact path used in calculations and label all future values as assumptions.
- `Prime_t = BOI_t + 1.5 percentage points` when that definition and the applicable dates are used. Other variable anchors may use contractual government-bond benchmarks and the specified reset cadence. Interpolation across 1-, 3- and 5-year curve points is a model choice and must be documented/tested.
- The reference chart inventory is: (1) monthly repayment by track and total mix, (2) remaining debt balance, (3) annual payment composition by net nominal principal reduction, CPI indexation and interest actually paid, (4) annual payment difference, (5) cumulative savings with a zero crossing, (6) estimated prepayment-fee trajectory and (7) CPI / policy-rate / prime / anchor forecast curves.
- Every chart must reconcile to the same schedule and component definitions as the results cards and amortization table. Negative chart components require an honest diverging or otherwise clear display, not clamping. The indexed balance already contains indexation; never add cumulative CPI to it a second time.

### Conceptual screen layout

- Top summary: property value, total loan, LTV and correctly defined PTI status.
- Actions: add/duplicate mix, scan an approval, merge/aggregate loans, export report.
- Mix controls: names, bank/product, validated rate source/as-of date, approval-date validity, track editor and grace/reset controls where supported.
- Track rows: schedule, type, allocated amount/percentage, rate basis, anchor/margin, term, reset frequency, grace and actions for payoff/delete.
- Result summaries: first payment, representative/planning payment, total scheduled payments, total indexation, interest paid/accrued where distinguishable, cash fees, modeled IRR and only those additional metrics whose definitions are implemented.
- Lower views: compare table, monthly/yearly amortization, monthly payment, remaining balance, payment-composition and fee-aware savings charts.
- Keep the small-screen no-overflow requirement; do not add a narrow data-table column if the existing responsive pattern uses a detail view instead.

### Architecture and rollout notes from the source

The original sketch suggested a React/Next.js client, REST/GraphQL API, a Node.js or Python/FastAPI application layer, a separate calculation engine (C++/Rust/Python), document OCR/parsing (LLM, AWS Textract or PyMuPDF), and market-data sync for Bank of Israel and government-bond data. This is conceptual, not a mandate. The actual repository notes say the project already uses Next.js/TypeScript, Better Auth and custom SVG charts, so keep that stack unless the repo audit documents a concrete need to change it.

The original rough estimate was financial core in weeks 1-3, Bank of Israel/regulatory rules in weeks 4-5, OCR in weeks 6-7, comparative analytics/refinancing in weeks 8-9, and reporting/alerts/eligibility in weeks 10-12. These are historical brainstorming estimates, not delivery commitments. The current step checklist and dependencies below are authoritative.


Roadmap: reference-tool parity
This is a working plan, not a commitment to build all of it. It tracks shipped
slices and remaining parity work inspired by the professional Israeli mortgage
simulation demonstrated in the "סימולצייה מקצועית בסמארט" YouTube walkthrough
saved in examples/, with proposed shape, effort, risk and source for each item.

Effort is S (a day or less), M (2-4 days), L (a week or more) for a first
slice, including unit tests, i18n for every supported language, and e2e.

The reference product's layout and copy belong to it. We borrow the ideas and
build our own components and strings.

This unified master plan contains the file-level engineering requirements, accounting rules, acceptance criteria and tests. The `docs/ROADMAP.md` and `docs/SMARTNPV_IMPLEMENTATION.md` paths may both exist in the repository; inspect them during Step 0 for context and reconcile any conflicts, but do not let an older copy silently override this master plan.
1. Indexation visibility (הצמדה)
Status. The core calculation and several UI surfaces are shipped. The
remaining work is to make the payment-composition charts use reconciled,
additive components and to make the total CPI amount easier to find in results.

Already shipped.
- src/lib/amortization.ts records monthly/yearly indexation and
  TrackResult.totalIndexation; combined rows aggregate these values.
- The schedule table shows an indexation column only when the mix has an
  indexed track, for monthly/yearly and combined/per-track views.
- The cost donut splits total repayment into nominal principal, indexation and
  interest. The cumulative-indexation compare chart is also shipped.
- The total-payments caption identifies indexation where relevant. Unit tests,
  Hebrew/English keys and e2e coverage already exist for the first slice.
Accounting definition. principal in the existing schedule is the amount
of the payment allocated to paying down the CPI-adjusted balance. Its lifetime
sum therefore includes CPI indexation. For a payment-composition chart, derive
netPrincipal = row.principal - row.indexation, then display
netPrincipal + indexation + interestPaid = paid. Implement this in one pure
helper in src/lib/amortization.ts and reuse it in the calculator and compare
charts. Do not add indexation to a balance that already includes it, and do
not clamp a negative net-principal result to zero. The implementation plan
explains how to handle negative values and how grace-period capitalization
will require separate accrued-interest and interest-paid fields.

Remaining work.
- Update src/features/calculator/AmortizationChart.tsx and
  src/features/compare/CompareTrendChart.tsx to use the shared three-part
  helper and an honest rendering for negative values.
- Add an explicit total-indexation amount to calculator results, with Hebrew
  and English labels and matching tests.
- Keep the current schedule columns, cost donut and cumulative-indexation chart.
  Do not add a narrow comparison-table column that violates the existing
  no-horizontal-scroll contract.
Effort M. Risk medium-high because the display depends on financial
accounting invariants. See Phase 0 in this master plan.
2. Rate-validity / approval-date warning (התראת תוקף ריבית)
Status. The first slice is shipped: approval date, rate-validity status and
warnings exist in calculator and compare as session inputs. The date is not yet
persisted with a saved mix, and the UI does not print an "as of" date next to
the validity figure.

Shape.
- New pure module src/lib/rateValidity.ts: RATE_VALIDITY_DAYS = 24 (cited
  below) and rateValidityStatus(approvalDate, now) returning
  valid | expiring | expired plus daysRemaining, with now injected.
- Mix-editor date input; a status chip near the mix title; a banner in results
  and compare when expired.
- i18n (he + en); dates formatted through the existing i18n/Intl path.
- Tests: the boundary at exactly 24 days, 0/negative, and date-only arithmetic
  so timezone/DST cannot drift. e2e for the chip in both languages at ~360px.
Effort S. Risk low.

Shipped (first slice).
- src/lib/rateValidity.ts: RATE_VALIDITY_DAYS = 24, EXPIRING_SOON_DAYS = 3,
  rateValidityStatus(approvalDate, now), parseDateOnly, formatDateOnly,
  rateValidityText. now is injected, and both sides of the comparison are
  normalised to UTC midnight so a timezone or DST change cannot shift the day
  count.
- Shared src/components/ui/RateValidityChip.tsx (renders nothing without a
  real date; data-status carries valid | expiring | expired).
- Calculator: approvalDateText + setApprovalDate on the store (session
  input, NOT part of a saved mix), a date field with the shared chip under the
  limits row, and an ⓘ/❌ summary note when the rate is lapsing or lapsed.
- Compare: approvalDateText per scenario (each mix is its own offer), the same
  field + chip in each scenario editor, and the same actionable warning as a
  status line in that mix's result card. The calculator's date travels into the
  first mix on seeding.
- he/en keys; 18 pure-module tests, 13 store tests, a placeholder-parity test,
  and 11 e2e cases (states, boundaries, both languages, 360px, and the seed
  carrying the date).
Not done (deliberately). The approval date is not persisted with a saved
mix: that would add a field to the stored mix scenario (server zod schema,
serialize baseline, load/restore), which is a data-model change to flag rather
than slip in. Today the date is session input, cleared on reset, on detaching
from a mix, and on loading one.

Wording split. The chip beside the field is the compact sentence; the
results area (calculator summary note, compare status line) carries the
actionable warning ("ask the bank for an updated rate"). One rule, both pages.

Open decision (resolved). Per mix. In the calculator that is the single
mix; in the comparison each scenario is its own offer and gets its own date.

Source. The Bank of Israel mortgage-transparency reform describes an approval in principle whose offered terms are valid for 24 days from issuance, subject to the conditions described by the Bank of Israel. Re-checked on 2026-10-23 against
boi.org.il/information/bank-paymnts/financial-education/competition-in-mortgages/
and the Kol-Zchut rights guide, which restates the BOI amendment's 24-day
minimum. EXPIRING_SOON_DAYS = 3 is a UI urgency threshold, not a regulatory
figure. The UI does not yet print an "as of" date next to the figure.
3. Early-repayment fee calculator (עמלת פירעון מוקדם)
Gap. We carry static education copy only
(src/components/education/PrepaymentPenaltyFacts.tsx); there is no fee
calculation. This is a high-value feature, but the fee is a regulated financial
figure and must not be approximated in the public UI.

Shape.
- Build a pure calculation module at src/lib/prepayment.ts only after the
  applicable official rules, fee components, exemptions, discounts, rate
  buckets and examples have been documented.
- Report applicable fee components separately and keep fees separate from
  scheduled principal, CPI and interest.
- Create authoritative fixtures from official Bank of Israel examples and
  match at least two or three worked cases before presenting any result as a
  complete statutory fee.
- If only one fee component or a subset of loan types is supported, keep the
  calculator internal-only. Never label a partial calculation as the complete
  fee or return a confident-looking zero for unsupported cases.
- Add stress scenarios only as clearly labeled assumptions. Effective-rate
  surcharge is a follow-up sub-ticket after the base fee result is verified.
Dependency. Phase 3 builds the underlying early-payoff events internally.
The public payoff feature remains gated until this phase can calculate the
applicable fee completely for its supported cases.

Official starting points include [BOI Circular 2103](https://www.boi.org.il/roles/supervisionregulation/circulars/cir2103/), the [Banking Order on early repayment of housing loans](https://www.boi.org.il/roles/supervisionregulation/legislation/leg116/), the [2012 rules on early-repayment fees for housing loans](https://www.boi.org.il/roles/supervisionregulation/legislation/leg166/), applicable later amendments, and the [official BOI average mortgage-rate tables](https://www.boi.org.il/information/interestrates/mortgage). The implementer must verify the currently applicable consolidated text, effective dates, and official examples rather than treating this roadmap or the tutorial summary as a legal specification.

Effort XL. Risk very high. See Phase 4 in this master plan.
4. BOI average-interest table (ריבית ממוצעת)
Gap (closed). The calculator's average-rate card used to deep-link to the
BOI page without showing the data. /rates now renders the official tables and
the card links there.

Shape.
- New src/server/rates/ following the src/server/market/ pattern (provider
  - service + cache + typed snapshot), exposed at
    src/app/api/rates/average/route.ts.
- Two accessible tables with each workbook's official bucket layout: indexed
  has 25+, 20-25, 15-20, 10-15, 5-10 and up-to-5 buckets; non-indexed adds
  1-5 and up-to-1-year buckets. Current publication plus dated history.
- Show an "as of" and degrade honestly (never invent a value), like the market
  strips' stale flag.
- Parse-fixture-to-table unit tests, plus e2e.
Effort M. Risk medium (external shape drift).

Shipped (first slice).
- src/server/rates/ parses the two official BIFF8 workbooks with SheetJS,
  validates the column count before reading, converts Excel date serials and
  normalizes every row; rows are deduped and sorted newest first.
- GET /api/rates/average returns both tables independently, each with
  ok / stale / unavailable. A six-hour in-memory cache, in-flight
  collapsing and a 45-day disk snapshot under .cache/ keep one BOI outage
  from blanking the page.
- /rates and /en/rates show the current rate plus 12 monthly rows per
  table, the official bucket layout for each kind, a source link, and honest
  stale/unavailable messages. The calculator's average-rate card now links
  there instead of leaving the site.
- Unit tests cover the pinned real workbooks, date serials, shape mismatches,
  caching, stale fallback and the API contract. E2e covers both locales at 360
  and 1280, stale/partial/500 states, dark theme, and the calculator entry.
Source (decided). The two official BOI workbooks, not the series database:
https://www.boi.org.il/boi_files/Pikuah/pribmash.xls (indexed) and
https://www.boi.org.il/boi_files/Pikuah/mashfix.xls (non-indexed). The series
database (edge.boi.gov.il, BIR_MRTG_99) exposes only total series, not the
term-bucketed table. Pinned fixtures live in tests/fixtures/rates/.

Open decision (resolved). An external data source was approved, and the
tables live on their own /rates page linked from the calculator's existing
average-rate result card.
5. Monthly CPI forecasts and variable-rate resets
Gap. Variable-rate reset periods are described in the help content but are
not modeled in the amortization schedule. CPI currently uses one annual
assumption for the full term rather than a changing monthly path.

Shape.
- Keep the current annual CPI input as the compatibility fallback.
- Add a validated monthly CPI path and month-indexed interest-rate reset
  assumptions. A reset takes effect at the start of its declared month, before
  CPI and interest are calculated for that month.
- Start with explicit user-provided milestones and deterministic interpolation.
  Label all future values as assumptions, not predictions or official data.
- Recalculate scheduled payments after rate changes using the then-current
  balance and remaining term. Use the same assumptions in calculator and
  compare views.
- The forecast chart must render the exact path used by the engine, and a chart
  tooltip or text summary must explain that these are scenario values.
Effort L. Risk high because the full future cash flow depends on the
assumptions. See Phase 2 in this master plan.
6. Advisor-metric rows
Status. The first derived-metrics slice is shipped. snapshot.totalPrincipalPaid
is the amount repaid that was not interest and therefore includes the CPI drift
already captured in the balance repayment. It is displayed as סך ירידת הקרן;
its caption identifies indexation where relevant. peakPaymentYear(rows) is
also shipped and reads the combined monthly series, with a relative tolerance
to avoid a false peak from floating-point drift.

Known nuance. The highest-payment card's amount is the sum of each track's
own peak, while its year comes from the actual combined monthly payment series.
For mixes with both rising and falling tracks, those may differ. Changing the
card amount to the true combined peak is a separate behavior decision.

Not done. Do not add a combined "interest + indexation" value by simply
summing totalInterest and totalIndexation against סך ירידת הקרן. Indexation
is already included in the principal column, so a poorly defined aggregate can
double-count it. Phase 0 instead defines additive chart components explicitly.
The per-track מרווח שוק field remains a separate product/data-model decision;
true market spread belongs with later advisor metrics after the forecast and
cash-flow model is trusted.

Effort S-M for additional derived rows. Risk low for values derived from
the current schedule, medium for any new market-spread field.
7. Grace periods (גרייס)
Gap. Tracks cannot model partial grace (interest-only) or full grace (no
scheduled payment and unpaid interest capitalized).

Shape. Per-track gracePeriodMonths and graceType: partial | full fields;
backward-compatible saved-mix defaults; re-amortization over the remaining
original term; separate first actual payment and representative post-grace
payment; first and representative payments remain separate. Regulatory PTI must use the current verified rule and must not be assumed to equal the post-grace payment. CPI continues during grace according to the selected linked-index convention. Grace remains distinct from an explicit balloon schedule.

Effort L. Risk high. See Phase 1 in this master plan.
8. Early repayment and full payoff scenarios (פרעון מוקדם)
Gap. There is no scheduled payoff or extra-principal event in the monthly
engine.

Shape. Support full-mix close, full-track close and partial prepayment at a
selected month after that month's scheduled payment. For partial prepayment,
implement shortenTerm and reducePayment with clearly defined behavior for
both Spitzer and equal-principal methods. Compare resulting cash flows to the
baseline. The prototype remains internal-only until the applicable statutory
fee is complete and verified.

Effort L. Risk high. See Phase 3 in this master plan.
9. Compare scenario cap and savings break-even
Gap. MAX_TRACKS = 3 is used both for tracks within one mix and the number
of compare scenarios, even though the compare chart already has four mix colors.

Shape. Introduce MAX_MIXES = 4 separately. Keep the per-mix track limit
unchanged. Then add baseline/candidate monthly cash-flow deltas, fee-aware
cumulative savings, and a break-even month/year after the prepayment fee model
is trusted. State explicitly when savings do not break even during the horizon.

Effort S for the cap split, M-L for savings analytics. Risk low for the
cap split and medium-high for finance comparisons. See Phases 0 and 5 in this master plan.
10. Refinancing (מחזור)
Gap. There is no separate existing-mortgage model or refinance simulation
that preserves historical reset dates and balances.

Shape. Store current payoff balance and each track's historical rate/reset
information; duplicate an existing mortgage without overwriting it; choose
whether verified fees are paid from cash or capitalized into the new loan; and
compare the old and proposed schedules on a shared horizon. Add a visual
historical-track indicator only after the reset calendar is preserved in the
math. Show cumulative net cash flow and the break-even point including fees.

Dependency. Do not start until the schedule, grace, forecast, payoff-event,
fee, and comparison phases are stable.

Effort XL. Risk very high. See Phase 6 in this master plan.
11. Balloon and staged releases
Gap. The model cannot represent explicit balloon maturity payments or loan
draws made in stages.

Shape. Add full and partial balloon as explicit schedule types. Add staged
draw events with dates/months, amount, and destination track. Interest and CPI
must apply only to amounts already disbursed. Do not infer balloon behavior
from grace fields.

Effort L-XL. Risk high. See Phase 7 in this master plan.
12. Advisor metrics, OCR and reporting
Gap. True forecast-driven IRR (שת"פ), market spread, automated scanning of
אישור עקרוני and דוח יתרה לסילוק, and modular client reports are not complete.

Shape. Add advisor metrics only after the monthly cash flows are trusted and
each metric has a documented definition. Treat OCR as an untrusted extraction
candidate that requires user review; never fill missing financial data with a
guess. Reports must reflect the same calculations used in the app.

Effort XL, split into independently reviewable tickets. Risk high to
very high depending on the feature. See Phase 8 in this master plan.
13. Compare lifecycle and saved comparisons
Gap. The compare workflow does not yet document a complete save/discard-on-exit guard or a persistent Saved Comparisons area in the profile.

Shape.
- Reuse the calculator's unsaved-changes modal and navigation-guard pattern.
- Track dirty state from persisted comparison inputs, not transient chart or hover state.
- On exit with changes, offer Save changes, Discard changes, and Stay on page. Navigate only after a successful save or an explicit discard. On discard, restore the persisted snapshot or clear a new unsaved draft so abandoned edits cannot reappear from in-memory store state. On a save error, remain on the page with all edits intact.
- Add a profile Saved comparisons section with create/save, list/open, rename, duplicate, and delete actions.
- Save a versioned input snapshot containing up to four scenarios, names/order, selected baseline, and all calculation-relevant fields. Recalculate results on load using the shared schedule engine.
- Store snapshots independently from source mixes. Later edits or deletion of a source mix must not mutate an already saved comparison.
- Use the existing saved-mix persistence conventions and Better Auth server session. Validate ownership on every server read/write/delete, and never trust a client-provided owner ID.
- Include schema-version handling, Hebrew/English localization, loading/error/empty states, and accessibility/e2e coverage.

Acceptance criteria. Dirty navigation prompts, clean navigation does not, failed saves cannot lose edits, saved comparisons survive reload, and all data restores to the same calculated results. The browser tab-close/reload warning must use the native browser warning where available because a custom app modal is not supported for true page unload.

Recommended implementation order
1. Phase 0: payment-composition accounting, chart consistency, explicit
   indexation total, and MAX_MIXES separation.
2. Phase 1: grace periods and separate first/representative payments.
3. Phase 2: monthly CPI scenario paths and variable-rate resets.
4. Phase 3: internal early-payoff event simulation.
5. Phase 4: complete, source-verified prepayment-fee engine and release gate.
6. Phase 5: compare deltas, cumulative savings and break-even analysis.
7. Phase 6: refinancing with historical reset dates and fee capitalization.
8. Phase 7: explicit balloon and staged-release schedules.
9. Phase 8: IRR, market spread, OCR and reporting.
Already-shipped rate-validity and BOI average-rate work should remain stable and
must not be regressed by these phases. See this master plan for the file-level tickets, event order, accounting invariants, and definition of done.


Mortgage Simulation Implementation Plan
Status: implementation plan only. No calculation or UI feature is implemented by this document.

This section was originally drafted for `docs/SMARTNPV_IMPLEMENTATION.md` and is retained here to keep the requirements in one file. This master plan is the consolidated task source of truth. `AGENTS.md` at the repository root still defines the repository-wide engineering rules and must be inspected during Step 0.

The objective is to evolve Makeyev Finance into a more capable Israeli mortgage simulation and refinancing tool while preserving the existing calculator, saved mixes, URLs, and golden calculation results.
1. Verified current state
The following findings are based on the project source in the October 20, 2026 project archive.
- src/lib/amortization.ts contains the pure monthly amortization calculation, track and schedule types, schedule aggregation, totals, and most derived metrics.
- The existing calculation supports Spitzer and equal-principal schedules, indexed and unlinked track types, and a single annual CPI assumption. For indexed tracks, the notes claim CPI starts after month 1 and use a single annual inflation assumption across the remaining term. Verify the actual annual-to-monthly conversion and CPI application in source code; never apply a full annual rate independently in each month. The month-one behavior is an app-specific compatibility convention, not a universal contract rule.
- YearlyRow, MonthlyRow, TrackResult, combined rows, and TotalsSummary already carry indexation amounts. principal is the amount of payment allocated to paying down the indexed balance, so its lifetime sum includes indexation.
- The schedule table conditionally displays an indexation column. The cost donut already separates nominal principal, indexation, and interest. Compare already has a cumulative-indexation chart.
- The calculator's AmortizationChart and compare's composition bars still plot principal and interest as two segments. They need a mathematically reconciled three-component representation.
- ResultsCards.tsx does not currently show a dedicated total-indexation amount. The existing donut, schedule, and comparison chart provide partial visibility.
- Grace periods, scheduled early-payment events, repayment-mode selection, prepayment-fee calculations, variable-rate reset projections, monthly CPI forecast paths, balloon schedules, staged releases, and refinancing workflows are not present in the core calculation model.
- MAX_TRACKS = 3 is also used to cap the number of compare scenarios. The chart theme already defines four mix-series colors, so a track limit and a scenario limit need to become separate concepts.
- The app has Hebrew and English locale files at src/i18n/he.ts and src/i18n/en.ts. New user-facing strings must be added to every locale currently supported.
- The project already uses Better Auth and custom SVG charts. Do not add an authentication or chart dependency as part of this roadmap without a separate reason and explicit review.
2. Non-negotiable calculation rules
2.1 Keep one schedule as the source of truth
The calculator, compare view, results cards, schedule tables, charts, payoff scenarios, and refinancing calculations must consume the same calculated schedule. Do not recreate mortgage arithmetic in a React component or maintain separate formula implementations for calculator and compare.
2.2 Preserve compatibility
- Existing tracks with no new fields must calculate exactly as before.
- New track fields must be optional when reading old saved mixes and must hydrate to safe defaults.
- Existing golden tests must keep passing unless a changed result is an intentional, reviewed correction with a replacement golden case.
- Keep MAX_TRACKS as the maximum number of loan tracks in one mix. Introduce a separate MAX_MIXES for compare scenarios.
- Do not silently rewrite stored mixes or drop unknown legacy-safe fields during serialization.
2.3 Indexation definitions and accounting
The current row fields use this convention:
- principal: the cash payment allocated to balance repayment, equal to paid - interest in the existing non-grace model. On an indexed track, its lifetime sum includes the CPI increase added to the balance.
- indexation: the CPI drift added to the outstanding debt during the period. It is a balance movement, not a separate cash payment made to the bank that month.
- interest: interest accrued and, in the existing model, paid in the same month.
- paid: the actual scheduled cash payment for the period.
For the existing fully amortizing model, the total identities are:

sum(principal) = original principal + sum(indexation)

total paid = original principal + total indexation + total interest

For an additive payment-composition visualization, use one pure helper in src/lib/amortization.ts to derive the three displayed components from a schedule row:
- netPrincipal = row.principal - row.indexation
- indexation = row.indexation
- interestPaid = row.interest for the current no-grace model
The required period identity is:

netPrincipal + indexation + interestPaid = row.paid

The helper must be used by both calculator and compare charts. Do not independently reimplement the subtraction in each UI component. Do not clamp negative netPrincipal to zero, because that breaks reconciliation. The chart must handle negative values explicitly or use a different visual treatment when the data cannot honestly be represented by a conventional positive stacked bar.

When grace periods are implemented, split interestAccrued from interestPaid. During full grace, interest accrues but is not paid and is capitalized. A later payment can repay capitalized interest, so the schedule must not label that amount as repayment of original nominal principal without a component ledger to support the claim. Revisit and test the composition helper when these fields are added.

Do not add indexation to a balance or principal series that already incorporates CPI. The outstanding balance line already includes accumulated indexation. Show the CPI drift as its own series, an explanatory overlay, or a clearly defined counterfactual, not as a second addition to the indexed balance.
2.4 Define the monthly event order once
Use this order for new schedule events, with all edge cases documented in tests:
1. Validate the month inputs and identify any rate reset effective at the start of this month.
2. Apply the effective annual rate for this month.
3. Apply CPI indexation to eligible indexed balances. Preserve the current app-specific month-one rule only if Step 0 confirms it; do not imply it is universal contract behavior.
4. Accrue interest on the balance after indexation using the effective rate for this month.
5. Determine the scheduled payment based on the amortization method, remaining term, current balance, and grace state.
6. Apply the scheduled payment. Track the interest actually paid and the principal amount paid separately. In full grace, scheduled payment is zero and unpaid interest capitalizes.
7. Apply a configured extra repayment or full payoff after the scheduled payment for that month. The user-facing scenario must explicitly say that the selected event happens after that month's scheduled payment.
8. Calculate the closing balance and record the period outputs.
A statutory prepayment fee is a separate amount calculated by the fee engine. Never hide a fee by silently adding it to principal or treating it as interest.
2.5 Assumptions must be visible
A forecast is a user-selected scenario, not a prediction. Show its CPI assumptions, rate-reset dates and assumed rates, and the timestamp/source for any official data. Do not imply the app knows future inflation or bank rates.
3. Implementation phases and file-level tickets
Effort values are rough first-pass estimates and include unit tests, localization, and relevant end-to-end coverage. They are not promises.
Phase 0: Accounting charts, explicit indexation, and compare limits
Priority: P0. Effort: M. Risk: medium because the chart data comes from core financial rows.
Ticket 0.1: Add the shared payment-composition helper
Files:
- src/lib/amortization.ts
- tests/unit/amortization.test.ts
- tests/unit/trend.test.ts
Implement a pure helper that accepts the relevant period fields and returns netPrincipal, indexation, and interestPaid. Use the formula and definitions in section 2.3. The helper must not mutate rows, apply rounding, or format currency.

Tests must cover:
- Indexed and unlinked periods.
- Zero indexation.
- Normal periods where all components are non-negative.
- A period where netPrincipal is negative. Keep the exact negative value and prove the components still sum to the period's payment within a defined floating-point tolerance.
- Yearly aggregation equals the sum of monthly components.
- Lifetime identities for existing fully amortizing indexed fixtures.
Ticket 0.2: Update the calculator amortization chart
Files:
- src/features/calculator/ScheduleSection.tsx
- src/features/calculator/AmortizationChart.tsx
- src/features/calculator/PerTrackChart.tsx only if its chart semantics are changed
- src/i18n/he.ts
- src/i18n/en.ts
- Relevant calculator schedule e2e specs
Feed the chart the shared helper's values. The composition must reconcile to the actual payment for each period. Retain the remaining-balance series on its existing scale and do not add cumulative CPI to a balance that already includes CPI. Make the tooltip and accessible text explain the displayed components. If a negative component makes an ordinary stacked bar misleading, use a diverging or otherwise explicit treatment instead of clamping it.
Ticket 0.3: Update compare composition bars
Files:
- src/features/compare/trend.ts
- src/features/compare/CompareTrendChart.tsx
- src/features/compare/computeScenario.ts
- tests/unit/trend.test.ts
- tests/unit/compare.test.ts
- e2e/tests/ui/compare.spec.ts
Use the same helper as the calculator. All scenarios must use the same component definitions and negative-value handling. Keep the existing cumulative-indexation chart; this ticket improves payment composition and must not remove the already-shipped indexation line.
Ticket 0.4: Make total indexation easy to find
Files:
- src/features/calculator/ResultsCards.tsx
- src/features/calculator/useCalculatorViewModel.tsx if a view-model field is needed
- src/i18n/he.ts
- src/i18n/en.ts
- Calculator results-card unit/e2e coverage
Show the total indexation amount for mixes that have indexed tracks. Follow the existing card and details-dialog patterns. If adding a card, update the expansion/collapse timing and card-count tests instead of leaving animation constants out of sync. The value must reconcile to snapshot.totals.totalIndexation and the schedule totals.
Ticket 0.5: Separate track and mix limits
Files:
- Add src/features/compare/constants.ts for MAX_MIXES = 4, unless a closer existing shared location is found during implementation.
- src/features/compare/ComparePage.tsx
- src/stores/comparisonStore.ts
- src/styles/globals.css
- Relevant compare unit and e2e tests
Use MAX_TRACKS only for the number of tracks inside a mix. Use MAX_MIXES only for the number of scenarios being compared. Confirm that add, duplicate, seed, load, and compare controls all respect the four-scenario limit and that each mix remains limited to the existing track count. Keep the four chart colors aligned with the four-mix maximum.
Ticket 0.6: Protect unsaved compare changes
Files: inspect the current implementations and follow the established patterns. Likely touchpoints include:
- src/features/compare/ComparePage.tsx
- src/stores/comparisonStore.ts
- The existing calculator unsaved-changes modal and navigation guard
- src/i18n/he.ts and src/i18n/en.ts
- Relevant compare unit and e2e specs

Implement a canonical persisted-input snapshot and derive dirty state from comparison data. A populated new comparison with no saved ID is dirty from initialization; an empty untouched compare editor can stay clean. Do not treat hover, chart animation, or transient tabs as edits unless they are already persisted preferences. Intercept internal app navigation and show a modal matching the calculator with Save changes, Discard changes, and Stay on page. Save must wait for successful persistence before navigation; on failure, remain on the page and preserve all edits. Use the native beforeunload warning for browser reload/tab close when supported; a custom modal cannot be shown reliably for true page unload. Reset the baseline only after a successful save, saved comparison load, or explicit discard.

Ticket 0.7: Save and restore comparisons in the profile
Files: inspect the saved-mix storage/schema/profile flow and follow the same conventions. Likely touchpoints include:
- Profile page/components for saved items
- src/stores/comparisonStore.ts and compare serialization
- Existing saved-mix schema and server persistence/API/action modules
- src/i18n/he.ts and src/i18n/en.ts
- Unit, integration, and Playwright coverage

Persist an independent, versioned snapshot of every comparison's editable inputs, up to four scenarios, scenario order, selected baseline, and all calculation-relevant fields. Persist inputs rather than treating derived chart values as authoritative; recalculate through the shared schedule engine after loading. Preserve per-scenario approval-date fields that exist in compare. Do not rely solely on saved-mix IDs, because a saved comparison must continue to work if its source mix changes or is deleted. Apply server-side schema validation and authenticated owner checks to list, read, update, and delete operations. Add profile actions to create/save, open, rename, duplicate, and delete comparisons. A duplicate gets a new ID; delete confirmation must not delete source mixes. Do not show save success until the server confirms success.

Ticket 0.6/0.7 acceptance criteria
- Dirty compare navigation produces the same safe choice flow as the calculator; clean navigation does not prompt.
- Save failures do not navigate, clear edits, or reset dirty state.
- New and saved comparisons round-trip through profile storage with all inputs and scenario order preserved.
- Editing/deleting a source mix does not mutate the saved comparison snapshot.
- Server-side ownership prevents access to another user's comparison.
- Save/load remains compatible with old saved mixes; compare data validates against a versioned schema.
- Add Hebrew/English, RTL/LTR, keyboard/accessibility, mobile, loading/error/empty-state, and regression tests.

Phase 0 acceptance criteria
- Both calculator and compare charts use the same pure component helper.
- The three chart components reconcile to each period's payment, including negative net-principal cases.
- Existing indexed-balance charts do not double-count indexation.
- The total CPI amount is explicitly discoverable in calculator results.
- A compare can contain four mixes, while each mix still has the existing track cap.
- Existing saved mixes, routes, golden outputs, and the mobile no-overflow contract remain intact.
Phase 1: Grace periods
Priority: P1. Effort: L. Risk: high because grace changes the balance path and representative payment.
Data model and calculation
Files:
- src/lib/amortization.ts
- src/stores/calculatorStore.ts
- src/features/compare/computeScenario.ts
- src/server/mixes/schema.ts
- src/features/calculator/TrackForm.tsx and its parent in src/features/calculator/CalculatorPage.tsx
- src/features/compare/ComparePage.tsx
- src/i18n/he.ts, src/i18n/en.ts
Add optional per-track fields:
- gracePeriodMonths: integer from 0 to less than the track term. Zero means no grace.
- graceType: partial or full. Ignore or normalize it to partial when grace length is zero.
Keep the fields optional in the saved-mix schema so old data still loads. When serializing, preserve new values. Hydration of old mixes defaults to no grace.

Grace semantics:
- Partial grace: pay accrued interest during the grace months; scheduled principal repayment is zero.
- Full grace: scheduled payment is zero; interest not paid is capitalized into the balance.
- CPI still applies to indexed tracks during grace according to the selected CPI scenario.
- Grace is inside the original loan term. It does not extend the maturity date.
- After grace, amortize the then-current balance over the remaining original months.
- Grace is not balloon. Balloon structures get their own explicit schedule type in a later phase.
For equal-principal schedules, explicitly test how the post-grace principal installments are recalculated over remaining months. Do not reuse the old original-principal divisor in a way that leaves a residual balance or extends the term.
Result model and PTI
Add representativePayment to the result model. It is the first normal scheduled payment after grace; with no grace it equals the first scheduled payment. Keep firstPayment as the first actual payment, which can be interest-only or zero during grace.

Show first payment and representative/planning payment as separate values in the calculator and each compare scenario. Compute any regulatory PTI only from the payment definition required by the current applicable rule; do not assume that the first post-grace payment is legally sufficient unless that rule is sourced and documented. Do not silently replace the first-payment result with the representative payment.
Tests and acceptance criteria
Add golden tests for partial and full grace on Spitzer and equal-principal tracks, indexed and unlinked tracks, zero interest, grace length zero, grace ending one month before maturity, invalid grace longer than term, and full grace where interest capitalizes. Assert the original maturity month is preserved and the ending balance is zero within tolerance. Test PTI against the current, cited regulatory payment definition, including a representative-payment case only if the verified rule requires it. Keep the first actual payment in the initial-payment display. Add RTL/LTR and narrow viewport e2e coverage.
Phase 2: Monthly CPI forecasts and variable-rate resets
Priority: P2. Effort: L. Risk: high because all future cash flows become scenario-dependent.
Model
Files:
- src/lib/amortization.ts
- src/stores/calculatorStore.ts
- src/features/compare/computeScenario.ts
- New focused forecast types/helper, preferably src/lib/forecast.ts
- A forecast editor component under src/features/calculator/
- src/features/compare/ComparePage.tsx
- src/i18n/he.ts, src/i18n/en.ts
Keep annualInflation as the legacy fallback. Add an optional monthly CPI assumption path and explicit rate-reset assumptions. Validate path lengths and values, and do not allow NaN, Infinity, negative CPI factors that would make the balance invalid, duplicate reset months, or reset months outside the loan term.

Use sorted rate assumptions with one-based loan month indexes. A reset at month m affects the rate before that month's CPI and interest calculations. Recalculate the scheduled payment using the current balance and remaining term after each reset, except when a later repayment mode explicitly preserves a fixed scheduled payment.

Provide a small, explicit forecast model first: user-entered dated/month-indexed milestones and deterministic interpolation between them. Show the source and assumptions. Do not add a forecasting service or pretend that interpolated values are official forecasts. Do not change legacy calculations when no forecast path or reset is supplied.
Tests and acceptance criteria
Test constant-path equivalence with the existing annual CPI option, zero inflation, several CPI milestones, reset exactly on a boundary month, multiple resets, no reset, a reset at the final month, indexed and unlinked loans, and interaction with grace. All chart tooltips must state that the values are scenario projections. The same assumptions must be used in calculator and compare.
Phase 3: Early repayment and full-mix payoff events
Priority: P3. Effort: L. Risk: high. Build this as a calculation capability first, then enable it for real users only after the applicable fee calculation in Phase 4 is complete and verified.
Event model
Files:
- src/lib/amortization.ts or a focused event module such as src/lib/repaymentEvents.ts
- src/stores/calculatorStore.ts
- src/features/compare/computeScenario.ts
- Add src/features/calculator/EarlyRepaymentPanel.tsx when the user-facing feature is approved
- src/i18n/he.ts, src/i18n/en.ts
- Unit tests and calculator/compare e2e specs
Support these separate actions:
1. Close an entire mix at selected month T after that month's scheduled payment.
2. Fully repay one selected track at selected month T.
3. Make a partial prepayment on a track at selected month T.
Partial repayment modes:
- shortenTerm: for Spitzer, keep the scheduled payment amount after the prepayment and pay the loan off earlier, adjusting the final payment. For equal-principal, retain the current principal installment where possible and close the loan earlier.
- reducePayment: retain the original maturity date and recalculate the future payment schedule over the remaining months.
The output must include the event month, pre-event scheduled payment, balance after the scheduled payment, extra principal amount, balance after the event, new payment or maturity, total paid before the event, and the resulting schedule. For a full close, show the payoff balance separately from future payments avoided. Do not call avoided payments guaranteed savings without comparing the actual scenarios and all fees.

Make the month convention explicit in UI: event happens after the regular payment in the selected month. A fee is a separate line item and is not silently added to principal.
Release gate
A prototype that calculates payoff without required statutory fees is internal-only and test-only. Do not expose it as a complete early repayment quote or imply that it is the amount the borrower must pay. It can be developed behind an internal feature flag while Phase 4 is in progress.
Tests and acceptance criteria
Test month 1, middle month, final month, amount equal to balance, amount above balance, zero amount, invalid month, and an event coinciding with a rate reset or CPI change. Test both amortization methods and indexed/unlinked tracks. For a full mix close, no track may accrue payments after the close month. Verify that the baseline schedule is unchanged when no event is supplied.
Phase 4: Statutory prepayment-fee engine
Priority: P4. Effort: XL. Risk: very high. Do not treat simplified reference notes as a legal specification.

Files:
- New src/lib/prepayment.ts
- Official-data fixtures under tests/fixtures/
- tests/unit/prepayment.test.ts
- The early repayment panel and calculator view model, only after validation
- src/i18n/he.ts, src/i18n/en.ts
Before coding the full formula, assemble and document the applicable official Bank of Israel rules, fee components, exemptions, discounts, comparison-rate buckets, and calculation examples. Match at least two or three authoritative examples to within the stated official rounding. Record the source URL and verification date in the documentation and fixture metadata.

Implement the legally applicable fee calculation for the supported track types and payoff cases, with each fee component reported separately. If only one component is implemented or an input cannot be supported, keep the calculator internal-only. Never label a partial discounting fee as the complete statutory prepayment fee. Use explicit supported, unsupported, or unavailable states rather than returning a confident-looking zero.

Stress cases may compare supplied current-rate scenarios, but future rates must be labeled assumptions. The effective-rate surcharge can be a later sub-ticket and must be derived from the same tested cash flows and fee amounts.

Acceptance criteria: official examples match; indexed and unlinked tracks have separately verified handling; exemption and discount boundaries are tested; zero/negative/non-finite inputs are rejected; incomplete fee coverage cannot be presented as a final payoff amount; fees remain separate from scheduled principal, CPI and interest in schedules and reports.
Phase 5: Compare improvements and break-even analysis
Priority: P5. Effort: M-L. Risk: medium-high after the shared schedule and fee model are trusted.

Files:
- src/features/compare/computeScenario.ts
- src/features/compare/trend.ts
- src/features/compare/CompareTrendChart.tsx
- src/features/compare/ComparePage.tsx
- src/stores/comparisonStore.ts
- Relevant compare unit and e2e tests
Add baseline-versus-candidate deltas using the shared monthly schedule. Include payment difference, remaining balance, interest, CPI indexation, fees, and cumulative net cash-flow difference. Mark the break-even month/year when cumulative savings first cross zero. If the curve never crosses zero within the compared horizon, state that plainly.

Include the prepayment fee in refinance/payoff comparisons only when Phase 4 says that fee is complete and supported for the selected tracks. Distinguish cash-flow savings from nominal lifetime repayment differences. Keep the compare page readable at 360px and at the existing 1280px no-sideways-scroll test width.
Phase 6: Refinancing workflow
Priority: P6. Effort: XL. Risk: very high. Do not start before Phases 1 through 5 are stable.

Build an explicit existing-mortgage model, separate from an ordinary new mix. Capture each existing track's current balance, original terms/rate data needed for fee calculation, next reset date, adjustment frequency, linkage type, method, and payoff date. Missing document data must be marked unknown, not invented.

Support duplication into a proposed mix with a clear choice for whether the applicable verified payoff fees are paid from cash or capitalized into the new loan. Preserve historical reset calendars for duplicated old tracks. Newly proposed refinance tracks use their own new reset calendars. Compare the old and new schedules on the same horizon, with fee-inclusive cash flows and a break-even month/year.

The reference's purple-dot concept can be represented as a historical-track indicator, but the indicator itself is not a substitute for correctly preserving the loan's historical dates and reset cycle.

Acceptance criteria: the old mortgage is never overwritten by duplication; the user can compare original versus new terms; fee capitalization is explicit; historical resets are tested; fee-free refinancing is not displayed as financially complete; cumulative savings and break-even reconcile to monthly cash flows.
Phase 7: Explicit balloon and staged-release schedules
Priority: P7. Effort: L-XL. Risk: high.

Add explicit schedule types for full balloon and partial balloon. Do not infer a balloon from grace fields. Full balloon accumulates/handles interest according to the defined contract and repays principal at its maturity; partial balloon must state which principal portion amortizes and which remains due at the end.

Add staged disbursements as dated/month-indexed draw events, including which tracks receive each draw and the amount. Interest and CPI must only be computed against capital actually disbursed at each point. Keep the original total approved amount separate from amounts already drawn. A mix may be locked against incompatible edits only if that rule is visible, reversible, and tested.

Acceptance criteria: draws before/after milestone dates, uneven amounts, indexed and unlinked tracks, no draw, full draw, and maturity with balloon remainder all have golden cases.
Phase 8: Advisor metrics and operational features
Priority: P8. Effort: XL, best split into separate tickets.

Possible sub-tickets after the underlying cash flows are trusted:
- True forecast-driven effective IRR (שת"פ) computed from dated cash flows, separately describing the treatment of CPI and any fees.
- Return per shekel, duration and a market-spread metric, each with a documented definition and tested reference values. Do not use bank margin as if it were a comparable market spread.
- PDF parsing for אישור עקרוני and דוח יתרה לסילוק. Treat OCR results as untrusted extraction candidates and require user review before changing a calculation.
- Modular client reports, monthly amortization schedules, documentation notes, and rate-expiry notifications.
Do not begin OCR or report polish ahead of the calculation engine, saved-data compatibility and verified payoff flow. OCR must never fill missing financial numbers with guesses.
4. Test plan and definition of done
For each phase:
1. Write or update the pure calculation tests before the UI implementation.
2. Check at least two or three sample calculations by hand or in a scratch calculation, as required by AGENTS.md.
3. Run the focused unit tests, then npm test, npm run typecheck, and npm run lint when dependencies are installed.
4. Run relevant Playwright specs and the complete npm run test:e2e suite when practical. Use the existing Page Object Model.
5. Verify a Hebrew RTL view and an English LTR view, light and dark themes, and narrow screen width around 360px.
6. Confirm old saved mixes, saved comparisons, account/profile records and other persistent data still load and re-save without losing supported values. Preserve records that use a newer unsupported schema rather than overwriting them.
7. Check NaN, Infinity, negative inputs, zero rate, zero CPI, maximum term, payoff near maturity, and rounding of the last installment where relevant.
8. Reconcile charts, summary cards, tables and comparison deltas to the exact same source schedule.
9. For account, CRM, document, API and portal work, test allowed and denied access across separate users, advisors, organizations and share revocation.
10. For email/reminder work, test duplicates, retry behavior, time zones, failed delivery, opt-in, unsubscribe and stale-source handling.
11. For file workflows, test upload validation, private-by-default storage, authorized downloads, expiring/revoked links, retention and deletion.
12. For recommendation or AI work, test missing/stale inputs, reproducibility, safe uncertainty, no unauthorized data access and no external action without confirmation.
A phase is not done merely because the UI appears. The calculation tests, accessibility/i18n coverage, compatibility checks, and any required official references are part of its acceptance criteria.
5. Recommended execution order
1. Phase 0: additive indexation accounting, results visibility, and MAX_MIXES separation.
2. Phase 1: grace periods and separate first/representative payments.
3. Phase 2: forecast paths and variable-rate resets.
4. Phase 3: internal early-payoff event simulation.
5. Phase 4: verified complete fee calculation and release gate.
6. Phase 5: fee-aware comparison, cumulative savings and break-even.
7. Phase 6: refinancing with historical reset dates.
8. Phase 7: balloon and staged releases.
9. Phase 8: IRR, market spread, OCR and reporting.
Do not skip ahead to a later phase because its UI is more visible. Later features depend on the accuracy and consistency of the monthly schedule.


Mortgage Simulation: Step-by-Step Implementation Plan
This breaks the roadmap and detailed implementation plan into small, sequential steps. Complete each step, run its focused tests, and review the result before moving on. Effort estimates are omitted because they are not commitments.
Before starting
Step 0  -  Establish the baseline
- Read AGENTS.md, docs/ROADMAP.md, and any legacy docs/SMARTNPV_IMPLEMENTATION.md if present. Record conflicts with this master plan before making changes.
- Run the existing tests, typecheck, lint, and relevant Playwright tests where dependencies allow.
- Record existing golden calculation results and verify saved mixes still load.
- Complete Step 0B's CSS inventory and migration map without changing CSS behavior; record the exact stylesheet path and supported import mechanism.
- Audit annual-rate basis, annual CPI conversion, first-month indexation, rate-reset timing, indexation/interest ledger semantics, zero-rate handling, rounding, and whether any current golden values encode bugs.
- Verify the applicable current BOI rules before implementing PTI or statutory early-repayment fees; record source URLs, effective dates and worked examples.
- Inspect the compare store and routes, profile/persistence model, current saved-mix schema, and the calculator's existing unsaved-changes modal.
- Keep the existing rate-validity feature and BOI average-rate tables stable; avoid regressions.
Done when: the baseline is understood and existing failures are distinguished from new ones.
Phase 0  -  Accounting, charts, indexation visibility, compare limits
Step 1  -  Add one shared payment-composition helper
- In src/lib/amortization.ts, derive netPrincipal, indexation, and interestPaid from each schedule row.
- Use netPrincipal = row.principal - row.indexation and preserve negative results.
- Do not mutate rows, round values, or format currency in this helper.
- Add unit tests for indexed/unlinked periods, zero indexation, negative net principal, monthly-to-yearly aggregation, and lifetime totals.
Done when: the components reconcile to the actual payment within a defined floating-point tolerance.
Step 2  -  Update the calculator amortization chart
- Update AmortizationChart.tsx to use the shared helper.
- Keep the remaining-balance series on its current scale and do not add CPI again to a balance that already includes it.
- Make tooltips and accessible text explain each component.
- Show negative components honestly; do not clamp them to zero.
- Add Hebrew and English strings and relevant UI tests.
Done when: calculator chart components add up to each period's payment.
Step 3  -  Update compare payment-composition charts
- Update trend.ts, CompareTrendChart.tsx, and computeScenario.ts to use the same helper.
- Match the calculator's component definitions and negative-value treatment.
- Keep the existing cumulative-indexation chart.
- Add or update unit and Playwright tests.
Done when: calculator and compare present the same component math without removing existing CPI visibility.
Step 4  -  Show total indexation in calculator results
- Add a dedicated total-indexation amount to ResultsCards.tsx, using the existing result-card/details patterns.
- Show it for mixes with indexed tracks and add Hebrew/English labels.
- Reconcile it with snapshot.totals.totalIndexation and the schedule totals.
- Update card-count, expand/collapse, unit, and e2e tests if needed.
Done when: users can find the total CPI indexation amount directly in results.
Step 5  -  Separate compare limits from track limits
- Keep MAX_TRACKS = 3 for tracks within one mortgage mix.
- Introduce MAX_MIXES = 4 for compare scenarios.
- Update compare controls, stores, styling, and tests for add, duplicate, seed, load, and compare behavior.
Done when: compare supports four mixes while each mix retains the existing track limit.
Step 5A - Add the compare unsaved-changes guard
- Reuse the calculator's current confirmation modal and navigation-guard pattern.
- Derive dirty state from a canonical snapshot of persisted comparison inputs.
- On attempted exit, offer Save changes, Discard changes, and Stay on page.
- Save must finish successfully before navigation. On failure, keep the compare page open and preserve edits.
- Do not prompt for a clean compare or transient presentation-only changes.
- Use the native browser beforeunload warning for reload/tab close; a custom modal is not supported for true page unload.
Done when: navigation behavior is tested for clean/dirty state, a new populated unsaved comparison, a blank untouched editor, save success/failure, discard restoring or clearing the in-memory draft, stay, and browser navigation.

Step 5B - Persist saved comparisons in the profile
- Follow the existing saved-mix profile, server, database, validation, and Better Auth patterns.
- Save a versioned snapshot of editable scenario inputs, up to four mixes, order, baseline selection, and all other calculation-relevant assumptions.
- Store input data as the source of truth and recalculate outputs through the shared schedule engine when restoring.
- Store each comparison independently from its source mixes so changes to source mixes cannot mutate saved comparisons.
- Add profile actions to save, open, rename, duplicate, and delete comparisons, with confirmation for deletion.
- Derive ownership from the authenticated server session and validate every read/update/delete. Never trust an owner ID sent by the client.
- Preserve per-scenario approval dates and the rest of the supported compare input state. Show success only after persistence is confirmed.
Done when: a comparison survives reload, restores equivalent calculations, can be managed in the profile, and cannot be accessed by another user.

Phase 0 exit check
- Confirm all charts use the shared helper and reconcile.
- Confirm existing saved mixes, routes, golden outputs, and the mobile no-horizontal-overflow contract still pass.
Phase 1  -  Grace periods
Step 6  -  Add backward-compatible grace fields
- Add optional per-track gracePeriodMonths and graceType (partial or full).
- Validate that grace is zero or less than the loan term; normalize the type when grace is zero.
- Update calculator state, compare scenarios, saved-mix schema, forms, and Hebrew/English strings.
- Old saved mixes must default to no grace and preserve all existing fields when saved again.
Done when: old data still loads unchanged and new grace settings round-trip through save/load.
Step 7  -  Implement grace calculations
- Partial grace: charge interest but no scheduled principal repayment.
- Full grace: scheduled payment is zero and unpaid interest is capitalized.
- Continue CPI on indexed tracks during grace.
- Keep grace within the original term; after grace, amortize the then-current balance over the remaining months.
- Handle equal-principal schedules explicitly so they neither leave a residual nor extend maturity.
Done when: golden tests cover both grace types, both repayment methods, indexed/unlinked tracks, zero rates, boundary lengths, and capitalization; the loan still ends on its original maturity month.
Step 8  -  Separate first and representative payments
- Keep firstPayment as the first actual payment, even when it is interest-only or zero.
- Add representativePayment as the first normal scheduled payment after grace; without grace, it equals the first payment.
- Keep representative payment as a planning output. Compute regulatory PTI only from the payment measure required by the current verified rule; do not assume representative payment is that measure without a citation.
- Show both values in calculator and compare results.
Done when: PTI and displayed payments use the correct values and RTL/LTR, narrow-screen tests pass.
Phase 2  -  CPI forecasts and variable-rate resets
Step 9  -  Define and validate forecast inputs
- Keep annual CPI as the backward-compatible fallback.
- Add optional month-indexed CPI assumptions and dated/month-indexed rate resets.
- Reject invalid values, duplicate reset months, out-of-term resets, and paths containing non-finite numbers.
- Use explicit user assumptions and deterministic interpolation; do not present them as official forecasts.
Done when: the forecast model is validated and schedules without forecast inputs remain unchanged.
Step 10  -  Apply monthly assumptions in the calculation engine
- Use one documented monthly event order: apply a rate reset, apply that month's rate, apply CPI where eligible, accrue interest, calculate the scheduled payment, apply payment, process any post-payment event, then record the closing balance.
- Preserve the existing rule that CPI does not apply in month 1 only if Step 0 verifies it and compatibility requires it. Document the behavior as an app-specific convention, not a universal mortgage rule.
- Recalculate payment using the current balance and remaining term after each reset, unless a future repayment mode explicitly preserves a fixed payment.
- Use the same assumptions in calculator and compare.
Done when: tests cover reset boundaries, multiple/final-month resets, CPI milestones, indexed/unlinked tracks, and interaction with grace.
Step 11  -  Expose forecast assumptions clearly
- Add a small forecast editor for user-entered milestones and assumptions.
- Make charts show the exact path used by the engine.
- Label outputs as scenario projections and show the assumptions/source in chart tooltips or a text summary.
Done when: users can understand which assumptions produced the forecast, and calculator/compare results match.
Phase 3  -  Early repayment and payoff events (internal only initially)
Step 12  -  Add full-mix and full-track payoff events
- Support closing an entire mix or fully repaying a selected track in a selected month.
- The event occurs after that month's scheduled payment.
- Stop future payments for the closed mix/track and report the payoff balance separately from future payments avoided.
- Keep the baseline schedule unchanged when no event is configured.
Done when: tests cover first, middle, and final months; reset/CPI overlap; and no payments after closure.
Step 13  -  Add partial prepayment modes
- Support a selected extra-principal amount with shortenTerm and reducePayment modes.
- For Spitzer, shorten the term while retaining the scheduled payment where possible, or recalculate payments while retaining maturity for reducePayment.
- For equal-principal, preserve the current principal installment where possible when shortening the term; recalculate remaining installments for reducePayment.
- Return event month, pre-event payment, balance before/after the event, extra principal, new payment or maturity, amount paid to date, and resulting schedule.
Done when: tests cover zero, valid, over-balance, and balance-equal amounts across both repayment methods and indexed/unlinked tracks.
Step 14  -  Keep payoff prototypes gated
- Until the statutory fee engine is complete and verified, keep payoff features internal-only/test-only or behind an internal feature flag.
- Do not call payments avoided guaranteed savings or present a fee-free result as a complete payoff quote.
- Keep fees separate from principal, CPI, and interest.
Done when: no public flow implies that an incomplete payoff calculation is the amount legally due.
Phase 4  -  Statutory early-repayment fee engine
Step 15  -  Verify the official rules before implementing formulas
- Document the applicable Bank of Israel rules, fee components, exemptions, discounts, comparison-rate buckets, amendments, and examples.
- Record source URLs and verification dates.
- Assemble official test fixtures and match at least two or three authoritative worked examples.
Done when: the rules and fixtures are documented well enough to implement without relying on this roadmap as a legal specification.
Step 16  -  Implement and validate the fee engine
- Build src/lib/prepayment.ts with each applicable fee component reported separately.
- Verify indexed and unlinked tracks, supported payoff cases, exemptions, discounts, and rounding boundaries.
- Reject invalid/non-finite inputs and represent unsupported cases explicitly; never return a confident-looking zero for an unsupported calculation.
- Keep incomplete fee coverage internal-only.
Done when: official examples match within stated rounding and incomplete cases cannot be shown as a complete statutory fee.
Step 17  -  Release the supported payoff flow
- Connect verified fee results to payoff scenarios only for explicitly supported track types and cases.
- Show fees as separate line items and retain the event-month convention.
- Add UI, localization, unit, and e2e coverage for supported and unsupported states.
Done when: public payoff output is enabled only for cases fully supported by the verified fee model.
Phase 5  -  Compare savings and break-even
Step 18  -  Add baseline-versus-candidate comparison metrics
- Use the shared monthly schedules to calculate differences in payment, remaining balance, interest, CPI indexation, fees, and cumulative net cash flow.
- Include fees only where Phase 4 verifies they are supported.
- Distinguish cash-flow savings from nominal lifetime repayment differences.
Done when: comparison totals reconcile to the underlying monthly cash flows.
Step 19  -  Add break-even analysis
- Define cash-flow savings as baseline borrower cash outflow minus candidate borrower cash outflow, and state the sign convention.
- Mark the month/year when cumulative net savings first cross zero. If they never cross zero within the comparison horizon, say so explicitly.
- Compare both scenarios on a common horizon and account for terminal outstanding balances/obligations, or label the result as cash-flow-only. Do not claim a refinance is economically better merely because a longer term lowers monthly payments.
- Keep the compare page readable at roughly 360px and at the existing desktop test width.
Done when: break-even results are correct for positive, negative, and never-break-even scenarios.
Phase 6  -  Refinancing workflow
Step 20  -  Model the existing mortgage separately
- Capture each current track's balance, original terms/rate data required for fee calculation, next reset date, reset frequency, linkage, repayment method, and payoff date.
- Mark missing document data as unknown instead of guessing.
- Preserve historical reset calendars.
Done when: the existing mortgage can be represented without overwriting or inventing missing details.
Step 21  -  Build and compare a proposed refinance
- Allow users to duplicate the existing mortgage into a proposed mix without altering the original.
- Make it explicit whether verified fees are paid in cash or capitalized into the new loan.
- Compare old and new schedules on the same horizon, with fee-inclusive cash flows and a break-even point.
- Do not start this phase until Phases 1–5 are stable and fee handling is verified.
Done when: historical resets, fee treatment, cumulative savings, and break-even reconcile to the monthly cash flows.
Phase 7  -  Balloon loans and staged releases
Step 22  -  Add explicit balloon schedule types
- Support full and partial balloons as their own schedule types; do not infer a balloon from grace fields.
- Define which principal amortizes and which amount remains due at maturity.
- Define contract-specific interest handling and test the maturity balance.
Done when: balloon behavior is explicit and verified for full and partial structures.
Step 23  -  Add staged disbursement events
- Add dated/month-indexed draw events with amount and destination track.
- Calculate CPI and interest only on amounts already disbursed.
- Keep the approved amount separate from the amount drawn.
Done when: tests cover uneven draws, different dates, indexed/unlinked tracks, no draw, full draw, and balloon balances at maturity.
Phase 8  -  Advisor metrics and operational features
Step 24  -  Add verified cash-flow metrics
- Add forecast-driven effective IRR from dated cash flows, documenting treatment of CPI and fees.
- Consider return per shekel, duration, and market spread only after each metric has a documented definition and tested reference values.
- Do not treat bank margin as interchangeable with market spread.
Done when: each displayed metric has a precise definition and reconciles to the shared schedule.
Step 25  -  Add reviewed document extraction
- Add OCR for approval documents and payoff-balance reports only after the core calculation and supported payoff flows are trusted.
- Treat extracted values as untrusted candidates and require user review before they affect a calculation.
- Preserve source-document identity and the source page/field for extracted financial values where practical.
- Support multiple payoff statements without overwriting previously reviewed tracks.
- Never fill missing financial values with guesses; bank-specific document handling requires fixtures for each supported format.
Done when: extracted data is reviewable, unknown values remain unknown, and accepting a document cannot silently change unrelated data.

Step 26  -  Add verified anchor refresh and indicative-rate estimates
- Verify each anchor's official/contractual source, eligible track types, reset behavior, effective date and stale-data fallback.
- Keep rate basis and linkage explicit. Separate verified published data from estimated bank pricing. Never claim a model estimate is a bank quote.
- Do not use capital risk weights as an interest-rate multiplier unless a documented calibrated pricing model and current regulatory source support it.
Done when: the source/as-of status is visible and missing/stale data cannot produce a fabricated current rate.

Step 27  -  Add a combined-loan / merge view
- Allow two or more separate loan schedules to be viewed as one combined household obligation without changing their original terms or source records.
- Aggregate monthly cash flows and balances only on a common date timeline. Preserve per-loan labels, reset dates, CPI assumptions, fees and provenance.
- Keep `MAX_TRACKS` scoped to tracks in a normal mix and `MAX_MIXES` scoped to compare scenarios; do not bypass either by silently flattening loans.
Done when: combined totals reconcile to the sum of their independent source schedules and no source mix is mutated.

Step 28  -  Add Ministry of Housing eligibility
- Verify the current Ministry rules and official source before calculating eligibility points/amounts or creating a subsidized track.
- Record the input fields and rule/source version used. Show unknown or unsupported situations for review rather than guessing eligibility.
Done when: official fixtures and boundary cases pass and generated tracks contain an auditable source/assumption record.

Step 29  -  Add advisor overview, case notes and support flow where in scope
- Reuse the existing deal/profile data and show property value, equity, income and loan summary without introducing duplicated competing state.
- Store dated case notes with ownership checks and predictable edit/delete behavior.
- A support ticket may include case data only after explicit user selection/consent; show exactly what is shared.
Done when: profile data reconciles to the source record, notes persist securely, and support sharing is opt-in.

Step 30  -  Complete reporting and rate-validity notifications
- Generate single-mix, 1-on-1 compare, multi-mix compare and amortization-schedule reports from the same calculation snapshots used by the UI.
- Support Hebrew and English, plus Russian only if all report strings and layouts are fully implemented and tested.
- Allow modular inclusion of advisor metrics without hiding assumptions essential to interpreting the numbers.
- Add rate-expiry alerts based on the verified 24-day approval-in-principle rule, with explicit issue/expiry dates and actionable warnings. Notification delivery needs its own tests.
Done when: exported values reconcile with the app, every enabled language is complete, and notifications do not fire from stale or invalid dates.
Phase 10  -  Secure accounts and personal financial records
Step 31  -  Audit roles, authentication, ownership and persistence
- Inspect existing Better Auth configuration, MongoDB models, saved-mix persistence, server action/API patterns and environment configuration. Reuse the current stack.
- Define consumer, advisor and organization-admin permissions only where required. Add platform-admin access only if justified.
- Enforce owner, organization and share policies in every server-side data operation. Never authorize from client-supplied IDs or UI state alone.
- Add schema validation, safe migrations, audit records for sensitive changes, data minimization and secure file-access patterns. Keep secrets server-side and redact sensitive values from logs.
Done when: role/ownership rules are documented and covered by negative access tests, existing login still works, and legacy data remains readable.

Step 31B  -  Refactor the global stylesheet in small, verified slices
- Use the Step 0B inventory to decide the target file map based on actual repo conventions. Do not assume the existing path or router type.
- Keep a single, clearly documented global entry point and deterministic order. Preserve original rule order as rules are moved. Confirm imports work in the installed Next.js version and existing CSS/PostCSS setup.
- Move only broad, truly global concerns into ordered global partials; gradually move component/feature styles to CSS Modules where safe. Start with one low-risk section and expand after visual validation.
- Do not combine cleanup, selector renaming, specificity reduction or design changes with the mechanical move. Search all code for dynamic/conditional use before deleting rules.
- Build for production and compare screenshots/pages before and after. Cover RTL/LTR, themes, responsive breakpoints, calculator, compare, modal, profile, and any existing CRM/shop routes. Fix regressions before extracting another section.
Done when: the large stylesheet has clear ownership and an understandable import graph, rules are not unintentionally duplicated, relevant production and test checks pass, and visuals/behavior match the recorded baseline.

Step 32  -  Persist a consumer financial profile
- Store user-selected mortgage/track, other loan, pension/retirement, insurance, property/equity and household-income details that the app actually supports.
- Record source, as-of date, last-verified date and whether each figure is manual, imported, OCR-extracted or externally verified. Unknown values remain unknown.
- Do not assume pension-provider connectivity. Start with reviewed manual entry/import unless a supported integration is confirmed.
- Apply authenticated ownership, validation, sensitive-data minimization and predictable edit/export/delete behavior.
Done when: records persist across sessions, ownership isolation is tested, provenance/freshness is visible and unsupported data sources are not implied.

Step 33  -  Build the personal financial dashboard
- Show known mortgage balances, payment, estimated remaining term, reset/renewal dates, other loan obligations, insurance premiums/renewals, property/equity and user-entered pension details.
- Separate assets, liabilities, monthly outflows and estimates. Do not add insurance or pension values to mortgage calculations unless explicitly included in a metric definition.
- Show source and last-updated date, indicate incomplete/stale data and let users correct it. Link summary metrics to their underlying records.
Done when: displayed amounts reconcile to source records, stale data is visible and profile data is private by default.

Phase 11  -  Goal-based mortgage analysis and explanations
Step 34  -  Capture the purpose and constraints of the property
- Ask whether the property is owner-occupied or an investment/rental property and capture goals, payment limits, payoff horizon, equity/cash reserve and risk preferences where relevant.
- For rentals, support expected rent, vacancy allowance, recurring expenses, insurance and optional user-entered tax/other costs. State which costs are omitted.
- Treat a 30-year term as a scenario to compare, not a universal rule. Gross rent above mortgage payment does not prove profitability.
- Preserve old behavior when no goal profile is provided.
Done when: purpose and constraints can be saved/reloaded, inputs are validated, missing assumptions are surfaced and no blanket rule decides the recommendation.

Step 35  -  Explain mixes, compare repayment methods and analyze payoff priority
- Explain payment trajectory, rate/reset and CPI risk, term, grace, total repayment and assumptions for every mix/track.
- Compare Spitzer and equal-principal alternatives using the shared schedule engine. Explain their typical trade-off without presenting it as universal under changing rates/CPI.
- For owner-occupied homes, compare a shorter affordable term with a lower-payment option. For rentals, show gross rent, estimated net cash flow after declared costs, rent coverage, debt trajectory and supported downside scenarios.
- Analyze which track to prepay first only after payoff events and fee logic are trusted. Include interest/indexation avoided, remaining balance, payment impact, verified fees, common-horizon cost and liquidity trade-offs.
- Do not claim unsupported cases have a definitive winner or fee calculation.
Done when: explanations/rankings reconcile to computed scenarios, assumptions are visible and missing data does not produce false precision.

Phase 12  -  Advisor CRM and workflow
Step 36  -  Expand the advisor overview into a case-management workspace
- Build on existing profile and case-note patterns. Include assigned clients, deal summary, case stage, next action, notes, related documents, mixes and comparisons.
- Add configurable pipeline stages, assignment, search/pagination and a quick-link registry for official bank portals/forms.
- Support sharing between authorized advisors with explicit share/unshare, organization boundaries, visible collaborators and audit history. Revocation must affect subsequent requests.
- Keep canonical mortgage data in existing records; do not fork a competing CRM copy of calculation state.
Done when: role access, reassignment/revocation, search, pagination and source-record consistency pass tests.

Step 37  -  Add tasks, reminders and workflow automation
- Support case-linked tasks with owner, due date, status, priority, stage, notes and optional email reminders. Add reusable workflow templates only after state transitions are defined.
- Prevent duplicate sends with idempotency or stable notification records; record delivery state and safe retries.
- Offer a focused dashboard for overdue, due-soon and completed work. Team workload reports must not expose unrelated client data.
Done when: task state persists, reminder dates/time zones are tested, duplicate sends are prevented and reports reconcile to task records.

Phase 13  -  Documents and customer portal
Step 38  -  Build a private document vault, checklist and client portal
- Associate private uploads with client/case and document type. Track requested, received, needs-correction and verified status, reviewer and due date.
- Allow clients to view requests and upload documents with explicit permissions, revocation and scoped/expiring share links where required.
- Use private storage, upload size/type checks, secure download authorization and retention/deletion rules. Add malware scanning where available before production.
- Keep an official/licensed digital document library distinct from private client documents, with source/version/effective-date metadata. Never copy proprietary SmartNPV documents.
Done when: uploads are private by default, access controls pass tests, checklist transitions are auditable and unauthorized links fail safely.

Step 39  -  Generate reviewed bank letters and prepare submissions
- Generate editable letter drafts and bank-document packages from known client/deal values; flag missing fields instead of guessing.
- Require advisor review before export/sending. Keep template version, data snapshot and approval metadata.
- Use digital bank submission only through a verified, authorized integration. Otherwise provide a package and link to the official submission channel.
- Record receipt/response only when the external system provides verifiable confirmation.
Done when: drafts are reproducible and reviewable, exports honor permissions and the UI never claims submission succeeded without evidence.

Phase 14  -  Partners, insurance and rate-change notifications
Step 40  -  Add partner/affiliate and insurance workflows
- Add configurable categories for realtors, real-estate/mortgage lawyers, insurance agents, appraisers and other approved providers.
- Disclose referral fees/affiliations clearly. Obtain consent before sharing client details; allow users to decline. Do not let commission determine an undisclosed ranking.
- Add user-entered insurance policies, premiums, coverage, renewal dates and documents. Begin with recordkeeping/reminders, not unsupported individualized coverage recommendations.
Done when: disclosure, consent, data-minimized referrals and insurance reminders are tested.

Step 41  -  Send opt-in rate-change and mortgage alerts
- Distinguish public published benchmark/rate-table changes from a user's contractual reset and from indicative lender estimates.
- Let users choose watched sources/tracks, threshold, frequency and language. Include prior/new values, source and as-of/effective date.
- Trigger alerts only from verified updates or known saved reset/expiry dates. Deduplicate, log delivery state, retry safely and provide unsubscribe/preferences.
- Reuse the existing server-side email setup after auditing it. Never expose SMTP/API credentials or include sensitive financial details in email by default.
Done when: opt-in/unsubscribe work, duplicates are suppressed, stale data does not trigger false alerts and failures are observable.

Phase 15  -  Feedback, reporting, APIs and optional AI
Step 42  -  Add customer feedback and business reporting
- Let authorized advisors create surveys for a case/milestone, with configurable questions, consent/attribution and retention controls.
- Report response rates and aggregate results without implying small samples are representative. Restrict results to authorized roles.
- Build reports only from defined source-backed metrics such as cases by stage, overdue tasks, workflow durations and survey outcomes. Reconcile exports to screen totals and apply the same permissions.
Done when: survey access, aggregation, retention and reports are tested; exports cannot bypass access controls.

Step 43  -  Add a secure versioned API and selected integrations
- Define a versioned server-side contract for approved client, case, simulation-summary and workflow operations after data models and permissions stabilize.
- Keep secrets server-side; support scoped credentials, rotation/revocation, rate limits, validation, idempotency and redacted logs. Document auth, permissions, errors and compatibility.
- Integrate SmartNPV, a bank or another provider only where need, contract support and authorization are verified. Do not use sample credentials or undocumented endpoints.
Done when: contract/permission tests pass, secrets remain private, retries do not duplicate records and failures are safe and observable.

Step 44  -  Evaluate a read-only AI assistant
- Start with opt-in, read-only explanations of the user's selected mortgage, mix and comparison, grounded in saved records, calculations and documented assumptions.
- Proposals must use the shared calculation engine and require user confirmation before saving, editing, emailing, sharing or submitting anything.
- Enforce existing authorization; minimize third-party transfer; exclude sensitive pension/documents by default and obtain explicit consent when needed.
- Treat document text as untrusted. Test hallucinated values, prompt injection, missing inputs, stale data, cross-account access and known calculation fixtures.
Done when: answers are grounded, calculations reproducible, unauthorized records cannot leak and no external action occurs without confirmation.

Required checks for every step
1. Add or update pure calculation tests before or alongside UI work.
2. Manually verify at least two or three sample calculations where the math changes.
3. Run focused tests, then npm test, npm run typecheck, and npm run lint when dependencies are installed.
4. Run relevant Playwright tests and the full npm run test:e2e suite when practical.
5. Check Hebrew RTL and English LTR, light and dark themes, and a narrow viewport around 360px.
6. Verify old saved mixes, saved comparisons, account/profile records and other persistent data still load and re-save without supported data loss. Preserve records with an unsupported newer schema rather than overwriting them.
7. Test invalid/non-finite inputs, zero rate/CPI, maximum term, payoff near maturity, and final-payment rounding where relevant.
8. Reconcile charts, cards, tables, and comparison results to the same calculated schedule.
9. For account, CRM, document, API and portal work, test allowed and denied access across users, advisors, organizations and share revocation.
10. For email/reminder work, test duplicate prevention, retries, time zones, failed delivery, opt-in, unsubscribe and stale-source handling.
11. For file workflows, test upload validation, private-by-default storage, authorized downloads, expiring/revoked links, retention and deletion.
12. For recommendation or AI work, test missing/stale inputs, reproducibility, uncertainty handling, authorization isolation and confirmation before external actions.
Non-negotiable rules
- The shared monthly schedule is the source of truth; do not duplicate mortgage arithmetic in React components.
- Every rate input has a declared annualization/compounding basis; effective annual BOI rates are never treated as nominal annual rates by accident.
- CPI assumptions use an explicit conversion/index-ratio convention and do not apply an annual percentage as if it were a monthly value.
- Refinance break-even includes fees exactly once and considers ending liabilities on a common horizon.
- PTI uses the current verified regulation and is not a hard <=40% validation rule solely because the tutorial says so.
- Any current legal/regulatory number has a source URL, verification date and fixture/test; unverified fee rules remain gated.
- Preserve legacy results when no new optional feature is configured.
- Keep MAX_TRACKS and MAX_MIXES separate.
- Never double-count CPI indexation in balances or principal; the indexed balance already includes it.
- Never clamp negative net principal just to make a chart look normal.
- Keep statutory fees separate from principal, indexation, and interest.
- Label forecasts as assumptions, not predictions or official rates.
- A phase is not complete just because the UI looks correct: tests, compatibility, localization, accessibility, and required official sources are part of done.
