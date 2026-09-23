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

const MATERIAL_PALETTE = {
  ink: '#111111',
  accent: '#2f2f2f',
  accentSoft: '#e5e5e5',
  surface: '#eeeeee',
  border: '#c6c6c6',
  muted: '#626262',
  white: '#fafafa',
};

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
    .filter(Boolean);
}

export default function CompanyMaterialsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = {
    ...Colors[colorScheme ?? 'light'],
    background: MATERIAL_PALETTE.surface,
    foreground: MATERIAL_PALETTE.ink,
    card: MATERIAL_PALETTE.white,
    cardForeground: MATERIAL_PALETTE.ink,
    primary: MATERIAL_PALETTE.accent,
    primaryForeground: MATERIAL_PALETTE.white,
    secondary: MATERIAL_PALETTE.accentSoft,
    secondaryForeground: MATERIAL_PALETTE.ink,
    muted: MATERIAL_PALETTE.accentSoft,
    mutedForeground: MATERIAL_PALETTE.muted,
    accent: MATERIAL_PALETTE.accentSoft,
    accentForeground: MATERIAL_PALETTE.ink,
    border: MATERIAL_PALETTE.border,
    input: MATERIAL_PALETTE.border,
  };
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

      <View style={[styles.hero, { backgroundColor: MATERIAL_PALETTE.ink }]}>
        <View style={[styles.heroOrb, { backgroundColor: MATERIAL_PALETTE.accent }]} />
        <Text style={[styles.eyebrow, { color: '#d1d5db' }]}>MATERIAIS DE DIVULGAÇÃO</Text>
        <Text style={styles.heroTitle}>Apresente seu trabalho com clareza.</Text>
        <Text style={styles.heroDescription}>
          Crie um cartão direto ou uma apresentação completa, sempre com seus dados seguros e sem informações de clientes.
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
          {updateCompany.isPending ? <ActivityIndicator color={theme.primaryForeground} /> : <Ionicons name="checkmark-circle-outline" size={19} color={theme.primaryForeground} />}
          <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>{updateCompany.isPending ? 'Salvando...' : 'Salvar textos'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.sectionHeading}>
          <View style={[styles.iconBubble, { backgroundColor: theme.accent }]}>
            <Ionicons name="images-outline" size={20} color={theme.primary} />
          </View>
          <View style={styles.headingCopy}>
            <Text style={[styles.cardTitle, { color: theme.foreground }]}>Fotos de apoio</Text>
            <Text style={[styles.cardSubtitle, { color: theme.mutedForeground }]}>
              Escolha até três fotos de O.S. para o final da apresentação. O cartão não usa fotos.
            </Text>
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
                  <View style={[styles.photoCheck, { backgroundColor: selected ? theme.primary : '#111111cc' }]}>
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
            <TouchableOpacity onPress={() => setPreviewKind('horizontal')} style={[styles.segmentButton, previewKind === 'horizontal' && { backgroundColor: theme.primary }]}>
              <Text style={[styles.segmentText, { color: previewKind === 'horizontal' ? theme.primaryForeground : theme.mutedForeground }]}>Cartão</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPreviewKind('vertical')} style={[styles.segmentButton, previewKind === 'vertical' && { backgroundColor: theme.primary }]}>
              <Text style={[styles.segmentText, { color: previewKind === 'vertical' ? theme.primaryForeground : theme.mutedForeground }]}>Apresentação</Text>
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
          {isSharing ? <ActivityIndicator color={theme.primaryForeground} /> : <Ionicons name="share-outline" size={19} color={theme.primaryForeground} />}
          <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>{isSharing ? 'Preparando imagem...' : 'Compartilhar PNG'}</Text>
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
  const horizontal = kind === 'horizontal';

  const slate = MATERIAL_PALETTE.ink;
  const accent = MATERIAL_PALETTE.accent;
  const accentLight = MATERIAL_PALETTE.accentSoft;
  const borderSubtle = MATERIAL_PALETTE.border;
  const muted = MATERIAL_PALETTE.muted;
  const heading = MATERIAL_PALETTE.ink;

  const contact = [company.phone, company.email, company.website].filter(Boolean);
  const serviceBullets = splitItems(services);
  const differentialBullets = splitItems(differentials);

  // ── HORIZONTAL: Cartão de visitas (company info only, no photos) ──
  if (horizontal) {
    return (
      <View style={[matStyles.card, { width, height: width * 0.56, backgroundColor: MATERIAL_PALETTE.surface, borderColor: borderSubtle }]}>
        {/* Top accent line */}
        <View style={[matStyles.accentLine, { backgroundColor: accent }]} />

        {/* Logo / initial */}
        <View style={matStyles.cardHeader}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={matStyles.logo} contentFit="contain" />
          ) : (
            <View style={[matStyles.logoPlaceholder, { backgroundColor: accentLight }]}>
              <Text style={[matStyles.logoInitial, { color: accent }]}>{company.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={matStyles.cardHeaderCopy}>
            <Text style={[matStyles.companyName, { color: heading }]} numberOfLines={1}>{company.name}</Text>
            {(headline.trim() || 'Trabalho bem feito, do seu jeito.') && (
              <Text style={[matStyles.tagline, { color: accent }]} numberOfLines={2}>
                {headline.trim() || 'Trabalho bem feito, do seu jeito.'}
              </Text>
            )}
          </View>
        </View>

        {/* About */}
        <Text style={[matStyles.aboutText, { color: muted }]} numberOfLines={3}>
          {about.trim() || 'Serviços cuidadosos, comunicação clara e compromisso com cada entrega.'}
        </Text>

        {/* Divider */}
        <View style={[matStyles.divider, { backgroundColor: borderSubtle }]} />

        {/* Contact */}
        <View style={matStyles.contactBlock}>
          {contact.map((item, i) => (
            <Text key={`${item}-${i}`} style={[matStyles.contactLine, { color: slate }]} numberOfLines={1}>
              {item}
            </Text>
          ))}
          {company.address && (
            <Text style={[matStyles.contactLine, { color: slate }]} numberOfLines={1}>
              {company.address}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // ── VERTICAL: Apresentação (company info FIRST, photos LAST) ──
  return (
      <View style={[matStyles.presentation, { width, backgroundColor: MATERIAL_PALETTE.surface, borderColor: borderSubtle }]}>
      {/* Header */}
        <View style={[matStyles.presHeader, { backgroundColor: heading }]}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={matStyles.presLogo} contentFit="contain" />
        ) : (
            <View style={[matStyles.presLogoPlaceholder, { backgroundColor: accent }]}>
            <Text style={[matStyles.presLogoInitial, { color: MATERIAL_PALETTE.white }]}>{company.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={matStyles.presCompanyName}>{company.name}</Text>
      </View>

      <View style={[matStyles.presBody, { backgroundColor: MATERIAL_PALETTE.surface }]}>
        {/* 1. Headline */}
        <Text style={[matStyles.presHeadline, { color: heading }]}>
          {headline.trim() || 'Serviços com cuidado e clareza.'}
        </Text>

        {/* 2. About / Quem somos */}
        <View style={[matStyles.presSection, { borderBottomColor: borderSubtle }]}>
          <Text style={[matStyles.presSectionLabel, { color: accent }]}>QUEM SOMOS</Text>
          <Text style={[matStyles.presAboutText, { color: slate }]}>
            {about.trim() || 'Conheça meu trabalho e vamos encontrar o melhor caminho juntos.'}
          </Text>
        </View>

        {/* 3. Services */}
        <View style={[matStyles.presSection, { borderBottomColor: borderSubtle }]}>
          <Text style={[matStyles.presSectionLabel, { color: accent }]}>SERVIÇOS</Text>
          {(serviceBullets.length ? serviceBullets : ['Atendimento sob medida', 'Execução cuidadosa']).map((bullet, index) => (
            <View key={`${bullet}-${index}`} style={matStyles.presBulletRow}>
              <View style={[matStyles.presBulletDot, { backgroundColor: accent }]} />
              <Text style={[matStyles.presBulletText, { color: slate }]}>{bullet}</Text>
            </View>
          ))}
        </View>

        {/* 4. Differentials */}
        <View style={[matStyles.presSection, { borderBottomColor: borderSubtle }]}>
          <Text style={[matStyles.presSectionLabel, { color: accent }]}>DIFERENCIAIS</Text>
          {(differentialBullets.length ? differentialBullets : ['Orçamento transparente', 'Atenção aos detalhes']).slice(0, 4).map((bullet, index) => (
            <View key={`${bullet}-${index}`} style={matStyles.presBulletRow}>
              <View style={[matStyles.presBulletDot, { backgroundColor: accent }]} />
              <Text style={[matStyles.presBulletText, { color: slate }]}>{bullet}</Text>
            </View>
          ))}
        </View>

        {/* 5. Contact */}
        <View style={[matStyles.presSection, selectedPhotos.length === 0 ? undefined : { borderBottomColor: borderSubtle }]}>
          <Text style={[matStyles.presSectionLabel, { color: accent }]}>CONTATO</Text>
          {contact.map((item, i) => (
            <Text key={`c-${i}`} style={[matStyles.presContactLine, { color: slate }]}>{item}</Text>
          ))}
          {company.address && (
            <Text style={[matStyles.presContactLine, { color: slate }]}>{company.address}</Text>
          )}
        </View>

        {/* 6. Compact supporting photos, only in the presentation */}
        {selectedPhotos.length > 0 && (
          <View style={matStyles.presPhotosSection}>
            <Text style={[matStyles.presSectionLabel, { color: accent, marginBottom: 3 }]}>TRABALHOS REALIZADOS</Text>
            <Text style={[matStyles.presPhotosIntro, { color: muted }]}>Registros selecionados de ordens de serviço.</Text>
            <View style={matStyles.presPhotoGrid}>
              {selectedPhotos.map((photo) => {
                const uri = getStorageUrl(photo.url);
                if (!uri) return null;
                return (
                  <View key={photo.id} style={matStyles.presPhotoBlock}>
                    <Image source={{ uri }} style={[matStyles.presPhoto, { height: Math.min(86, width * 0.2) }]} contentFit="cover" />
                    {!!photo.caption && (
                      <Text style={[matStyles.presPhotoCaption, { color: muted }]} numberOfLines={2}>{photo.caption}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={matStyles.presFooter}>
          <Text style={[matStyles.presFooterText, { color: muted }]}>
            {company.name} · {new Date().getFullYear()}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  backText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  hero: { borderRadius: 20, padding: 24, overflow: 'hidden' },
  heroOrb: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -72, top: -88, opacity: 0.72 },
  eyebrow: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 1.4, marginBottom: 12 },
  heroTitle: { color: '#f5f5f5', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 25, lineHeight: 31, maxWidth: 310 },
  heroDescription: { color: '#c7c7c7', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 20, marginTop: 10 },
  card: { borderRadius: 18, borderWidth: 1, padding: 17, gap: 15 },
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
  primaryButtonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
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
  safeNote: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, lineHeight: 15, textAlign: 'center' },
});

// ── Modern preview styles ──
const matStyles = StyleSheet.create({
  // ── Horizontal card (Cartão de visitas) ──
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  accentLine: {
    height: 3,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  logoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
  },
  cardHeaderCopy: {
    flex: 1,
  },
  companyName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  tagline: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  aboutText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 10,
    lineHeight: 15,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  divider: {
    height: 1,
    marginHorizontal: 18,
    marginTop: 12,
  },
  contactBlock: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 3,
  },
  contactLine: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 9,
    lineHeight: 13,
  },

  // ── Vertical presentation (Apresentação) ──
  presentation: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  presHeader: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 12,
  },
  presLogo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: MATERIAL_PALETTE.white,
    padding: 4,
  },
  presLogoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presLogoInitial: {
    color: '#ffffff',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
  },
  presCompanyName: {
    color: '#ffffff',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  presBody: {
    padding: 20,
  },
  presHeadline: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  presSection: {
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginTop: 4,
  },
  presSectionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  presAboutText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    lineHeight: 19,
  },
  presBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  presBulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    flexShrink: 0,
  },
  presBulletText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  presContactLine: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 2,
  },
  presPhotosSection: {
    paddingTop: 16,
  },
  presPhotosIntro: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 9,
    lineHeight: 13,
    marginBottom: 9,
  },
  presPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presPhotoBlock: {
    width: '31.5%',
  },
  presPhoto: {
    width: '100%',
    borderRadius: 8,
  },
  presPhotoCaption: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 8,
    lineHeight: 11,
    marginTop: 4,
  },
  presFooter: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 4,
  },
  presFooterText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 9,
    letterSpacing: 0.5,
  },
});