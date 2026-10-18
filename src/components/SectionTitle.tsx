import { AppText } from './AppText';

export function SectionTitle({ children }: { children: string }) {
  return (
    <AppText accessibilityRole="header" className="mb-3 mt-6 text-lg font-extrabold">
      {children}
    </AppText>
  );
}
