# Contributing to ANKR Interact

Thank you for your interest in contributing. Every contribution matters — code, docs, bundles, translations, or bug reports.

## Ways to Contribute

| Type | How |
|------|-----|
| Bug report | [Open an issue](https://github.com/rocketlang/ankr-interact/issues/new?template=bug_report.md) |
| Feature request | [Open a discussion](https://github.com/rocketlang/ankr-interact/discussions/new) |
| Code fix/feature | Fork → branch → PR |
| Bundle template | Add to `/bundles/templates/` |
| Language pack | Add to `/src/i18n/` |
| Documentation | Edit any `.md` file |

## Development Setup

```bash
git clone https://github.com/rocketlang/ankr-interact
cd ankr-interact
cp .env.example .env
pnpm install
pnpm run db:push
pnpm run dev
```

Runs at `http://localhost:3199`.

## Project Structure

```
src/
├── server/          # Fastify backend
│   ├── routes/      # REST endpoints
│   ├── graphql/     # Mercurius resolvers + schema
│   └── services/    # Business logic
├── client/
│   ├── viewer/      # Knowledge graph app
│   ├── platform/    # LMS platform app
│   └── student/     # Student app
└── shared/          # Types, utils shared by client + server
bundles/
└── templates/       # Seed bundle templates (.ib)
docs/                # Developer documentation
```

## Pull Request Guidelines

1. **One PR per concern** — keep changes focused
2. **Branch naming:** `feat/description`, `fix/description`, `docs/description`
3. **Test your change** — run `pnpm test` before submitting
4. **Update docs** — if you add a feature, update the relevant `.md`
5. **No breaking changes** without a discussion issue first

## Bundle Contributions

To add a bundle template:
1. Create a folder in `/bundles/templates/your-bundle-name/`
2. Add `manifest.json`, `docs/`, and optionally `quizzes/`, `flashcards/`, `courses/`
3. Run `pnpm run bundle:validate your-bundle-name`
4. Submit a PR

## Code Style

- TypeScript strict mode
- Prettier (auto-formatted on save)
- ESLint — run `pnpm lint` before PR
- No hardcoded ports or URLs — use environment variables

## Commit Convention

```
feat: add flashcard export to PDF
fix: resolve wiki-link autocomplete crash on mobile
docs: update self-hosting nginx example
bundle: add UPSC History flashcard deck
i18n: add Bengali translations for platform UI
```

## License

By contributing, you agree your contributions will be licensed under Apache 2.0.

---

Questions? Open a [Discussion](https://github.com/rocketlang/ankr-interact/discussions) or join our Discord.
