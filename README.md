# dc-manager

A modern, modular DataCite repository management console for listing, editing, batch updating, and exporting DOIs.

## Features

- Login/logout with DataCite repository credentials (stored only in memory).
- List and filter DOIs with a DataTables-powered table.
- JSON/XML editor modal with upsert support.
- Status changes and draft deletion with confirmation.
- Batch upload for JSON/XML metadata.
- Advanced batch updates with conditional logic and recursive array traversal.
- ZIP export of displayed DOIs.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` to use the app.

## Configuration

- `VITE_DEFAULT_API_BASE` in `.env` controls the default API base URL.
- Use Test or Production environments via the login screen.

## Security Notes

- Passwords are **never persisted**; they are stored only in memory for the current session.
- Avoid sharing sessions or screenshots that might include sensitive data.

## Testing

```bash
npm run test
npm run e2e
```

## GitHub Pages Deployment

This repository includes a GitHub Pages workflow that builds the Vite app with the correct base
path and deploys the `dist` output on pushes to `main`.

## Troubleshooting

See [docs/en/troubleshooting.md](docs/en/troubleshooting.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for development and PR guidance.
