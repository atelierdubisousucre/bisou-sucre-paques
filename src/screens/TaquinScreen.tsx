import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Dimensions, Modal, ScrollView, Animated,
  PanResponder, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Confetti from '../components/Confetti';
import { shuffleFromSolved, isSolved, applyMove } from '../utils/taquinUtils';
import { ND } from '../utils/animated';

const { width: SW } = Dimensions.get('window');
const IS_WEB     = Platform.OS === 'web';
const MAX_BOARD  = IS_WEB ? Math.min(SW, 480) : SW;
const BOARD_PAD  = 20;
const BOARD_BASE = MAX_BOARD - BOARD_PAD * 2;
const SWIPE_MIN  = 10;

function getDims(grid: number) {
  const tileSize  = Math.floor(BOARD_BASE / grid);
  return { tileSize, boardSize: tileSize * grid };
}
function saveKey(imgId: string, diffId: string) {
  return '@taquin_' + imgId + '_' + diffId;
}

const IMAGES = [
  { id:'taquin1', source:require('../../assets/taquin1.png'), label:'Chasse aux oeufs', emoji:'🌸' },
  { id:'taquin2', source:require('../../assets/taquin2.jpg'), label:'Paques cartoon', emoji:'🐰' },
] as const;

const DIFFICULTIES = [
  { id:'easy',   label:'Facile',    grid:3, emoji:'😊', moves:100 },
  { id:'normal', label:'Normal',    grid:4, emoji:'😏', moves:300 },
  { id:'hard',   label:'Difficile', grid:5, emoji:'😈', moves:500 },
] as const;

type ImageIndex = 0|1;
type DiffIndex  = 0|1|2;
type GamePhase  = 'select'|'play';

interface ConfirmAction { label:string; onPress:()=>void; primary?:boolean; }
interface ConfirmState  { title:string; message:string; actions:ConfirmAction[]; }

// ─── TaquinTile ───────────────────────────────────────────────────────────────
interface TileProps {
  tileValue:number; position:number; gridSize:number;
  tileSize:number; boardSize:number; imageSource:any;
  onMove:(pos:number)=>void;
  isEmpty:boolean; scaleAnim:Animated.Value;
}

const TaquinTile = React.memo(function TaquinTile({
  tileValue, position, gridSize, tileSize, boardSize,
  imageSource, onMove, isEmpty, scaleAnim,
}: TileProps) {
  const cbRef  = useRef(onMove);
  const posRef = useRef(position);
  cbRef.current  = onMove;
  posRef.current = position;

  const panRef = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: (_,g) => Math.abs(g.dx)>3||Math.abs(g.dy)>3,
    onMoveShouldSetPanResponderCapture: (_,g) => Math.abs(g.dx)>3||Math.abs(g.dy)>3,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: () => { cbRef.current(posRef.current); },
  }));

  const srcRow = Math.floor(tileValue / gridSize);
  const srcCol = tileValue % gridSize;

  if (isEmpty) {
    return <View style={{ width:tileSize, height:tileSize, backgroundColor:'rgba(100,0,30,0.35)' }}/>;
  }
  return (
    <Animated.View
      {...panRef.current.panHandlers}
      style={{ width:tileSize, height:tileSize, overflow:'hidden',
        transform:[{ scale:scaleAnim }], borderWidth:0.5, borderColor:'rgba(255,255,255,0.25)' }}
    >
      <Image source={imageSource}
        style={{ position:'absolute', width:boardSize, height:boardSize,
          top:-(srcRow*tileSize), left:-(srcCol*tileSize) }}
        resizeMode="cover"/>
    </Animated.View>
  );
});

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function TaquinScreen() {
  const [phase,         setPhase]         = useState<GamePhase>('select');
  const [selectedImage, setSelectedImage] = useState<ImageIndex>(0);
  const [selectedDiff,  setSelectedDiff]  = useState<DiffIndex>(1);
  const [tiles,         setTiles]         = useState<number[]>([]);
  const [complete,      setComplete]      = useState(false);
  const [showConfetti,  setShowConfetti]  = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [hasSave,       setHasSave]       = useState(false);
  const [confirm,       setConfirm]       = useState<ConfirmState|null>(null);

  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const tilesRef    = useRef<number[]>([]);
  const gridRef     = useRef<number>(DIFFICULTIES[1].grid);
  const imgRef      = useRef<ImageIndex>(0);
  const diffRef     = useRef<DiffIndex>(1);
  const completeRef = useRef(false);
  const tileAnims   = useRef<Map<number, Animated.Value>>(new Map()).current;
  const selectCount = useRef(0); // incrémenté à chaque goToSelect() pour forcer checkSave

  const getTileAnim = (val: number) => {
    if (!tileAnims.has(val)) tileAnims.set(val, new Animated.Value(1));
    return tileAnims.get(val)!;
  };

  // ── Vérifier sauvegarde — dépend de phase, sélections ET selectCount ────
  useEffect(() => {
    if (phase !== 'select') return;
    (async () => {
      try {
        const key  = saveKey(IMAGES[selectedImage].id, DIFFICULTIES[selectedDiff].id);
        const raw  = await AsyncStorage.getItem(key);
        if (!raw) { setHasSave(false); return; }
        const data = JSON.parse(raw);
        const grid = DIFFICULTIES[selectedDiff].grid;
        setHasSave(Array.isArray(data.tiles) && data.tiles.length===grid*grid && !isSolved(data.tiles));
      } catch { setHasSave(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedImage, selectedDiff, selectCount.current]);

  const persist = useCallback(async (t: number[], imgIdx: ImageIndex, diffIdx: DiffIndex) => {
    try {
      await AsyncStorage.setItem(
        saveKey(IMAGES[imgIdx].id, DIFFICULTIES[diffIdx].id),
        JSON.stringify({ tiles: t })
      );
    } catch (e) { console.warn('persist:', e); }
  }, []);

  const clearSave = useCallback(async (imgIdx: ImageIndex, diffIdx: DiffIndex) => {
    try {
      await AsyncStorage.removeItem(saveKey(IMAGES[imgIdx].id, DIFFICULTIES[diffIdx].id));
      setHasSave(false);
    } catch {}
  }, []);

  // goToSelect : incrémente selectCount pour forcer rechargement de hasSave
  const goToSelect = useCallback(() => {
    selectCount.current += 1;
    setPhase('select');
  }, []);

  const launchGame = useCallback((imgIdx: ImageIndex, diffIdx: DiffIndex, t: number[]) => {
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
  }, [persist]);

  const handleStart = useCallback(async () => {
    const imgIdx  = selectedImage;
    const diffIdx = selectedDiff;
    const diff    = DIFFICULTIES[diffIdx];
    try {
      const raw = await AsyncStorage.getItem(saveKey(IMAGES[imgIdx].id, diff.id));
      if (raw) {
        const data  = JSON.parse(raw);
        const valid = Array.isArray(data.tiles) &&
          data.tiles.length===diff.grid*diff.grid && !isSolved(data.tiles);
        if (valid) {
          setConfirm({
            title:   'Partie en cours',
            message: IMAGES[imgIdx].label + ' - ' + diff.label,
            actions: [
              { label:'Reprendre', primary:true,
                onPress:()=>{ setConfirm(null); launchGame(imgIdx, diffIdx, data.tiles); } },
              { label:'Nouvelle partie',
                onPress:()=>{ setConfirm(null); clearSave(imgIdx,diffIdx);
                  launchGame(imgIdx, diffIdx, shuffleFromSolved(diff.grid, diff.moves)); } },
              { label:'Annuler', onPress:()=>setConfirm(null) },
            ],
          });
          return;
        }
      }
    } catch {}
    launchGame(imgIdx, diffIdx, shuffleFromSolved(diff.grid, diff.moves));
  }, [selectedImage, selectedDiff, launchGame, clearSave]);

  const reshuffle = useCallback(() => {
    setConfirm({
      title:'Melanger', message:'Melanger toutes les pieces ?',
      actions:[
        { label:'Annuler', onPress:()=>setConfirm(null) },
        { label:'Melanger !', primary:true, onPress:()=>{
          setConfirm(null);
          const diff = DIFFICULTIES[diffRef.current];
          const sh   = shuffleFromSolved(diff.grid, diff.moves);
          tileAnims.clear();
          tilesRef.current=sh; completeRef.current=false;
          setTiles([...sh]); setComplete(false);
          setShowConfetti(false); setShowFullImage(false);
          fadeAnim.setValue(0);
          persist(sh, imgRef.current, diffRef.current);
        }},
      ],
    });
  }, [persist]);

  const leaveGame = useCallback(() => {
    setConfirm({
      title:'Quitter', message:'Progression sauvegardee automatiquement.',
      actions:[
        { label:'Rester', onPress:()=>setConfirm(null) },
        { label:'Quitter', primary:true, onPress:()=>{ setConfirm(null); goToSelect(); } },
      ],
    });
  }, [goToSelect]);

  const doMove = useCallback((pos: number) => {
    if (completeRef.current) return;
    const cur  = tilesRef.current;
    const grid = gridRef.current;
    if (!cur || cur.length===0) return;
    const ePos = cur.indexOf(grid*grid-1);
    if (ePos<0) return;
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
      setComplete(true); setShowConfetti(true);
      clearSave(imgRef.current, diffRef.current);
      setTimeout(() => {
        Animated.timing(fadeAnim, { toValue:1, duration:900, useNativeDriver:ND })
          .start(() => setShowFullImage(true));
      }, 2200);
    } else {
      persist(newTiles, imgRef.current, diffRef.current);
    }
  }, [persist, clearSave]);

  const selectImg  = (i: ImageIndex) => { imgRef.current=i;  setSelectedImage(i); };
  const selectDiff = (d: DiffIndex)  => {
    diffRef.current=d; gridRef.current=DIFFICULTIES[d].grid; setSelectedDiff(d);
  };

  // Modal de confirmation — remplace Alert (compatible web)
  const ConfirmModal = confirm ? (
    <Modal visible transparent animationType="fade">
      <View style={s.modalBg}>
        <View style={s.confirmBox}>
          <Text style={s.confirmTitle}>{confirm.title}</Text>
          <Text style={s.confirmMsg}>{confirm.message}</Text>
          <View style={s.confirmBtns}>
            {confirm.actions.map((a,i) => (
              <TouchableOpacity key={i}
                style={[s.confirmBtn, a.primary&&s.confirmBtnPrimary]}
                onPress={a.onPress}>
                <Text style={[s.confirmBtnTxt, a.primary&&s.confirmBtnTxtPrimary]}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  ) : null;

  // ════════════════════════════════════════════════════════════════════════════
  // SELECTION
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'select') {
    return (
      <LinearGradient colors={['#FFF0F5','#FFE4F0','#FECDE0']} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          {ConfirmModal}
          <ScrollView
            contentContainerStyle={[s.sel, IS_WEB&&{maxWidth:500,alignSelf:'center' as const,width:'100%' as any}]}
            showsVerticalScrollIndicator={false}>

            <Text style={s.secTitle}>Choisissez une image</Text>
            <View style={s.imgRow}>
              {IMAGES.map((img,idx)=>(
                <TouchableOpacity key={img.id}
                  style={[s.imgCard, selectedImage===idx&&s.imgCardSel]}
                  onPress={()=>selectImg(idx as ImageIndex)} activeOpacity={0.8}>
                  <View style={s.imgPreviewWrap}>
                    <Image source={img.source}
                      style={[s.imgPreviewImg,{opacity:0.1}]}
                      resizeMode="cover" blurRadius={Platform.OS==='android'?5:12}/>
                    <View style={s.imgPreviewOv}>
                      <Text style={s.qmark}>?</Text>
                      <Text style={{fontSize:22,marginTop:4}}>{img.emoji}</Text>
                    </View>
                  </View>
                  <Text style={[s.imgLabel, selectedImage===idx&&s.imgLabelSel]}>{img.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.secTitle}>Difficulte</Text>
            <View style={s.diffRow}>
              {DIFFICULTIES.map((d,idx)=>(
                <TouchableOpacity key={d.id}
                  style={[s.diffCard, selectedDiff===idx&&s.diffCardSel]}
                  onPress={()=>selectDiff(idx as DiffIndex)} activeOpacity={0.8}>
                  <Text style={s.diffEmoji}>{d.emoji}</Text>
                  <Text style={[s.diffLabel, selectedDiff===idx&&s.diffLabelSel]}>{d.label}</Text>
                  <Text style={s.diffSub}>{d.grid}x{d.grid} - {d.grid*d.grid-1} pieces</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.helpBox}>
              <Text style={s.helpTitle}>Comment jouer ?</Text>
              <Text style={s.helpTxt}>
                Reperez la case sombre (case vide).{'\n'}
                {IS_WEB
                  ? 'Cliquez sur une piece adjacente pour la deplacer.'
                  : 'Swipez une piece adjacente vers cette case.'}
              </Text>
            </View>

            <TouchableOpacity style={s.startBtn} onPress={handleStart} activeOpacity={0.85}>
              <LinearGradient colors={['#FF6B9D','#FF4081']} style={s.startBtnIn}
                start={{x:0,y:0}} end={{x:1,y:0}}>
                <Text style={s.startBtnTxt}>
                  {hasSave ? 'Continuer / Nouvelle partie' : 'Commencer !'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            {hasSave&&(
              <Text style={{textAlign:'center',color:'#AD1457',fontSize:12,marginTop:8,fontStyle:'italic'}}>
                Partie sauvegardee pour cette combinaison
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
        {ConfirmModal}
        {showConfetti&&<Confetti onDone={()=>setShowConfetti(false)}/>}

        <View style={s.hdr}>
          <TouchableOpacity onPress={leaveGame} style={s.hdrBtn}>
            <Text style={s.hdrBtnTxt}>Menu</Text>
          </TouchableOpacity>
          <View style={{alignItems:'center'}}>
            <Text style={s.hdrTitle}>{img.emoji} {DIFFICULTIES[selectedDiff].label}</Text>
            <Text style={s.hdrSub}>{grid}x{grid} - {grid*grid-1} pieces</Text>
          </View>
          <TouchableOpacity onPress={reshuffle} style={s.hdrBtn} disabled={complete}>
            <Text style={[s.hdrBtnTxt, complete&&{opacity:0.3}]}>Melanger</Text>
          </TouchableOpacity>
        </View>

        <View style={{alignItems:'center',marginTop:16}}>
          <View style={{width:boardSize,height:boardSize,backgroundColor:'#C2185B',
            borderRadius:10,overflow:'hidden',flexDirection:'row',flexWrap:'wrap'}}>
            {tiles.map((tileValue,position)=>(
              <TaquinTile key={String(position)}
                tileValue={tileValue} position={position} gridSize={grid}
                tileSize={tileSize} boardSize={boardSize} imageSource={img.source}
                isEmpty={tileValue===grid*grid-1}
                onMove={doMove} scaleAnim={getTileAnim(tileValue)}/>
            ))}
          </View>
          {complete&&(
            <Animated.View style={{position:'absolute',top:0,width:boardSize,height:boardSize,
              borderRadius:10, opacity:fadeAnim}}>
              <Image source={img.source}
                style={{width:boardSize,height:boardSize,borderRadius:10}} resizeMode="cover"/>
            </Animated.View>
          )}
        </View>

        {complete&&(
          <View style={s.victory}>
            <Text style={s.victoryTitle}>Felicitations !</Text>
            <Text style={s.victorySub}>Vous avez reconstitue l'image !</Text>
            <View style={{flexDirection:'row',gap:12}}>
              <TouchableOpacity style={s.vBtn} onPress={()=>setShowFullImage(true)}>
                <LinearGradient colors={['#FF6B9D','#FF4081']} style={s.vBtnIn}
                  start={{x:0,y:0}} end={{x:1,y:0}}>
                  <Text style={s.vBtnTxt}>Voir en grand</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={s.vBtn} onPress={goToSelect}>
                <LinearGradient colors={['#FFB347','#FF8C00']} style={s.vBtnIn}
                  start={{x:0,y:0}} end={{x:1,y:0}}>
                  <Text style={s.vBtnTxt}>Rejouer</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {!complete&&(
          <Text style={s.hint}>
            {IS_WEB?'Cliquez sur une piece adjacente a la case sombre'
                   :'Swipez une piece vers la case sombre'}
          </Text>
        )}

        <Modal visible={showFullImage} transparent animationType="fade" statusBarTranslucent>
          <View style={s.modalBg}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Bravo ! Voici l'image !</Text>
              <Image source={img.source}
                style={{width:Math.min(SW-80,400),height:Math.min(SW-80,400),borderRadius:12}}
                resizeMode="cover"/>
              <View style={{flexDirection:'row',marginTop:16,gap:12,paddingHorizontal:16}}>
                <TouchableOpacity style={s.mClose} onPress={()=>setShowFullImage(false)}>
                  <Text style={{fontWeight:'700',color:'#555'}}>Fermer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.mNew}
                  onPress={()=>{ setShowFullImage(false); goToSelect(); }}>
                  <Text style={{fontWeight:'700',color:'#fff'}}>Rejouer</Text>
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
  sel:{padding:BOARD_PAD,paddingBottom:40},
  secTitle:{fontSize:19,fontWeight:'800',color:'#C2185B',marginBottom:14,marginTop:8},
  imgRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:24},
  imgCard:{width:'48%',borderRadius:18,overflow:'hidden',borderWidth:3,borderColor:'#E0E0E0',backgroundColor:'#fff'},
  imgCardSel:{borderColor:'#FF6B9D'},
  imgPreviewWrap:{height:130,backgroundColor:'#F5F5F5'},
  imgPreviewImg:{width:'100%',height:'100%'},
  imgPreviewOv:{...StyleSheet.absoluteFillObject,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(255,240,245,0.5)'},
  qmark:{fontSize:52,fontWeight:'900',color:'#C2185B'},
  imgLabel:{textAlign:'center',paddingVertical:10,fontSize:13,fontWeight:'700',color:'#666'},
  imgLabelSel:{color:'#C2185B'},
  diffRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:20},
  diffCard:{flex:1,marginHorizontal:4,padding:12,borderRadius:16,borderWidth:2,borderColor:'#E0E0E0',alignItems:'center',backgroundColor:'#fff'},
  diffCardSel:{borderColor:'#FF6B9D',backgroundColor:'#FFF0F5'},
  diffEmoji:{fontSize:26,marginBottom:4},
  diffLabel:{fontWeight:'700',color:'#666',fontSize:14},
  diffLabelSel:{color:'#C2185B'},
  diffSub:{fontSize:11,color:'#aaa',marginTop:2},
  helpBox:{backgroundColor:'rgba(194,24,91,0.07)',borderRadius:14,padding:14,marginBottom:20,borderLeftWidth:4,borderLeftColor:'#FF6B9D'},
  helpTitle:{fontSize:14,fontWeight:'800',color:'#C2185B',marginBottom:6},
  helpTxt:{fontSize:13,color:'#555',lineHeight:20},
  startBtn:{borderRadius:30,overflow:'hidden'},
  startBtnIn:{paddingVertical:18,alignItems:'center',borderRadius:30},
  startBtnTxt:{color:'#fff',fontSize:18,fontWeight:'900',textAlign:'center'},
  hdr:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:12,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'rgba(194,24,91,0.1)'},
  hdrBtn:{padding:6},
  hdrBtnTxt:{color:'#C2185B',fontWeight:'700',fontSize:13},
  hdrTitle:{fontSize:16,fontWeight:'800',color:'#C2185B'},
  hdrSub:{fontSize:11,color:'#AD1457',marginTop:1},
  victory:{alignItems:'center',paddingVertical:14,paddingHorizontal:20},
  victoryTitle:{fontSize:26,fontWeight:'900',color:'#C2185B',marginBottom:4},
  victorySub:{fontSize:14,color:'#AD1457',marginBottom:14},
  vBtn:{borderRadius:25,overflow:'hidden'},
  vBtnIn:{paddingHorizontal:20,paddingVertical:12},
  vBtnTxt:{color:'#fff',fontWeight:'800',fontSize:14},
  hint:{textAlign:'center',color:'#AD1457',fontSize:13,paddingHorizontal:30,paddingVertical:8,opacity:0.85},
  modalBg:{flex:1,backgroundColor:'rgba(0,0,0,0.88)',justifyContent:'center',alignItems:'center',padding:20},
  modalBox:{backgroundColor:'#fff',borderRadius:24,overflow:'hidden',width:'100%',maxWidth:400,alignItems:'center',paddingBottom:20},
  modalTitle:{fontSize:17,fontWeight:'800',color:'#C2185B',paddingVertical:16,textAlign:'center',paddingHorizontal:16},
  mClose:{flex:1,paddingVertical:12,borderRadius:20,backgroundColor:'#EEE',alignItems:'center'},
  mNew:{flex:1,paddingVertical:12,borderRadius:20,backgroundColor:'#FF6B9D',alignItems:'center'},
  confirmBox:{backgroundColor:'#fff',borderRadius:20,padding:24,width:'100%',maxWidth:360},
  confirmTitle:{fontSize:18,fontWeight:'900',color:'#C2185B',marginBottom:8,textAlign:'center'},
  confirmMsg:{fontSize:14,color:'#555',marginBottom:20,textAlign:'center',lineHeight:20},
  confirmBtns:{gap:10},
  confirmBtn:{paddingVertical:12,borderRadius:16,backgroundColor:'#EEE',alignItems:'center'},
  confirmBtnPrimary:{backgroundColor:'#FF6B9D'},
  confirmBtnTxt:{fontWeight:'700',color:'#555',fontSize:15},
  confirmBtnTxtPrimary:{color:'#fff'},
});
