# 🌐 Déploiement Web — Joyeuses Pâques Bisou Sucré

## Option 1 : GitHub Pages (recommandé — gratuit)

### Étape 1 : Exporter l'application web
```powershell
# Dans le dossier du projet
npx expo export --platform web
```
Cela génère un dossier `dist/` avec tous les fichiers web.

### Étape 2 : Pousser sur GitHub
```powershell
git add .
git commit -m "🌐 Build web"
git push
```

### Étape 3 : Activer GitHub Pages
1. Allez sur votre dépôt GitHub
2. **Settings** → **Pages**
3. Source : **Deploy from a branch**
4. Branch : `main` / dossier : `/ (root)` → **Save**

⚠️ GitHub Pages sert la racine du repo, pas le dossier `dist/`.
Solution : utiliser **GitHub Actions** pour automatiser le déploiement.

### Étape 4 : GitHub Actions (déploiement automatique)
Créez le fichier `.github/workflows/deploy.yml` :

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install --legacy-peer-deps
      - run: npx expo export --platform web
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

À chaque `git push`, l'application est automatiquement buildée et déployée.
L'URL sera : `https://VotreCompte.github.io/bisou-sucre-paques/`

---

## Option 2 : Netlify (encore plus simple)

1. Allez sur **netlify.com** → **Add new site** → **Import from Git**
2. Connectez votre dépôt GitHub
3. Build command : `npx expo export --platform web`
4. Publish directory : `dist`
5. **Deploy** → URL automatique type `bisou-sucre-paques.netlify.app`

---

## Option 3 : Vercel

```powershell
npm install -g vercel
vercel
```
Suivez les instructions. Vercel détecte automatiquement Expo.

---

## ⚠️ Limitations connues sur le Web

| Fonctionnalité | Mobile | Web |
|---|---|---|
| Caméra | ✅ Complète | ⚠️ Selon navigateur (Chrome OK) |
| Sauvegarde galerie | ✅ | ❌ Remplacé par téléchargement |
| Partage natif | ✅ | ⚠️ Web Share API (Chrome/Edge) |
| Taquin (swipe) | ✅ | ✅ (souris/touch) |
| Sauvegarde progression | ✅ AsyncStorage | ✅ localStorage |

