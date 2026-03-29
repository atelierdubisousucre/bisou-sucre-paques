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

const IS_WEB     = Platform.OS === 'web';
const IS_IOS     = Platform.OS === 'ios';
const FRAME_ASPECT = 711 / 1011;
const { width: SW, height: SH } = Dimensions.get('window');
const DISPLAY_W  = IS_WEB ? Math.min(SW, 500) : SW;
const DISPLAY_H  = Math.round(DISPLAY_W / FRAME_ASPECT);
const CONTROLS_H = 110;
type Phase = 'camera' | 'preview';

export default function PhotoScreen() {
  const [camPerm,   reqCamPerm]   = useCameraPermissions();
  const [mediaPerm, reqMediaPerm] = MediaLibrary.usePermissions();
  const [phase,       setPhase]       = useState<Phase>('camera');
  const [facing,      setFacing]      = useState<CameraType>('front');
  const [photoUri,    setPhotoUri]    = useState<string|null>(null);
  const [compositing, setCompositing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [webViewHTML, setWebViewHTML] = useState<string|null>(null);
  const [pendingAction, setPendingAction] = useState<'save'|'share'|null>(null);

  const cameraRef = useRef<CameraView>(null);
  const insets    = useSafeAreaInsets();
  const availableH = SH - insets.top - insets.bottom - CONTROLS_H;
  const frameTop   = insets.top + Math.max(0, (availableH - DISPLAY_H) / 2);

  useEffect(() => {
    (async () => {
      if (!camPerm?.granted) await reqCamPerm();
      if (!IS_WEB && !mediaPerm?.granted) await reqMediaPerm();
    })();
  }, []);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1, skipProcessing: false, exif: IS_IOS,
      });
      if (photo?.uri) { setPhotoUri(photo.uri); setPhase('preview'); }
    } catch { Alert.alert('Erreur', 'Impossible de prendre la photo.'); }
    finally { setIsCapturing(false); }
  }, [isCapturing]);

  // ── WEB : canvas natif ────────────────────────────────────────────────────
  const handleWeb = useCallback(async (action: 'save'|'share') => {
    if (!photoUri) return;
    setCompositing(true);
    try {
      const canvas = document.createElement('canvas');
      const photo  = new (window as any).Image() as HTMLImageElement;
      const frame  = new (window as any).Image() as HTMLImageElement;
      await new Promise<void>((res, rej) => {
        let n = 0;
        const onLoad = () => { if (++n >= 2) res(); };
        photo.onload = frame.onload = onLoad;
        photo.onerror = frame.onerror = rej;
        photo.src = photoUri;
        frame.src = FRAME_B64;
      });
      canvas.width  = photo.naturalWidth  || 1080;
      canvas.height = photo.naturalHeight || 1920;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob|null>(res => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error('blob failed');

      if (action === 'share' && (navigator as any).share) {
        await (navigator as any).share({
          files: [new File([blob], 'paques.jpg', { type:'image/jpeg' })],
          title: 'Photo de Paques',
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url;
        a.download = 'joyeuses-paques-' + Date.now() + '.jpg';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        Alert.alert('Photo telechargee !', 'Verifiez votre dossier Telechargements.');
      }
    } catch (e) {
      console.error('handleWeb:', e);
      Alert.alert('Erreur', 'Composition echouee.');
    } finally { setCompositing(false); }
  }, [photoUri]);

  // ── MOBILE : WebView canvas ───────────────────────────────────────────────
  const handleMobile = useCallback(async (action: 'save'|'share') => {
    if (!photoUri) return;
    setCompositing(true);
    setPendingAction(action);
    try {
      const FileSystem = require('expo-file-system');
      const photoB64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setWebViewHTML(
        `<!DOCTYPE html><html><body><canvas id="c" style="display:none"></canvas>
<script>
var p=new Image(),f=new Image(),n=0;
function go(){if(++n<2)return;
var W=p.naturalWidth||1080,H=p.naturalHeight||1920;
var c=document.getElementById('c');c.width=W;c.height=H;
var x=c.getContext('2d');x.drawImage(p,0,0,W,H);x.drawImage(f,0,0,W,H);
window.ReactNativeWebView.postMessage(JSON.stringify({ok:true,data:c.toDataURL('image/jpeg',0.92)}));}
function err(){window.ReactNativeWebView.postMessage(JSON.stringify({ok:false}));}
p.onload=f.onload=go;p.onerror=f.onerror=err;
p.src='data:image/jpeg;base64,${photoB64}';
f.src='${FRAME_B64}';
</script></body></html>`
      );
    } catch (e) {
      console.error('handleMobile:', e);
      setCompositing(false);
      setPendingAction(null);
      // Fallback sans cadre
      if (action === 'save') await doSave(photoUri);
      else await doShare(photoUri);
    }
  }, [photoUri]);

  // ── Résultat WebView ──────────────────────────────────────────────────────
  const onWebViewMsg = useCallback(async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      setWebViewHTML(null);
      const action = pendingAction;
      setPendingAction(null);

      if (!msg.ok || !msg.data) {
        setCompositing(false);
        if (photoUri) {
          if (action === 'save') await doSave(photoUri);
          else await doShare(photoUri);
        }
        return;
      }

      const FileSystem = require('expo-file-system');
      const b64    = msg.data.replace('data:image/jpeg;base64,', '');
      const outUri = FileSystem.cacheDirectory + 'paques_' + Date.now() + '.jpg';
      await FileSystem.writeAsStringAsync(outUri, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setCompositing(false);
      if (action === 'save') await doSave(outUri);
      else await doShare(outUri);
    } catch (e) {
      console.error('onWebViewMsg:', e);
      setCompositing(false);
    }
  }, [pendingAction, photoUri]);

  // ── Sauvegarde mobile ─────────────────────────────────────────────────────
  const doSave = async (uri: string) => {
    try {
      // S'assurer que les permissions sont OK
      let perm = mediaPerm;
      if (!perm?.granted) {
        const r = await reqMediaPerm();
        perm = r;
      }
      if (!perm?.granted) {
        Alert.alert('Permission requise',
          IS_IOS
            ? 'Reglages → Expo Go → Photos → Autoriser'
            : 'Parametres → Applications → Expo Go → Autorisations → Photos',
          [{ text:'OK' }, { text:'Parametres', onPress:()=>Linking.openSettings() }]
        );
        return;
      }

      if (IS_IOS) {
        // iOS : createAssetAsync plus fiable que saveToLibraryAsync
        const asset = await MediaLibrary.createAssetAsync(uri);
        // Optionnel : créer un album dédié
        try {
          const album = await MediaLibrary.getAlbumAsync('Joyeuses Paques');
          if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          } else {
            await MediaLibrary.createAlbumAsync('Joyeuses Paques', asset, false);
          }
        } catch {
          // Si l'album échoue, la photo est quand même dans la galerie
        }
        Alert.alert('Photo sauvegardee !', 'Dans votre galerie Photos 🐣');
      } else {
        // Android : saveToLibraryAsync
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert('Photo sauvegardee !', 'Dans votre galerie 🐣');
      }
    } catch (e: any) {
      console.error('doSave:', e);
      // Sur iOS, si saveToLibraryAsync échoue, proposer le partage
      Alert.alert('Sauvegarde impossible',
        IS_IOS
          ? 'Utilisez "Partager" puis "Enregistrer dans Photos".'
          : 'Verifiez les permissions.',
        [
          { text:'OK' },
          { text:'Partager', onPress:()=>doShare(uri) },
        ]
      );
    }
  };

  // ── Partage mobile ────────────────────────────────────────────────────────
  const doShare = async (uri: string) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Partager votre photo de Paques',
          UTI: 'public.jpeg',
        });
      }
    } catch (e) { console.error('doShare:', e); }
  };

  // ── Dispatcher save/share ─────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (IS_WEB) { await handleWeb('save'); }
    else        { await handleMobile('save'); }
  }, [handleWeb, handleMobile]);

  const handleShare = useCallback(async () => {
    if (IS_WEB) { await handleWeb('share'); }
    else        { await handleMobile('share'); }
  }, [handleWeb, handleMobile]);

  const retake = useCallback(() => {
    setPhotoUri(null); setWebViewHTML(null);
    setPendingAction(null); setCompositing(false);
    setPhase('camera');
  }, []);

  // ── Permission ────────────────────────────────────────────────────────────
  if (!camPerm) return <View style={s.ctr}><ActivityIndicator size="large" color="#FF6B9D"/></View>;
  if (!camPerm.granted) {
    return (
      <LinearGradient colors={['#FFF0F5','#FFE4F0']} style={s.ctr}>
        <Text style={{ fontSize:60, marginBottom:16 }}>📸</Text>
        <Text style={s.permTxt}>L'acces a la camera est necessaire.</Text>
        <TouchableOpacity style={s.permBtn} onPress={reqCamPerm}>
          <Text style={s.permBtnTxt}>Autoriser la camera</Text>
        </TouchableOpacity>
        {!IS_WEB && (
          <TouchableOpacity style={[s.permBtn,{marginTop:10,backgroundColor:'#888'}]}
            onPress={()=>Linking.openSettings()}>
            <Text style={s.permBtnTxt}>Ouvrir les parametres</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    );
  }

  // ── Prévisualisation ───────────────────────────────────────────────────────
  if (phase === 'preview' && photoUri) {
    let WebViewNode: any = null;
    if (!IS_WEB && webViewHTML) {
      try {
        const { WebView } = require('react-native-webview');
        WebViewNode = (
          <WebView
            source={{ html: webViewHTML }}
            onMessage={onWebViewMsg}
            style={{ width:1, height:1, opacity:0, position:'absolute' }}
            javaScriptEnabled
            originWhitelist={['*']}
            mixedContentMode="always"
          />
        );
      } catch {}
    }

    return (
      <View style={{ flex:1, backgroundColor:'#0a0a0a' }}>
        {WebViewNode}
        <View style={s.prevWrap}>
          <View style={{ width:DISPLAY_W, height:DISPLAY_H }}>
            <Image source={{ uri:photoUri }}
              style={{ position:'absolute', width:DISPLAY_W, height:DISPLAY_H }}
              resizeMode="cover"/>
            <Image source={require('../../assets/cadre.png')}
              style={{ position:'absolute', width:DISPLAY_W, height:DISPLAY_H }}
              resizeMode="stretch"/>
          </View>
        </View>
        <LinearGradient colors={['transparent','rgba(0,0,0,0.92)']}
          style={[s.prevCtrl, { paddingBottom:insets.bottom+16 }]}>
          <Text style={s.prevTitle}>Belle photo de Paques !</Text>
          <View style={s.prevBtns}>
            <TouchableOpacity style={[s.pBtn,s.btnRetake]} onPress={retake} disabled={compositing}>
              <Text style={s.pBtnIcon}>🔄</Text>
              <Text style={s.pBtnTxt}>Reprendre</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.pBtn,s.btnSave]} onPress={handleSave} disabled={compositing}>
              {compositing
                ? <ActivityIndicator color="#fff" size="small"/>
                : <Text style={s.pBtnIcon}>💾</Text>}
              <Text style={s.pBtnTxt}>{IS_WEB?'Telecharger':'Sauvegarder'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.pBtn,s.btnShare]} onPress={handleShare} disabled={compositing}>
              {compositing
                ? <ActivityIndicator color="#fff" size="small"/>
                : <Text style={s.pBtnIcon}>📤</Text>}
              <Text style={s.pBtnTxt}>Partager</Text>
            </TouchableOpacity>
          </View>
          {compositing && (
            <Text style={s.compositing}>Application du cadre... ✨</Text>
          )}
          {IS_IOS && !compositing && (
            <Text style={s.iosTip}>
              💡 Si la sauvegarde echoue, utilisez Partager → Enregistrer dans Photos
            </Text>
          )}
        </LinearGradient>
      </View>
    );
  }

  // ── Caméra ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex:1, backgroundColor:'#000' }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing={facing}/>
      {frameTop > 0 && (
        <View style={{ position:'absolute', top:0, left:0, right:0,
          height:frameTop, backgroundColor:'#000' }}/>
      )}
      <Image source={require('../../assets/cadre.png')}
        style={{ position:'absolute', top:frameTop, left:0,
          width:DISPLAY_W, height:DISPLAY_H }}
        resizeMode="stretch"/>
      <View style={{ position:'absolute', top:frameTop+DISPLAY_H,
        left:0, right:0, bottom:0, backgroundColor:'#000' }}/>
      <View style={{ position:'absolute', top:frameTop+14,
        left:0, right:0, alignItems:'center' }}>
        <Text style={s.hint}>📸 Positionnez-vous dans le cadre</Text>
      </View>
      <View style={[s.ctrl, { paddingBottom:insets.bottom+8 }]}>
        <TouchableOpacity style={s.flipBtn}
          onPress={()=>setFacing(f=>f==='front'?'back':'front')}>
          <Text style={{ fontSize:26 }}>🔄</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.shutter} onPress={takePicture} disabled={isCapturing}>
          {isCapturing
            ? <ActivityIndicator color="#C2185B"/>
            : <View style={s.shutterIn}/>}
        </TouchableOpacity>
        <View style={{ width:54 }}/>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ctr:{ flex:1, justifyContent:'center', alignItems:'center',
    padding:30, backgroundColor:'#fff' },
  permTxt:{ fontSize:16, color:'#444', textAlign:'center',
    lineHeight:24, marginBottom:24 },
  permBtn:{ backgroundColor:'#FF6B9D', paddingHorizontal:32,
    paddingVertical:14, borderRadius:30, marginBottom:4 },
  permBtnTxt:{ color:'#fff', fontWeight:'bold', fontSize:16, textAlign:'center' },
  prevWrap:{ flex:1, justifyContent:'center', alignItems:'center' },
  prevCtrl:{ position:'absolute', bottom:0, left:0, right:0,
    paddingTop:24, paddingHorizontal:20 },
  prevTitle:{ color:'#fff', fontSize:17, fontWeight:'bold',
    textAlign:'center', marginBottom:14 },
  prevBtns:{ flexDirection:'row', justifyContent:'space-around', alignItems:'center' },
  pBtn:{ alignItems:'center', paddingHorizontal:14,
    paddingVertical:10, borderRadius:14, minWidth:88 },
  btnRetake:{ backgroundColor:'rgba(255,255,255,0.18)' },
  btnSave:{ backgroundColor:'#4CAF50' },
  btnShare:{ backgroundColor:'#2196F3' },
  pBtnIcon:{ fontSize:24, marginBottom:3 },
  pBtnTxt:{ color:'#fff', fontWeight:'700', fontSize:12 },
  compositing:{ color:'rgba(255,255,255,0.7)', textAlign:'center',
    fontSize:12, marginTop:8 },
  iosTip:{ color:'rgba(255,255,255,0.5)', textAlign:'center',
    fontSize:11, marginTop:6, fontStyle:'italic' },
  hint:{ color:'#fff', backgroundColor:'rgba(0,0,0,0.45)',
    paddingHorizontal:14, paddingVertical:6, borderRadius:20,
    fontSize:12, overflow:'hidden' },
  ctrl:{ position:'absolute', bottom:0, left:0, right:0,
    flexDirection:'row', justifyContent:'space-around', alignItems:'center',
    paddingTop:14, paddingHorizontal:40, backgroundColor:'rgba(0,0,0,0.45)',
    height:CONTROLS_H },
  shutter:{ width:76, height:76, borderRadius:38,
    backgroundColor:'rgba(255,255,255,0.18)', borderWidth:4,
    borderColor:'#fff', justifyContent:'center', alignItems:'center' },
  shutterIn:{ width:60, height:60, borderRadius:30, backgroundColor:'#fff' },
  flipBtn:{ width:54, height:54, borderRadius:27,
    backgroundColor:'rgba(255,255,255,0.18)',
    justifyContent:'center', alignItems:'center' },
});
