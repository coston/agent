# @coston/agent demo

A tiny Vite + React Router app that mounts every `@coston/agent/react` view in a
deterministic state (mocked transport, no live LLM or network) so Playwright can
baseline desktop + mobile screenshots of each one.

It consumes the package via `file:..`, so **build the package first**:

```bash
# from the repo root
npm run build

# then, in this directory
npm install
npm run dev            # http://localhost:5173
```

A left sidebar lists every view, grouped (Chat, Tool calls, Panel, Provider,
…); use the **Theme** button to toggle light/dark live. To see what tool calls
render like, open the **Tool calls** group (running / completed / error /
approval) — the completed and error cards expand on click to reveal output.

Iterating on the package while the demo runs: rerun `npm run build` in the repo
root, then restart `npm run dev`. The dev script runs `vite --force` so it
re-bundles the freshly built `dist` on start — Vite does not watch `dist` under
`node_modules`, so a plain HMR reload would otherwise serve the stale bundle.

## Visual baselines

```bash
npm run test:visual:update   # (re)generate baselines
npm run test:visual          # compare against committed baselines
npm run test:report          # open the last HTML report
```

Coverage = each view × {desktop (1280×800), mobile (390×844)} × {light, dark}.
Baselines are committed under `tests/visual.spec.ts-snapshots/` and are
**platform-specific** (the filename carries the OS, e.g. `…-desktop-darwin.png`);
regenerate them on the same OS used to review diffs.

### Views

Routes live in `src/App.tsx`; fixtures and the no-op transport in `src/lib/`.
Overlay states (session switcher, rename/delete dialogs, config panel,
expandable tool cards, the attachment strip) are opened by the spec's `prepare`
steps via the components' `data-testid`s.

> **Not baselined:** the live streaming / Stop-button state. It depends on
> in-flight `useChat` status and isn't deterministic, so it's intentionally
> excluded rather than captured flakily.
