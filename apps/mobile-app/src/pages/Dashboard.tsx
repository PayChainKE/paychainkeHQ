import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { setStatusBarStyle } from 'expo-status-bar';
import { preventScreenCaptureAsync, allowScreenCaptureAsync } from 'expo-screen-capture';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScrollTopOnFocus } from '../hooks/useScrollTopOnFocus';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTransactions } from '../context/TransactionsContext';
import api from '../api/config';
import PrivateValue from '../components/PrivateValue';
import FundAccountModal from '../components/FundAccountModal';
import TourTarget from '../components/TourTarget';
import MerchantWalkthrough from '../components/MerchantWalkthrough';
import FadeSlideIn from '../components/ui/FadeSlideIn';
import NoConnectionState from '../components/ui/NoConnectionState';
import { isCreditTransaction, isDebitTransaction, netBalanceImpact } from '../utils/transactionDirection';
import { formatAccountNumber } from '../utils/formatAccountNumber';
import { formatName } from '../utils/formatName';

type Timeframe = '7D' | '30D' | '6M';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Promo carousel cards are full-bleed (visible content width minus the
// page's own 24px side padding) so exactly one card is in view per swipe,
// like a slideshow ad unit rather than a peek-next-card carousel. Sized
// off the container's own measured layout width, not Dimensions.get
// ('window') — on web the page content is capped at max-w-lg and centered,
// so the browser window is much wider than what's actually visible here;
// Dimensions would size each card to the full window and make the
// carousel look stuck on one (mostly off-screen) card.
const PROMO_SLIDE_COUNT = 3;
const PROMO_AUTOPLAY_MS = 4000;
const PROMO_CARD_GAP = 16;

// Same bucketing convention as the merchant dashboard's Overview chart
// (apps/merchant-dashboard/src/pages/Overview.jsx generateChartData), ported to RN.
function computeChartData(transactions: any[]) {
  const inboundTxs = transactions.filter((t) => isCreditTransaction(t.type));
  const outboundTxs = transactions.filter((t) => isDebitTransaction(t.type));
  const now = new Date();
  // Math.abs(netBalanceImpact(t)) instead of the raw amount field — txs is
  // already filtered to inboundTxs/outboundTxs (by type) above, so the sign
  // is already known; this corrects the magnitude for unsettled rows and
  // the NCBA gross/fee mismatch (see netBalanceImpact's doc comment in
  // utils/transactionDirection.ts).
  const sumFor = (txs: any[], matches: (t: any) => boolean) =>
    txs.filter(matches).reduce((sum, t) => sum + Math.abs(netBalanceImpact(t)), 0);

  const labels7D: string[] = [];
  const inbound7D: number[] = [];
  const outbound7D: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    labels7D.push(DAY_NAMES[d.getDay()]);
    const sameDay = (t: any) => new Date(t.createdAt).toDateString() === d.toDateString();
    inbound7D.push(sumFor(inboundTxs, sameDay));
    outbound7D.push(sumFor(outboundTxs, sameDay));
  }

  const labels30D = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const inbound30D = [0, 0, 0, 0];
  const outbound30D = [0, 0, 0, 0];
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 28);
  const bucketByWeek = (txs: any[], bucket: number[]) => {
    txs.forEach((t) => {
      const txDate = new Date(t.createdAt);
      if (txDate >= thirtyDaysAgo) {
        const diffDays = Math.floor(Math.abs(now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
        const weekIndex = 3 - Math.floor(diffDays / 7);
        if (weekIndex >= 0 && weekIndex < 4) bucket[weekIndex] += Math.abs(netBalanceImpact(t));
      }
    });
  };
  bucketByWeek(inboundTxs, inbound30D);
  bucketByWeek(outboundTxs, outbound30D);

  const labels6M: string[] = [];
  const inbound6M: number[] = [];
  const outbound6M: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    labels6M.push(MONTH_NAMES[d.getMonth()]);
    const sameMonth = (t: any) => {
      const txDate = new Date(t.createdAt);
      return txDate.getMonth() === d.getMonth() && txDate.getFullYear() === d.getFullYear();
    };
    inbound6M.push(sumFor(inboundTxs, sameMonth));
    outbound6M.push(sumFor(outboundTxs, sameMonth));
  }

  return {
    '7D': { labels: labels7D, inbound: inbound7D, outbound: outbound7D },
    '30D': { labels: labels30D, inbound: inbound30D, outbound: outbound30D },
    '6M': { labels: labels6M, inbound: inbound6M, outbound: outbound6M },
  };
}

// ─── PromoCard ───────────────────────────────────────────────────────────────
// The 3 ad-unit cards in the home page carousel below. Dark, premium-ad-unit
// background (near-black green gradient) with the illustration and copy
// split into two columns like a real print/digital ad banner, alternating
// which side the image sits on from card to card so the carousel doesn't
// read as three copies of one template. A soft accent-colored "podium" blob
// behind the illustration and a large dim glow in the corresponding corner
// are what sell the depth on flat vector art against a dark field.
type PromoCardProps = {
  illustration: any;
  accentColor: string;
  blobColor: string;
  label: string;
  headline: string;
  description: string;
  ctaLabel: string;
  onPress: () => void;
  width: number;
  imageSide: 'left' | 'right';
};

function PromoCard({ illustration, accentColor, blobColor, label, headline, description, ctaLabel, onPress, width, imageSide }: PromoCardProps) {
  const imageBlock = (
    <View style={{ width: 104, height: 112, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: blobColor,
        }}
      />
      <Image source={illustration} style={{ width: 102, height: 102, resizeMode: 'contain' }} />
    </View>
  );

  const textBlock = (
    <View className="flex-1" style={{ paddingHorizontal: 6 }}>
      <Text style={{ color: accentColor }} className="text-[10.5px] font-jakarta-bold uppercase tracking-[0.12em] mb-1.5">
        {label}
      </Text>
      <Text className="text-white text-[18px] font-jakarta-bold tracking-tight leading-[22px] mb-2">{headline}</Text>
      <Text className="text-white/55 text-[11.5px] font-jakarta-bold leading-[16px] mb-4" numberOfLines={3}>
        {description}
      </Text>
      <View className="self-start flex-row items-center gap-1.5 rounded-full px-4 py-2" style={{ backgroundColor: accentColor }}>
        <Text className="text-[#00120a] text-[10px] font-jakarta-extrabold uppercase tracking-wider">{ctaLabel}</Text>
        <Feather name="arrow-right" size={12} color="#00120a" />
      </View>
    </View>
  );

  return (
    // Shadow lives on this outer wrapper, not the LinearGradient below — a
    // shadow and overflow:'hidden' on the same view don't render together
    // (the clip suppresses the shadow, most visibly on iOS), so the
    // gradient keeps the clip/radius/border and this view keeps the shadow.
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{
        width,
        borderRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.32,
        shadowRadius: 24,
        elevation: 10,
      }}
    >
      <LinearGradient
        colors={['#0e2018', '#00110a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 32,
          padding: 20,
          overflow: 'hidden',
          minHeight: 168,
        }}
      >
        {/* Ambient glow — sits in the corner nearest the illustration, a
            dim wash of the card's own accent color so a flat-black card
            doesn't read as an empty void. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -50,
            [imageSide === 'left' ? 'left' : 'right']: -50,
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: accentColor,
            opacity: 0.14,
          }}
        />
        <View className={`items-center ${imageSide === 'left' ? 'flex-row' : 'flex-row-reverse'}`}>
          {imageBlock}
          {textBlock}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function Dashboard({ navigation }: any) {
  const { merchant } = useAuth();
  const { transactions, isLoading, isRefreshing, hasError, refresh: refreshTransactions } = useTransactions();
  const [now, setNow] = useState(new Date());
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAmounts, setShowAmounts] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('7D');
  const [showFundAccount, setShowFundAccount] = useState(false);
  const [activePromoSlide, setActivePromoSlide] = useState(0);
  // Tracks the ScrollView's own card index, 0..PROMO_SLIDE_COUNT — index
  // PROMO_SLIDE_COUNT is a trailing clone of card 0 appended to the
  // carousel's content (see below) so advancing past the last real card
  // scrolls forward into an identical-looking card instead of animating
  // backward to card 0. activePromoSlide (for the dots) is always this
  // value modulo PROMO_SLIDE_COUNT, since the clone IS card 0 visually.
  const [promoScrollIndex, setPromoScrollIndex] = useState(0);
  const [promoContainerWidth, setPromoContainerWidth] = useState(0);
  const promoScrollRef = useRef<ScrollView>(null);
  const promoCardWidth = Math.max(0, promoContainerWidth - 48);
  const scrollRef = useScrollTopOnFocus();

  useFocusEffect(
    useCallback(() => {
      api.get('/api/notifications/unread-count')
        .then((res) => {
          if (res.data?.success) setUnreadCount(res.data.count);
        })
        .catch(() => {});
    }, [])
  );

  // Imperative (not the <StatusBar> component) because this screen, like
  // every tab, never actually unmounts once visited — React Navigation's
  // bottom-tab navigator keeps all visited tabs mounted, so a declarative
  // <StatusBar style="light" /> here would never unmount to hand control
  // back to the app-wide default, leaving light (white) status bar icons
  // stuck on every other screen's light header once this tab had been
  // opened once. Explicitly restoring 'dark' (App.tsx's own default) on
  // blur keeps this screen's dark-header override scoped to only when
  // it's actually the visible screen.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, [])
  );

  // Wallet balance card lives on this screen, so block screenshots/screen
  // recording while it's the visible screen — same imperative, focus-scoped
  // pattern as the status bar above (usePreventScreenCapture()'s own
  // mount/unmount lifecycle doesn't fire here, since this tab screen never
  // actually unmounts once visited). Keyed distinctly from the PIN screens'
  // own (keyless) usePreventScreenCapture() calls so they don't clash.
  useFocusEffect(
    useCallback(() => {
      preventScreenCaptureAsync('dashboard-balance').catch(() => {});
      return () => {
        allowScreenCaptureAsync('dashboard-balance').catch(() => {});
      };
    }, [])
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Transaction data (list, loading/refreshing state) now comes from the
  // app-wide TransactionsContext — a single shared fetch/poll instead of
  // this screen running its own on top of Transactions.tsx's and
  // Collections.tsx's identical ones. Still refreshed on focus so the
  // numbers are current the moment a merchant lands back on this tab.
  useFocusEffect(
    useCallback(() => {
      if (merchant) refreshTransactions();
    }, [merchant, refreshTransactions])
  );

  const onRefresh = () => {
    refreshTransactions();
  };

  // A manual swipe landing on the trailing clone (index PROMO_SLIDE_COUNT)
  // gets the same silent snap-back as the autoplay path below, so dragging
  // past the last real card doesn't leave the carousel sitting on the
  // clone (which would make a *second* manual swipe re-show card 0 as if
  // nothing happened).
  const handlePromoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (promoCardWidth + PROMO_CARD_GAP));
    setActivePromoSlide(index % PROMO_SLIDE_COUNT);
    if (index >= PROMO_SLIDE_COUNT) {
      setPromoScrollIndex(0);
      setTimeout(() => promoScrollRef.current?.scrollTo({ x: 0, animated: false }), 50);
    } else {
      setPromoScrollIndex(index);
    }
  };

  // Auto-advance the promo carousel like an ad slideshow. Loops forward
  // continuously instead of animating backward to card 0 at the end: the
  // carousel's content has a trailing clone of card 0 (index
  // PROMO_SLIDE_COUNT), so the last step of the loop animates forward onto
  // that clone, then — once the animation has landed — silently snaps
  // (unanimated) back to the real card 0 underneath it. Since the clone is
  // pixel-identical to card 0, that snap is invisible to the merchant.
  // Re-armed on every promoScrollIndex change (including a manual swipe)
  // so a manual swipe resets the timer instead of fighting it. Waits for a
  // real measured width so it doesn't scroll by 0px before layout.
  useEffect(() => {
    if (promoCardWidth <= 0) return;
    const timer = setTimeout(() => {
      const next = promoScrollIndex + 1;
      promoScrollRef.current?.scrollTo({ x: next * (promoCardWidth + PROMO_CARD_GAP), animated: true });
      setActivePromoSlide(next % PROMO_SLIDE_COUNT);
      if (next >= PROMO_SLIDE_COUNT) {
        setTimeout(() => {
          promoScrollRef.current?.scrollTo({ x: 0, animated: false });
          setPromoScrollIndex(0);
        }, 400);
      } else {
        setPromoScrollIndex(next);
      }
    }, PROMO_AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [promoScrollIndex, promoCardWidth]);

  const initials = merchant?.businessName
    ? merchant.businessName.substring(0, 2).toUpperCase()
    : '??';

  const formatCurrency = (amount: number) => {
    return `Ksh ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const inboundTransactions = transactions.filter((tx) => isCreditTransaction(tx.type));
  const todayInbound = inboundTransactions.filter((tx) => isSameDay(new Date(tx.createdAt), now));
  // netBalanceImpact (not the raw amount field) — inboundTransactions is
  // already type-filtered to credits, so Math.abs just corrects the
  // magnitude for unsettled rows and the NCBA gross/fee mismatch (see its
  // doc comment in utils/transactionDirection.ts). A raw sum counted a
  // failed/pending row as real revenue and overstated ncba_inbound rows by
  // the fee that never actually reached the merchant's balance.
  const todayTotal = todayInbound.reduce((sum, tx) => sum + Math.abs(netBalanceImpact(tx)), 0);

  const chartData = computeChartData(transactions);
  const activeChart = chartData[activeTimeframe];
  const chartMax = Math.max(1, ...activeChart.inbound, ...activeChart.outbound);
  const periodInboundTotal = activeChart.inbound.reduce((s, v) => s + v, 0);
  const periodOutboundTotal = activeChart.outbound.reduce((s, v) => s + v, 0);

  return (
    // Matches the header gradient's own top-left color (below) — the safe
    // area inset (status bar height) is this view's own background, painted
    // before the gradient header renders beneath it. Using the page's light
    // body color here left a bright strip above the dark green header on
    // every device with a status bar/notch. Status bar icon color (light
    // while focused here, dark everywhere else) is handled imperatively
    // above via setStatusBarStyle, not a <StatusBar> component here — see
    // that useFocusEffect's comment.
    <SafeAreaView className="flex-1 bg-[#0b4d2e]" edges={['top', 'left', 'right']}>
      <MerchantWalkthrough />
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        // Own background matches the light body, not the SafeAreaView's dark
        // green — otherwise iOS's overscroll bounce reveals the SafeAreaView
        // behind it, flashing dark green at the bottom of the page.
        style={{ backgroundColor: '#f0fdf4' }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#006c4e" colors={['#006c4e']} />
        }
      >
        <FadeSlideIn style={{ flex: 1 }}>
        <View className="w-full max-w-lg mx-auto flex-1">
          {/* Greeting backdrop — just page chrome now (avatar, greeting,
              notifications; the eye/visibility toggle now lives on the
              wallet card itself, next to the balance it actually controls).
              Sized for the avatar chip and greeting text to sit with real
              breathing room (was pt-4/pb-6 — too tight, misaligned-looking
              next to the larger avatar) without going back to the original
              excessive pt-16/pb-10. Gradient tones match the merchant
              dashboard's own primary/primary-container palette for visual
              unison between the two apps. */}
          <LinearGradient
            colors={['#0b4d2e', '#00351d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 6,
            }}
            className="px-8 pt-12 pb-11 rounded-b-[32px]"
          >
            {/* ~0.3cm (11px) gap above and below the row, so the avatar/
                greeting text doesn't sit flush against the header's own
                top/bottom edges regardless of the outer padding. */}
            <View className="flex-row justify-between items-center" style={{ marginTop: 11, marginBottom: 11 }}>
              <View className="flex-row items-center gap-3.5 flex-1 min-w-0 pr-3">
                <TouchableOpacity
                  onPress={() => navigation?.navigate('More')}
                  className="w-10 h-10 rounded-2xl bg-[#5efeb3] items-center justify-center shadow-md shadow-black/20 flex-shrink-0"
                  style={{ marginLeft: 11 }}
                >
                  <Text className="text-[#00351d] font-jakarta-extrabold text-sm">{initials}</Text>
                </TouchableOpacity>
                <View className="flex-1 min-w-0">
                  <Text className="text-white/70 text-[12px] font-jakarta-bold uppercase tracking-wider mb-1" numberOfLines={1} ellipsizeMode="tail">{greeting} 👋</Text>
                  <Text className="text-white text-lg font-jakarta-bold tracking-tight" numberOfLines={1} ellipsizeMode="tail">{merchant?.businessName || 'Merchant'}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => navigation?.navigate('Notifications')}
                className="w-11 h-11 items-center justify-center flex-shrink-0"
                style={{ marginRight: 19 }}
              >
                <Feather name="bell" size={20} color="white" />
                {unreadCount > 0 && (
                  <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff5a5f] border border-[#0b4d2e] items-center justify-center">
                    <Text className="text-white text-[10px] font-jakarta-extrabold leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Wallet card — floats over the backdrop at a real e-wallet card
              proportion (ISO card ratio, ~1.586:1) instead of a full-bleed
              banner, with a real drop shadow so it reads as a physical
              object sitting on the page. */}
          {/* Sits in normal document flow below the greeting backdrop —
              deliberately not a negative-margin overlap onto the backdrop
              (that positioning trick was unreliable across platforms and
              put the card above the header bar on device). */}
          <View className="px-6 mt-6 mb-10">
            <View style={{ position: 'relative' }}>
              {/* A second card's edge, peeking out behind the front one —
                  offset down-right and dimmer, like real cards sitting
                  stacked in a wallet. Inset from the top-left (hidden under
                  the front card there) and extended past the bottom-right
                  (the visible sliver). Purely decorative. */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 10,
                  right: -8,
                  bottom: -12,
                  borderRadius: 24,
                  backgroundColor: '#0a3322',
                  opacity: 0.55,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.25,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              />
            <TourTarget id="home-balance">
              <LinearGradient
                colors={['#22B589', '#0b4d2e', '#031f13']}
                locations={[0, 0.55, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  aspectRatio: 1.75,
                  borderRadius: 24,
                  padding: 22,
                  overflow: 'hidden',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 18 },
                  shadowOpacity: 0.35,
                  shadowRadius: 28,
                  elevation: 18,
                }}
                className="justify-between"
              >
                {/* Tech/blockchain background art — the actual supplied
                    image (cube cluster + binary digits + glow), clipped to
                    the card's own rounded rect (the wrapper below owns the
                    clipping, not the Image itself, since an absolutely
                    positioned Image sizing purely from inset values is the
                    more fragile of the two across platforms). Darkened
                    (lower opacity + a dark scrim on top) so the glowing
                    cubes read as texture, not as the loudest thing on the
                    card. */}
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', borderRadius: 24 }}>
                  <Image
                    source={require('../../assets/wallet-card-bg.png')}
                    resizeMode="cover"
                    style={{ width: '100%', height: '100%', opacity: 0.14 }}
                  />
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
                </View>

                {/* Ambient light — the soft glow real premium card UIs use
                    to avoid a flat, single-tone fill. */}
                <View pointerEvents="none" style={{ position: 'absolute', top: -70, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(94,254,179,0.14)' }} />
                <View pointerEvents="none" style={{ position: 'absolute', bottom: -60, left: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.04)' }} />

                {/* 1cm (38px) top offset — with the card's justify-between
                    layout, this pushes the balance block down from the
                    top edge without moving the bottom row, so the card
                    doesn't read as an empty box with text stuck at the top. */}
                <View className="flex-row items-center gap-2" style={{ marginTop: 38 }}>
                  <Text className="text-white/60 text-[10px] font-jakarta-bold uppercase tracking-[0.15em]">Available Balance</Text>
                  <TouchableOpacity
                    onPress={() => setShowAmounts((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name={showAmounts ? 'eye' : 'eye-off'} size={13} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>

                {/* Balance — chip/contactless icons removed: this is a
                    paybill/virtual-account wallet, not an issued card, so
                    those symbols implied a tap/insert capability that
                    doesn't actually exist here. */}
                <PrivateValue
                  hidden={!showAmounts}
                  tint="dark"
                  style={{ fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: -1 }}
                  className="text-[32px] text-white leading-none mt-2"
                >
                  {formatCurrency(merchant?.kesBalance || 0)}
                </PrivateValue>

                <View>
                  {todayTotal > 0 && (
                    <View className="flex-row items-center gap-1.5 self-start bg-[#83f5c6]/20 px-2.5 py-1 rounded-full border border-[#83f5c6]/20 mb-3">
                      <Feather name="trending-up" size={12} color="#83f5c6" />
                      <View className="flex-row items-center">
                        <Text className="text-[#83f5c6] font-jakarta-bold text-[11px]">+</Text>
                        <PrivateValue hidden={!showAmounts} tint="dark" className="text-[#83f5c6] font-jakarta-bold text-[11px]">
                          {formatCurrency(todayTotal)}
                        </PrivateValue>
                        <Text className="text-[#83f5c6] font-jakarta-bold text-[11px]"> today</Text>
                      </View>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </TourTarget>
            </View>
          </View>

          <FundAccountModal visible={showFundAccount} onClose={() => setShowFundAccount(false)} />

          {/* Action Buttons — Fund lives here as its own circle (gold,
              matching the card chip) instead of a full-width button inside
              the card. Inner-circle colors are now drawn only from the
              shared brand palette (bright mint, secondary green, primary
              green, gold) instead of two washed-out/unrelated tones, so the
              row reads as one deliberate branded set rather than default
              Material colors. */}
          <View className="px-6 flex-row justify-between mb-10 z-10">
            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => setShowFundAccount(true)}>
              <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/15 items-center justify-center mb-2.5">
                {/* alignItems/justifyContent moved into style — className
                    centering wasn't reliably applying on this component
                    (same issue as LinearGradient's overflow className
                    elsewhere), leaving the plus icon off-center. */}
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#1d9e75', alignItems: 'center', justifyContent: 'center' }}>
                  <Image source={require('../../assets/fund.png')} style={{ width: 21, height: 21, tintColor: '#ffffff' }} resizeMode="contain" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Fund</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Collections')}>
              <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/15 items-center justify-center mb-2.5">
                <View className="w-11 h-11 rounded-full bg-[#5efeb3] items-center justify-center">
                  <Image source={require('../../assets/collect.png')} style={{ width: 21, height: 21, tintColor: '#00351d' }} resizeMode="contain" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Collect</Text>
            </TouchableOpacity>

            <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Pay')}>
              <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/15 items-center justify-center mb-2.5">
                <View className="w-11 h-11 rounded-full bg-[#006c4e] items-center justify-center">
                  <MaterialIcons name="payments" size={21} color="#ffffff" />
                </View>
              </View>
              <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Pay</Text>
            </TouchableOpacity>

            {!merchant?.isAppReviewAccount && (
              <TouchableOpacity className="items-center" activeOpacity={0.8} onPress={() => navigation?.navigate('Advance')}>
                <View className="w-16 h-16 rounded-full bg-white shadow-lg shadow-black/15 items-center justify-center mb-2.5">
                  <View className="w-11 h-11 rounded-full bg-[#0b4d2e] items-center justify-center">
                    <Image source={require('../../assets/cash advance.png')} style={{ width: 21, height: 21, tintColor: '#5efeb3' }} resizeMode="contain" />
                  </View>
                </View>
                <Text className="text-[11px] font-jakarta-bold text-[#0c2010] uppercase tracking-widest">Advance</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Growth Ribbon */}
          <View className="px-6 mb-8">
            <View className="bg-[#5efeb3] rounded-[24px] p-5 flex-row items-center justify-between shadow-sm">
              <View>
                <Text style={{ fontFamily: 'DMSerifDisplay_400Regular' }} className="text-[22px] text-[#00351d] mb-1">
                  Collect. Pay. Protect. Grow.
                </Text>
              </View>
              <View className="w-8 h-8 rounded-full bg-[#83f5c6] items-center justify-center">
                <MaterialIcons name="verified-user" size={16} color="#00351d" />
              </View>
            </View>
          </View>

          {/* Quick Actions — a single 3×2 grid card, the same layout
              convention M-Pesa/bank apps use on their home screen (one
              uniform icon treatment, short label, no per-tile copy) rather
              than the previous mix of full-width description cards. Every
              icon is tinted the same mint accent on the same dark chip so
              the grid reads as one coherent set rather than six unrelated
              buttons. */}
          <TourTarget id="send-request-row" className="px-6 mb-8">
            <Text className="text-[10px] font-jakarta-extrabold uppercase tracking-widest text-[#0c2010]/40 mb-3">Quick Actions</Text>
            <View className="bg-white rounded-[28px] border border-[#eff4ef] shadow-sm shadow-[#00351d]/5 p-5">
              <View className="flex-row flex-wrap justify-between">
                {[
                  { key: 'send', label: 'Send Money', icon: require('../../assets/send money.png'), onPress: () => navigation?.navigate('SendMoney') },
                  { key: 'request', label: 'Request Money', icon: require('../../assets/receive money.png'), onPress: () => navigation?.navigate('RequestMoney') },
                  { key: 'stk', label: 'STK Push', icon: require('../../assets/stk push.png'), onPress: () => navigation?.navigate('RequestMoney', { preset: 'mpesa' }) },
                  { key: 'link', label: 'Payment Link', icon: require('../../assets/payment link.png'), onPress: () => navigation?.navigate('RequestMoney', { preset: 'link' }) },
                  { key: 'tokens', label: 'Buy Tokens', icon: require('../../assets/buy kplc token.png'), onPress: () => navigation?.navigate('BuyTokens') },
                  { key: 'statement', label: 'Statement', icon: require('../../assets/statement.png'), onPress: () => navigation?.navigate('Transactions', { openStatement: true }) },
                ].map((action, i) => (
                  <TouchableOpacity
                    key={action.key}
                    activeOpacity={0.85}
                    onPress={action.onPress}
                    style={{ width: '31%' }}
                    className={`items-center ${i < 3 ? 'mb-5' : ''}`}
                  >
                    <View className="w-14 h-14 rounded-2xl bg-[#00351d] shadow-lg shadow-black/20 items-center justify-center mb-2">
                      <Image source={action.icon} style={{ width: 24, height: 24, tintColor: '#5efeb3' }} resizeMode="contain" />
                    </View>
                    <Text className="text-[10px] font-jakarta-bold text-[#0c2010] text-center leading-tight" numberOfLines={2}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TourTarget>

          {/* Promo carousel — Bulk Payouts, Business Advance, Payment Links,
              swiped horizontally like a slideshow ad unit. Snaps one card
              per swipe (snapToInterval = card width + gap) rather than
              react-native's pagingEnabled, since pagingEnabled snaps to the
              full ScrollView width, not each card's width. */}
          <View className="mb-8" onLayout={(e) => setPromoContainerWidth(e.nativeEvent.layout.width)}>
            {promoCardWidth > 0 && (
            <ScrollView
              ref={promoScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={promoCardWidth + PROMO_CARD_GAP}
              snapToAlignment="start"
              contentContainerStyle={{ paddingHorizontal: 24, gap: PROMO_CARD_GAP }}
              onMomentumScrollEnd={handlePromoScroll}
            >
              <PromoCard
                illustration={require('../../assets/vectors/bulk payout.png')}
                accentColor="#5efeb3"
                blobColor="rgba(94,254,179,0.22)"
                label="Bulk Payouts"
                headline="Pay suppliers & staff at once"
                description="Upload a list or pick recipients, then settle an entire batch of payouts in a single click."
                ctaLabel="Start a Bulk Payout"
                onPress={() => navigation?.navigate('Pay')}
                width={promoCardWidth}
                imageSide="left"
              />

              {merchant?.isAppReviewAccount ? (
                // Swapped in place of the Business Advance card for the
                // app-store reviewer account — keeps the carousel's card
                // count/dot indices (PROMO_SLIDE_COUNT, [0,1,2] below)
                // unchanged rather than removing a slide outright. Reuses
                // grow.png (its bar chart fits "sales tracking" just as
                // well as "business advance") — safe since the two cards
                // never render for the same merchant.
                <PromoCard
                  illustration={require('../../assets/vectors/grow.png')}
                  accentColor="#7ec8ff"
                  blobColor="rgba(126,200,255,0.22)"
                  label="Sales Tracking"
                  headline="Every sale, tracked automatically"
                  description="PayChain confirms every customer payment and counts your daily sales for you."
                  ctaLabel="View Transactions"
                  onPress={() => navigation?.navigate('Collections')}
                  width={promoCardWidth}
                  imageSide="right"
                />
              ) : (
                <PromoCard
                  illustration={require('../../assets/vectors/grow.png')}
                  accentColor="#ffd166"
                  blobColor="rgba(255,209,102,0.22)"
                  label="Business Advance"
                  headline="Unlock cash flow instantly"
                  description="Get an advance against your revenue and repay it automatically as you get paid."
                  ctaLabel="Check Eligibility"
                  onPress={() => navigation?.navigate('Advance')}
                  width={promoCardWidth}
                  imageSide="right"
                />
              )}

              <PromoCard
                illustration={require('../../assets/vectors/collect.png')}
                accentColor="#c9b8ff"
                blobColor="rgba(201,184,255,0.22)"
                label="Payment Links"
                headline="Get paid without an invoice"
                description="Share a link for any amount and get paid instantly from anywhere — no paperwork."
                ctaLabel="Create a Link"
                onPress={() => navigation?.navigate('RequestMoney', { preset: 'link' })}
                width={promoCardWidth}
                imageSide="left"
              />

              {/* Trailing clone of card 0 — see the promoScrollIndex/autoplay
                  comments above. Lets the carousel scroll forward past the
                  last real card instead of animating backward to loop. */}
              <PromoCard
                illustration={require('../../assets/vectors/bulk payout.png')}
                accentColor="#5efeb3"
                blobColor="rgba(94,254,179,0.22)"
                label="Bulk Payouts"
                headline="Pay suppliers & staff at once"
                description="Upload a list or pick recipients, then settle an entire batch of payouts in a single click."
                ctaLabel="Start a Bulk Payout"
                onPress={() => navigation?.navigate('Pay')}
                width={promoCardWidth}
                imageSide="left"
              />
            </ScrollView>
            )}

            <View className="flex-row justify-center gap-1.5 mt-4">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className={`h-1.5 rounded-full ${activePromoSlide === i ? 'w-5 bg-[#006c4e]' : 'w-1.5 bg-[#d8e4dd]'}`}
                />
              ))}
            </View>
          </View>

          {/* Revenue Overview Chart */}
          <View className="px-6 mb-8">
            <View className="bg-white rounded-[32px] p-6 shadow-sm border border-[#bfc9bf]/10">
              <View className="flex-row items-center justify-between mb-1">
                <View>
                  <Text className="text-lg font-jakarta-bold text-[#0c2010]">Revenue Overview</Text>
                  <Text className="text-[#5b645c] text-[11px] font-jakarta-bold mt-0.5">Money moving in and out</Text>
                </View>
                <View className="flex-row bg-[#f0fdf4] p-0.5 rounded-lg border border-[#e7ece7]">
                  {(['7D', '30D', '6M'] as Timeframe[]).map((period) => (
                    <TouchableOpacity
                      key={period}
                      onPress={() => setActiveTimeframe(period)}
                      className={`px-2.5 py-1.5 rounded-md ${activeTimeframe === period ? 'bg-white shadow-sm' : ''}`}
                    >
                      <Text className={`text-[10px] font-jakarta-extrabold uppercase tracking-wider ${activeTimeframe === period ? 'text-[#006c4e]' : 'text-[#006c4e]/40'}`}>
                        {period}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="flex-row items-center gap-5 mt-5 mb-5">
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-[#00855D]" />
                  <Text className="text-[10px] font-jakarta-bold text-[#5b645c] uppercase tracking-wider">In</Text>
                  <PrivateValue hidden={!showAmounts} tint="light" className="text-[12px] font-jakarta-extrabold text-[#0c2010]">
                    {formatCurrency(periodInboundTotal)}
                  </PrivateValue>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                  <Text className="text-[10px] font-jakarta-bold text-[#5b645c] uppercase tracking-wider">Out</Text>
                  <PrivateValue hidden={!showAmounts} tint="light" className="text-[12px] font-jakarta-extrabold text-[#0c2010]">
                    {formatCurrency(periodOutboundTotal)}
                  </PrivateValue>
                </View>
              </View>

              {periodInboundTotal === 0 && periodOutboundTotal === 0 ? (
                <View className="h-[120px] items-center justify-center">
                  <Text className="text-[#5b645c] font-jakarta-bold text-[12px]">No activity in this period</Text>
                </View>
              ) : (
                <View className="flex-row items-end justify-between h-[120px]">
                  {activeChart.labels.map((label, i) => {
                    const inH = Math.max(4, (activeChart.inbound[i] / chartMax) * 100);
                    const outH = Math.max(4, (activeChart.outbound[i] / chartMax) * 100);
                    return (
                      <View key={`${label}-${i}`} className="items-center flex-1">
                        <View className="flex-row items-end gap-[3px]" style={{ height: 100 }}>
                          <View style={{ width: 6, height: inH, backgroundColor: '#00855D', borderRadius: 3 }} />
                          <View style={{ width: 6, height: outH, backgroundColor: '#D97706', borderRadius: 3 }} />
                        </View>
                        <Text className="text-[10px] font-jakarta-bold text-[#5b645c] uppercase tracking-wider mt-2" numberOfLines={1}>
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Recent Activity */}
          <View className="px-6 mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-jakarta-bold text-[#0c2010]">Recent Activity</Text>
                <TouchableOpacity
                  onPress={onRefresh}
                  className="w-7 h-7 rounded-full bg-[#eff4ef] items-center justify-center"
                >
                  <Feather name="refresh-cw" size={12} color="#006c4e" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => navigation?.navigate('Transactions')} className="bg-[#e7f8ef] px-3 py-1.5 rounded-full">
                <Text className="text-[#006c4e] text-[10px] font-jakarta-bold uppercase tracking-widest">View All</Text>
              </TouchableOpacity>
            </View>

            <View className="bg-white rounded-[32px] p-2 shadow-sm border border-[#bfc9bf]/10">
              {isLoading ? (
                <View className="py-10 items-center justify-center">
                  <ActivityIndicator color="#00351d" />
                </View>
              ) : hasError && transactions.length === 0 ? (
                <NoConnectionState onRetry={refreshTransactions} />
              ) : transactions.length === 0 ? (
                <View className="items-center justify-center py-12">
                  <View className="w-16 h-16 rounded-full bg-[#f7faf7] border border-[#eff4ef] items-center justify-center mb-4">
                    <Feather name="inbox" size={24} color="#b3b9b4" />
                  </View>
                  <Text className="text-[14px] text-[#5b645c] font-jakarta-bold">No recent activity</Text>
                  <Text className="text-[12px] text-[#9ca3af] font-jakarta-bold mt-1">Payments you send or receive will show up here.</Text>
                </View>
              ) : (
                transactions.slice(0, 10).map((tx, index) => {
                  const isInbound = isCreditTransaction(tx.type);
                  const name = isInbound ? (formatName(tx.sender?.name) || 'Unknown') : (formatName(tx.recipient?.name) || formatName(tx.sender?.name) || 'Treasury');
                  const verified = tx.status === 'completed' || tx.status === 'verified';
                  // A failed payout is always refunded in full — without this,
                  // it showed with the exact same solid debit color as a real
                  // completed one, making it look like money had actually
                  // left when net balance impact was zero.
                  const isFailed = tx.status === 'failed';
                  const kes = tx.kesAmount || tx.amount || 0;
                  const rawRef = tx.reference || tx.type.replace('_', ' ');
                  const refText = rawRef.length > 14 ? `${rawRef.slice(0, 6)}…${rawRef.slice(-4)}` : rawRef;
                  return (
                    <View key={tx._id || index} className={`flex-row items-center py-3 px-4 ${index !== Math.min(transactions.length - 1, 4) ? 'border-b border-[#eff4ef]/50' : ''}`}>
                      <View className="w-10 h-10 rounded-full bg-[#eff4ef] items-center justify-center overflow-hidden mr-3">
                        <Text className="text-[#404942] font-jakarta-bold text-[11px]">
                          {name ? name.substring(0, 2).toUpperCase() : 'TX'}
                        </Text>
                      </View>
                      <View className="flex-1 min-w-0 mr-2">
                        <View className="flex-row items-center">
                          <Text className="font-jakarta-bold text-[14px] text-[#0c2010] flex-shrink" numberOfLines={1} ellipsizeMode="tail">{name}</Text>
                          {verified && <MaterialIcons name="verified" size={12} color="#006c4e" style={{ marginLeft: 4 }} />}
                        </View>
                        {isFailed ? (
                          <Text className="text-[#b91c1c] text-[10px] font-jakarta-bold mt-0.5 uppercase tracking-wider">Failed & Refunded</Text>
                        ) : (
                          <Text className="text-[#5b645c] text-[10px] font-jakarta-bold mt-0.5" numberOfLines={1} ellipsizeMode="tail">
                            {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} · {refText}
                          </Text>
                        )}
                      </View>
                      <PrivateValue
                        hidden={!showAmounts}
                        tint="light"
                        className={`font-jakarta-bold text-[13px] ${isFailed ? 'text-[#5b645c] line-through' : isInbound ? 'text-[#006c4e]' : 'text-[#0c2010]'}`}
                        numberOfLines={1}
                        style={{ flexShrink: 0 }}
                      >
                        {`${isInbound ? '+' : '-'} ${formatCurrency(kes)}`}
                      </PrivateValue>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* Growth Tip */}
          <View className="px-6 mb-8">
            <View className="bg-[#e6fffa] p-5 rounded-[24px] border border-emerald-100 flex-row items-start gap-4">
              <View className="w-10 h-10 rounded-full bg-white items-center justify-center border border-emerald-100">
                <MaterialIcons name="lightbulb" size={18} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-jakarta-extrabold text-emerald-800 uppercase tracking-[0.2em] mb-1">Growth Tip</Text>
                <Text className="text-[11px] text-emerald-900 font-jakarta-bold leading-relaxed opacity-80">
                  Instruct your customers to pay via M-Pesa Paybill 880100, Account Number {formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || '...')}, to increase your daily volume.
                </Text>
              </View>
            </View>
          </View>

        </View>
        </FadeSlideIn>
      </ScrollView>
    </SafeAreaView>
  );
}
