import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Dimensions, Alert, ScrollView, Modal, Animated,
  PanResponder, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Confetti from '../components/Confetti';
import { shuffleFromSolved, isSolved, applyMove } from '../utils/taquinUtils';
import { ND } from '../utils/animated';

const { width: SW } = Dimensions.get('window');
const IS_WEB      = Platform.OS === 'web';
// Sur web : limiter la largeur du plateau
const MAX_BOARD   = IS_WEB ? Math.min(SW, 480) : SW;
const BOARD_PAD   = 20;
const BOARD_BASE  = MAX_BOARD - BOARD_PAD * 2;
const SWIPE_MIN   = 10;

function getDims(grid: number) {
  const tileSize  = Math.floor(BOARD_BASE / grid);
  const boardSize = tileSize * grid;
  return { tileSize, boardSize };
}

function saveKey(imgId: string, diffId: string) {
  return `@taquin_${imgId}_${diffId}`;
}

const IMAGES = [
  { id: 'taquin1', source: require('../../assets/taquin1.png'), label: 'Chasse aux œufs', emoji: '🌸' },
  { id: 'taquin2', source: require('../../assets/taquin2.jpg'), label: 'Pâques cartoon',  emoji: '🐰' },
] as const;

const DIFFICULTIES = [
  { id: 'easy',   label: 'Facile',    grid: 3, emoji: '😊', moves: 100 },
  { id: 'normal', label: 'Normal',    grid: 4, emoji: '😏', moves: 300 },
  { id: 'hard',   label: 'Difficile', grid: 5, emoji: '😈', moves: 500 },
] as const;

type ImageIndex = 0 | 1;
type DiffIndex  = 0 | 1 | 2;
type GamePhase  = 'select' | 'play';

interface TileProps {
  tileValue: number; position: number; gridSize: number;
  tileSize: number; boardSize: number; imageSource: any;
  onSwipe: (pos: number, dir: 'up'|'down'|'left'|'right') => void;
  onPress: (pos: number) => void;
  isEmpty: boolean; scaleAnim: Animated.Value;
}

// ─────────────────────────────────────────────────────────────────────────────
// TaquinTile — swipe (mobile) + clic sur case adjacente (web)
// ─────────────────────────────────────────────────────────────────────────────
const TaquinTile = React.memo(function TaquinTile({
  tileValue, position, gridSize, tileSize, boardSize,
  imageSource, onSwipe, onPress, isEmpty, scaleAnim,
}: TileProps) {
  const cbRef  = useRef(onSwipe);
  const cbPRef = useRef(onPress);
  const posRef = useRef(position);
  cbRef.current  = onSwipe;
  cbPRef.current = onPress;
  posRef.current = position;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: (_,g) => Math.abs(g.dx)>3||Math.abs(g.dy)>3,
    onMoveShouldSetPanResponderCapture: (_,g) => Math.abs(g.dx)>3||Math.abs(g.dy)>3,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_,g) => {
      const ax=Math.abs(g.dx), ay=Math.abs(g.dy);
      if (ax < SWIPE_MIN && ay < SWIPE_MIN) {
        // Petit mouvement = clic → déplacer si adjacent (utile sur web avec souris)
        cbPRef.current(posRef.current);
        return;
      }
      const dir: 'up'|'down'|'left'|'right' =
        ax>=ay?(g.dx>0?'right':'left'):(g.dy>0?'down':'up');
      cbRef.current(posRef.current, dir);
    },
  })).current;

  const srcRow = Math.floor(tileValue / gridSize);
  const srcCol = tileValue % gridSize;

  if (isEmpty) {
    return <View style={{ width:tileSize, height:tileSize, backgroundColor:'rgba(100,0,30,0.35)' }}/>;
  }

  return (
    <Animated.View
      {...pan.panHandlers}
      style={{
        width:tileSize, height:tileSize, overflow:'hidden',
        transform:[{ scale:scaleAnim }],
        borderWidth:0.5, borderColor:'rgba(255,255,255,0.25)',
        cursor: IS_WEB ? 'pointer' : 'auto',
      } as any}
    >
      <Image source={imageSource}
        style={{ position:'absolute', width:boardSize, height:boardSize,
          top:-(srcRow*tileSize), left:-(srcCol*tileSize) }}
        resizeMode="cover"/>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal
// ─────────────────────────────────────────────────────────────────────────────
export default function TaquinScreen() {
  const [phase,         setPhase]         = useState<GamePhase>('select');
  const [selectedImage, setSelectedImage] = useState<ImageIndex>(0);
  const [selectedDiff,  setSelectedDiff]  = useState<DiffIndex>(1);
  const [tiles,         setTiles]         = useState<number[]>([]);
  const [complete,      setComplete]      = useState(false);
  const [showConfetti,  setShowConfetti]  = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [hasSave,       setHasSave]       = useState(false);
  // refreshKey force le rechargement de checkSave quand on revient au menu
  const [refreshKey,    setRefreshKey]    = useState(0);

  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const tilesRef    = useRef<number[]>([]);
  const gridRef     = useRef<number>(DIFFICULTIES[1].grid);
  const imgRef      = useRef<ImageIndex>(0);
  const diffRef     = useRef<DiffIndex>(1);
  const completeRef = useRef(false);
  const tileAnims   = useRef<Map<number, Animated.Value>>(new Map()).current;

  const getTileAnim = (val: number) => {
    if (!tileAnims.has(val)) tileAnims.set(val, new Animated.Value(1));
    return tileAnims.get(val)!;
  };

  // ── Vérifier sauvegarde — se relance à chaque retour au menu (refreshKey) ──
  useEffect(() => {
    (async () => {
      try {
        const key   = saveKey(IMAGES[selectedImage].id, DIFFICULTIES[selectedDiff].id);
        const raw   = await AsyncStorage.getItem(key);
        if (!raw) { setHasSave(false); return; }
        const data  = JSON.parse(raw);
        const grid  = DIFFICULTIES[selectedDiff].grid;
        const valid = Array.isArray(data.tiles) &&
          data.tiles.length === grid*grid && !isSolved(data.tiles);
        setHasSave(valid);
      } catch { setHasSave(false); }
    })();
  }, [selectedImage, selectedDiff, refreshKey]);

  // ── Persist ────────────────────────────────────────────────────────────────
  const persist = useCallback(async (t: number[], imgIdx: ImageIndex, diffIdx: DiffIndex) => {
    try {
      const key = saveKey(IMAGES[imgIdx].id, DIFFICULTIES[diffIdx].id);
      await AsyncStorage.setItem(key, JSON.stringify({ tiles: t }));
    } catch (e) { console.warn('persist:', e); }
  }, []);

  const clearSave = useCallback(async (imgIdx: ImageIndex, diffIdx: DiffIndex) => {
    try {
      await AsyncStorage.removeItem(saveKey(IMAGES[imgIdx].id, DIFFICULTIES[diffIdx].id));
      setHasSave(false);
    } catch {}
  }, []);

  // ── Lancer le jeu ─────────────────────────────────────────────────────────
  const launchGame = (imgIdx: ImageIndex, diffIdx: DiffIndex, t: number[]) => {
    imgRef.current      = imgIdx;
    diffRef.current     = diffIdx;
    gridRef.current     = DIFFICULTIES[diffIdx].grid;
    tilesRef.current    = t;
    completeRef.current = false;
    tileAnims.clear();
    fadeAnim.setValue(0);
    setSelectedImage(imgIdx);
    setSelectedDiff(diffIdx);
    setTiles([...t]);
    setComplete(false);
    setShowConfetti(false);
    setShowFullImage(false);
    setPhase('play');
    if (!isSolved(t)) persist(t, imgIdx, diffIdx);
  };

  // ── Démarrer / reprendre ──────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    const imgIdx  = selectedImage;
    const diffIdx = selectedDiff;
    const diff    = DIFFICULTIES[diffIdx];

    try {
      const key = saveKey(IMAGES[imgIdx].id, diff.id);
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const data  = JSON.parse(raw);
        const valid = Array.isArray(data.tiles) &&
          data.tiles.length === diff.grid*diff.grid && !isSolved(data.tiles);
        if (valid) {
          Alert.alert(
            '💾 Partie en cours',
            `${IMAGES[imgIdx].label} · ${diff.label}\nQue voulez-vous faire ?`,
            [
              { text: '▶️ Reprendre', onPress: () => launchGame(imgIdx, diffIdx, data.tiles) },
              { text: '🔄 Nouvelle partie', onPress: () => {
                clearSave(imgIdx, diffIdx);
                launchGame(imgIdx, diffIdx, shuffleFromSolved(diff.grid, diff.moves));
              }},
              { text: 'Annuler', style: 'cancel' },
            ]
          );
          return;
        }
      }
    } catch {}
    launchGame(imgIdx, diffIdx, shuffleFromSolved(diff.grid, diff.moves));
  }, [selectedImage, selectedDiff]);

  // ── Mélanger ─────────────────────────────────────────────────────────────
  const reshuffle = useCallback(() => {
    Alert.alert('🔄 Mélanger', 'Mélanger toutes les pièces ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Mélanger !', onPress: () => {
        const diff = DIFFICULTIES[diffRef.current];
        const sh   = shuffleFromSolved(diff.grid, diff.moves);
        tileAnims.clear();
        tilesRef.current    = sh;
        completeRef.current = false;
        setTiles([...sh]);
        setComplete(false);
        setShowConfetti(false);
        setShowFullImage(false);
        fadeAnim.setValue(0);
        persist(sh, imgRef.current, diffRef.current);
      }},
    ]);
  }, [persist]);

  // ── Swipe (mobile) ────────────────────────────────────────────────────────
  const handleSwipe = useCallback((pos: number, dir: 'up'|'down'|'left'|'right') => {
    if (completeRef.current) return;
    const cur  = tilesRef.current;
    const grid = gridRef.current;
    if (!cur || cur.length === 0) return;
    const ePos = cur.indexOf(grid*grid-1);
    if (ePos < 0) return;
    const r=Math.floor(pos/grid), c=pos%grid;
    const er=Math.floor(ePos/grid), ec=ePos%grid;
    const valid =
      (dir==='right'&&er===r&&ec===c+1)||(dir==='left'&&er===r&&ec===c-1)||
      (dir==='down'&&ec===c&&er===r+1)||(dir==='up'&&ec===c&&er===r-1);
    if (!valid) return;
    doMove(pos);
  }, []);

  // ── Clic (web) ────────────────────────────────────────────────────────────
  const handlePress = useCallback((pos: number) => {
    if (completeRef.current) return;
    doMove(pos);
  }, []);

  // ── Déplacer une tuile ────────────────────────────────────────────────────
  const doMove = (pos: number) => {
    const cur  = tilesRef.current;
    const grid = gridRef.current;
    const ePos = cur.indexOf(grid*grid-1);
    if (ePos < 0) return;
    const r=Math.floor(pos/grid), c=pos%grid;
    const er=Math.floor(ePos/grid), ec=ePos%grid;
    const adjacent = (Math.abs(r-er)===1&&c===ec)||(Math.abs(c-ec)===1&&r===er);
    if (!adjacent) return;
    const newTiles = applyMove(cur, pos, grid);
    if (!newTiles) return;

    const anim = getTileAnim(cur[pos]);
    Animated.sequence([
      Animated.timing(anim, { toValue:0.88, duration:50, useNativeDriver:ND }),
      Animated.spring(anim, { toValue:1, useNativeDriver:ND, tension:400, friction:8 }),
    ]).start();

    tilesRef.current = newTiles;
    setTiles([...newTiles]);

    if (isSolved(newTiles)) {
      completeRef.current = true;
      setComplete(true);
      setShowConfetti(true);
      clearSave(imgRef.current, diffRef.current);
      setTimeout(() => {
        Animated.timing(fadeAnim, { toValue:1, duration:900, useNativeDriver:ND })
          .start(() => setShowFullImage(true));
      }, 2200);
    } else {
      persist(newTiles, imgRef.current, diffRef.current);
    }
  };

  // ── Quitter — incrémenter refreshKey pour forcer checkSave ────────────────
  const leaveGame = useCallback(() => {
    Alert.alert('Quitter', 'Progression sauvegardée.', [
      { text: 'Rester', style: 'cancel' },
      { text: 'Quitter', onPress: () => {
        setPhase('select');
        setRefreshKey(k => k + 1); // force rechargement de hasSave
      }},
    ]);
  }, []);

  const selectImg  = (i: ImageIndex) => { imgRef.current = i;  setSelectedImage(i); };
  const selectDiff = (d: DiffIndex)  => {
    diffRef.current = d; gridRef.current = DIFFICULTIES[d].grid; setSelectedDiff(d);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // SÉLECTION
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'select') {
    const selContent = IS_WEB
      ? [s.sel, { maxWidth: 500, alignSelf: 'center' as const, width: '100%' as any }]
      : s.sel;

    return (
      <LinearGradient colors={['#FFF0F5','#FFE4F0','#FECDE0']} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <ScrollView contentContainerStyle={selContent} showsVerticalScrollIndicator={false}>

            <Text style={s.secTitle}>Choisissez une image 🖼️</Text>
            <View style={s.imgRow}>
              {IMAGES.map((img, idx) => (
                <TouchableOpacity key={img.id}
                  style={[s.imgCard, selectedImage===idx && s.imgCardSel]}
                  onPress={() => selectImg(idx as ImageIndex)} activeOpacity={0.8}>
                  <View style={s.imgPreviewWrap}>
                    <Image source={img.source}
                      style={[s.imgPreviewImg,{opacity:0.1}]}
                      resizeMode="cover"
                      blurRadius={Platform.OS==='android'?5:12}/>
                    <View style={s.imgPreviewOv}>
                      <Text style={s.qmark}>?</Text>
                      <Text style={{fontSize:22,marginTop:4}}>{img.emoji}</Text>
                    </View>
                  </View>
                  <Text style={[s.imgLabel, selectedImage===idx && s.imgLabelSel]}>{img.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.secTitle}>Difficulté 🎯</Text>
            <View style={s.diffRow}>
              {DIFFICULTIES.map((d, idx) => (
                <TouchableOpacity key={d.id}
                  style={[s.diffCard, selectedDiff===idx && s.diffCardSel]}
                  onPress={() => selectDiff(idx as DiffIndex)} activeOpacity={0.8}>
                  <Text style={s.diffEmoji}>{d.emoji}</Text>
                  <Text style={[s.diffLabel, selectedDiff===idx && s.diffLabelSel]}>{d.label}</Text>
                  <Text style={s.diffSub}>{d.grid}×{d.grid} · {d.grid*d.grid-1} pièces</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.helpBox}>
              <Text style={s.helpTitle}>💡 Comment jouer ?</Text>
              <Text style={s.helpTxt}>
                Repérez la <Text style={{fontWeight:'800'}}>case sombre</Text> (case vide).{'\n'}
                {IS_WEB
                  ? 'Cliquez sur une pièce adjacente pour la déplacer.'
                  : 'Swipez une pièce adjacente vers cette case.'}
                {'\n'}
                {!IS_WEB && 'Directions : ← → ↑ ↓'}
              </Text>
            </View>

            <TouchableOpacity style={s.startBtn} onPress={handleStart} activeOpacity={0.85}>
              <LinearGradient colors={['#FF6B9D','#FF4081']} style={s.startBtnIn}
                start={{x:0,y:0}} end={{x:1,y:0}}>
                <Text style={s.startBtnTxt}>
                  {hasSave ? '▶️ Continuer / Nouvelle partie' : '🐣 Commencer !'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {hasSave && (
              <Text style={{textAlign:'center',color:'#AD1457',fontSize:12,
                marginTop:8,fontStyle:'italic'}}>
                💾 Une partie sauvegardée existe pour cette combinaison
              </Text>
            )}

          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // JEU
  // ════════════════════════════════════════════════════════════════════════════
  const img  = IMAGES[selectedImage];
  const grid = DIFFICULTIES[selectedDiff].grid;
  const { tileSize, boardSize } = getDims(grid);

  return (
    <LinearGradient colors={['#FFF0F5','#FFE4F0']} style={{flex:1}}>
      <SafeAreaView style={{flex:1}}>
        {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}

        <View style={s.hdr}>
          <TouchableOpacity onPress={leaveGame} style={s.hdrBtn}>
            <Text style={s.hdrBtnTxt}>← Menu</Text>
          </TouchableOpacity>
          <View style={{alignItems:'center'}}>
            <Text style={s.hdrTitle}>{img.emoji} {DIFFICULTIES[selectedDiff].label}</Text>
            <Text style={s.hdrSub}>{grid}×{grid} · {grid*grid-1} pièces</Text>
          </View>
          <TouchableOpacity onPress={reshuffle} style={s.hdrBtn} disabled={complete}>
            <Text style={[s.hdrBtnTxt, complete && {opacity:0.3}]}>🔄 Mélanger</Text>
          </TouchableOpacity>
        </View>

        <View style={{alignItems:'center', marginTop:16}}>
          <View style={{width:boardSize, height:boardSize, backgroundColor:'#C2185B',
            borderRadius:10, overflow:'hidden', flexDirection:'row', flexWrap:'wrap'}}>
            {tiles.map((tileValue, position) => (
              <TaquinTile key={String(position)}
                tileValue={tileValue} position={position} gridSize={grid}
                tileSize={tileSize} boardSize={boardSize} imageSource={img.source}
                isEmpty={tileValue===grid*grid-1}
                onSwipe={handleSwipe} onPress={handlePress}
                scaleAnim={getTileAnim(tileValue)}/>
            ))}
          </View>
          {complete && (
            <Animated.View pointerEvents="none"
              style={{position:'absolute',top:0,width:boardSize,height:boardSize,
                borderRadius:10, opacity:fadeAnim}}>
              <Image source={img.source}
                style={{width:boardSize,height:boardSize,borderRadius:10}}
                resizeMode="cover"/>
            </Animated.View>
          )}
        </View>

        {complete && (
          <View style={s.victory}>
            <Text style={s.victoryTitle}>🎉 Félicitations !</Text>
            <Text style={s.victorySub}>Vous avez reconstitué l'image !</Text>
            <View style={{flexDirection:'row',gap:12}}>
              <TouchableOpacity style={s.vBtn} onPress={() => setShowFullImage(true)}>
                <LinearGradient colors={['#FF6B9D','#FF4081']} style={s.vBtnIn}
                  start={{x:0,y:0}} end={{x:1,y:0}}>
                  <Text style={s.vBtnTxt}>👁️ Voir en grand</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={s.vBtn} onPress={() => {
                setPhase('select'); setRefreshKey(k => k+1);
              }}>
                <LinearGradient colors={['#FFB347','#FF8C00']} style={s.vBtnIn}
                  start={{x:0,y:0}} end={{x:1,y:0}}>
                  <Text style={s.vBtnTxt}>🔄 Rejouer</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!complete && (
          <Text style={s.hint}>
            {IS_WEB
              ? '🖱️ Cliquez sur une pièce adjacente à la case sombre'
              : '← → ↑ ↓  Swipez une pièce vers la case sombre'}
          </Text>
        )}

        <Modal visible={showFullImage} transparent animationType="fade" statusBarTranslucent>
          <View style={s.modalBg}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>🎊 Bravo ! Voici l'image !</Text>
              <Image source={img.source}
                style={{width:Math.min(SW-80,400), height:Math.min(SW-80,400), borderRadius:12}}
                resizeMode="cover"/>
              <View style={{flexDirection:'row',marginTop:16,gap:12,paddingHorizontal:16}}>
                <TouchableOpacity style={s.mClose} onPress={() => setShowFullImage(false)}>
                  <Text style={{fontWeight:'700',color:'#555'}}>✕ Fermer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.mNew} onPress={() => {
                  setShowFullImage(false); setPhase('select'); setRefreshKey(k=>k+1);
                }}>
                  <Text style={{fontWeight:'700',color:'#fff'}}>🐰 Rejouer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  sel: { padding: BOARD_PAD, paddingBottom: 40 },
  secTitle: { fontSize:19, fontWeight:'800', color:'#C2185B', marginBottom:14, marginTop:8 },
  imgRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:24 },
  imgCard: { width:'48%', borderRadius:18, overflow:'hidden', borderWidth:3, borderColor:'#E0E0E0', backgroundColor:'#fff', elevation:4 },
  imgCardSel: { borderColor:'#FF6B9D' },
  imgPreviewWrap: { height:130, backgroundColor:'#F5F5F5' },
  imgPreviewImg: { width:'100%', height:'100%' },
  imgPreviewOv: { ...StyleSheet.absoluteFillObject, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(255,240,245,0.5)' },
  qmark: { fontSize:52, fontWeight:'900', color:'#C2185B' },
  imgLabel: { textAlign:'center', paddingVertical:10, fontSize:13, fontWeight:'700', color:'#666' },
  imgLabelSel: { color:'#C2185B' },
  diffRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:20 },
  diffCard: { flex:1, marginHorizontal:4, padding:12, borderRadius:16, borderWidth:2, borderColor:'#E0E0E0', alignItems:'center', backgroundColor:'#fff', elevation:3 },
  diffCardSel: { borderColor:'#FF6B9D', backgroundColor:'#FFF0F5' },
  diffEmoji: { fontSize:26, marginBottom:4 },
  diffLabel: { fontWeight:'700', color:'#666', fontSize:14 },
  diffLabelSel: { color:'#C2185B' },
  diffSub: { fontSize:11, color:'#aaa', marginTop:2 },
  helpBox: { backgroundColor:'rgba(194,24,91,0.07)', borderRadius:14, padding:14, marginBottom:20, borderLeftWidth:4, borderLeftColor:'#FF6B9D' },
  helpTitle: { fontSize:14, fontWeight:'800', color:'#C2185B', marginBottom:6 },
  helpTxt: { fontSize:13, color:'#555', lineHeight:20 },
  startBtn: { borderRadius:30, overflow:'hidden', elevation:8 },
  startBtnIn: { paddingVertical:18, alignItems:'center', borderRadius:30 },
  startBtnTxt: { color:'#fff', fontSize:18, fontWeight:'900', textAlign:'center' },
  hdr: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:12, paddingVertical:10, borderBottomWidth:1, borderBottomColor:'rgba(194,24,91,0.1)' },
  hdrBtn: { padding:6 },
  hdrBtnTxt: { color:'#C2185B', fontWeight:'700', fontSize:13 },
  hdrTitle: { fontSize:16, fontWeight:'800', color:'#C2185B' },
  hdrSub: { fontSize:11, color:'#AD1457', marginTop:1 },
  victory: { alignItems:'center', paddingVertical:14, paddingHorizontal:20 },
  victoryTitle: { fontSize:26, fontWeight:'900', color:'#C2185B', marginBottom:4 },
  victorySub: { fontSize:14, color:'#AD1457', marginBottom:14 },
  vBtn: { borderRadius:25, overflow:'hidden', elevation:5 },
  vBtnIn: { paddingHorizontal:20, paddingVertical:12 },
  vBtnTxt: { color:'#fff', fontWeight:'800', fontSize:14 },
  hint: { textAlign:'center', color:'#AD1457', fontSize:13, paddingHorizontal:30, paddingVertical:8, opacity:0.85 },
  modalBg: { flex:1, backgroundColor:'rgba(0,0,0,0.88)', justifyContent:'center', alignItems:'center', padding:20 },
  modalBox: { backgroundColor:'#fff', borderRadius:24, overflow:'hidden', width:'100%', maxWidth:400, alignItems:'center', paddingBottom:20 },
  modalTitle: { fontSize:17, fontWeight:'800', color:'#C2185B', paddingVertical:16, textAlign:'center', paddingHorizontal:16 },
  mClose: { flex:1, paddingVertical:12, borderRadius:20, backgroundColor:'#EEE', alignItems:'center' },
  mNew: { flex:1, paddingVertical:12, borderRadius:20, backgroundColor:'#FF6B9D', alignItems:'center' },
});
