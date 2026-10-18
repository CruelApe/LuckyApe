import type { PropsWithChildren, ReactElement } from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBackground } from './ScreenBackground';

interface ScreenProps extends PropsWithChildren {
  /** Pass a RefreshControl for pull-to-refresh. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Fixed content that stays above the scroll area (e.g. a header). */
  header?: ReactElement;
}

/** Page chrome: themed background, safe-area padding, and a readable max width on tablets and web. */
export function Screen({ children, header, refreshControl }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <ScreenBackground />
      <View style={{ paddingTop: insets.top + 8 }} className="w-full max-w-[720px] self-center px-4">
        {header}
      </View>
      <ScrollView
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        contentContainerClassName="w-full max-w-[720px] self-center px-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}
