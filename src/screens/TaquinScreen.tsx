import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Dimensions, Modal, ScrollView, Animated, PanResponder, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Confetti from '../components/Confetti';
import { shuffleFromSolved, isSolved, applyMove } from '../utils/taquinUtils';

const { width: SW } = Dimensions.get('window');
const IS_WEB     = Platform.OS === 'web';
const ND         = Platform.OS !== 'web';
const MAX_BOARD  = IS_WEB ? Math.min(SW, 480) : SW;
const BOARD_BASE = MAX_BOARD - 40;

function getDims(grid: number) {
  const ts = Math.floor(BOARD_BASE / grid);
  return { tileSize: ts, boardSize: ts * grid };
}
const key = (imgId: string, diffId: string) => '@taq_' + imgId + '_' + diffId;

const IMGS = [
  { id:'taquin1', src:require('../../assets/taquin1.png'), label:'Chasse aux oeufs', emoji:'🌸' },
  { id:'taquin2', src:require('../../assets/taquin2.jpg'), label:'Paques cartoon', emoji:'🐰' },
] as const;

const DIFFS = [
  { id:'easy',   label:'Facile',    grid:3, emoji:'😊', moves:100 },
  { id:'normal', label:'Normal',    grid:4, emoji:'😏', moves:300 },
  { id:'hard',   label:'Difficile', grid:5, emoji:'😈', moves:500 },
] as const;

type IIdx = 0|1;
type DIdx = 0|1|2;
type Phase = 'select'|'play';
interface Dlg { title:string; msg:string; btns:{label:string;cb:()=>void;primary?:boolean}[]; }

// ─── Tile ─────────────────────────────────────────────────────────────────────
const Tile = React.memo(function Tile({
  val, pos, grid, ts, bs, src, onMove, empty, anim,
}: {
  val:number; pos:number; grid:number; ts:number; bs:number;
  src:any; onMove:(p:number)=>void; empty:boolean; anim:Animated.Value;
}) {
  const cbRef = useRef(onMove);
  const pRef  = useRef(pos);
  cbRef.current = onMove;
  pRef.current  = pos;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        ()=>true,
    onStartShouldSetPanResponderCapture: ()=>true,
    onMoveShouldSetPanResponder: (_,g)=>Math.abs(g.dx)>3||Math.abs(g.dy)>3,
    onMoveShouldSetPanResponderCapture: (_,g)=>Math.abs(g.dx)>3||Math.abs(g.dy)>3,
    onPanResponderTerminationRequest: ()=>false,
    onPanResponderRelease: ()=>{ cbRef.current(pRef.current); },
  })).current;

  if (empty) return <View style={{ width:ts, height:ts, backgroundColor:'rgba(80,0,20,0.35)' }}/>;

  const row = Math.floor(val/grid), col = val%grid;
  return (
    <Animated.View {...pan.panHandlers}
      style={{ width:ts, height:ts, overflow:'hidden',
        transform:[{scale:anim}], borderWidth:0.5, borderColor:'rgba(255,255,255,0.2)' }}>
      <Image source={src}
        style={{ position:'absolute', width:bs, height:bs, top:-(row*ts), left:-(col*ts) }}
        resizeMode="cover"/>
    </Animated.View>
  );
});

// ─── Écran ────────────────────────────────────────────────────────────────────
export default function TaquinScreen() {
  const [phase,   setPhase]   = useState<Phase>('select');
  const [imgIdx,  setImgIdx]  = useState<IIdx>(0);
  const [diffIdx, setDiffIdx] = useState<DIdx>(1);
  const [tiles,   setTiles]   = useState<number[]>([]);
  const [done,    setDone]    = useState(false);
  const [confetti,setConfetti]= useState(false);
  const [fullImg, setFullImg] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [dlg,     setDlg]     = useState<Dlg|null>(null);

  const fade      = useRef(new Animated.Value(0)).current;
  const tilesR    = useRef<number[]>([]);
  const gridR     = useRef(DIFFS[1].grid);
  const imgR      = useRef<IIdx>(0);
  const diffR     = useRef<DIdx>(1);
  const doneR     = useRef(false);
  const anims     = useRef<Map<number,Animated.Value>>(new Map()).current;
  const backCount = useRef(0); // incrémenté à chaque retour au menu

  const getAnim = (v:number) => {
    if (!anims.has(v)) anims.set(v, new Animated.Value(1));
    return anims.get(v)!;
  };

  // Vérifier sauvegarde à chaque fois qu'on est sur 'select'
  useEffect(() => {
    if (phase !== 'select') return;
    AsyncStorage.getItem(key(IMGS[imgIdx].id, DIFFS[diffIdx].id)).then(raw => {
      if (!raw) { setHasSave(false); return; }
      try {
        const d = JSON.parse(raw);
        const g = DIFFS[diffIdx].grid;
        setHasSave(Array.isArray(d.tiles) && d.tiles.length===g*g && !isSolved(d.tiles));
      } catch { setHasSave(false); }
    }).catch(()=>setHasSave(false));
  // backCount.current dans le tableau de dépendances n'est pas réactif,
  // on utilise un state séparé pour forcer le refresh
  }, [phase, imgIdx, diffIdx, backCount.current]); // eslint-disable-line

  const save = async (t:number[], ii:IIdx, di:DIdx) => {
    try { await AsyncStorage.setItem(key(IMGS[ii].id, DIFFS[di].id), JSON.stringify({tiles:t})); }
    catch {}
  };
  const clearSave = async (ii:IIdx, di:DIdx) => {
    try { await AsyncStorage.removeItem(key(IMGS[ii].id, DIFFS[di].id)); setHasSave(false); }
    catch {}
  };

  // Retour au menu taquin (PAS menu principal)
  const goSelect = useCallback(() => {
    backCount.current += 1;
    setPhase('select');
  }, []);

  const launch = (ii:IIdx, di:DIdx, t:number[]) => {
    imgR.current  = ii; diffR.current = di;
    gridR.current = DIFFS[di].grid;
    tilesR.current = t; doneR.current = false;
    anims.clear(); fade.setValue(0);
    setImgIdx(ii); setDiffIdx(di);
    setTiles([...t]); setDone(false);
    setConfetti(false); setFullImg(false);
    setPhase('play');
    if (!isSolved(t)) save(t, ii, di);
  };

  const start = useCallback(async () => {
    const ii = imgIdx, di = diffIdx, d = DIFFS[di];
    try {
      const raw = await AsyncStorage.getItem(key(IMGS[ii].id, d.id));
      if (raw) {
        const data = JSON.parse(raw);
        const ok = Array.isArray(data.tiles) && data.tiles.length===d.grid*d.grid && !isSolved(data.tiles);
        if (ok) {
          setDlg({ title:'Partie en cours', msg:IMGS[ii].label+' - '+d.label,
            btns:[
              { label:'Reprendre',        primary:true, cb:()=>{ setDlg(null); launch(ii,di,data.tiles); } },
              { label:'Nouvelle partie',               cb:()=>{ setDlg(null); clearSave(ii,di); launch(ii,di,shuffleFromSolved(d.grid,d.moves)); } },
              { label:'Annuler',                       cb:()=>setDlg(null) },
            ]});
          return;
        }
      }
    } catch {}
    launch(ii, di, shuffleFromSolved(d.grid, d.moves));
  }, [imgIdx, diffIdx]);

  const reshuffle = () => {
    setDlg({ title:'Melanger', msg:'Melanger toutes les pieces ?',
      btns:[
        { label:'Annuler', cb:()=>setDlg(null) },
        { label:'Melanger !', primary:true, cb:()=>{
          setDlg(null);
          const d = DIFFS[diffR.current];
          const sh = shuffleFromSolved(d.grid, d.moves);
          anims.clear(); tilesR.current=sh; doneR.current=false;
          setTiles([...sh]); setDone(false); setConfetti(false);
          setFullImg(false); fade.setValue(0);
          save(sh, imgR.current, diffR.current);
        }},
      ]});
  };

  const leaveGame = () => {
    setDlg({ title:'Quitter', msg:'Progression sauvegardee.',
      btns:[
        { label:'Rester',  cb:()=>setDlg(null) },
        { label:'Quitter', primary:true, cb:()=>{ setDlg(null); goSelect(); } },
      ]});
  };

  const move = useCallback((pos:number) => {
    if (doneR.current) return;
    const cur = tilesR.current, g = gridR.current;
    if (!cur?.length) return;
    const ePos = cur.indexOf(g*g-1);
    if (ePos<0) return;
    const r=Math.floor(pos/g), c=pos%g, er=Math.floor(ePos/g), ec=ePos%g;
    const adj = (Math.abs(r-er)===1&&c===ec)||(Math.abs(c-ec)===1&&r===er);
    if (!adj) return;
    const next = applyMove(cur, pos, g);
    if (!next) return;

    const a = getAnim(cur[pos]);
    Animated.sequence([
      Animated.timing(a,{toValue:0.88,duration:50,useNativeDriver:ND}),
      Animated.spring(a,{toValue:1,useNativeDriver:ND,tension:400,friction:8}),
    ]).start();

    tilesR.current = next;
    setTiles([...next]);
    if (isSolved(next)) {
      doneR.current = true;
      setDone(true); setConfetti(true);
      clearSave(imgR.current, diffR.current);
      setTimeout(()=>{
        Animated.timing(fade,{toValue:1,duration:900,useNativeDriver:ND})
          .start(()=>setFullImg(true));
      }, 2200);
    } else {
      save(next, imgR.current, diffR.current);
    }
  }, []);

  const setImg  = (i:IIdx) => { imgR.current=i;  setImgIdx(i); };
  const setDiff = (d:DIdx) => { diffR.current=d; gridR.current=DIFFS[d].grid; setDiffIdx(d); };

  // Dialog modal (remplace Alert pour compatibilité web)
  const DlgModal = dlg ? (
    <Modal visible transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.dlgBox}>
          <Text style={s.dlgTitle}>{dlg.title}</Text>
          <Text style={s.dlgMsg}>{dlg.msg}</Text>
          {dlg.btns.map((b,i)=>(
            <TouchableOpacity key={i} style={[s.dlgBtn, b.primary&&s.dlgBtnPrimary]} onPress={b.cb}>
              <Text style={[s.dlgBtnTxt, b.primary&&s.dlgBtnTxtPrimary]}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  ) : null;

  // ═══ SELECTION ════════════════════════════════════════════════════════════
  if (phase === 'select') {
    return (
      <LinearGradient colors={['#FFF0F5','#FFE4F0','#FECDE0']} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          {DlgModal}
          <ScrollView contentContainerStyle={[s.sel, IS_WEB&&{maxWidth:500,alignSelf:'center' as const,width:'100%' as any}]}
            showsVerticalScrollIndicator={false}>

            <Text style={s.secTitle}>Choisissez une image</Text>
            <View style={s.imgRow}>
              {IMGS.map((img,i)=>(
                <TouchableOpacity key={img.id} style={[s.imgCard, imgIdx===i&&s.imgCardSel]}
                  onPress={()=>setImg(i as IIdx)} activeOpacity={0.8}>
                  <View style={s.imgWrap}>
                    <Image source={img.src} style={[s.imgPrev,{opacity:0.1}]} resizeMode="cover" blurRadius={Platform.OS==='android'?5:12}/>
                    <View style={s.imgOv}>
                      <Text style={s.qmark}>?</Text>
                      <Text style={{fontSize:22,marginTop:4}}>{img.emoji}</Text>
                    </View>
                  </View>
                  <Text style={[s.imgLabel, imgIdx===i&&s.imgLabelSel]}>{img.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.secTitle}>Difficulte</Text>
            <View style={s.diffRow}>
              {DIFFS.map((d,i)=>(
                <TouchableOpacity key={d.id} style={[s.diffCard, diffIdx===i&&s.diffCardSel]}
                  onPress={()=>setDiff(i as DIdx)} activeOpacity={0.8}>
                  <Text style={s.diffEmoji}>{d.emoji}</Text>
                  <Text style={[s.diffLabel, diffIdx===i&&s.diffLabelSel]}>{d.label}</Text>
                  <Text style={s.diffSub}>{d.grid}x{d.grid} - {d.grid*d.grid-1}p</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.help}>
              <Text style={s.helpTitle}>Comment jouer ?</Text>
              <Text style={s.helpTxt}>
                Reperez la case sombre.{'\n'}
                {IS_WEB ? 'Cliquez sur une piece adjacente.' : 'Swipez une piece vers la case.'}
              </Text>
            </View>

            <TouchableOpacity style={s.startBtn} onPress={start} activeOpacity={0.88}>
              <LinearGradient colors={['#FF6B9D','#FF4081']} style={s.startIn} start={{x:0,y:0}} end={{x:1,y:0}}>
                <Text style={s.startTxt}>{hasSave?'Continuer / Nouvelle partie':'Commencer !'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            {hasSave&&<Text style={s.saveHint}>Partie sauvegardee pour cette combinaison</Text>}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ═══ JEU ══════════════════════════════════════════════════════════════════
  const img = IMGS[imgIdx], diff = DIFFS[diffIdx];
  const grid = diff.grid;
  const { tileSize, boardSize } = getDims(grid);

  return (
    <LinearGradient colors={['#FFF0F5','#FFE4F0']} style={{flex:1}}>
      <SafeAreaView style={{flex:1}}>
        {DlgModal}
        {confetti && <Confetti onDone={()=>setConfetti(false)}/>}

        {/* Header */}
        <View style={s.hdr}>
          <TouchableOpacity onPress={leaveGame} style={s.hdrBtn}>
            <Text style={s.hdrBtnTxt}>Menu</Text>
          </TouchableOpacity>
          <View style={{alignItems:'center'}}>
            <Text style={s.hdrTitle}>{img.emoji} {diff.label}</Text>
            <Text style={s.hdrSub}>{grid}x{grid} - {grid*grid-1} pieces</Text>
          </View>
          <TouchableOpacity onPress={reshuffle} style={s.hdrBtn} disabled={done}>
            <Text style={[s.hdrBtnTxt, done&&{opacity:0.3}]}>Melanger</Text>
          </TouchableOpacity>
        </View>

        {/* Plateau */}
        <View style={{alignItems:'center', marginTop:16}}>
          <View style={{width:boardSize, height:boardSize, backgroundColor:'#C2185B',
            borderRadius:10, overflow:'hidden', flexDirection:'row', flexWrap:'wrap'}}>
            {tiles.map((v,p)=>(
              <Tile key={p} val={v} pos={p} grid={grid} ts={tileSize} bs={boardSize}
                src={img.src} onMove={move} empty={v===grid*grid-1} anim={getAnim(v)}/>
            ))}
          </View>
          {done && (
            <Animated.View style={{position:'absolute',top:0,width:boardSize,height:boardSize,
              borderRadius:10,opacity:fade}}>
              <Image source={img.src} style={{width:boardSize,height:boardSize,borderRadius:10}} resizeMode="cover"/>
            </Animated.View>
          )}
        </View>

        {done ? (
          <View style={s.victory}>
            <Text style={s.vicTitle}>Felicitations !</Text>
            <Text style={s.vicSub}>Vous avez reconstitue l'image !</Text>
            <View style={{flexDirection:'row',gap:12}}>
              <TouchableOpacity style={s.vBtn} onPress={()=>setFullImg(true)}>
                <LinearGradient colors={['#FF6B9D','#FF4081']} style={s.vBtnIn} start={{x:0,y:0}} end={{x:1,y:0}}>
                  <Text style={s.vBtnTxt}>Voir en grand</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={s.vBtn} onPress={goSelect}>
                <LinearGradient colors={['#FFB347','#FF8C00']} style={s.vBtnIn} start={{x:0,y:0}} end={{x:1,y:0}}>
                  <Text style={s.vBtnTxt}>Rejouer</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={s.hint}>
            {IS_WEB ? 'Cliquez sur une piece adjacente a la case sombre'
                    : 'Swipez une piece vers la case sombre'}
          </Text>
        )}

        {/* Modal image complète */}
        <Modal visible={fullImg} transparent animationType="fade" statusBarTranslucent>
          <View style={s.overlay}>
            <View style={s.imgModal}>
              <Text style={s.imgModalTitle}>Bravo ! Voici l'image !</Text>
              <Image source={img.src}
                style={{width:Math.min(SW-80,400),height:Math.min(SW-80,400),borderRadius:12}}
                resizeMode="cover"/>
              <View style={{flexDirection:'row',marginTop:16,gap:12,paddingHorizontal:16}}>
                <TouchableOpacity style={s.mClose} onPress={()=>setFullImg(false)}>
                  <Text style={{fontWeight:'700',color:'#555'}}>Fermer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.mNew} onPress={()=>{setFullImg(false);goSelect();}}>
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
  sel:{padding:20,paddingBottom:40},
  secTitle:{fontSize:19,fontWeight:'800',color:'#C2185B',marginBottom:14,marginTop:8},
  imgRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:24},
  imgCard:{width:'48%',borderRadius:18,overflow:'hidden',borderWidth:3,borderColor:'#E0E0E0',backgroundColor:'#fff'},
  imgCardSel:{borderColor:'#FF6B9D'},
  imgWrap:{height:130,backgroundColor:'#F5F5F5'},
  imgPrev:{width:'100%',height:'100%'},
  imgOv:{...StyleSheet.absoluteFillObject,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(255,240,245,0.5)'},
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
  help:{backgroundColor:'rgba(194,24,91,0.07)',borderRadius:14,padding:14,marginBottom:20,borderLeftWidth:4,borderLeftColor:'#FF6B9D'},
  helpTitle:{fontSize:14,fontWeight:'800',color:'#C2185B',marginBottom:6},
  helpTxt:{fontSize:13,color:'#555',lineHeight:20},
  startBtn:{borderRadius:30,overflow:'hidden'},
  startIn:{paddingVertical:18,alignItems:'center',borderRadius:30},
  startTxt:{color:'#fff',fontSize:18,fontWeight:'900',textAlign:'center'},
  saveHint:{textAlign:'center',color:'#AD1457',fontSize:12,marginTop:8,fontStyle:'italic'},
  hdr:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:12,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'rgba(194,24,91,0.1)'},
  hdrBtn:{padding:8},
  hdrBtnTxt:{color:'#C2185B',fontWeight:'700',fontSize:14},
  hdrTitle:{fontSize:16,fontWeight:'800',color:'#C2185B'},
  hdrSub:{fontSize:11,color:'#AD1457',marginTop:1},
  victory:{alignItems:'center',paddingVertical:14,paddingHorizontal:20},
  vicTitle:{fontSize:26,fontWeight:'900',color:'#C2185B',marginBottom:4},
  vicSub:{fontSize:14,color:'#AD1457',marginBottom:14},
  vBtn:{borderRadius:25,overflow:'hidden'},
  vBtnIn:{paddingHorizontal:20,paddingVertical:12},
  vBtnTxt:{color:'#fff',fontWeight:'800',fontSize:14},
  hint:{textAlign:'center',color:'#AD1457',fontSize:13,paddingHorizontal:30,paddingVertical:8,opacity:0.85},
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.85)',justifyContent:'center',alignItems:'center',padding:20},
  dlgBox:{backgroundColor:'#fff',borderRadius:20,padding:24,width:'100%',maxWidth:360},
  dlgTitle:{fontSize:18,fontWeight:'900',color:'#C2185B',marginBottom:8,textAlign:'center'},
  dlgMsg:{fontSize:14,color:'#555',marginBottom:16,textAlign:'center',lineHeight:20},
  dlgBtn:{paddingVertical:13,borderRadius:14,backgroundColor:'#EEE',alignItems:'center',marginTop:6},
  dlgBtnPrimary:{backgroundColor:'#FF6B9D'},
  dlgBtnTxt:{fontWeight:'700',color:'#555',fontSize:15},
  dlgBtnTxtPrimary:{color:'#fff'},
  imgModal:{backgroundColor:'#fff',borderRadius:24,overflow:'hidden',width:'100%',maxWidth:400,alignItems:'center',paddingBottom:20},
  imgModalTitle:{fontSize:17,fontWeight:'800',color:'#C2185B',paddingVertical:16,textAlign:'center'},
  mClose:{flex:1,paddingVertical:12,borderRadius:20,backgroundColor:'#EEE',alignItems:'center'},
  mNew:{flex:1,paddingVertical:12,borderRadius:20,backgroundColor:'#FF6B9D',alignItems:'center'},
});
