# Sigma HQ - Technical Office Command Center

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run locally
npm run dev

# 3. Build for production
npm run build
```

## Project Structure

```
sigma-hq-app/
├── src/
│   ├── components/          # Individual UI components
│   │   ├── Sidebar.jsx      # Left navigation
│   │   ├── Header.jsx       # Top header bar
│   │   ├── Overview.jsx     # Dashboard view
│   │   ├── ProjectHome.jsx  # Home tab
│   │   ├── AIChat.jsx       # AI Intel tab
│   │   ├── Vault.jsx        # GCS Vault tab (Quick Access + Submissions)
│   │   ├── Actions.jsx      # Actions tab
│   │   ├── Modal.jsx        # New project modal
│   │   ├── ChatPanel.jsx    # Bottom chat panel
│   │   └── Icon.jsx         # Icon wrapper
│   ├── App.jsx              # Main app (routing + state)
│   ├── config.js            # Settings (colors, URLs, branding)
│   ├── firebase.js          # Firebase initialization
│   ├── main.jsx             # Entry point
│   └── index.css            # Styles
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Making Changes

**To change colors/branding:** Edit `src/config.js`

**To change the vault/tracker:** Edit `src/components/Vault.jsx`

**To change tabs:** Edit `src/config.js` (TABS array) and add component

**To change the sidebar:** Edit `src/components/Sidebar.jsx`

## Deploy to Netlify

1. Push to GitHub
2. Connect repo to Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`

Auto-deploys on every push to main branch.
