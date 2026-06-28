import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useBiometrics } from '../hooks/useBiometrics';
import * as LocalAuthentication from 'expo-local-authentication';

// ── Animated scanner ring ────────────────────────────────────────────────────
type Phase = 'idle' | 'scanning' | 'success' | 'fail';

function ScannerRing({ phase }: { phase: Phase }) {
  const ringScale   = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 'scanning') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ringScale,   { toValue: 1.35, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
            Animated.timing(ringOpacity, { toValue: 0.6,  duration: 350, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ringScale,   { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
          ]),
        ])
      );
      Animated.timing(glowOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      pulse.start();
      return () => pulse.stop();
    }

    if (phase === 'success') {
      Animated.spring(successScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
      Animated.timing(glowOpacity,  { toValue: 0.5, duration: 400, useNativeDriver: true }).start();
    }

    if (phase === 'idle' || phase === 'fail') {
      Animated.timing(glowOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      ringScale.setValue(1);
      ringOpacity.setValue(0);
      if (phase === 'idle') successScale.setValue(0);
    }
  }, [phase]);

  const ringColor = phase === 'success' ? '#34d399' : phase === 'fail' ? '#f87171' : '#34d399';
  const iconColor = phase === 'fail' ? '#f87171' : '#68dbae';

  return (
    <View style={styles.ringContainer}>
      <Animated.View style={[styles.glow, { opacity: glowOpacity, backgroundColor: ringColor + '30' }]} />
      <Animated.View style={[styles.pulseRing, { borderColor: ringColor, transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
      <LinearGradient
        colors={phase === 'success' ? ['#064e3b', '#065f46'] : ['#0b2114', '#0d2a1a']}
        style={styles.mainCircle}
      >
        {phase === 'success' ? (
          <Animated.View style={{ transform: [{ scale: successScale }] }}>
            <MaterialIcons name="check" size={52} color="#34d399" />
          </Animated.View>
        ) : (
          <MaterialIcons name="fingerprint" size={52} color={iconColor} />
        )}
      </LinearGradient>
    </View>
  );
}

// ── Biometric method label ───────────────────────────────────────────────────
function biometricLabel(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris Scan';
  }
  return 'Fingerprint';
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function BiometricSetup() {
  const insets = useSafeAreaInsets();
  const { completeBiometricSetup, unlockApp } = useAuth();
  const { support, checking, authenticate } = useBiometrics();
  const [phase, setPhase]     = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!checking && !support.available) {
      completeBiometricSetup(false);
      unlockApp();
    }
  }, [checking, support.available]);

  const method = biometricLabel(support.types);

  const handleEnable = async () => {
    setPhase('scanning');
    setErrorMsg('');
    const result = await authenticate(`Enable ${method} for PayChain`);
    if (result.success) {
      setPhase('success');
      setTimeout(async () => {
        await completeBiometricSetup(true);
        unlockApp();
      }, 1200);
    } else {
      setPhase('fail');
      setErrorMsg(result.cancelled ? 'Authentication was cancelled.' : result.error);
      setTimeout(() => setPhase('idle'), 2000);
    }
  };

  const handleSkip = () => {
    completeBiometricSetup(false);
    unlockApp();
  };

  if (checking || !support.available) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.center}>
          <View style={styles.spinner} />
        </View>
      </View>
    );
  }

  const isScanning = phase === 'scanning';
  const isDone     = phase === 'success';

  const statusText =
    phase === 'idle'     ? `Set up ${method} for instant, secure access` :
    phase === 'scanning' ? `Touch the sensor now…` :
    phase === 'success'  ? 'Identity verified!' :
    errorMsg || 'Authentication failed — try again';

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient colors={['#081a10', '#0b2114', '#06201b']} style={styles.gradient}>

        {/* Security badge */}
        <View style={styles.badge}>
          <MaterialIcons name="security" size={13} color="#34d399" />
          <Text style={styles.badgeText}>FIDO2 · Bank-grade Authentication</Text>
        </View>

        {/* Animated scanner */}
        <View style={styles.scanArea}>
          <ScannerRing phase={phase} />
          <Text style={styles.methodLabel}>{method}</Text>
          <Text style={styles.statusText}>{statusText}</Text>
          {phase === 'fail' && errorMsg ? (
            <View style={styles.errorRow}>
              <MaterialIcons name="error-outline" size={14} color="#f87171" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
        </View>

        {/* Feature list */}
        <View style={styles.features}>
          {[
            { icon: 'bolt',    text: 'Instant login without typing your password' },
            { icon: 'lock',    text: 'Private key never leaves your device' },
            { icon: 'devices', text: 'Works with Face ID, Touch ID & Fingerprint' },
          ].map(f => (
            <View key={f.icon} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <MaterialIcons name={f.icon as any} size={16} color="#34d399" />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {!isDone && (
            <>
              <TouchableOpacity
                onPress={handleEnable}
                disabled={isScanning}
                style={[styles.primaryBtn, isScanning && styles.btnDisabled]}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#34d399', '#10b981']} style={styles.btnGradient}>
                  {isScanning ? (
                    <View style={styles.scanningRow}>
                      <View style={styles.dotPulse} />
                      <Text style={styles.primaryBtnText}>Waiting for {method}…</Text>
                    </View>
                  ) : (
                    <>
                      <MaterialIcons name="fingerprint" size={20} color="#064e3b" />
                      <Text style={styles.primaryBtnText}>Enable {method}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {!isScanning && (
                <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
                  <Text style={styles.skipText}>Skip for now</Text>
                  <MaterialIcons name="arrow-forward" size={14} color="#68dbae" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <Text style={styles.disclaimer}>
          Your biometric data is stored securely on this device only.{'\n'}
          PayChain never has access to your fingerprint or face data.
        </Text>
      </LinearGradient>
    </View>
  );
}

const RING_SIZE = 160;
const GLOW_SIZE = RING_SIZE + 60;

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#06201b' },
  gradient: { flex: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 32 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spinner:  { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: '#34d399', borderTopColor: 'transparent' },

  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    backgroundColor: '#34d39918', borderWidth: 1, borderColor: '#34d39940',
    borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, gap: 5, marginBottom: 32,
  },
  badgeText: { color: '#34d399', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },

  scanArea:  { alignItems: 'center', gap: 16, marginBottom: 36 },

  ringContainer: { width: GLOW_SIZE, height: GLOW_SIZE, alignItems: 'center', justifyContent: 'center' },
  glow:          { position: 'absolute', width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2 },
  pulseRing:     { position: 'absolute', width: RING_SIZE + 10, height: RING_SIZE + 10, borderRadius: (RING_SIZE + 10) / 2, borderWidth: 2 },
  mainCircle:    {
    width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#34d399', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },

  methodLabel: { color: '#34d399', fontSize: 12, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase' },
  statusText:  { color: '#ffffff', fontSize: 16, fontWeight: '700', textAlign: 'center', lineHeight: 24, maxWidth: 280 },
  errorRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  errorText:   { color: '#f87171', fontSize: 12, fontWeight: '600' },

  features:    { gap: 14, marginBottom: 36 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#34d39915', borderWidth: 1, borderColor: '#34d39930',
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { color: '#a7f3d0', fontSize: 14, fontWeight: '500', flex: 1, lineHeight: 20 },

  actions:        { gap: 12, marginBottom: 24 },
  primaryBtn:     { borderRadius: 16, overflow: 'hidden' },
  btnDisabled:    { opacity: 0.6 },
  btnGradient:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17, gap: 10 },
  primaryBtnText: { color: '#064e3b', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  scanningRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotPulse:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#064e3b' },
  skipBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
  skipText:       { color: '#68dbae', fontWeight: '700', fontSize: 14 },

  disclaimer: { color: '#34d39960', fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 'auto' },
});
