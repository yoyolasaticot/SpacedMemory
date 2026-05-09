# Application Jeu

Application Vite + React + TypeScript utilisant Supabase.

## Developpement local

1. Installer les dependances :

```bash
npm install
```

2. Creer un fichier `.env` a partir de `.env.example`, puis renseigner :

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

3. Lancer l'application :

```bash
npm run dev
```

## Build

```bash
npm run build
```

La sortie de production est generee dans `dist/`.

## Deploiement GitHub + Vercel

1. Creer un repository GitHub vide.
2. Initialiser Git et pousser le projet :

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<utilisateur>/<repo>.git
git push -u origin main
```

3. Dans Vercel, importer le repository GitHub.
4. Verifier les reglages :

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

5. Ajouter les variables d'environnement dans Vercel :

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

6. Deployer. Les prochains `git push` sur `main` redeploieront automatiquement l'application.
