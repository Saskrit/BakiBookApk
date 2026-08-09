import Svg, { Circle, Path, Rect, G } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
import type { TutorialChapterId } from '../../features/tutorial/catalog';

const ACCENTS: Record<TutorialChapterId, { bg: string; fg: string }> = {
  'shop-setup': { bg: '#EEF6E8', fg: '#6A7E3F' },
  dashboard: { bg: '#E8F0FE', fg: '#2563EB' },
  customers: { bg: '#F3E8FF', fg: '#7C3AED' },
  credit: { bg: '#FFF4E5', fg: '#D97706' },
  ledger: { bg: '#E0F7F4', fg: '#0D9488' },
  payments: { bg: '#ECFDF5', fg: '#059669' },
  qr: { bg: '#FCE7F3', fg: '#DB2777' },
  products: { bg: '#EFF6FF', fg: '#3B82F6' },
  expenses: { bg: '#FEF2F2', fg: '#DC2626' },
  reports: { bg: '#F5F3FF', fg: '#6366F1' },
  notifications: { bg: '#FFF7ED', fg: '#EA580C' },
  security: { bg: '#F0FDF4', fg: '#16A34A' },
};

type Props = {
  chapterId: TutorialChapterId;
  stepIndex: number;
};

/** Full-bleed illustrated “phone mock” panel for tutorial slides. */
export default function TutorialIllustration({ chapterId, stepIndex }: Props) {
  const accent = ACCENTS[chapterId] || ACCENTS.dashboard;
  const variant = stepIndex % 3;

  return (
    <View style={[styles.frame, { backgroundColor: accent.bg }]}>
      <View style={styles.phone}>
        <View style={styles.notch} />
        <Svg width="100%" height="100%" viewBox="0 0 200 260" preserveAspectRatio="xMidYMid meet">
          <Rect x={16} y={28} width={168} height={208} rx={18} fill="#FFFFFF" />
          <Rect x={28} y={42} width={80} height={10} rx={5} fill={accent.fg} opacity={0.9} />
          <Rect x={28} y={58} width={120} height={6} rx={3} fill="#E5E7EB" />

          {variant === 0 ? (
            <G>
              <Rect x={28} y={80} width={68} height={52} rx={12} fill={accent.bg} />
              <Rect x={104} y={80} width={68} height={52} rx={12} fill={accent.bg} />
              <Rect x={28} y={144} width={144} height={36} rx={12} fill={accent.fg} opacity={0.15} />
              <Rect x={28} y={190} width={144} height={28} rx={10} fill={accent.fg} />
            </G>
          ) : null}

          {variant === 1 ? (
            <G>
              <Circle cx={56} cy={108} r={22} fill={accent.bg} />
              <Circle cx={56} cy={108} r={12} fill={accent.fg} opacity={0.35} />
              <Rect x={88} y={94} width={84} height={8} rx={4} fill="#E5E7EB" />
              <Rect x={88} y={110} width={60} height={6} rx={3} fill="#F3F4F6" />
              <Rect x={28} y={148} width={144} height={14} rx={7} fill={accent.bg} />
              <Rect x={28} y={172} width={144} height={14} rx={7} fill={accent.bg} />
              <Rect x={28} y={196} width={100} height={14} rx={7} fill={accent.fg} opacity={0.25} />
            </G>
          ) : null}

          {variant === 2 ? (
            <G>
              <Rect x={40} y={88} width={120} height={90} rx={14} fill={accent.bg} />
              <Path
                d="M70 150 L90 130 L110 145 L130 115 L150 150 Z"
                fill={accent.fg}
                opacity={0.45}
              />
              <Circle cx={100} cy={120} r={10} fill={accent.fg} />
              <Rect x={52} y={196} width={96} height={22} rx={11} fill={accent.fg} />
            </G>
          ) : null}
        </Svg>
      </View>
    </View>
  );
}

export function chapterAccent(chapterId: TutorialChapterId) {
  return ACCENTS[chapterId] || ACCENTS.dashboard;
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  phone: {
    width: '72%',
    aspectRatio: 200 / 260,
    maxHeight: '92%',
    borderRadius: 28,
    backgroundColor: '#111827',
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  notch: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    width: 54,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#374151',
    zIndex: 2,
    left: '50%',
    marginLeft: -27,
  },
});
