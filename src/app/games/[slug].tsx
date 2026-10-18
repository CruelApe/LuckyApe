import { isGameSlug } from '@shared/games';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { GeneratorScreen } from '@/screens/GeneratorScreen';

export default function GeneratorRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  if (!slug || !isGameSlug(slug)) return <Redirect href="/games" />;
  return <GeneratorScreen slug={slug} />;
}
