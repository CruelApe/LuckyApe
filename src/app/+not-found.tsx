import { Link } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';

export default function NotFound() {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-8">
      <AppText accessibilityRole="header" className="text-2xl font-extrabold">
        Lost in the jungle
      </AppText>
      <AppText tone="muted" className="text-center text-sm">
        That screen doesn&apos;t exist.
      </AppText>
      <Link href="/games" replace>
        <AppText tone="accent" className="text-base font-bold">
          Back to the games
        </AppText>
      </Link>
    </View>
  );
}
