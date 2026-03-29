import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, Dimensions, Animated, ScrollView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;
const { width: SW } = Dimensions.get('window');
const ND     = Platform.OS !== 'web';
const IS_WEB = Platform.OS === 'web';
const MAX_W  = IS_WEB ? Math.min(SW, 500) : SW;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(40)).current;
  const floatAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:800, useNativeDriver:ND }),
      Animated.timing(slideAnim, { toValue:0, duration:800, useNativeDriver:ND }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue:1, duration:2000, useNativeDriver:ND }),
      Animated.timing(floatAnim, { toValue:0, duration:2000, useNativeDriver:ND }),
    ])).start();
  }, []);

  const floatY = floatAnim.interpolate({ inputRange:[0,1], outputRange:[0,-8] });

  return (
    <LinearGradient colors={['#FFF5F8','#FFE4F0','#FFCFE3']} style={s.gradient}>
      <SafeAreaView style={s.safe}>
        <ScrollView
          contentContainerStyle={[s.scroll, { width: MAX_W, alignSelf:'center' as const }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Bandeau */}
          <View style={s.banner}>
            <Text style={s.bannerTxt}>L'Atelier du Bisou Sucre</Text>
          </View>

          <Text style={s.emojiRow}>🐣  🌸  🥚  🌸  🐣</Text>

          {/* Logo flottant */}
          <Animated.View style={[s.logoWrap, { opacity:fadeAnim, transform:[{translateY:floatY}] }]}>
            <View style={s.logoRing}>
              <View style={s.logoClip}>
                <Image source={require('../../assets/logo_rond.png')} style={s.logoImg} resizeMode="cover"/>
              </View>
            </View>
          </Animated.View>

          {/* Titre */}
          <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim}] }}>
            <LinearGradient colors={['#FF4081','#FF6B9D','#FF4081']}
              start={{x:0,y:0}} end={{x:1,y:0}} style={s.ribbon}>
              <Text style={s.ribbonTxt}>🐰  Joyeuses Paques  🐰</Text>
            </LinearGradient>
            <Text style={s.title}>Vivez la magie{'\n'}de Paques !</Text>
            <Text style={s.subtitle}>avec L'Atelier du Bisou Sucre 💕</Text>
          </Animated.View>

          <View style={s.divider}>
            <View style={s.line}/>
            <Text style={{ fontSize:18, marginHorizontal:10 }}>🌸 🐇 🌸</Text>
            <View style={s.line}/>
          </View>

          {/* Carte Photo */}
          <TouchableOpacity onPress={() => navigation.navigate('Photo')} activeOpacity={0.88} style={s.card}>
            <LinearGradient colors={['#FF6B9D','#C2185B']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.cardGrad}>
              <View style={s.bubble}><Text style={s.cardEmoji}>📸</Text></View>
              <View style={s.cardBody}>
                <Text style={s.cardTitle}>Photo de Paques</Text>
                <Text style={s.cardDesc}>Immortalisez Paques avec notre cadre festif !</Text>
                <View style={s.chip}><Text style={s.chipTxt}>🎀 Cadre exclusif</Text></View>
              </View>
              <Text style={s.arrow}>›</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Carte Taquin */}
          <TouchableOpacity onPress={() => navigation.navigate('Taquin')} activeOpacity={0.88} style={s.card}>
            <LinearGradient colors={['#FFB347','#E65100']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.cardGrad}>
              <View style={[s.bubble,{backgroundColor:'rgba(255,255,255,0.2)'}]}>
                <Text style={s.cardEmoji}>🧩</Text>
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardTitle}>Jeu de Taquin</Text>
                <Text style={s.cardDesc}>Reconstituez les images piece par piece !</Text>
                <View style={[s.chip,{backgroundColor:'rgba(255,255,255,0.2)'}]}>
                  <Text style={s.chipTxt}>🏆 3 niveaux</Text>
                </View>
              </View>
              <Text style={s.arrow}>›</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={{ fontSize:20, letterSpacing:5, marginBottom:8 }}>🌼 🐥 🌷 🐥 🌼</Text>
            <Text style={s.footerTxt}>Fait avec amour par L'Atelier du Bisou Sucre</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  gradient: { flex:1 },
  safe: { flex:1 },
  scroll: { alignItems:'center', paddingHorizontal:20, paddingBottom:40 },
  banner: { width:'120%', backgroundColor:'#FF4081', paddingVertical:10, alignItems:'center', marginBottom:20 },
  bannerTxt: { color:'#fff', fontSize:13, fontWeight:'700', letterSpacing:2 },
  emojiRow: { fontSize:22, letterSpacing:6, marginBottom:20 },
  logoWrap: { alignItems:'center', marginBottom:24 },
  logoRing: { width:164, height:164, borderRadius:82, backgroundColor:'#fff', alignItems:'center', justifyContent:'center' },
  logoClip: { width:150, height:150, borderRadius:75, overflow:'hidden' },
  logoImg: { width:150, height:150 },
  ribbon: { width:'100%', paddingVertical:10, alignItems:'center', borderRadius:6, marginBottom:14 },
  ribbonTxt: { color:'#fff', fontSize:15, fontWeight:'800', letterSpacing:2 },
  title: { fontSize:40, fontWeight:'900', color:'#C2185B', textAlign:'center', lineHeight:48, marginBottom:8 },
  subtitle: { fontSize:14, color:'#AD1457', textAlign:'center', fontStyle:'italic', marginBottom:4 },
  divider: { flexDirection:'row', alignItems:'center', width:'90%', marginVertical:20 },
  line: { flex:1, height:1.5, backgroundColor:'rgba(194,24,91,0.2)' },
  card: { width:'100%', borderRadius:22, overflow:'hidden', marginBottom:16 },
  cardGrad: { flexDirection:'row', alignItems:'center', padding:18, minHeight:96 },
  bubble: { width:60, height:60, borderRadius:30, backgroundColor:'rgba(255,255,255,0.25)', justifyContent:'center', alignItems:'center', marginRight:16 },
  cardEmoji: { fontSize:32 },
  cardBody: { flex:1 },
  cardTitle: { fontSize:19, fontWeight:'900', color:'#fff', marginBottom:4 },
  cardDesc: { fontSize:12, color:'rgba(255,255,255,0.9)', lineHeight:17, marginBottom:8 },
  chip: { alignSelf:'flex-start', backgroundColor:'rgba(255,255,255,0.25)', paddingHorizontal:10, paddingVertical:3, borderRadius:20 },
  chipTxt: { color:'#fff', fontSize:11, fontWeight:'700' },
  arrow: { fontSize:32, color:'rgba(255,255,255,0.6)', marginLeft:6 },
  footer: { alignItems:'center', marginTop:14 },
  footerTxt: { fontSize:12, color:'#AD1457', fontStyle:'italic', opacity:0.7 },
});
