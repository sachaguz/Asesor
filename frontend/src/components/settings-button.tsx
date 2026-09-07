import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export function SettingsButton() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Pressable
      style={styles.boton}
      hitSlop={8}
      onPress={() => {
        haptics.tap();
        router.push('/configuracion');
      }}>
      <Ionicons name="ellipsis-horizontal-circle-outline" size={24} color={colors.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: { padding: 4 },
});
