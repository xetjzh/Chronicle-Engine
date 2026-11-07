# Writing and AI connection fixes

User-reported scope: pure writing cannot delete chapters; tuning presets appear unselectable; improve AI connection reliability. Continue in the existing checkout, preserve browser data and existing provider modes. The user subsequently authorized committing and uploading the completed changes after verification. No live inference is requested.

## Findings and implementation

- The pure-writing editor had no delete control/handler. Add per-row controls and an explicit confirmation dialog, immutable deletion, neighboring selection, final-chapter empty state and no writes after stale project confirmation. Preserve existing storage and late AI-write protections.
- Preset callbacks updated draft state but rendered no selected state. Expose pressed/highlight/check feedback, retain save/cancel semantics and configured endpoints/credentials/model identifiers, and mark manual sampling/note changes custom.
- Make health requests cancelable and bounded, ignore stale results, and honor the configured Gemini model. Generation deadlines include response-body reads; malformed/empty replies must fail honestly. Preserve URL path/query data, normalize header casing and show redacted errors. No automatic billable retries.
- Preserve standard fetch behavior in the Vertex shim for Request/URL/string inputs, request bodies, whitelisted headers and AbortSignal. Use the captured native fetch and propagate rejection; never forward SDK credentials to the ADC proxy. Test the actual installed browser Gemini SDK offline as well as transport boundaries.
- Known Gemini 2.5 Pro cannot disable thinking. Normalize legacy caller budget zero to the supported minimum of 128 and use a bounded compatible probe; never silently increase a user's output cap. Explain this behavior in settings.
- Pure-writing operations must consume the selected sampling parameters and enabled author note. Remove the forced temperature and fixed classical-style instruction that bypassed the selected preset.

## Verification

- Regression tests cover deletion transforms and real component callback/state transitions, preset selection/save/reopen and preserved connection settings, cancellation and stale requests, provider errors/timeouts/output validation, fetch forms and the installed browser SDK.
- Run `npm run check`, scoped whitespace validation and independent review after integration. Tests replace remote provider boundaries and do not perform paid calls.
- Computer-use inventory reported both browser host and Windows native pipe unavailable. Browser layout, actual pointer/focus behavior and live provider authorization remain unverified; component callback tests do not substitute for those claims.

## Completed verification

- `npm run check`: exit 0; frontend 115, backend 19 and delivery smoke 4 tests passed (138 total), with frontend typecheck, backend syntax check and Vite production build successful.
- Regression tests first reproduced missing chapter deletion, preset feedback/model preservation, connection/timeout/output failures, shim Request/URL/cancellation failures, pure-writing preset bypass and known Pro budget edge cases before their fixes.
- Independent review checked deletion/data preservation, cancellation/request identity, settings save, transport and SDK integration. Its finding that pure writing bypassed preset temperature/author notes was fixed and verified with failing-then-passing component tests.
- Installed `@google/genai/web` drives real `generateContent` through the real interceptor against an offline transport; its generated payload passes the backend body policy and its placeholder API key is not forwarded. No real inference, new dependency or backend behavior change was introduced.
