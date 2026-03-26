import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../types/navigation';

type HomeNavProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const { width: SW } = Dimensions.get('window');
const LOGO_SIZE = 150;
const TITLE_FONT = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const SCRIPT_FONT = Platform.OS === 'ios' ? 'Palatino' : 'serif';

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();

  const logoAnim  = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const btn1Anim  = useRef(new Animated.Value(0)).current;
  const btn2Anim  = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const haloAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrée en cascade
    Animated.stagger(180, [
      Animated.spring(logoAnim,  { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.spring(titleAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.spring(btn1Anim,  { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.spring(btn2Anim,  { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
    ]).start();

    // Flottement du logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();

    // Pulsation du halo
    Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(haloAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const floatY      = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const haloScale   = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.18] });
  const haloOpacity = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.0] });

  return (
    <LinearGradient colors={['#FFF5F8', '#FFE8F0', '#FFCFE3', '#FFB8D4']} style={s.gradient}>
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Bandeau haut */}
          <View style={s.topBanner}>
            <Text style={s.bannerText}>✦  L'Atelier du Bisou Sucré  ✦</Text>
          </View>

          {/* Emojis festifs */}
          <Text style={s.emojiRow}>🐣  🌸  🥚  🌸  🐣</Text>

          {/* Logo flottant avec halo */}
          <Animated.View style={[s.logoOuter, { opacity: logoAnim, transform: [{ translateY: floatY }] }]}>
            {/* Halo pulsant */}
            <Animated.View style={[s.logoHalo, { transform: [{ scale: haloScale }], opacity: haloOpacity }]} />
            {/* Anneau blanc */}
            <View style={s.logoRing}>
              {/* Clip circulaire : overflow hidden rogne le PNG */}
              <View style={s.logoClip}>
                <Image
                  source={require('../../assets/logo_rond.png')}
                  style={s.logoImg}
                  resizeMode="cover"
                />
              </View>
            </View>
          </Animated.View>

          {/* Bloc titre */}
          <Animated.View style={[s.titleBlock, {
            opacity: titleAnim,
            transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }]}>
            {/* Ruban décoratif */}
            <LinearGradient
              colors={['#FF4081', '#FF6B9D', '#FF4081']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.ribbon}
            >
              <Text style={s.ribbonText}>🐰  Joyeuses Pâques  🐰</Text>
            </LinearGradient>

            <Text style={s.mainTitle}>Vivez la magie{'\n'}de Pâques !</Text>
            <Text style={s.subtitle}>avec L'Atelier du Bisou Sucré 💕</Text>
          </Animated.View>

          {/* Séparateur */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerFleur}>🌸 🐇 🌸</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Carte Photo */}
          <Animated.View style={[s.cardWrap, {
            opacity: btn1Anim,
            transform: [{ translateX: btn1Anim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }],
          }]}>
            <TouchableOpacity onPress={() => navigation.navigate('Photo')} activeOpacity={0.88} style={s.card}>
              <LinearGradient
                colors={['#FF6B9D', '#E91E8C', '#C2185B']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.cardGrad}
              >
                <View style={s.emojiBubble}>
                  <Text style={s.cardEmoji}>📸</Text>
                </View>
                <View style={s.cardText}>
                  <Text style={s.cardTitle}>Photo de Pâques</Text>
                  <Text style={s.cardDesc}>Immortalisez Pâques avec notre joli cadre festif !</Text>
                  <View style={s.cardChip}>
                    <Text style={s.cardChipText}>🎀 Cadre exclusif inclus</Text>
                  </View>
                </View>
                <Text style={s.cardArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Carte Taquin */}
          <Animated.View style={[s.cardWrap, {
            opacity: btn2Anim,
            transform: [{ translateX: btn2Anim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
          }]}>
            <TouchableOpacity onPress={() => navigation.navigate('Taquin')} activeOpacity={0.88} style={s.card}>
              <LinearGradient
                colors={['#FFB347', '#FF8C00', '#E65100']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.cardGrad}
              >
                <View style={[s.emojiBubble, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Text style={s.cardEmoji}>🧩</Text>
                </View>
                <View style={s.cardText}>
                  <Text style={s.cardTitle}>Jeu de Taquin</Text>
                  <Text style={s.cardDesc}>Reconstituez les images de Pâques pièce par pièce !</Text>
                  <View style={[s.cardChip, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                    <Text style={s.cardChipText}>🏆 3 niveaux de difficulté</Text>
                  </View>
                </View>
                <Text style={s.cardArrow}>›</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footerEmoji}>🌼  🐥  🌷  🐥  🌼</Text>
            <Text style={s.footerText}>Fait avec 💕 par L'Atelier du Bisou Sucré</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  scroll: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 40 },

  topBanner: {
    width: SW + 40,
    backgroundColor: '#FF4081',
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 18,
    marginHorizontal: -20,
  },
  bannerText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 2, fontFamily: SCRIPT_FONT },

  emojiRow: { fontSize: 24, letterSpacing: 6, marginBottom: 22 },

  // Logo
  logoOuter: { alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  logoHalo: {
    position: 'absolute',
    width: LOGO_SIZE + 44,
    height: LOGO_SIZE + 44,
    borderRadius: (LOGO_SIZE + 44) / 2,
    backgroundColor: '#FF6B9D',
  },
  logoRing: {
    width: LOGO_SIZE + 14,
    height: LOGO_SIZE + 14,
    borderRadius: (LOGO_SIZE + 14) / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C2185B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 14,
  },
  // overflow: 'hidden' est INDISPENSABLE pour rogner le PNG en cercle
  logoClip: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    overflow: 'hidden',
  },
  logoImg: { width: LOGO_SIZE, height: LOGO_SIZE },

  // Titre
  titleBlock: { alignItems: 'center', width: '100%', marginBottom: 8 },
  ribbon: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 6,
    marginBottom: 16,
  },
  ribbonText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 2, fontFamily: SCRIPT_FONT },
  mainTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#C2185B',
    textAlign: 'center',
    fontFamily: TITLE_FONT,
    lineHeight: 50,
    textShadowColor: 'rgba(194,24,91,0.12)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#AD1457',
    textAlign: 'center',
    fontFamily: SCRIPT_FONT,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },

  // Séparateur
  divider: { flexDirection: 'row', alignItems: 'center', width: '90%', marginVertical: 22 },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: 'rgba(194,24,91,0.2)', borderRadius: 1 },
  dividerFleur: { fontSize: 18, marginHorizontal: 10 },

  // Cartes
  cardWrap: {
    width: '100%', marginBottom: 16, borderRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 14, elevation: 10,
  },
  card: { borderRadius: 24, overflow: 'hidden' },
  cardGrad: {
    flexDirection: 'row', alignItems: 'center',
    padding: 18, paddingRight: 14, minHeight: 100, overflow: 'hidden',
  },
  emojiBubble: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  cardEmoji: { fontSize: 34 },
  cardText: { flex: 1 },
  cardTitle: {
    fontSize: 20, fontWeight: '900', color: '#fff',
    marginBottom: 4, fontFamily: TITLE_FONT,
  },
  cardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 17, marginBottom: 8 },
  cardChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },
  cardChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardArrow: { fontSize: 34, color: 'rgba(255,255,255,0.65)', marginLeft: 6 },

  // Footer
  footer: { alignItems: 'center', marginTop: 12 },
  footerEmoji: { fontSize: 20, letterSpacing: 5, marginBottom: 8 },
  footerText: { fontSize: 12, color: '#AD1457', fontStyle: 'italic', fontFamily: SCRIPT_FONT, opacity: 0.7 },
});
