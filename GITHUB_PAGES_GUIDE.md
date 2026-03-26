# 🚀 Guide GitHub Pages — Étape par étape

## ÉTAPE 1 : Préparer votre dépôt GitHub

### 1a. Aller sur github.com et créer un compte si besoin

### 1b. Créer un nouveau dépôt
1. Cliquez sur le **+** en haut à droite → **New repository**
2. Nom : `bisou-sucre-paques` (exactement)
3. Visibilité : **Public** (obligatoire pour GitHub Pages gratuit)
4. Ne cochez rien d'autre → **Create repository**

### 1c. Copier l'URL de votre dépôt
Elle ressemble à : `https://github.com/VotreNom/bisou-sucre-paques.git`
https://github.com/atelierdubisousucre/bisou-sucre-paques.git

---

## ÉTAPE 2 : Envoyer le projet sur GitHub (PowerShell)

```powershell
# Aller dans votre dossier projet
cd C:\Users\Jean-Sébastien\bisou-sucre-paques

# Initialiser Git (si pas déjà fait)
git init

# Connecter à GitHub (remplacer par votre URL)
git remote add origin https://github.com/VotreNom/bisou-sucre-paques.git

# Ajouter tous les fichiers
git add .

# Premier commit
git commit -m "🐣 Initial commit - Application Joyeuses Pâques"

# Envoyer sur GitHub
git branch -M main
git push -u origin main
```

---

## ÉTAPE 3 : Activer GitHub Pages avec GitHub Actions

### 3a. Sur GitHub, aller dans Settings de votre dépôt
1. Cliquez sur **Settings** (onglet en haut)
2. Dans le menu gauche : **Pages**
3. Sous "Source" : sélectionnez **GitHub Actions**
4. Cliquez **Save**

### 3b. Vérifier que le fichier workflow est présent
Le fichier `.github/workflows/deploy.yml` doit être dans votre projet.
Il est déjà inclus dans les fichiers fournis ici.

### 3c. Déclencher le premier déploiement
```powershell
# Le déploiement se lance automatiquement à chaque push
# Pour forcer un déploiement maintenant :
git commit --allow-empty -m "🚀 Trigger first deployment"
git push
```

---

## ÉTAPE 4 : Suivre le déploiement

1. Sur GitHub, cliquez sur l'onglet **Actions**
2. Vous verrez un workflow "Deploy to GitHub Pages" en cours
3. Attendez qu'il devienne ✅ vert (2-5 minutes)
4. Votre app est disponible à :
   `https://VotreNom.github.io/bisou-sucre-paques/`

---

## ÉTAPE 5 : Mettre à jour l'application

À chaque modification, il suffit de :

```powershell
# Dans votre dossier projet
git add .
git commit -m "Description de la modification"
git push
```
GitHub Actions rebuild et redéploie automatiquement en 2-3 minutes.

---

## ⚠️ Points importants

**Limitation caméra sur le web :**
La caméra fonctionne sur Chrome/Edge (HTTPS requis → GitHub Pages utilise HTTPS ✅)
Elle ne fonctionne pas sur tous les navigateurs mobile.

**Sauvegarde taquin sur le web :**
AsyncStorage → localStorage automatiquement avec Expo Web.
La progression est sauvegardée dans le navigateur.

**Photo avec cadre sur le web :**
La composition WebView → Canvas fonctionne normalement sur Chrome/Edge.

---

## Structure des fichiers importants pour GitHub

```
bisou-sucre-paques/
├── .github/
│   └── workflows/
│       └── deploy.yml     ← Déploiement automatique
├── assets/                ← Images de l'app
├── src/                   ← Code source
├── app.json               ← Config Expo
├── package.json           ← Dépendances
└── ...
```
