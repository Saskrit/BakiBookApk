import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

const ICON_COLOR = 'rgba(107, 114, 128, 0.12)';

function FaintIcon({
  x,
  y,
  size,
  children,
}: {
  x: number;
  y: number;
  size: number;
  children: ReactNode;
}) {
  return (
    <G transform={`translate(${x}, ${y}) scale(${size / 48})`} opacity={1}>
      {children}
    </G>
  );
}

function BackgroundIcons({ width }: { width: number }) {
  return (
    <Svg width={width} height={280} style={StyleSheet.absoluteFill}>
      <FaintIcon x={width * 0.08} y={36} size={40}>
        <Rect x={8} y={14} width={32} height={28} rx={3} stroke={ICON_COLOR} strokeWidth={2} fill="none" />
        <Path d="M8 22 H40" stroke={ICON_COLOR} strokeWidth={2} />
        <Path d="M14 14 V8 H34 V14" stroke={ICON_COLOR} strokeWidth={2} fill="none" />
      </FaintIcon>
      <FaintIcon x={width * 0.72} y={28} size={36}>
        <Rect x={10} y={6} width={28} height={36} rx={2} stroke={ICON_COLOR} strokeWidth={2} fill="none" />
        <Path d="M16 16 H32 M16 22 H32 M16 28 H26" stroke={ICON_COLOR} strokeWidth={2} />
      </FaintIcon>
      <FaintIcon x={width * 0.78} y={120} size={34}>
        <Circle cx={24} cy={16} r={8} stroke={ICON_COLOR} strokeWidth={2} fill="none" />
        <Path d="M10 38 C10 28 38 28 38 38" stroke={ICON_COLOR} strokeWidth={2} fill="none" />
      </FaintIcon>
      <FaintIcon x={width * 0.12} y={130} size={32}>
        <Rect x={6} y={6} width={36} height={36} rx={4} stroke={ICON_COLOR} strokeWidth={2} fill="none" />
        <Rect x={12} y={12} width={10} height={10} fill={ICON_COLOR} />
        <Rect x={26} y={12} width={10} height={10} fill={ICON_COLOR} />
        <Rect x={12} y={26} width={10} height={10} fill={ICON_COLOR} />
        <Rect x={26} y={26} width={10} height={10} fill={ICON_COLOR} />
      </FaintIcon>
      <FaintIcon x={width * 0.68} y={200} size={38}>
        <Path
          d="M18 10 L30 10 L34 16 L34 40 L14 40 L14 16 Z"
          stroke={ICON_COLOR}
          strokeWidth={2}
          fill="none"
        />
        <Path d="M14 18 H34" stroke={ICON_COLOR} strokeWidth={2} />
      </FaintIcon>
    </Svg>
  );
}

function Landscape({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id="hillBack" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B8E0A8" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#8BC34A" stopOpacity="0.95" />
        </SvgLinearGradient>
        <SvgLinearGradient id="hillMid" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#9CCC65" />
          <Stop offset="1" stopColor="#7CB342" />
        </SvgLinearGradient>
        <SvgLinearGradient id="hillFront" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6A7E3F" />
          <Stop offset="1" stopColor="#4C5C2D" />
        </SvgLinearGradient>
      </Defs>

      <Path
        d={`M0 ${height * 0.45} Q ${width * 0.25} ${height * 0.28} ${width * 0.5} ${height * 0.38} T ${width} ${height * 0.42} V ${height} H 0 Z`}
        fill="url(#hillBack)"
      />
      <Path
        d={`M0 ${height * 0.62} Q ${width * 0.35} ${height * 0.48} ${width * 0.65} ${height * 0.58} T ${width} ${height * 0.55} V ${height} H 0 Z`}
        fill="url(#hillMid)"
      />
      <Path
        d={`M0 ${height * 0.78} Q ${width * 0.4} ${height * 0.68} ${width * 0.7} ${height * 0.74} T ${width} ${height * 0.72} V ${height} H 0 Z`}
        fill="url(#hillFront)"
      />

      <Ellipse cx={width * 0.18} cy={height * 0.58} rx={28} ry={38} fill="#689F38" opacity={0.55} />
      <Ellipse cx={width * 0.82} cy={height * 0.55} rx={32} ry={42} fill="#689F38" opacity={0.5} />

      <G transform={`translate(${width * 0.5 - 36}, ${height * 0.38})`} opacity={0.35}>
        <Rect x={12} y={28} width={48} height={32} rx={2} fill="#FFFFFF" />
        <Path d="M8 28 H64 L58 16 H14 Z" fill="#FFFFFF" />
        <Path d="M8 28 H64" stroke="#E8F5E9" strokeWidth={2} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Rect key={i} x={10 + i * 9} y={16} width={7} height={12} fill={i % 2 === 0 ? '#C8E6C9' : '#FFFFFF'} />
        ))}
        <Rect x={26} y={40} width={20} height={20} rx={1} fill="#E8F5E9" />
      </G>

      <Path
        d={`M ${width * 0.08} ${height * 0.82} Q ${width * 0.5} ${height * 0.7} ${width * 0.92} ${height * 0.84}`}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={3}
        fill="none"
      />
    </Svg>
  );
}

export default function SplashBackground() {
  const { width, height } = useWindowDimensions();
  const landscapeHeight = height * 0.42;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BackgroundIcons width={width} />
      <View style={[sbStyles.sbLandscapeWrap, { height: landscapeHeight }]}>
        <Landscape width={width} height={landscapeHeight} />
      </View>
    </View>
  );
}

const sbStyles = StyleSheet.create({
  sbLandscapeWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
