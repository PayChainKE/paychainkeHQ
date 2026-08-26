import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getTourTarget } from '../utils/tourTargets';

export type TourStep = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  // Registered via <TourTarget id="..."> somewhere in the app — omit for a
  // pure intro/outro step, which renders as a centered card instead of a
  // spotlight (there's nothing to point at yet).
  targetId?: string;
  // Tab/stack screen name to navigate to first if not already there (see
  // AppNavigator.tsx's Tab.Screen names) — e.g. 'SendMoney', 'Pay', 'More'.
  screen?: string;
  screenParams?: Record<string, any>;
};

type Rect = { x: number; y: number; width: number; height: number };

// ─── SpotlightTour (mobile) ──────────────────────────────────────────────────
// React Native equivalent of the web dashboard's SpotlightTour.jsx — same
// idea (find the real UI element a step describes, highlight it, anchor the
// explanation beside it, navigate to another screen first if needed) built
// on RN's own primitives instead of the DOM:
//   - No querySelector — TourTarget/tourTargets.ts is the ref-registry
//     stand-in for `data-tour="..."` + `document.querySelector`.
//   - No box-shadow spotlight trick — the "hole" is built from four opaque
//     bands (top/bottom/left/right) covering everything except the target's
//     measured rect, the standard RN technique for this effect.
//   - Step index lives in plain useState rather than sessionStorage: unlike
//     the web dashboard (every page wraps its own <MerchantLayout>, so
//     navigating remounts the tour), React Navigation's bottom tabs keep
//     every visited tab mounted in the background by default — this
//     component (mounted once in Dashboard.tsx) never unmounts when
//     `screen` navigates to another tab, so its own state survives.
export default function SpotlightTour({
  steps,
  visible,
  onFinish,
  onSkip,
  finishLabel = 'Done',
}: {
  steps: TourStep[];
  visible: boolean;
  onFinish: () => void;
  onSkip?: () => void;
  finishLabel?: string;
}) {
  const navigation = useNavigation<any>();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [entered, setEntered] = useState(false);
  const [cardSize, setCardSize] = useState({ width: 320, height: 220 });

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  // Navigate to this step's screen first, if we're not already there.
  useEffect(() => {
    if (!visible || !step?.screen) return;
    const currentRoute = navigation.getState?.()?.routes?.[navigation.getState()?.index]?.name;
    if (currentRoute !== step.screen) {
      navigation.navigate(step.screen, step.screenParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stepIndex, step?.screen]);

  // Locate + measure the target, polling briefly since a screen we just
  // navigated to (or a section gated on its own async data) may not have
  // laid out yet.
  useEffect(() => {
    if (!visible || !step) return;
    if (!step.targetId) {
      setRect(null);
      setTargetMissing(false);
      setEntered(true);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    setEntered(false);
    setTargetMissing(false);
    setRect(null);

    const measure = () => {
      if (cancelled) return;
      const targetRef = getTourTarget(step.targetId!);
      const node = targetRef?.current;
      if (node) {
        node.measureInWindow((x, y, width, height) => {
          if (cancelled) return;
          if (width > 0 && height > 0) {
            setRect({ x, y, width, height });
            setTargetMissing(false);
            setEntered(true);
            return;
          }
          retry();
        });
        return;
      }
      retry();
    };

    const retry = () => {
      attempts += 1;
      if (attempts > 20) {
        // ~3s of polling — give up and fall back to a centered card rather
        // than leaving the tour stuck on a target that never rendered.
        if (!cancelled) {
          setTargetMissing(true);
          setEntered(true);
        }
        return;
      }
      timeoutRef.current = setTimeout(measure, 150);
    };

    const timeoutRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };
    // Small initial delay — gives a just-triggered screen navigation's
    // transition animation a moment to settle before the first measurement.
    timeoutRef.current = setTimeout(measure, 200);

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible, stepIndex, step?.targetId]);

  const goNext = useCallback(() => {
    if (isLast) {
      onFinish();
      return;
    }
    setStepIndex((s) => s + 1);
  }, [isLast, onFinish]);

  const goBack = useCallback(() => {
    setStepIndex((s) => Math.max(0, s - 1));
  }, []);

  const skip = useCallback(() => {
    (onSkip || onFinish)();
  }, [onSkip, onFinish]);

  if (!visible || !step) return null;

  const { width: screenW, height: screenH } = Dimensions.get('window');
  const showSpotlight = !!step.targetId && rect && !targetMissing;
  const pad = 8;

  // Card placement — below the target if there's room, else above; clamped
  // so it always stays fully on-screen. Falls back to a fixed vertical
  // anchor (upper-middle) when centered (no target).
  let cardTop: number;
  let cardLeft: number;
  if (showSpotlight && rect) {
    const spaceBelow = screenH - (rect.y + rect.height);
    const spaceAbove = rect.y;
    const placeBelow = spaceBelow >= cardSize.height + 24 || spaceBelow >= spaceAbove;
    cardTop = placeBelow ? rect.y + rect.height + pad + 16 : rect.y - pad - 16 - cardSize.height;
    cardTop = Math.max(48, Math.min(cardTop, screenH - cardSize.height - 40));
    cardLeft = Math.max(16, Math.min(screenW - cardSize.width - 16, rect.x + rect.width / 2 - cardSize.width / 2));
  } else {
    cardTop = screenH / 2 - cardSize.height / 2;
    cardLeft = screenW / 2 - cardSize.width / 2;
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {showSpotlight && rect ? (
          <SpotlightBands rect={rect} pad={pad} screenW={screenW} screenH={screenH} entered={entered} />
        ) : (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,17,11,0.82)' }} />
        )}

        <View
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width && height && (Math.abs(width - cardSize.width) > 2 || Math.abs(height - cardSize.height) > 2)) {
              setCardSize({ width, height });
            }
          }}
          style={{
            position: 'absolute',
            top: cardTop,
            left: cardLeft,
            width: showSpotlight ? 320 : screenW - 48,
            maxWidth: 360,
            opacity: entered ? 1 : 0,
          }}
        >
          <TourCard
            step={step}
            stepIndex={stepIndex}
            totalSteps={steps.length}
            isLast={isLast}
            onNext={goNext}
            onBack={stepIndex > 0 ? goBack : undefined}
            onSkip={skip}
            finishLabel={finishLabel}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── SpotlightBands ──────────────────────────────────────────────────────────
// Four opaque bands covering the full screen except the target's rect — the
// standard RN stand-in for a CSS box-shadow spotlight cutout, since RN has
// no equivalent of an arbitrarily large box-shadow spread. Non-interactive
// (no press handlers), purely visual.
function SpotlightBands({ rect, pad, screenW, screenH, entered }: { rect: Rect; pad: number; screenW: number; screenH: number; entered: boolean }) {
  const top = Math.max(0, rect.y - pad);
  const bottom = Math.min(screenH, rect.y + rect.height + pad);
  const left = Math.max(0, rect.x - pad);
  const right = Math.min(screenW, rect.x + rect.width + pad);
  const dim = 'rgba(3,17,11,0.82)';

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: entered ? 1 : 0 }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top, backgroundColor: dim }} />
      <View style={{ position: 'absolute', top: bottom, left: 0, right: 0, bottom: 0, backgroundColor: dim }} />
      <View style={{ position: 'absolute', top, left: 0, width: left, height: bottom - top, backgroundColor: dim }} />
      <View style={{ position: 'absolute', top, left: right, right: 0, height: bottom - top, backgroundColor: dim }} />
      {/* Glow ring around the cutout */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top,
          left,
          width: right - left,
          height: bottom - top,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: 'rgba(52,211,153,0.9)',
          shadowColor: '#34d399',
          shadowOpacity: 0.6,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
          elevation: Platform.OS === 'android' ? 8 : 0,
        }}
      />
    </View>
  );
}

// ─── TourCard ────────────────────────────────────────────────────────────────
function TourCard({
  step,
  stepIndex,
  totalSteps,
  isLast,
  onNext,
  onBack,
  onSkip,
  finishLabel,
}: {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  isLast: boolean;
  onNext: () => void;
  onBack?: () => void;
  onSkip: () => void;
  finishLabel: string;
}) {
  return (
    <View
      style={{
        backgroundColor: '#06201b',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 14 },
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(52,211,153,0.12)',
      }}
    >
      {/* Thin gilded accent line — same premium flourish as the web tour */}
      <View style={{ height: 3, width: '100%', backgroundColor: '#34d399' }} />

      <View style={{ padding: 22 }}>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row" style={{ gap: 6 }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={{
                  height: 4,
                  borderRadius: 2,
                  width: i === stepIndex ? 24 : 4,
                  backgroundColor: i === stepIndex ? '#34d399' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </View>
          <TouchableOpacity onPress={onSkip}>
            <Text className="font-jakarta-bold text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Skip Tour
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-start" style={{ gap: 14, marginBottom: 4 }}>
          <View
            style={{
              width: 44, height: 44, borderRadius: 14,
              backgroundColor: 'rgba(52,211,153,0.1)',
              borderWidth: 1, borderColor: 'rgba(110,231,183,0.2)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Feather name={step.icon} size={20} color="#6ee7b7" />
          </View>
          <View style={{ flex: 1, paddingTop: 2 }}>
            <Text className="font-jakarta-bold text-[9px] uppercase" style={{ color: 'rgba(110,231,183,0.8)', letterSpacing: 1.5, marginBottom: 4 }}>
              {stepIndex + 1} / {totalSteps}
            </Text>
            <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-white text-[18px] leading-tight">
              {step.title}
            </Text>
          </View>
        </View>

        <Text className="font-jakarta-medium text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', marginTop: 10, marginBottom: 20 }}>
          {step.body}
        </Text>

        <View className="flex-row items-center" style={{ gap: 10 }}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 14 }}>
              <Text className="font-jakarta-bold text-[11px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Back
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onNext}
            style={{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#34d399', alignItems: 'center' }}
          >
            <Text className="font-jakarta-bold text-[11px] uppercase tracking-widest" style={{ color: '#06201b' }}>
              {isLast ? finishLabel : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
