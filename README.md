# 🐣 Joyeuses Pâques — L'Atelier du Bisou Sucré

Application mobile et web sur le thème de Pâques, réalisée avec **React Native + Expo**.  
Compatible iOS, Android et Web depuis un seul codebase.

---

## ✨ Fonctionnalités

### 📸 Mode Photo
- Prévisualisation en direct de la caméra avec le cadre de Pâques en overlay
- Prise de photo en portrait, haute qualité (JPEG 100 %)
- Composition automatique photo + cadre via ViewShot
- **Sauvegarde** dans l'album « Joyeuses Pâques 🐣 » de la galerie
- **Partage** direct (WhatsApp, Instagram, iMessage…)
- Bouton flip (caméra avant ↔ arrière)

### 🧩 Jeu de Taquin
- 2 images au choix (masquées jusqu'à la résolution)
- 3 niveaux de difficulté : Facile (3×3), Normal (4×4), Difficile (5×5)
- Algorithme de mélange garanti solvable (shuffle from solved)
- **Sauvegarde automatique** de la progression (AsyncStorage)
- Reprise de partie au redémarrage de l'app
- Bouton **Mélanger** à tout moment
- Animation de **confettis** + révélation de l'image complète en cas de victoire

---

## 🗂 Structure du projet

```
bisou-sucre-paques/
├── assets/               ← Placez vos images ici (voir ci-dessous)
│   ├── logo_rond.png
│   ├── cadre.png         ⚠️ Doit avoir le centre transparent (PNG avec alpha)
│   ├── taquin1.png
│   └── taquin2.jpg
├── src/
│   ├── components/
│   │   └── Confetti.tsx  ← Animation de confettis
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── PhotoScreen.tsx
│   │   └── TaquinScreen.tsx
│   ├── types/
│   │   └── navigation.ts
│   └── utils/
│       └── taquinUtils.ts ← Logique du puzzle (shuffle, move, solve check)
├── App.tsx               ← Point d'entrée, navigation
├── app.json              ← Config Expo (permissions, icône, splash)
├── eas.json              ← Config EAS Build
├── package.json
├── babel.config.js
└── tsconfig.json
```

---

## 🚀 Installation & Démarrage

### Prérequis
- [Node.js](https://nodejs.org) ≥ 18
- [Expo CLI](https://docs.expo.dev/get-started/installation/) : `npm install -g expo-cli`
- [EAS CLI](https://docs.expo.dev/eas/) : `npm install -g eas-cli` *(pour les builds natifs)*

### 1. Cloner et installer

```bash
git clone https://github.com/VOTRE_COMPTE/bisou-sucre-paques.git
cd bisou-sucre-paques
npm install
```

### 2. Placer les assets

Copiez les fichiers suivants dans le dossier `assets/` :
- `logo_rond.png` — Logo de L'Atelier du Bisou Sucré
- `cadre.png` — Cadre Pâques (**avec le centre transparent**)
- `taquin1.png` — Première image du taquin
- `taquin2.jpg` — Deuxième image du taquin

> ⚠️ **Important pour `cadre.png`** : le rectangle central qui représente l'emplacement de la photo doit être **transparent** (canal alpha = 0) pour que la caméra se voit en dessous. Si votre cadre a un fond noir plein, ouvrez-le dans Photoshop/GIMP et supprimez le fond noir (remplacez-le par de la transparence).

### 3. Lancer en développement

```bash
# Démarre le serveur Metro + Expo DevTools
npm start

# Ou directement sur un appareil/simulateur :
npm run ios       # Simulateur iOS (macOS requis)
npm run android   # Émulateur Android
npm run web       # Navigateur web
```

> Scannez le QR code avec **Expo Go** (iOS/Android) pour tester sur votre téléphone.

---

## 📦 Build de Production

Le module `react-native-view-shot` (utilisé pour la composition photo + cadre) nécessite un **build natif**. Il ne fonctionnera pas dans Expo Go standard — utilisez **EAS Build** ou `expo run`.

### Via EAS Build (recommandé)

```bash
# Connexion à votre compte Expo
eas login

# Initialiser le projet EAS (première fois)
eas build:configure

# Build iOS (TestFlight / App Store)
eas build --platform ios

# Build Android (.aab pour Play Store, ou .apk pour distribution directe)
eas build --platform android

# Build prévisualisation (APK direct, sans store)
eas build --platform android --profile preview
```

### Via Expo Run (local, sans EAS)

```bash
# iOS (macOS + Xcode requis)
npx expo run:ios

# Android (Android Studio + SDK requis)
npx expo run:android
```

---

## 🌐 Déploiement Web

```bash
npx expo export:web
# Les fichiers sont générés dans web-build/
# Déployez ce dossier sur Netlify, Vercel, GitHub Pages, etc.
```

> Note : La fonctionnalité caméra est limitée sur le web (dépend du navigateur).  
> La sauvegarde du taquin fonctionne via AsyncStorage (localStorage sur le web).

---

## 🔧 Configuration personnalisée

### Changer le nom de l'app
Modifiez `app.json` → `"name"` et `"slug"`.

### Changer l'identifiant de l'app
- iOS : `app.json` → `"ios"."bundleIdentifier"`
- Android : `app.json` → `"android"."package"`

### Ajouter d'autres images au taquin
Dans `src/screens/TaquinScreen.tsx`, ajoutez votre image dans le tableau `IMAGES` :
```typescript
const IMAGES = [
  { id: 'taquin1', source: require('../../assets/taquin1.png'), label: 'Mon image', emoji: '🌸' },
  // ...
];
```

---

## 🛠 Dépendances principales

| Package | Rôle |
|---|---|
| `expo-camera` | Accès caméra iOS/Android/Web |
| `expo-media-library` | Sauvegarde dans la galerie photo |
| `expo-sharing` | Partage natif (WhatsApp, etc.) |
| `react-native-view-shot` | Capture d'un composant React → image |
| `@react-native-async-storage/async-storage` | Sauvegarde locale de la progression |
| `expo-linear-gradient` | Dégradés dans l'interface |
| `@react-navigation/stack` | Navigation entre les écrans |

---

## 📱 Permissions déclarées

### iOS (`Info.plist`)
- `NSCameraUsageDescription` — Accès caméra
- `NSPhotoLibraryAddUsageDescription` — Sauvegarde photos
- `NSPhotoLibraryUsageDescription` — Accès galerie

### Android
- `android.permission.CAMERA`
- `android.permission.READ_MEDIA_IMAGES` (Android 13+)
- `android.permission.READ_EXTERNAL_STORAGE` (Android ≤ 12)
- `android.permission.WRITE_EXTERNAL_STORAGE` (Android ≤ 12)

---

## 🐛 Dépannage fréquent

**"ViewShot ne fonctionne pas dans Expo Go"**  
→ Normal. Utilisez `eas build` ou `expo run:ios/android`.

**"La caméra apparaît noire dans la photo finale"**  
→ Vérifiez que `cadre.png` a bien le centre transparent (pas un fond noir plein).

**"Permission galerie refusée sur Android 13+"**  
→ L'app demande `READ_MEDIA_IMAGES`. Assurez-vous de builder avec le SDK 33+ (Expo 51 ✓).

**"Le taquin est impossible à résoudre"**  
→ L'algorithme `shuffleFromSolved` garantit toujours la solvabilité. Si le problème persiste, appuyez sur 🔄 Mélanger.

---

## 📄 Licence

Projet privé — © L'Atelier du Bisou Sucré. Tous droits réservés.
