import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Alert, ActivityIndicator, Image,
  Platform, Linking,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FRAME_B64 } from '../utils/frameData';

// Imports conditionnels - non disponibles sur web
let FileSystem: any = null;
let WebViewComp: any = null;
if (Platform.OS !== 'web') {
  FileSystem  = require('expo-file-system');
  WebViewComp = require('react-native-webview').WebView;
}

const FRAME_ASPECT = 711 / 1011;
const { width: SW, height: SH } = Dimensions.get('window');
const IS_WEB     = Platform.OS === 'web';
const DISPLAY_W  = IS_WEB ? Math.min(SW, 500) : SW;
const DISPLAY_H  = Math.round(DISPLAY_W / FRAME_ASPECT);
const CONTROLS_H = 110;
type Phase = 'camera' | 'preview';

const makeCompositorHTML = (photoB64: string, frameB64: string) =>
  `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>*{margin:0;padding:0}body{background:#000}</style>
  </head><body><canvas id="c" style="display:none"></canvas>
  <script>
  (function(){
    var photo=new Image(),frame=new Image(),n=0;
    function draw(){
      if(++n<2)return;
      var W=photo.naturalWidth||1080,H=photo.naturalHeight||1920;
      var c=document.getElementById('c');
      c.width=W;c.height=H;
      var ctx=c.getContext('2d');
      ctx.drawImage(photo,0,0,W,H);
      ctx.drawImage(frame,0,0,W,H);
      window.ReactNativeWebView.postMessage(JSON.stringify({ok:true,data:c.toDataURL('image/jpeg',0.95)}));
    }
    function err(e){window.ReactNativeWebView.postMessage(JSON.stringify({ok:false,msg:''+e.type}));}
    photo.onload=frame.onload=draw;
    photo.onerror=frame.onerror=err;
    photo.src='data:image/jpeg;base64,${photoB64}';
    frame.src='${frameB64}';
  })();
  </script></body></html>`;

export default function PhotoScreen() {
  const [camPerm,   reqCamPerm]   = useCameraPermissions();
  const [mediaPerm, reqMediaPerm] = MediaLibrary.usePermissions();
  const [phase,          setPhase]          = useState<Phase>('camera');
  const [facing,         setFacing]         = useState<CameraType>('front');
  const [photoUri,       setPhotoUri]       = useState<string|null>(null);
  const [compositorHTML, setCompositorHTML] = useState<string|null>(null);
  const [compositing,    setCompositing]    = useState(false);
  const [pendingAction,  setPendingAction]  = useState<'save'|'share'|null>(null);
  const [isCapturing,    setIsCapturing]    = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const insets    = useSafeAreaInsets();
  const availableH = SH - insets.top - insets.bottom - CONTROLS_H;
  const frameTop   = insets.top + Math.max(0, (availableH - DISPLAY_H) / 2);

  useEffect(() => {
    (async () => {
      if (!camPerm?.granted)              await reqCamPerm();
      if (!IS_WEB && !mediaPerm?.granted) await reqMediaPerm();
    })();
  }, []);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality:1, skipProcessing:false, exif: Platform.OS==='ios',
      });
      if (photo?.uri) { setPhotoUri(photo.uri); setPhase('preview'); }
    } catch { Alert.alert('Erreur', 'Impossible de prendre la photo.'); }
    finally   { setIsCapturing(false); }
  }, [isCapturing]);

  // ── Composition WEB : canvas natif avec FRAME_B64 (pas d'URL HTTP) ────────
  const composeWeb = useCallback(async (action: 'save'|'share') => {
    if (!photoUri) return;
    setCompositing(true);
    try {
      const canvas = document.createElement('canvas');
      const photo  = new window.Image();
      const frame  = new window.Image();
      await new Promise<void>((res, rej) => {
        let loaded = 0;
        const onLoad = () => { if (++loaded >= 2) res(); };
        photo.onload = frame.onload = onLoad;
        photo.onerror = frame.onerror = (e: any) => rej(e);
        photo.src = photoUri;
        frame.src = FRAME_B64; // constante base64 — jamais de 404
      });
      canvas.width  = photo.naturalWidth  || 1080;
      canvas.height = photo.naturalHeight || 1920;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob|null>(res => canvas.toBlob(res, 'image/jpeg', 0.95));
      if (!blob) throw new Error('toBlob failed');

      if (action === 'share' && (navigator as any).share) {
        const file = new File([blob], 'paques.jpg', { type:'image/jpeg' });
        await (navigator as any).share({ files:[file], title:'Photo de Paques 🐣' });
      } else {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url; a.download = `joyeuses-paques-${Date.now()}.jpg`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        Alert.alert('Photo téléchargée !', 'Vérifiez votre dossier Téléchargements 🐣');
      }
    } catch (e) {
      console.error('composeWeb:', e);
      Alert.alert('Erreur', 'Composition du cadre échouée.');
    } finally { setCompositing(false); }
  }, [photoUri]);

  // ── Composition MOBILE : WebView ──────────────────────────────────────────
  const startCompositing = useCallback(async (action: 'save'|'share') => {
    if (IS_WEB) { await composeWeb(action); return; }
    if (!photoUri || !FileSystem) return;
    try {
      setCompositing(true); setPendingAction(action);
      const photoB64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setCompositorHTML(makeCompositorHTML(photoB64, FRAME_B64));
    } catch (e) {
      console.error('startCompositing:', e);
      setCompositing(false);
      Alert.alert('Erreur', 'Impossible de charger la photo.');
    }
  }, [photoUri, composeWeb]);

  const onWebViewMsg = useCallback(async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      setCompositorHTML(null);
      if (!msg.ok) {
        setCompositing(false);
        Alert.alert('Cadre indisponible', 'La photo sera enregistrée sans le cadre.', [
          { text:'Annuler', style:'cancel', onPress:()=>setPendingAction(null) },
          { text:'Continuer', onPress:async()=>{
            const act=pendingAction; setPendingAction(null);
            if (!photoUri) return;
            if (act==='save') await doSave(photoUri);
            else if (act==='share') await doShare(photoUri);
          }},
        ]);
        return;
      }
      const b64    = (msg.data as string).replace('data:image/jpeg;base64,','');
      const outUri = `${FileSystem.cacheDirectory}paques_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(outUri, b64, { encoding:FileSystem.EncodingType.Base64 });
      const action = pendingAction;
      setCompositing(false); setPendingAction(null);
      if (action==='save') await doSave(outUri);
      else if (action==='share') await doShare(outUri);
    } catch (e) { console.error('onWebViewMsg:',e); setCompositing(false); }
  }, [pendingAction, photoUri]);

  const doSave = async (uri: string) => {
    try {
      let perm = mediaPerm;
      if (!perm?.granted) { const r=await reqMediaPerm(); perm=r; }
      if (!perm?.granted) {
        Alert.alert('Permission requise',
          Platform.OS==='android'
            ? 'Paramètres → Applications → Expo Go → Autorisations → Photos'
            : 'Réglages → Expo Go → Photos → Autoriser',
          [{ text:'Annuler', style:'cancel' },
           { text:'Paramètres', onPress:()=>Linking.openSettings() }]);
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Photo sauvegardée !', 'Votre photo est dans votre galerie ! 🐣');
    } catch (e) {
      console.error('doSave:',e);
      Alert.alert('Erreur', 'Sauvegarde impossible.', [
        { text:'OK' }, { text:'Partager', onPress:()=>doShare(uri) },
      ]);
    }
  };

  const doShare = async (uri: string) => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Indisponible','Le partage n\'est pas disponible.'); return;
      }
      await Sharing.shareAsync(uri, { mimeType:'image/jpeg', dialogTitle:'Partager 🐣', UTI:'public.jpeg' });
    } catch (e) { console.error('doShare:',e); }
  };

  const retake = useCallback(() => {
    setPhotoUri(null); setCompositorHTML(null);
    setCompositing(false); setPendingAction(null); setPhase('camera');
  }, []);

  if (!camPerm) return <View style={s.ctr}><ActivityIndicator size="large" color="#FF6B9D"/></View>;
  if (!camPerm.granted) {
    return (
      <LinearGradient colors={['#FFF0F5','#FFE4F0']} style={s.ctr}>
        <Text style={s.permEmoji}>📸</Text>
        <Text style={s.permText}>L'accès à la caméra est nécessaire{'\n'}pour vos photos de Pâques.</Text>
        <TouchableOpacity style={s.permBtn} onPress={reqCamPerm}>
          <Text style={s.permBtnTxt}>Autoriser la caméra</Text>
        </TouchableOpacity>
        {!IS_WEB && (
          <TouchableOpacity style={[s.permBtn,{marginTop:10,backgroundColor:'#888'}]}
            onPress={()=>Linking.openSettings()}>
            <Text style={s.permBtnTxt}>Ouvrir les paramètres</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    );
  }

  if (phase==='preview' && photoUri) {
    return (
      <View style={{flex:1,backgroundColor:'#0a0a0a'}}>
        {!IS_WEB && WebViewComp && compositorHTML && (
          <WebViewComp source={{html:compositorHTML}} onMessage={onWebViewMsg}
            style={{width:1,height:1,opacity:0,position:'absolute'}}
            javaScriptEnabled originWhitelist={['*']} mixedContentMode="always"/>
        )}
        <View style={s.prevWrap}>
          <View style={{width:DISPLAY_W,height:DISPLAY_H}}>
            <Image source={{uri:photoUri}}
              style={{position:'absolute',width:DISPLAY_W,height:DISPLAY_H}} resizeMode="cover"/>
            <Image source={require('../../assets/cadre.png')}
              style={{position:'absolute',width:DISPLAY_W,height:DISPLAY_H}} resizeMode="stretch"/>
          </View>
        </View>
        <LinearGradient colors={['transparent','rgba(0,0,0,0.93)']}
          style={[s.prevCtrl,{paddingBottom:insets.bottom+16}]}>
          <Text style={s.prevTitle}>Belle photo de Paques !</Text>
          <View style={s.prevBtns}>
            <TouchableOpacity style={[s.pBtn,s.btnRetake]} onPress={retake} disabled={compositing}>
              <Text style={s.pBtnIcon}>🔄</Text>
              <Text style={s.pBtnTxt}>Reprendre</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.pBtn,s.btnSave]}
              onPress={()=>startCompositing('save')} disabled={compositing}>
              {compositing&&pendingAction==='save'
                ? <ActivityIndicator color="#fff" size="small"/>
                : <Text style={s.pBtnIcon}>💾</Text>}
              <Text style={s.pBtnTxt}>{IS_WEB?'Telecharger':'Sauvegarder'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.pBtn,s.btnShare]}
              onPress={()=>startCompositing('share')} disabled={compositing}>
              {compositing&&pendingAction==='share'
                ? <ActivityIndicator color="#fff" size="small"/>
                : <Text style={s.pBtnIcon}>📤</Text>}
              <Text style={s.pBtnTxt}>Partager</Text>
            </TouchableOpacity>
          </View>
          {compositing&&(
            <Text style={{color:'rgba(255,255,255,0.7)',textAlign:'center',fontSize:12,marginTop:8}}>
              Application du cadre... ✨
            </Text>
          )}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={{flex:1,backgroundColor:'#000'}}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing={facing}/>
      {frameTop>0&&<View style={{position:'absolute',top:0,left:0,right:0,height:frameTop,backgroundColor:'#000'}}/>}
      <Image source={require('../../assets/cadre.png')}
        style={{position:'absolute',top:frameTop,left:0,width:DISPLAY_W,height:DISPLAY_H}}
        resizeMode="stretch"/>
      <View style={{position:'absolute',top:frameTop+DISPLAY_H,left:0,right:0,bottom:0,backgroundColor:'#000'}}/>
      <View style={{position:'absolute',top:frameTop+14,left:0,right:0,alignItems:'center'}}>
        <Text style={s.hint}>📸 Positionnez-vous dans le cadre</Text>
      </View>
      <View style={[s.ctrl,{paddingBottom:insets.bottom+8}]}>
        <TouchableOpacity style={s.flipBtn}
          onPress={()=>setFacing(f=>f==='front'?'back':'front')} activeOpacity={0.75}>
          <Text style={{fontSize:26}}>🔄</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.shutter} onPress={takePicture} disabled={isCapturing} activeOpacity={0.85}>
          {isCapturing?<ActivityIndicator color="#C2185B"/>:<View style={s.shutterIn}/>}
        </TouchableOpacity>
        <View style={{width:54}}/>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ctr:{flex:1,justifyContent:'center',alignItems:'center',padding:30,backgroundColor:'#fff'},
  permEmoji:{fontSize:60,marginBottom:16},
  permText:{fontSize:16,color:'#444',textAlign:'center',lineHeight:24,marginBottom:24},
  permBtn:{backgroundColor:'#FF6B9D',paddingHorizontal:32,paddingVertical:14,borderRadius:30,marginBottom:4},
  permBtnTxt:{color:'#fff',fontWeight:'bold',fontSize:16,textAlign:'center'},
  prevWrap:{flex:1,justifyContent:'center',alignItems:'center'},
  prevCtrl:{position:'absolute',bottom:0,left:0,right:0,paddingTop:30,paddingHorizontal:20},
  prevTitle:{color:'#fff',fontSize:17,fontWeight:'bold',textAlign:'center',marginBottom:16},
  prevBtns:{flexDirection:'row',justifyContent:'space-around',alignItems:'center'},
  pBtn:{alignItems:'center',paddingHorizontal:14,paddingVertical:10,borderRadius:14,minWidth:90},
  btnRetake:{backgroundColor:'rgba(255,255,255,0.18)'},
  btnSave:{backgroundColor:'#4CAF50'},
  btnShare:{backgroundColor:'#2196F3'},
  pBtnIcon:{fontSize:24,marginBottom:4},
  pBtnTxt:{color:'#fff',fontWeight:'700',fontSize:12},
  hint:{color:'#fff',backgroundColor:'rgba(0,0,0,0.45)',paddingHorizontal:14,paddingVertical:6,borderRadius:20,fontSize:12,overflow:'hidden'},
  ctrl:{position:'absolute',bottom:0,left:0,right:0,flexDirection:'row',justifyContent:'space-around',alignItems:'center',paddingTop:14,paddingHorizontal:40,backgroundColor:'rgba(0,0,0,0.45)',height:CONTROLS_H},
  shutter:{width:76,height:76,borderRadius:38,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:4,borderColor:'#fff',justifyContent:'center',alignItems:'center'},
  shutterIn:{width:60,height:60,borderRadius:30,backgroundColor:'#fff'},
  flipBtn:{width:54,height:54,borderRadius:27,backgroundColor:'rgba(255,255,255,0.18)',justifyContent:'center',alignItems:'center'},
});
