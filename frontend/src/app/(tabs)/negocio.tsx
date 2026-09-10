import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import { SettingsButton } from '@/components/settings-button';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBusinessId } from '@/hooks/use-business-id';
import { useTheme } from '@/hooks/use-theme';
import { useTour } from '@/hooks/use-tour';
import { haptics } from '@/lib/haptics';

const GOOGLE_DRIVE_DEEP_LINK = 'elasesor://google-drive-connected';

export default function NegocioScreen() {
  const { business, businessId } = useBusinessId();
  const { user, logout } = useAuth();
  const { registerTarget } = useTour();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [textoContexto, setTextoContexto] = useState('');
  const [confirmandoBorrarId, setConfirmandoBorrarId] = useState<number | null>(null);

  const contextoQuery = useQuery({
    queryKey: ['context', businessId],
    queryFn: () => api.obtenerContexto(businessId as number),
    enabled: businessId != null,
  });

  const agregarTextoMutation = useMutation({
    mutationFn: (texto: string) => api.agregarContextoTexto(businessId as number, texto),
    onSuccess: () => {
      haptics.success();
      setTextoContexto('');
      queryClient.invalidateQueries({ queryKey: ['context', businessId] });
    },
    onError: () => haptics.error(),
  });

  const subirArchivoMutation = useMutation({
    mutationFn: async () => {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/csv', 'text/plain', '.xlsx'],
        copyToCacheDirectory: true,
      });
      if (resultado.canceled || !resultado.assets[0]) return null;
      const archivo = resultado.assets[0];
      return api.agregarContextoArchivo(businessId as number, {
        uri: archivo.uri,
        name: archivo.name,
        mimeType: archivo.mimeType,
      });
    },
    onSuccess: (creado) => {
      if (creado) {
        haptics.success();
        queryClient.invalidateQueries({ queryKey: ['context', businessId] });
      }
    },
    onError: () => haptics.error(),
  });

  const eliminarContextoMutation = useMutation({
    mutationFn: (contextId: number) => api.eliminarContexto(businessId as number, contextId),
    onSuccess: () => {
      haptics.success();
      setConfirmandoBorrarId(null);
      queryClient.invalidateQueries({ queryKey: ['context', businessId] });
    },
    onError: () => haptics.error(),
  });

  const importar = useImportarVentas(businessId);
  const googleDrive = useGoogleDrive(businessId);

  const reenviarMutation = useMutation({
    mutationFn: () => api.reenviarVerificacion(),
    onSuccess: () => haptics.success(),
    onError: () => haptics.error(),
  });

  function SectionTitle({
    icon,
    children,
  }: {
    icon: ComponentProps<typeof Ionicons>['name'];
    children: string;
  }) {
    return (
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon} size={14} color={colors.brandDeep} />
        <Text style={styles.sectionTitle}>{children}</Text>
      </View>
    );
  }

  if (businessId == null || !business) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={tabBarHeight}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.flexShrink}>
            <Text style={styles.lead}>Tu negocio.</Text>
            <Text style={styles.subtle}>Entre mejor te conozca, mejores consejos te doy.</Text>
          </View>
          <SettingsButton />
        </View>

        <SectionTitle icon="storefront-outline">Identidad</SectionTitle>
        <View style={styles.block}>
          <View style={styles.identityRow}>
            <View style={styles.identityIcon}>
              <Ionicons name="storefront" size={20} color={colors.brand} />
            </View>
            <View style={styles.flexShrink}>
              <Text style={styles.negocioNombre}>{business.nombre}</Text>
              <Text style={styles.negocioGiro}>Giro: {business.giro}</Text>
            </View>
          </View>
        </View>

        <SectionTitle icon="cloud-upload-outline">Ventas</SectionTitle>
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Importar ventas desde CSV</Text>
          <Text style={styles.blockHint}>
            Subí tu historial de ventas tal cual lo tenés — no importa el orden ni los nombres de
            las columnas, los reconozco solo. Si lo que tenés es un inventario, lista de precios u
            otro archivo, usá “Adjuntar” más abajo en vez de esto.
          </Text>
          {importar.archivo ? (
            <>
              <View style={styles.divider} />
              <View style={styles.archivoRow}>
                <Ionicons name="document-text-outline" size={16} color={colors.brandDeep} />
                <Text style={styles.archivoNombre}>{importar.archivo.name}</Text>
              </View>
              <Pressable
                style={[styles.botonSecundario, importar.enviando && styles.botonDisabled]}
                disabled={importar.enviando}
                onPress={() => {
                  haptics.tap();
                  importar.importar();
                }}>
                {importar.enviando ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.white} />
                    <Text style={styles.botonSecundarioTexto}>Importar</Text>
                  </>
                )}
              </Pressable>
              {importar.resultado && (
                <Text style={styles.resultado}>
                  {importar.resultado.filas_importadas} filas importadas
                  {importar.resultado.errores.length > 0
                    ? `, ${importar.resultado.errores.length} con error`
                    : ''}
                  .
                </Text>
              )}
              {importar.error && <Text style={styles.errorTexto}>{importar.error}</Text>}
            </>
          ) : (
            <Pressable
              style={styles.botonSecundario}
              onPress={() => {
                haptics.tap();
                importar.elegirArchivo();
              }}>
              <Ionicons name="document-attach-outline" size={16} color={colors.white} />
              <Text style={styles.botonSecundarioTexto}>Elegir archivo CSV</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>Importar ventas desde Google Drive</Text>
          {googleDrive.cargando ? (
            <ActivityIndicator color={colors.brand} />
          ) : !googleDrive.conexion ? (
            <>
              <Text style={styles.blockHint}>
                Conectá una carpeta de Drive y cada CSV que dejes ahí se importa solo, sin subirlo a
                mano — desde cualquier dispositivo, sin depender de una compu prendida.
              </Text>
              <Pressable
                style={[styles.botonSecundario, googleDrive.conectando && styles.botonDisabled]}
                disabled={googleDrive.conectando}
                onPress={() => {
                  haptics.tap();
                  googleDrive.conectar();
                }}>
                {googleDrive.conectando ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={16} color={colors.white} />
                    <Text style={styles.botonSecundarioTexto}>Conectar Google Drive</Text>
                  </>
                )}
              </Pressable>
              {googleDrive.errorConectar && (
                <Text style={styles.errorTexto}>{googleDrive.errorConectar}</Text>
              )}
            </>
          ) : !googleDrive.conexion.folder_id ? (
            <>
              <Text style={styles.blockHint}>
                Google Drive conectado. Ahora pegá el link de la carpeta donde vas a dejar los CSV.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="https://drive.google.com/drive/folders/…"
                placeholderTextColor={colors.inkSoft}
                value={googleDrive.folderUrl}
                onChangeText={googleDrive.setFolderUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={[
                  styles.botonSecundario,
                  (!googleDrive.folderUrl.trim() || googleDrive.eligiendoCarpeta) &&
                    styles.botonDisabled,
                ]}
                disabled={!googleDrive.folderUrl.trim() || googleDrive.eligiendoCarpeta}
                onPress={() => {
                  haptics.tap();
                  googleDrive.elegirCarpeta();
                }}>
                {googleDrive.eligiendoCarpeta ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.botonSecundarioTexto}>Guardar carpeta</Text>
                )}
              </Pressable>
              {googleDrive.errorCarpeta && (
                <Text style={styles.errorTexto}>{googleDrive.errorCarpeta}</Text>
              )}
            </>
          ) : (
            <>
              <View style={styles.archivoRow}>
                <Ionicons name="folder-outline" size={16} color={colors.brandDeep} />
                <Text style={styles.archivoNombre}>{googleDrive.conexion.folder_name}</Text>
              </View>
              <Pressable
                style={[styles.botonSecundario, googleDrive.sincronizando && styles.botonDisabled]}
                disabled={googleDrive.sincronizando}
                onPress={() => {
                  haptics.tap();
                  googleDrive.sincronizar();
                }}>
                {googleDrive.sincronizando ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={16} color={colors.white} />
                    <Text style={styles.botonSecundarioTexto}>Sincronizar</Text>
                  </>
                )}
              </Pressable>
              {googleDrive.resultadoSync && (
                <Text style={styles.resultado}>
                  {googleDrive.resultadoSync.archivos_importados} archivo(s) nuevo(s),{' '}
                  {googleDrive.resultadoSync.filas_importadas} filas importadas
                  {googleDrive.resultadoSync.errores.length > 0
                    ? `, ${googleDrive.resultadoSync.errores.length} con error`
                    : ''}
                  .
                </Text>
              )}
              {googleDrive.errorSync && <Text style={styles.errorTexto}>{googleDrive.errorSync}</Text>}
              <Pressable
                style={[styles.botonPeligroChico, googleDrive.desconectando && styles.botonDisabled]}
                disabled={googleDrive.desconectando}
                onPress={() => {
                  haptics.tap();
                  googleDrive.desconectar();
                }}>
                <Text style={styles.borrarCuentaTexto}>Desconectar Google Drive</Text>
              </Pressable>
            </>
          )}
        </View>

        <SectionTitle icon="bulb-outline">Lo que solo tú sabes</SectionTitle>
        <View style={styles.block} ref={(node) => registerTarget('negocio', node)}>
          <Text style={styles.blockHint}>
            Inventarios, listas de precios, catálogos de proveedor o cualquier otro archivo — se
            usan como contexto para tus consejos, no como ventas.
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Cuéntame de tu negocio con tus palabras…"
            placeholderTextColor={colors.inkSoft}
            value={textoContexto}
            onChangeText={setTextoContexto}
            multiline
          />
          <View style={styles.buttonRow}>
            <Pressable
              style={[
                styles.botonSecundario,
                styles.flexOne,
                (!textoContexto.trim() || agregarTextoMutation.isPending) && styles.botonDisabled,
              ]}
              disabled={!textoContexto.trim() || agregarTextoMutation.isPending}
              onPress={() => {
                haptics.tap();
                agregarTextoMutation.mutate(textoContexto.trim());
              }}>
              <Ionicons name="add-circle-outline" size={16} color={colors.white} />
              <Text style={styles.botonSecundarioTexto}>Agregar</Text>
            </Pressable>

            <Pressable
              style={[
                styles.botonSecundario,
                styles.flexOne,
                subirArchivoMutation.isPending && styles.botonDisabled,
              ]}
              disabled={subirArchivoMutation.isPending}
              onPress={() => {
                haptics.tap();
                subirArchivoMutation.mutate();
              }}>
              {subirArchivoMutation.isPending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="attach-outline" size={16} color={colors.white} />
                  <Text style={styles.botonSecundarioTexto}>Adjuntar</Text>
                </>
              )}
            </Pressable>
          </View>

          {contextoQuery.isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: Spacing.three }} />
          ) : (
            (contextoQuery.data ?? []).length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.contextoListTitulo}>Guardado hasta ahora</Text>
                {(contextoQuery.data ?? []).map((item) => (
                  <View key={item.id} style={styles.contextoItem}>
                    <Ionicons
                      name={item.archivo_path ? 'document-text-outline' : 'chatbubble-ellipses-outline'}
                      size={16}
                      color={colors.inkSoft}
                      style={styles.contextoIcon}
                    />
                    <View style={styles.flexShrink}>
                      <Text style={styles.contextoTexto} numberOfLines={4}>
                        {item.texto || '(sin texto extraído)'}
                      </Text>
                      {item.archivo_path && <Text style={styles.contextoTag}>Archivo adjunto</Text>}
                    </View>
                    {confirmandoBorrarId === item.id ? (
                      <View style={styles.confirmarBorrarRow}>
                        <Pressable
                          hitSlop={8}
                          disabled={eliminarContextoMutation.isPending}
                          onPress={() => {
                            haptics.tap();
                            eliminarContextoMutation.mutate(item.id);
                          }}>
                          {eliminarContextoMutation.isPending &&
                          eliminarContextoMutation.variables === item.id ? (
                            <ActivityIndicator color={colors.nopidas} size="small" />
                          ) : (
                            <Text style={styles.confirmarBorrarTexto}>Borrar</Text>
                          )}
                        </Pressable>
                        <Pressable hitSlop={8} onPress={() => setConfirmandoBorrarId(null)}>
                          <Text style={styles.cancelarBorrarTexto}>Cancelar</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        hitSlop={8}
                        style={styles.borrarIconWrapper}
                        onPress={() => setConfirmandoBorrarId(item.id)}>
                        <Ionicons name="trash-outline" size={16} color={colors.inkSoft} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </>
            )
          )}
        </View>

        <SectionTitle icon="person-circle-outline">Cuenta</SectionTitle>
        <View style={styles.block}>
          <View style={styles.identityRow}>
            <Ionicons name="mail-outline" size={18} color={colors.inkSoft} />
            <Text style={styles.negocioGiro}>{user?.email}</Text>
          </View>
          {user && !user.email_verificado && (
            <>
              <View style={styles.divider} />
              <View style={styles.identityRow}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.vigila} />
                <Text style={[styles.blockHint, styles.flexShrink]}>Correo sin verificar</Text>
                <Pressable
                  disabled={reenviarMutation.isPending || reenviarMutation.isSuccess}
                  onPress={() => {
                    haptics.tap();
                    reenviarMutation.mutate();
                  }}>
                  {reenviarMutation.isPending ? (
                    <ActivityIndicator color={colors.brand} size="small" />
                  ) : (
                    <Text style={styles.reenviarTexto}>
                      {reenviarMutation.isSuccess ? 'Enviado' : 'Reenviar'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>

        <Pressable
          style={styles.botonPeligro}
          onPress={async () => {
            haptics.tap();
            await logout();
            router.replace('/login');
          }}>
          <Ionicons name="log-out-outline" size={16} color={colors.nopidas} />
          <Text style={styles.botonPeligroTexto}>Cerrar sesión</Text>
        </Pressable>

        <Pressable
          style={styles.botonPeligroChico}
          onPress={() => {
            haptics.tap();
            router.push('/eliminar-cuenta');
          }}>
          <Text style={styles.borrarCuentaTexto}>Borrar mi cuenta</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function useImportarVentas(businessId: number | null | undefined) {
  const [archivo, setArchivo] = useState<{ uri: string; name: string; mimeType?: string | null } | null>(
    null
  );
  const mutation = useMutation({
    mutationFn: () => api.importarVentasCsv(businessId as number, archivo!),
    onSuccess: () => haptics.success(),
    onError: () => haptics.error(),
  });

  const elegirArchivo = async () => {
    const resultado = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
      copyToCacheDirectory: true,
    });
    if (resultado.canceled || !resultado.assets[0]) return;
    setArchivo(resultado.assets[0]);
    mutation.reset();
  };

  return {
    archivo,
    elegirArchivo,
    enviando: mutation.isPending,
    resultado: mutation.data ?? null,
    error: mutation.error instanceof ApiError ? mutation.error.message : null,
    importar: () => mutation.mutate(),
  };
}

function useGoogleDrive(businessId: number | null | undefined) {
  const queryClient = useQueryClient();
  const [folderUrl, setFolderUrl] = useState('');

  const conexionQuery = useQuery({
    queryKey: ['google-drive', businessId],
    queryFn: async () => {
      try {
        return await api.obtenerConexionGoogleDrive(businessId as number);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: businessId != null,
  });

  const conectarMutation = useMutation({
    mutationFn: async () => {
      const { url } = await api.conectarGoogleDrive(businessId as number);
      const resultado = await WebBrowser.openAuthSessionAsync(url, GOOGLE_DRIVE_DEEP_LINK);
      if (resultado.type !== 'success') return;
      const { queryParams } = Linking.parse(resultado.url);
      if (queryParams?.status !== 'ok') {
        const mensaje = typeof queryParams?.mensaje === 'string' ? queryParams.mensaje : null;
        throw new Error(mensaje ?? 'No se pudo conectar Google Drive. Intenta de nuevo.');
      }
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['google-drive', businessId] });
    },
    onError: () => haptics.error(),
  });

  const elegirCarpetaMutation = useMutation({
    mutationFn: () => api.elegirCarpetaGoogleDrive(businessId as number, folderUrl.trim()),
    onSuccess: () => {
      haptics.success();
      setFolderUrl('');
      queryClient.invalidateQueries({ queryKey: ['google-drive', businessId] });
    },
    onError: () => haptics.error(),
  });

  const sincronizarMutation = useMutation({
    mutationFn: () => api.sincronizarGoogleDrive(businessId as number),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['google-drive', businessId] });
    },
    onError: () => haptics.error(),
  });

  const desconectarMutation = useMutation({
    mutationFn: () => api.desconectarGoogleDrive(businessId as number),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['google-drive', businessId] });
    },
    onError: () => haptics.error(),
  });

  return {
    conexion: conexionQuery.data ?? null,
    cargando: conexionQuery.isLoading,
    conectar: () => conectarMutation.mutate(),
    conectando: conectarMutation.isPending,
    errorConectar: conectarMutation.error instanceof Error ? conectarMutation.error.message : null,
    folderUrl,
    setFolderUrl,
    elegirCarpeta: () => elegirCarpetaMutation.mutate(),
    eligiendoCarpeta: elegirCarpetaMutation.isPending,
    errorCarpeta: elegirCarpetaMutation.error instanceof ApiError ? elegirCarpetaMutation.error.message : null,
    sincronizar: () => sincronizarMutation.mutate(),
    sincronizando: sincronizarMutation.isPending,
    resultadoSync: sincronizarMutation.data ?? null,
    errorSync: sincronizarMutation.error instanceof ApiError ? sincronizarMutation.error.message : null,
    desconectar: () => desconectarMutation.mutate(),
    desconectando: desconectarMutation.isPending,
  };
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { padding: Spacing.four, paddingBottom: Spacing.eight },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    lead: { fontFamily: Fonts.serifSemiBold, fontSize: 22, color: colors.ink, marginTop: Spacing.two },
    subtle: {
      fontFamily: Fonts.sansRegular,
      fontSize: 13.5,
      color: colors.inkSoft,
      marginTop: 4,
      marginBottom: Spacing.four,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: Spacing.six,
      marginBottom: Spacing.three,
    },
    sectionTitle: {
      fontFamily: Fonts.serifSemiBold,
      fontSize: 12,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: colors.brandDeep,
    },
    block: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.lg,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    identityIcon: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flexShrink: { flexShrink: 1 },
    flexOne: { flex: 1 },
    divider: { height: 1, backgroundColor: colors.line, marginVertical: 2 },
    negocioNombre: { fontFamily: Fonts.serifMedium, fontSize: 17, color: colors.ink },
    negocioGiro: { fontFamily: Fonts.sansRegular, fontSize: 13, color: colors.inkSoft },
    blockLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink },
    blockHint: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: colors.inkSoft, lineHeight: 18 },
    archivoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    archivoNombre: { fontFamily: Fonts.sansMedium, fontSize: 13, color: colors.brandDeep },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      fontFamily: Fonts.sansRegular,
      fontSize: 13.5,
      color: colors.ink,
      backgroundColor: colors.paper,
    },
    textarea: { minHeight: 90, textAlignVertical: 'top' },
    buttonRow: { flexDirection: 'row', gap: Spacing.two },
    botonSecundario: {
      flexDirection: 'row',
      backgroundColor: colors.brand,
      borderRadius: Radius.md,
      paddingVertical: Spacing.two,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    botonSecundarioTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.white },
    botonDisabled: { opacity: 0.5 },
    resultado: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: colors.inkSoft },
    errorTexto: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: colors.nopidas },
    contextoListTitulo: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 11.5,
      color: colors.inkSoft,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    contextoItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.two,
    },
    contextoIcon: { marginTop: 2 },
    borrarIconWrapper: { marginTop: 2 },
    confirmarBorrarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: 2 },
    confirmarBorrarTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.nopidas },
    cancelarBorrarTexto: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: colors.inkSoft },
    contextoTexto: { fontFamily: Fonts.sansRegular, fontSize: 13, color: colors.ink, lineHeight: 18 },
    contextoTag: {
      fontFamily: Fonts.sansMedium,
      fontSize: 11,
      color: colors.resurte,
      marginTop: 2,
    },
    botonPeligro: {
      flexDirection: 'row',
      marginTop: Spacing.six,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.three,
    },
    botonPeligroTexto: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: colors.nopidas },
    botonPeligroChico: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.two,
    },
    borrarCuentaTexto: { fontFamily: Fonts.sansRegular, fontSize: 11.5, color: colors.inkSoft },
    reenviarTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.brandDeep },
  });
}
