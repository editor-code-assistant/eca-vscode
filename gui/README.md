# ECA GUI

This is the React frontend for the ECA VS Code extension.

## Development

To start the development server:

```bash
npm run dev
```

This will start Vite dev server on `http://localhost:5173`.

## Building

To build for production:

```bash
npm run build
```

This will create optimized files in the `assets/` directory:
- `index.js` - The main JavaScript bundle
- `index.css` - The main CSS bundle

## VS Code Integration

The VS Code extension (`chat.ts`) automatically detects if it's running in development mode and uses the Vite dev server, otherwise it uses the built assets.

## Project Structure

- `src/main.tsx` - Entry point
- `src/App.tsx` - Main chat component
- `src/App.css` - Component styles
- `src/index.css` - Global styles
- `vite.config.ts` - Vite configuration
- `tsconfig.json` - TypeScript configuration