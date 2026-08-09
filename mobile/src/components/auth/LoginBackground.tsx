import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

export default function LoginBackground() {
  const { width } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={220} style={lbStyles.lbSvg}>
        <G opacity={0.18} transform={`translate(${width - 160}, 24)`}>
          <Rect x={28} y={48} width={72} height={52} rx={4} fill="#C8E6C9" />
          <Path d="M20 48 H108 L100 28 H28 Z" fill="#A5D6A7" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Rect
              key={i}
              x={24 + i * 12}
              y={28}
              width={10}
              height={20}
              fill={i % 2 === 0 ? '#E8F5E9' : '#C8E6C9'}
            />
          ))}
          <Rect x={48} y={68} width={32} height={32} rx={2} fill="#E8F5E9" />
        </G>

        <G opacity={0.22} transform={`translate(${width - 72}, 8)`}>
          <Rect x={0} y={0} width={52} height={68} rx={6} fill="#FFFFFF" stroke="#C8E6C9" strokeWidth={2} />
          <Path d="M8 18 H44" stroke="#A5D6A7" strokeWidth={2} />
          <Path d="M8 28 H44" stroke="#A5D6A7" strokeWidth={2} />
          <Path d="M8 38 H32" stroke="#A5D6A7" strokeWidth={2} />
          <Circle cx={38} cy={52} r={10} fill="#6A7E3F" />
          <SvgText
            x={38}
            y={56}
            fontSize={11}
            fontWeight="700"
            fill="#FFFFFF"
            textAnchor="middle"
          >
            Rs.
          </SvgText>
        </G>
      </Svg>
    </View>
  );
}

const lbStyles = StyleSheet.create({
  lbSvg: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
});
