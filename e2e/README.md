# End-to-End Tests

Run the browser smoke suite with:

```sh
pnpm run test:e2e
```

The Playwright config starts the existing development server, which starts the
repo PostgreSQL container and runs migrations. Install browser binaries once per
machine with:

```sh
pnpm exec playwright install
```
