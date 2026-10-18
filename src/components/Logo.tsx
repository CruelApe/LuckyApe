import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

interface LogoProps {
  size?: number;
}

/** The Lucky Ape mark: an ape with a banana tucked behind one ear. Drawn in code so it scales and themes cleanly. */
export function Logo({ size = 120 }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Lucky Ape logo">
      <G>
        {/* banana */}
        <Path
          d="M78 14 C101 16 114 36 108 60 C106 46 96 33 76 28 Z"
          fill="#FBBF24"
          stroke="#B45309"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Path d="M76 28 L72 23" stroke="#78350F" strokeWidth={3} strokeLinecap="round" />
        {/* ears */}
        <Circle cx={15} cy={64} r={15} fill="#7C4A21" />
        <Circle cx={15} cy={64} r={8.5} fill="#E9B98C" />
        <Circle cx={105} cy={64} r={15} fill="#7C4A21" />
        <Circle cx={105} cy={64} r={8.5} fill="#E9B98C" />
        {/* head */}
        <Circle cx={60} cy={62} r={44} fill="#7C4A21" />
        {/* face */}
        <Ellipse cx={60} cy={72} rx={31} ry={28} fill="#F2CBA2" />
        <Path d="M32 56 C32 44 46 40 60 50 C74 40 88 44 88 56 C88 66 74 70 60 62 C46 70 32 66 32 56 Z" fill="#F2CBA2" />
        {/* eyes */}
        <Circle cx={47} cy={59} r={5.5} fill="#0F172A" />
        <Circle cx={73} cy={59} r={5.5} fill="#0F172A" />
        <Circle cx={49} cy={57} r={1.8} fill="#FFFFFF" />
        <Circle cx={75} cy={57} r={1.8} fill="#FFFFFF" />
        {/* nose + smile */}
        <Circle cx={54.5} cy={76} r={2} fill="#7C4A21" />
        <Circle cx={65.5} cy={76} r={2} fill="#7C4A21" />
        <Path d="M46 86 Q60 98 74 86" stroke="#7C4A21" strokeWidth={3} strokeLinecap="round" fill="none" />
      </G>
    </Svg>
  );
}
