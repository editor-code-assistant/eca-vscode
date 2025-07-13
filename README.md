# ECA VsCode

:warning: The project is still alpha and experimental, with bugs and missing features, but being consistenly improved.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

ECA (Editor Code Assistant) Vscode is an AI-powered pair-programming client for VsCode.
It connects to an external `eca` server process to provide interactive chat, code suggestions, context management and more.

For more details about ECA, check [ECA server](https://github.com/editor-code-assistant/eca).

## Settings

- `eca.serverPath`: Custom server path, if not set it will download latest server from https://github.com/editor-code-assistant/eca

## Development

```bash
npm run dev:gui
```

This will start Vite dev server on `http://localhost:5173`, so any changes will be updated on the vscode live.

then start vscode on debug mode, open this project in vscode and hit F5 (Debug), this should open a new vscode extension with this plugin running.

