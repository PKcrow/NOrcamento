import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  useGetCompany,
  useListTasks,
  useUpdateCompany,
  type TaskPhoto,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type PreviewKind = 'horizontal' | 'vertical';
type SelectedPhoto = TaskPhoto & { caption: string };

function getStorageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return null;
  const path = value.startsWith('/objects/')
    ? `/api/storage${value}`
    : value.startsWith('/') ? value : `/${value}`;
  return `https://${domain}${path}`;
}

function splitItems(value: string): string[] {
  return value
    .split(/\n|•|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export default function CompanyMaterialsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { width } = Dimensions.get('window');
  const { data: company, isLoading: companyLoading } = useGetCompany();
  const { data: tasks, isLoading: tasksLoading } = useListTasks({});
  const updateCompany = useUpdateCompany();
  const materialRef = useRef<View>(null);
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [services, setServices] = useState('');
  const [differentials, setDifferentials] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [previewKind, setPreviewKind] = useState<PreviewKind>('horizontal');
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!company) return;
    setHeadline(company.marketingHeadline ?? '');
    setAbout(company.marketingAbout ?? '');
    setServices(company.marketingServices ?? '');
    setDifferentials(company.marketingDifferentials ?? '');
  }, [company]);

  const photos = useMemo(() => {
    const unique = new Map<number, TaskPhoto>();
    for (const task of tasks ?? []) {
      for (const photo of task.photos ?? []) {
        if (photo.url && !unique.has(photo.id)) unique.set(photo.id, photo);
      }
    }
    return Array.from(unique.values());
  }, [tasks]);

  const togglePhoto = (photo: TaskPhoto) => {
    if (selectedPhotos.some((item) => item.id === photo.id)) {
      setSelectedPhotos((current) => current.filter((item) => item.id !== photo.id));
      return;
    }
    if (selectedPhotos.length >= 3) {
      Alert.alert('Limite de fotos', 'Escolha no máximo três fotos para a apresentação.');
      return;
    }
    setSelectedPhotos((current) => [...current, { ...photo, caption: '' }]);
  };

  const saveTexts = () => {
    updateCompany.mutate(
      {
        data: {
          marketingHeadline: headline.trim() || null,
          marketingAbout: about.trim() || null,
          marketingServices: services.trim() || null,
          marketingDifferentials: differentials.trim() || null,
        },
      },
      {
        onSuccess: () => Alert.alert('Salvo', 'Os textos dos materiais foram atualizados.'),
        onError: () => Alert.alert('Erro', 'Não foi possível salvar os textos.'),
      },
    );
  };

  const sharePng = async () => {
    if (!materialRef.current || isSharing) return;
    if (Platform.OS === 'web') {
      Alert.alert('Indisponível no navegador', 'A exportação PNG dos materiais está disponível no aplicativo instalado.');
      return;
    }
    if (!FileSystem.cacheDirectory) {
      Alert.alert('Erro', 'O armazenamento temporário do aparelho não está disponível.');
      return;
    }
    setIsSharing(true);
    try {
      const uri = await captureRef(materialRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Compartilhamento indisponível', 'Este aparelho não permite compartilhar arquivos.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Compartilhar ${previewKind === 'horizontal' ? 'cartão' : 'apresentação'}`,
        UTI: 'public.png',
      });
    } catch (error) {
      console.error('Marketing material capture failed', error);
      Alert.alert('Erro', 'Não foi possível gerar a imagem. Tente novamente.');
    } finally {
      setIsSharing(false);
    }
  };

  if (companyLoading || tasksLoading || !company) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const selectedIds = new Set(selectedPhotos.map((photo) => photo.id));
  const logoUrl = getStorageUrl(company.logoUrl);
  const safeWidth = Math.max(300, Math.min(width - 32, 520));

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
        <Text style={[styles.backText, { color: theme.foreground }]}>Voltar</Text>
      </TouchableOpacity>

      <View style={[styles.hero, { backgroundColor: theme.foreground }]}>
        <View style={[styles.heroOrb, { backgroundColor: theme.primary }]} />
        <Text style={[styles.eyebrow, { color: '#ffd9bd' }]}>APRESENTE SEU TRABALHO</Text>
        <Text style={styles.heroTitle}>Materiais para abrir novas conversas.</Text>
        <Text style={styles.heroDescription}>
          Use seus dados seguros e fotos escolhidas por você. Nada de nomes, endereços ou pagamentos de clientes.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.sectionHeading}>
          <View style={[styles.iconBubble, { backgroundColor: theme.primary + '18' }]}>
            <Ionicons name="create-outline" size={20} color={theme.primary} />
          </View>
          <View style={styles.headingCopy}>
            <Text style={[styles.cardTitle, { color: theme.foreground }]}>Seu conteúdo</Text>
            <Text style={[styles.cardSubtitle, { color: theme.mutedForeground }]}>
              Fale com o cliente de forma direta e pessoal.
            </Text>
          </View>
        </View>

        <MarketingField label="Frase principal" value={headline} onChangeText={setHeadline} placeholder="Ex.: Reparos com segurança e capricho" theme={theme} />
        <MarketingField label="Quem somos" value={about} onChangeText={setAbout} placeholder="Conte sua experiência e o que valoriza em cada serviço." multiline theme={theme} />
        <MarketingField label="Serviços" value={services} onChangeText={setServices} placeholder="Ex.:\n• Instalações\n• Manutenção" multiline theme={theme} />
        <MarketingField label="Diferenciais" value={differentials} onChangeText={setDifferentials} placeholder="Ex.:\n• Prazo combinado\n• Orçamento transparente" multiline theme={theme} />

        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={saveTexts} disabled={updateCompany.isPending}>
          {updateCompany.isPending ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle-outline" size={19} color="#fff" />}
          <Text style={styles.primaryButtonText}>{updateCompany.isPending ? 'Salvando...' : 'Salvar textos'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.sectionHeading}>
          <View style={[styles.iconBubble, { backgroundColor: '#e5f0eb' }]}>
            <Ionicons name="images-outline" size={20} color="#3f7664" />
          </View>
          <View style={styles.headingCopy}>
            <Text style={[styles.cardTitle, { color: theme.foreground }]}>Fotos reais do trabalho</Text>
            <Text style={[styles.cardSubtitle, { color: theme.mutedForeground }]}>Escolha até três fotos das suas O.S.</Text>
          </View>
          <Text style={[styles.counter, { color: theme.primary }]}>{selectedPhotos.length}/3</Text>
        </View>

        {photos.length ? (
          <View style={styles.photoGrid}>
            {photos.map((photo) => {
              const selected = selectedIds.has(photo.id);
              const uri = getStorageUrl(photo.url);
              if (!uri) return null;
              return (
                <TouchableOpacity
                  key={photo.id}
                  style={[styles.photoChoice, selected && { borderColor: theme.primary, borderWidth: 3 }]}
                  onPress={() => togglePhoto(photo)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={selected ? 'Remover foto selecionada' : 'Selecionar foto de trabalho'}
                >
                  <Image source={{ uri }} style={styles.photoImage} contentFit="cover" />
                  <View style={[styles.photoCheck, { backgroundColor: selected ? theme.primary : '#202a2d99' }]}>
                    <Ionicons name={selected ? 'checkmark' : 'add'} size={16} color="#fff" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyBox, { borderColor: theme.border }]}>
            <Ionicons name="images-outline" size={26} color={theme.mutedForeground} />
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>Adicione fotos nas O.S. para escolhê-las aqui.</Text>
          </View>
        )}

        {selectedPhotos.map((photo, index) => (
          <View key={photo.id} style={styles.captionRow}>
            <Image source={{ uri: getStorageUrl(photo.url) ?? undefined }} style={styles.captionImage} contentFit="cover" />
            <TextInput
              value={photo.caption}
              onChangeText={(caption) => setSelectedPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, caption } : item))}
              placeholder={`Legenda da foto ${index + 1} (opcional)`}
              placeholderTextColor={theme.mutedForeground}
              maxLength={80}
              style={[styles.captionInput, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.background }]}
            />
            <TouchableOpacity onPress={() => togglePhoto(photo)} accessibilityLabel="Remover foto">
              <Ionicons name="close-circle-outline" size={22} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.previewHeader}>
          <View>
            <Text style={[styles.cardTitle, { color: theme.foreground }]}>Pré-visualização</Text>
            <Text style={[styles.cardSubtitle, { color: theme.mutedForeground }]}>A imagem usa contatos preenchidos automaticamente.</Text>
          </View>
          <View style={[styles.segment, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <TouchableOpacity onPress={() => setPreviewKind('horizontal')} style={[styles.segmentButton, previewKind === 'horizontal' && { backgroundColor: theme.foreground }]}>
              <Text style={[styles.segmentText, { color: previewKind === 'horizontal' ? '#fff' : theme.mutedForeground }]}>Cartão</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPreviewKind('vertical')} style={[styles.segmentButton, previewKind === 'vertical' && { backgroundColor: theme.foreground }]}>
              <Text style={[styles.segmentText, { color: previewKind === 'vertical' ? '#fff' : theme.mutedForeground }]}>Apresentação</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View ref={materialRef} collapsable={false} style={{ width: safeWidth }}>
          <MaterialPreview
            kind={previewKind}
            width={safeWidth}
            company={company}
            logoUrl={logoUrl}
            headline={headline}
            about={about}
            services={services}
            differentials={differentials}
            selectedPhotos={selectedPhotos}
          />
        </View>

        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={sharePng} disabled={isSharing}>
          {isSharing ? <ActivityIndicator color="#fff" /> : <Ionicons name="share-outline" size={19} color="#fff" />}
          <Text style={styles.primaryButtonText}>{isSharing ? 'Preparando imagem...' : 'Compartilhar PNG'}</Text>
        </TouchableOpacity>
        <Text style={[styles.safeNote, { color: theme.mutedForeground }]}>O PNG não inclui Pix, dados bancários ou informações de clientes.</Text>
      </View>
    </ScrollView>
  );
}

function MarketingField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  theme: typeof Colors.light;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.mutedForeground}
        multiline={multiline}
        maxLength={multiline ? 600 : 120}
        style={[
          multiline ? styles.textarea : styles.input,
          { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.background },
        ]}
      />
    </View>
  );
}

function MaterialPreview({
  kind,
  width,
  company,
  logoUrl,
  headline,
  about,
  services,
  differentials,
  selectedPhotos,
}: {
  kind: PreviewKind;
  width: number;
  company: { name: string; phone: string | null; email: string | null; address: string | null; website: string | null };
  logoUrl: string | null;
  headline: string;
  about: string;
  services: string;
  differentials: string;
  selectedPhotos: SelectedPhoto[];
}) {
  const orange = '#e76622';
  const ink = '#202a2d';
  const cream = '#fbf6ed';
  const contact = [company.phone, company.email, company.website].filter(Boolean).join('  •  ');
  const bullets = splitItems(services || differentials);
  const imageUri = getStorageUrl(selectedPhotos[0]?.url);
  const horizontal = kind === 'horizontal';

  return (
    <View style={[styles.material, horizontal ? { height: width * 0.56, flexDirection: 'row' } : { minHeight: width * 1.39 }]}>
      <View style={[styles.materialAccent, horizontal ? { width: '39%' } : { height: 118, width: '100%' }, { backgroundColor: orange }]}>
        <Text style={styles.materialEyebrow}>{horizontal ? 'SEU TRABALHO EM FOCO' : 'PORTFÓLIO DE SERVIÇOS'}</Text>
        {!horizontal && <Text style={styles.materialCompany}>{company.name}</Text>}
        {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.materialLogo} contentFit="contain" /> : <View style={styles.materialInitial}><Text style={styles.materialInitialText}>{company.name.charAt(0).toUpperCase()}</Text></View>}
        {horizontal && <Text style={styles.materialHeadline}>{headline.trim() || 'Trabalho bem feito, do seu jeito.'}</Text>}
        {horizontal && <Text style={styles.materialAbout}>{about.trim() || 'Serviços cuidadosos, comunicação clara e compromisso com cada entrega.'}</Text>}
        {horizontal && <Text style={styles.materialFooter}>{company.name}</Text>}
      </View>
      <View style={[styles.materialBody, !horizontal && { backgroundColor: ink }]}>
        {imageUri ? (
          <View>
            <View style={{ position: 'relative' }}>
              <Image source={{ uri: imageUri }} style={[styles.materialPhoto, horizontal ? { height: '64%' } : { height: width * 0.39 }]} contentFit="cover" />
              {!!selectedPhotos[0]?.caption && <Text style={styles.materialCaption}>{selectedPhotos[0].caption}</Text>}
            </View>
            {selectedPhotos.length > 1 && (
              <View style={styles.materialPhotoStrip}>
                {selectedPhotos.slice(1, 3).map((photo) => {
                  const uri = getStorageUrl(photo.url);
                  return uri ? (
                    <View key={photo.id} style={styles.materialPhotoTile}>
                      <Image source={{ uri }} style={styles.materialPhotoSmall} contentFit="cover" />
                      {!!photo.caption && <Text style={styles.materialCaptionSmall} numberOfLines={1}>{photo.caption}</Text>}
                    </View>
                  ) : null;
                })}
              </View>
            )}
          </View>
        ) : <View style={[styles.materialPhotoEmpty, horizontal ? { height: '64%' } : { height: width * 0.39 }]}><Ionicons name="images-outline" size={24} color="#9aa6a2" /><Text style={styles.materialEmptyText}>Escolha uma foto de destaque</Text></View>}
        {!horizontal && <Text style={styles.materialHeadlineVertical}>{headline.trim() || 'Serviços com cuidado e clareza.'}</Text>}
        {!horizontal && <Text style={styles.materialAboutVertical}>{about.trim() || 'Conheça meu trabalho e vamos encontrar o melhor caminho.'}</Text>}
        {!horizontal && (
          <View style={styles.materialBullets}>
            <Text style={styles.materialSectionLabel}>O QUE VOCÊ PODE ESPERAR</Text>
            {(bullets.length ? bullets : ['Experiência prática', 'Orçamento transparente', 'Atenção aos detalhes']).slice(0, 3).map((bullet, index) => (
              <Text key={`${bullet}-${index}`} style={styles.materialBullet}>✓ {bullet}</Text>
            ))}
          </View>
        )}
        <Text style={styles.materialSectionLabel}>FALE COMIGO</Text>
        <Text style={styles.materialContact}>{contact || 'Entre em contato para conversar.'}</Text>
        {!horizontal && company.address && <Text style={styles.materialContact}>{company.address}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  backText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  hero: { borderRadius: 18, padding: 22, overflow: 'hidden' },
  heroOrb: { position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -50, top: -65, opacity: 0.8 },
  eyebrow: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 1.4, marginBottom: 12 },
  heroTitle: { color: '#fff8ef', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 25, lineHeight: 31, maxWidth: 310 },
  heroDescription: { color: '#d8dfdc', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 20, marginTop: 10 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBubble: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1 },
  cardTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
  cardSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 18, marginTop: 2 },
  counter: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  field: { gap: 6 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 },
  input: { minHeight: 46, borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14 },
  textarea: { minHeight: 88, borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, paddingTop: 11, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, textAlignVertical: 'top' },
  primaryButton: { minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  primaryButtonText: { color: '#fff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoChoice: { width: '31.8%', aspectRatio: 1.15, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'transparent' },
  photoImage: { width: '100%', height: '100%' },
  photoCheck: { position: 'absolute', top: 6, right: 6, width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { minHeight: 90, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  emptyText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, textAlign: 'center' },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  captionImage: { width: 48, height: 42, borderRadius: 7 },
  captionInput: { flex: 1, minHeight: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12 },
  previewHeader: { gap: 12 },
  segment: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: 9, borderWidth: 1, padding: 3 },
  segmentButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7 },
  segmentText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11 },
  material: { overflow: 'hidden', borderRadius: 13, backgroundColor: '#fbf6ed' },
  materialAccent: { padding: 14, overflow: 'hidden' },
  materialEyebrow: { color: '#ffe1ca', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 8, letterSpacing: 1.1 },
  materialCompany: { color: '#fff4ea', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, marginTop: 10, maxWidth: '75%' },
  materialLogo: { position: 'absolute', top: 13, right: 13, width: 38, height: 38, borderRadius: 9, backgroundColor: '#fff', padding: 3 },
  materialInitial: { position: 'absolute', top: 13, right: 13, width: 38, height: 38, borderRadius: 9, backgroundColor: '#ffffff33', alignItems: 'center', justifyContent: 'center' },
  materialInitialText: { color: '#fff', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
  materialHeadline: { color: '#fff4ea', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, lineHeight: 24, marginTop: 25 },
  materialAbout: { color: '#ffe4d0', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, lineHeight: 14, marginTop: 8 },
  materialFooter: { color: '#ffe1ca', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, marginTop: 'auto' },
  materialBody: { flex: 1, padding: 12, backgroundColor: '#fbf6ed' },
  materialPhoto: { width: '100%', borderRadius: 10 },
  materialCaption: { position: 'absolute', bottom: 7, left: 8, right: 8, color: '#fff', backgroundColor: '#202a2dcc', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 4, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9 },
  materialPhotoStrip: { flexDirection: 'row', gap: 6, marginTop: 6 },
  materialPhotoTile: { flex: 1, position: 'relative' },
  materialPhotoSmall: { width: '100%', height: 42, borderRadius: 7 },
  materialCaptionSmall: { position: 'absolute', bottom: 3, left: 3, right: 3, color: '#fff', backgroundColor: '#202a2dcc', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 2, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 7 },
  materialPhotoEmpty: { width: '100%', backgroundColor: '#eadfd2', borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 5 },
  materialEmptyText: { color: '#927e6c', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10 },
  materialHeadlineVertical: { color: '#fff8ef', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, lineHeight: 25, marginTop: 14 },
  materialAboutVertical: { color: '#c8d0cd', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, lineHeight: 15, marginTop: 7 },
  materialBullets: { borderTopWidth: 1, borderTopColor: '#ffffff18', marginTop: 12, paddingTop: 10, gap: 5 },
  materialSectionLabel: { color: '#e76622', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 8, letterSpacing: 1, marginTop: 12 },
  materialBullet: { color: '#e1e6e4', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10 },
  materialContact: { color: '#d6ddda', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9, lineHeight: 14, marginTop: 4 },
  safeNote: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, lineHeight: 15, textAlign: 'center' },
});