import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Fonts, Radius, type ColorPalette } from '@/constants/theme';
import { useSubscription } from '@/hooks/use-subscription';
import { useTheme } from '@/hooks/use-theme';

function TabIcon({
  name,
  focused,
  color,
  colors,
}: {
  name: ComponentProps<typeof Ionicons>['name'];
  focused: boolean;
  color: string;
  colors: ColorPalette;
}) {
  const styles = createStyles(colors);
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapOn]}>
      <Ionicons name={name} size={20} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { suscrito } = useSubscription();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: 82,
          paddingTop: 10,
        },
        tabBarLabelStyle: { fontFamily: Fonts.sansSemiBold, fontSize: 10.5, marginTop: 2 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'home' : 'home-outline'}
              focused={focused}
              color={color}
              colors={colors}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="preguntar"
        options={{
          title: 'Preguntar',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              focused={focused}
              color={color}
              colors={colors}
            />
          ),
        }}
      />
      <Tabs.Screen
        // href: null oculta la pestaña de la barra sin sacar la ruta — así
        // "Redes sociales" desde Configuración sigue funcionando aunque no
        // esté suscrito, y la pestaña aparece sola apenas se suscribe.
        name="redes"
        options={{
          title: 'Redes',
          href: suscrito ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="logo-instagram" focused={focused} color={color} colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="negocio"
        options={{
          title: 'Mi negocio',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'settings' : 'settings-outline'}
              focused={focused}
              color={color}
              colors={colors}
            />
          ),
        }}
      />
    </Tabs>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    iconWrap: {
      width: 46,
      height: 30,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapOn: { backgroundColor: colors.brandSoft },
  });
}
