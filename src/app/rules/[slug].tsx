import { useLocalSearchParams } from 'expo-router';

import { RulesScreen } from '@/screens/RulesScreen';

export default function RulesRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <RulesScreen slug={slug ?? ''} />;
}
