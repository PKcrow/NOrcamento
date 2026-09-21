import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import JSZip from 'jszip';
import {
  useCreateCompanyDocument,
  useDeleteCompanyDocument,
  useGetCompany,
  useListCompanyDocuments,
  useRequestUploadUrl,
  useUpdateCompany,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

type ZipEntry = {
  name: string;
  bytes: number[];
};

type ShareProgress = {
  phase: string;
  detail: string;
  percent: number;
  etaSeconds: number | null;
};

type DocumentTypeFilter = 'all' | 'pdf' | 'image' | 'document' | 'other';

const DOCUMENT_TYPE_FILTERS: Array<{ value: DocumentTypeFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Imagens' },
  { value: 'document', label: 'Documentos' },
  { value: 'other', label: 'Outros' },
];

function getDocumentTypeFilter(contentType: string | null | undefined, fileName: string | null | undefined): Exclude<DocumentTypeFilter, 'all'> {
  const normalizedType = (contentType ?? '').toLowerCase();
  const normalizedName = (fileName ?? '').toLowerCase();
  if (normalizedType === 'application/pdf' || normalizedName.endsWith('.pdf')) return 'pdf';
  if (normalizedType.startsWith('image/')) return 'image';
  if (
    normalizedType.startsWith('text/') ||
    normalizedType.includes('word') ||
    normalizedType.includes('excel') ||
    normalizedType.includes('spreadsheet') ||
    normalizedType.includes('presentation') ||
    normalizedType.includes('opendocument')
  ) {
    return 'document';
  }
  return 'other';
}

function decodeBase64(value: string): number[] {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const input = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];
  for (let index = 0; index < input.length; index += 4) {
    const a = alphabet.indexOf(input[index] ?? '');
    const b = alphabet.indexOf(input[index + 1] ?? '');
    const c = alphabet.indexOf(input[index + 2] ?? '');
    const d = alphabet.indexOf(input[index + 3] ?? '');
    if (a < 0 || b < 0) continue;
    bytes.push((a << 2) | (b >> 4));
    if (c >= 0) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d >= 0) bytes.push(((c & 3) << 6) | d);
  }
  return bytes;
}

async function createZipBase64(
  entries: ZipEntry[],
  onProgress: (progress: number) => void,
): Promise<string> {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.name, new Uint8Array(entry.bytes));
  }
  return zip.generateAsync(
    { type: 'base64', compression: 'STORE' },
    (metadata) => onProgress(metadata.percent / 100),
  );
}

function formatEta(seconds: number | null): string {
  if (seconds === null) return 'Calculando tempo restante...';
  if (seconds < 60) return `Aproximadamente ${Math.max(1, seconds)}s restantes`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `Aproximadamente ${minutes}min${remainingSeconds ? ` ${remainingSeconds}s` : ''} restantes`;
}

function sanitizeFileNamePart(value: string | null | undefined, fallback: string): string {
  const sanitized = (value ?? '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '');
  return sanitized || fallback;
}

function formatFileDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function createSecureFileSuffix(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(12);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getStorageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return null;

  const path = value.startsWith('/objects/')
    ? `/api/storage${value}`
    : value.startsWith('/')
      ? value
      : `/${value}`;
  return `https://${domain}${path}`;
}

async function uploadLogoFile(uploadURL: string, fileUri: string, contentType: string): Promise<void> {
  if (Platform.OS === 'web') {
    const sourceResponse = await fetch(fileUri);
    if (!sourceResponse.ok) throw new Error('Could not read selected logo');

    const fileBlob = await sourceResponse.blob();
    const uploadResponse = await fetch(uploadURL, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: fileBlob,
    });
    if (!uploadResponse.ok) throw new Error(`Logo upload failed with status ${uploadResponse.status}`);
    return;
  }

  const uploaded = await FileSystem.uploadAsync(uploadURL, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });
  if (uploaded.status < 200 || uploaded.status >= 300) {
    throw new Error(`Logo upload failed with status ${uploaded.status}`);
  }
}

export default function EmpresaScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useGetCompany();
  const { mutate: updateCompany, mutateAsync: updateCompanyAsync, isPending } = useUpdateCompany();
  const { data: documents, isLoading: documentsLoading } = useListCompanyDocuments();
  const { mutateAsync: requestUploadUrl } = useRequestUploadUrl();
  const { mutateAsync: createDocument } = useCreateCompanyDocument();
  const { mutateAsync: deleteDocument } = useDeleteCompanyDocument();
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [isSharingDocuments, setIsSharingDocuments] = useState(false);
  const [shareProgress, setShareProgress] = useState<ShareProgress | null>(null);
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<DocumentTypeFilter>('all');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [website, setWebsite] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [marketingHeadline, setMarketingHeadline] = useState('');
  const [marketingAbout, setMarketingAbout] = useState('');
  const [marketingServices, setMarketingServices] = useState('');
  const [marketingDifferentials, setMarketingDifferentials] = useState('');
  const [visibility, setVisibility] = useState({
    phone: true, email: true, address: true, legalName: false, taxId: false,
    website: false, pixKey: false, bankDetails: false, paymentInstructions: false, additionalInfo: false,
  });
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreviewUri, setLogoPreviewUri] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (company) {
      setName(company.name ?? '');
      setPhone(company.phone ?? '');
      setEmail(company.email ?? '');
      setAddress(company.address ?? '');
      setLegalName(company.legalName ?? '');
      setTaxId(company.taxId ?? '');
      setWebsite(company.website ?? '');
      setPixKey(company.pixKey ?? '');
      setBankDetails(company.bankDetails ?? '');
      setPaymentInstructions(company.paymentInstructions ?? '');
      setAdditionalInfo(company.additionalInfo ?? '');
      setMarketingHeadline(company.marketingHeadline ?? '');
      setMarketingAbout(company.marketingAbout ?? '');
      setMarketingServices(company.marketingServices ?? '');
      setMarketingDifferentials(company.marketingDifferentials ?? '');
      setVisibility({
        phone: company.showPhoneOnQuotes,
        email: company.showEmailOnQuotes,
        address: company.showAddressOnQuotes,
        legalName: company.showLegalNameOnQuotes,
        taxId: company.showTaxIdOnQuotes,
        website: company.showWebsiteOnQuotes,
        pixKey: company.showPixKeyOnQuotes,
        bankDetails: company.showBankDetailsOnQuotes,
        paymentInstructions: company.showPaymentInstructionsOnQuotes,
        additionalInfo: company.showAdditionalInfoOnQuotes,
      });
    }
  }, [company]);

  const effectiveLogoUri =
    logoPreviewUri !== undefined ? logoPreviewUri : getStorageUrl(company?.logoUrl);

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = documentSearch.trim().toLowerCase();
    return (documents ?? []).filter((document) => {
      const matchesSearch =
        !normalizedSearch ||
        document.name.toLowerCase().includes(normalizedSearch) ||
        document.fileName.toLowerCase().includes(normalizedSearch);
      const matchesType =
        documentTypeFilter === 'all' ||
        getDocumentTypeFilter(document.contentType, document.fileName) === documentTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [documents, documentSearch, documentTypeFilter]);

  const handleSelectLogo = async () => {
    if (isUploadingLogo || isPending) return;

    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        const settingsAction = !permission.canAskAgain
          ? [{ text: 'Abrir ajustes', onPress: () => void Linking.openSettings() }]
          : [];
        Alert.alert(
          'Permissão necessária',
          'Permita o acesso às fotos para escolher o logo da empresa.',
          [{ text: 'Cancelar', style: 'cancel' }, ...settingsAction],
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const contentType = asset.mimeType ?? 'image/jpeg';
    const size = asset.fileSize ?? 1;
    const previewUri = asset.uri;
    const previousLogoUri = getStorageUrl(company?.logoUrl);
    setLogoPreviewUri(previewUri);
    setIsUploadingLogo(true);

    try {
      const upload = await requestUploadUrl({
        data: {
          name: asset.fileName ?? `logo-${Date.now()}.jpg`,
          size,
          contentType,
        },
      });
      await uploadLogoFile(upload.uploadURL, asset.uri, contentType);

      const logoUrl = getStorageUrl(upload.objectPath);
      if (!logoUrl) throw new Error('Storage domain is not configured');

      await updateCompanyAsync({ data: { logoUrl } });
      setLogoPreviewUri(undefined);
      queryClient.invalidateQueries();
      Alert.alert('Logo atualizado', 'O logo da empresa foi salvo.');
    } catch (error) {
      console.error('Logo upload failed', error);
      setLogoPreviewUri(previousLogoUri);
      Alert.alert('Erro', 'Não foi possível enviar o logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    if (isUploadingLogo || isPending || !company?.logoUrl) return;
    const previousLogoUri = getStorageUrl(company.logoUrl);
    setLogoPreviewUri(null);
    updateCompany(
      { data: { logoUrl: null } },
      {
        onSuccess: () => {
          setLogoPreviewUri(undefined);
          queryClient.invalidateQueries();
          Alert.alert('Logo removido', 'O logo da empresa foi removido.');
        },
        onError: () => {
          setLogoPreviewUri(previousLogoUri);
          Alert.alert('Erro', 'Não foi possível remover o logo.');
        },
      },
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome da empresa.');
      return;
    }
    updateCompany(
      {
        data: {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          legalName: legalName.trim() || null,
          taxId: taxId.trim() || null,
          website: website.trim() || null,
          pixKey: pixKey.trim() || null,
          bankDetails: bankDetails.trim() || null,
          paymentInstructions: paymentInstructions.trim() || null,
          additionalInfo: additionalInfo.trim() || null,
          marketingHeadline: marketingHeadline.trim() || null,
          marketingAbout: marketingAbout.trim() || null,
          marketingServices: marketingServices.trim() || null,
          marketingDifferentials: marketingDifferentials.trim() || null,
          showPhoneOnQuotes: visibility.phone,
          showEmailOnQuotes: visibility.email,
          showAddressOnQuotes: visibility.address,
          showLegalNameOnQuotes: visibility.legalName,
          showTaxIdOnQuotes: visibility.taxId,
          showWebsiteOnQuotes: visibility.website,
          showPixKeyOnQuotes: visibility.pixKey,
          showBankDetailsOnQuotes: visibility.bankDetails,
          showPaymentInstructionsOnQuotes: visibility.paymentInstructions,
          showAdditionalInfoOnQuotes: visibility.additionalInfo,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          Alert.alert('Salvo!', 'Dados da empresa atualizados.');
        },
        onError: () => Alert.alert('Erro', 'Não foi possível salvar.'),
      }
    );
  };

  const handleAddDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const size = asset.size ?? 1;
    const contentType = asset.mimeType ?? 'application/octet-stream';
    setIsUploadingDocument(true);
    try {
      const upload = await requestUploadUrl({
        data: { name: asset.name, size, contentType },
      });
      const uploaded = await FileSystem.uploadAsync(upload.uploadURL, asset.uri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': contentType },
      });
      if (uploaded.status < 200 || uploaded.status >= 300) {
        throw new Error('Upload failed');
      }

      await createDocument({
        data: {
          name: asset.name,
          documentType: 'Documento da empresa',
          fileName: asset.name,
          objectPath: upload.objectPath,
          contentType,
          size,
        },
      });
      queryClient.invalidateQueries();
      Alert.alert('Documento salvo', 'O arquivo foi adicionado aos documentos da empresa.');
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar esse documento.');
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleShareDocument = async (document: NonNullable<typeof documents>[number]) => {
    if (!FileSystem.cacheDirectory) {
      Alert.alert('Erro', 'O armazenamento temporário do aparelho não está disponível.');
      return;
    }
    try {
      const safeName = document.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const localUri = `${FileSystem.cacheDirectory}norcamento-${document.id}-${safeName}`;
      const url = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/storage${document.objectPath}`;
      await FileSystem.downloadAsync(url, localUri);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Compartilhamento indisponível', 'Este aparelho não permite compartilhar arquivos.');
        return;
      }
      await Sharing.shareAsync(localUri, {
        mimeType: document.contentType,
        dialogTitle: `Compartilhar ${document.name}`,
        UTI: document.contentType,
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o compartilhamento.');
    }
  };

  const toggleDocumentSelection = (documentId: number) => {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  };

  const handleSelectAllDocuments = () => {
    if (!filteredDocuments.length) return;
    const visibleIds = new Set(filteredDocuments.map((document) => document.id));
    setSelectedDocumentIds((current) =>
      filteredDocuments.every((document) => current.includes(document.id))
        ? current.filter((id) => !visibleIds.has(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  };

  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedDocumentIds([]);
    }
    setIsSelectionMode((current) => !current);
  };

  const handleShareSelectedDocuments = async () => {
    const selectedDocuments = documents?.filter((document) => selectedDocumentIds.includes(document.id)) ?? [];
    if (!selectedDocuments.length) {
      Alert.alert('Selecione os documentos', 'Escolha pelo menos um documento para compartilhar.');
      return;
    }
    if (selectedDocuments.length === 1) {
      setIsSharingDocuments(true);
      try {
        await handleShareDocument(selectedDocuments[0]);
        setSelectedDocumentIds([]);
      } finally {
        setIsSharingDocuments(false);
      }
      return;
    }
    if (!FileSystem.cacheDirectory) {
      Alert.alert('Erro', 'O armazenamento temporário do aparelho não está disponível.');
      return;
    }

    const startedAt = Date.now();
    let lastProgressUpdate = 0;
    const publishProgress = (phase: string, detail: string, progress: number, force = false) => {
      const now = Date.now();
      if (!force && progress < 1 && now - lastProgressUpdate < 100) return;
      lastProgressUpdate = now;
      const boundedProgress = Math.max(0, Math.min(1, progress));
      const elapsedSeconds = (now - startedAt) / 1000;
      const etaSeconds = boundedProgress > 0 && boundedProgress < 1
        ? Math.max(1, Math.ceil((elapsedSeconds * (1 - boundedProgress)) / boundedProgress))
        : null;
      setShareProgress({
        phase,
        detail,
        percent: Math.round(boundedProgress * 100),
        etaSeconds,
      });
    };

    setIsSharingDocuments(true);
    publishProgress('Baixando documentos', `0 de ${selectedDocuments.length} documentos`, 0, true);
    try {
      const usedNames = new Set<string>();
      const entries: ZipEntry[] = [];
      for (let index = 0; index < selectedDocuments.length; index += 1) {
        const document = selectedDocuments[index];
        publishProgress(
          'Baixando documentos',
          `${index + 1} de ${selectedDocuments.length}: ${document.name}`,
          (index / selectedDocuments.length) * 0.4,
          true,
        );
        const safeName = document.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const localUri = `${FileSystem.cacheDirectory}norcamento-${document.id}-${safeName}`;
        const url = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/storage${document.objectPath}`;
        const downloaded = await FileSystem.downloadAsync(url, localUri);
        if (downloaded.status < 200 || downloaded.status >= 300) {
          throw new Error(`Falha ao baixar ${document.name}`);
        }

        let zipName = safeName || `documento-${document.id}`;
        let suffix = 2;
        while (usedNames.has(zipName)) {
          const dotIndex = zipName.lastIndexOf('.');
          zipName = dotIndex > 0
            ? `${zipName.slice(0, dotIndex)}-${suffix}${zipName.slice(dotIndex)}`
            : `${zipName}-${suffix}`;
          suffix += 1;
        }
        usedNames.add(zipName);

        const content = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
        entries.push({ name: zipName, bytes: decodeBase64(content) });
        publishProgress(
          'Baixando documentos',
          `${index + 1} de ${selectedDocuments.length} documentos baixados`,
          ((index + 1) / selectedDocuments.length) * 0.4,
          true,
        );
      }

      const companyName = sanitizeFileNamePart(company?.name, 'empresa');
      const date = formatFileDate(new Date());
      const secureSuffix = await createSecureFileSuffix();
      const zipFileName = `${companyName}-documentos-${date}-${secureSuffix}.zip`;
      const zipUri = `${FileSystem.cacheDirectory}${zipFileName}`;
      publishProgress('Compactando ZIP', 'Preparando os arquivos selecionados...', 0.4, true);
      const zipBase64 = await createZipBase64(entries, (progress) => {
        publishProgress('Compactando ZIP', 'Gerando o arquivo ZIP...', 0.4 + progress * 0.55);
      });
      publishProgress('Finalizando', 'Preparando o compartilhamento...', 0.96, true);
      await FileSystem.writeAsStringAsync(zipUri, zipBase64, { encoding: 'base64' });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Compartilhamento indisponível', 'Este aparelho não permite compartilhar arquivos.');
        return;
      }
      publishProgress('Finalizando', 'Abrindo o compartilhamento...', 0.99, true);
      await Sharing.shareAsync(zipUri, {
        mimeType: 'application/zip',
        dialogTitle: `Compartilhar ${entries.length} documentos`,
        UTI: 'public.zip-archive',
      });
      setSelectedDocumentIds([]);
    } catch {
      Alert.alert('Erro', 'Não foi possível preparar os documentos para compartilhamento.');
    } finally {
      setIsSharingDocuments(false);
      setShareProgress(null);
    }
  };

  const handleDeleteDocument = (document: NonNullable<typeof documents>[number]) => {
    Alert.alert(
      'Excluir documento',
      `Remover "${document.name}" dos documentos da empresa?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocument({ id: document.id });
              queryClient.invalidateQueries();
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir o documento.');
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const Field = ({
    label,
    value,
    onChange,
    placeholder,
    keyboardType,
    icon,
    visibleOnQuotes,
    onVisibleChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    keyboardType?: any;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    visibleOnQuotes?: boolean;
    onVisibleChange?: (value: boolean) => void;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: theme.mutedForeground }]}>{label}</Text>
      <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Ionicons name={icon} size={18} color={theme.mutedForeground} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: theme.foreground }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.mutedForeground}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        />
      </View>
      {onVisibleChange ? (
        <View style={styles.visibilityRow}>
          <Text style={[styles.visibilityText, { color: theme.mutedForeground }]}>Mostrar nos orçamentos e PDFs</Text>
          <Switch value={visibleOnQuotes} onValueChange={onVisibleChange} trackColor={{ true: theme.primary }} />
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.infoBox, { backgroundColor: theme.primary + '11', borderColor: theme.primary + '33' }]}>
        <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
        <Text style={[styles.infoText, { color: theme.primary }]}>
          Esses dados aparecem nos orçamentos impressos enviados aos clientes.
        </Text>
      </View>

      <View style={styles.logoSection}>
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Logo da empresa</Text>
        <View style={styles.logoRow}>
          <View style={[styles.logoPreview, { borderColor: theme.border, backgroundColor: theme.card }]}>
            {effectiveLogoUri ? (
              <Image
                source={{ uri: effectiveLogoUri }}
                style={styles.logoImage}
                contentFit="contain"
                accessibilityLabel="Logo da empresa"
              />
            ) : (
              <Ionicons name="business-outline" size={30} color={theme.mutedForeground} />
            )}
          </View>
          <View style={styles.logoActions}>
            <Text style={[styles.logoHint, { color: theme.mutedForeground }]}>
              PNG, JPG, WEBP ou SVG. Uma imagem quadrada deixa o cabeçalho do orçamento mais consistente.
            </Text>
            <View style={styles.logoButtons}>
              <TouchableOpacity
                style={[styles.logoButton, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={handleSelectLogo}
                disabled={isUploadingLogo || isPending}
              >
                {isUploadingLogo ? (
                  <ActivityIndicator color={theme.primary} size="small" />
                ) : (
                  <Ionicons name="image-outline" size={17} color={theme.primary} />
                )}
                <Text style={[styles.logoButtonText, { color: theme.primary }]}>
                  {effectiveLogoUri ? 'Trocar logo' : 'Escolher logo'}
                </Text>
              </TouchableOpacity>
              {!!effectiveLogoUri && (
                <TouchableOpacity
                  style={styles.removeLogoButton}
                  onPress={handleRemoveLogo}
                  disabled={isUploadingLogo || isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Remover logo"
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>

      <Field label="Nome da empresa *" value={name} onChange={setName} placeholder="Ex: Elétrica Silva Ltda" icon="business-outline" />
      <Field label="Razão social" value={legalName} onChange={setLegalName} placeholder="Nome empresarial completo" icon="document-text-outline" visibleOnQuotes={visibility.legalName} onVisibleChange={(value) => setVisibility((current) => ({ ...current, legalName: value }))} />
      <Field label="CPF ou CNPJ" value={taxId} onChange={setTaxId} placeholder="00.000.000/0001-00" icon="card-outline" visibleOnQuotes={visibility.taxId} onVisibleChange={(value) => setVisibility((current) => ({ ...current, taxId: value }))} />
      <Field label="Telefone" value={phone} onChange={setPhone} placeholder="(11) 99999-9999" keyboardType="phone-pad" icon="call-outline" visibleOnQuotes={visibility.phone} onVisibleChange={(value) => setVisibility((current) => ({ ...current, phone: value }))} />
      <Field label="E-mail" value={email} onChange={setEmail} placeholder="contato@empresa.com" keyboardType="email-address" icon="mail-outline" visibleOnQuotes={visibility.email} onVisibleChange={(value) => setVisibility((current) => ({ ...current, email: value }))} />

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Endereço</Text>
        <View style={[styles.textareaRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Ionicons name="location-outline" size={18} color={theme.mutedForeground} style={styles.inputIcon} />
          <TextInput
            style={[styles.textarea, { color: theme.foreground }]}
            value={address}
            onChangeText={setAddress}
            placeholder="Rua, número, bairro, cidade - UF"
            placeholderTextColor={theme.mutedForeground}
            multiline
            numberOfLines={2}
          />
        </View>
        <View style={styles.visibilityRow}>
          <Text style={[styles.visibilityText, { color: theme.mutedForeground }]}>Mostrar nos orçamentos e PDFs</Text>
          <Switch value={visibility.address} onValueChange={(value) => setVisibility((current) => ({ ...current, address: value }))} trackColor={{ true: theme.primary }} />
        </View>
      </View>

      <Field label="Site ou rede social" value={website} onChange={setWebsite} placeholder="www.suaempresa.com.br" icon="globe-outline" visibleOnQuotes={visibility.website} onVisibleChange={(value) => setVisibility((current) => ({ ...current, website: value }))} />
      <Field label="Chave Pix" value={pixKey} onChange={setPixKey} placeholder="CPF, CNPJ, e-mail, telefone ou chave" icon="qr-code-outline" visibleOnQuotes={visibility.pixKey} onVisibleChange={(value) => setVisibility((current) => ({ ...current, pixKey: value }))} />
      <Field label="Dados bancários" value={bankDetails} onChange={setBankDetails} placeholder="Banco, agência, conta e favorecido" icon="wallet-outline" visibleOnQuotes={visibility.bankDetails} onVisibleChange={(value) => setVisibility((current) => ({ ...current, bankDetails: value }))} />
      <Field label="Instruções de pagamento" value={paymentInstructions} onChange={setPaymentInstructions} placeholder="Ex: 50% na aprovação e 50% na conclusão" icon="cash-outline" visibleOnQuotes={visibility.paymentInstructions} onVisibleChange={(value) => setVisibility((current) => ({ ...current, paymentInstructions: value }))} />
      <Field label="Outras informações" value={additionalInfo} onChange={setAdditionalInfo} placeholder="Informações relevantes para seus clientes" icon="information-circle-outline" visibleOnQuotes={visibility.additionalInfo} onVisibleChange={(value) => setVisibility((current) => ({ ...current, additionalInfo: value }))} />

      <View style={[styles.marketingSection, { backgroundColor: theme.primary + '0d', borderColor: theme.primary + '2b' }]}>
        <View style={styles.marketingHeading}>
          <Ionicons name="sparkles-outline" size={19} color={theme.primary} />
          <View style={styles.marketingHeadingCopy}>
            <Text style={[styles.marketingTitle, { color: theme.foreground }]}>Conteúdo para divulgação</Text>
            <Text style={[styles.marketingSubtitle, { color: theme.mutedForeground }]}>
              Estes textos aparecem somente nos materiais de divulgação.
            </Text>
          </View>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.mutedForeground }]}>Frase principal</Text>
          <TextInput style={[styles.textarea, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card }]} value={marketingHeadline} onChangeText={setMarketingHeadline} placeholder="Ex: Reparos com segurança e capricho" placeholderTextColor={theme.mutedForeground} maxLength={120} />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.mutedForeground }]}>Quem somos</Text>
          <TextInput style={[styles.textarea, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card }]} value={marketingAbout} onChangeText={setMarketingAbout} placeholder="Conte sua experiência e o que valoriza em cada serviço." placeholderTextColor={theme.mutedForeground} multiline numberOfLines={4} maxLength={600} />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.mutedForeground }]}>Serviços</Text>
          <TextInput style={[styles.textarea, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card }]} value={marketingServices} onChangeText={setMarketingServices} placeholder="Ex.:\n• Instalações\n• Manutenção" placeholderTextColor={theme.mutedForeground} multiline numberOfLines={4} maxLength={400} />
        </View>
        <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
          <Text style={[styles.label, { color: theme.mutedForeground }]}>Diferenciais</Text>
          <TextInput style={[styles.textarea, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card }]} value={marketingDifferentials} onChangeText={setMarketingDifferentials} placeholder="Ex.:\n• Prazo combinado\n• Orçamento transparente" placeholderTextColor={theme.mutedForeground} multiline numberOfLines={4} maxLength={400} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: theme.primary }, isPending && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>Salvar dados</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.documentsSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Documentos da empresa</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.mutedForeground }]}>
              CCMEI, cartão MEI, dados de pagamento e outros arquivos importantes.
            </Text>
          </View>
          <View style={styles.sectionHeaderActions}>
            {!!documents?.length && (
              <TouchableOpacity
                style={[styles.selectMultipleButton, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={handleToggleSelectionMode}
                disabled={isSharingDocuments}
              >
                <Ionicons
                  name={isSelectionMode ? 'close-outline' : 'checkbox-outline'}
                  size={17}
                  color={theme.primary}
                />
                <Text style={[styles.selectMultipleText, { color: theme.primary }]}>
                  {isSelectionMode ? 'Cancelar' : 'Selecionar vários'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
                style={[styles.addDocumentBtn, { backgroundColor: theme.primary }]}
              onPress={handleAddDocument}
                disabled={isUploadingDocument || isSharingDocuments}
            >
              {isUploadingDocument ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="add" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {documentsLoading ? (
          <ActivityIndicator color={theme.primary} style={styles.documentsLoader} />
        ) : documents?.length ? (
          <>
            <View style={styles.documentFilters}>
              <View style={[styles.documentSearchRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Ionicons name="search-outline" size={18} color={theme.mutedForeground} />
                <TextInput
                  style={[styles.documentSearchInput, { color: theme.foreground }]}
                  value={documentSearch}
                  onChangeText={setDocumentSearch}
                  placeholder="Buscar por nome ou arquivo"
                  placeholderTextColor={theme.mutedForeground}
                  returnKeyType="search"
                />
                {!!documentSearch && (
                  <TouchableOpacity onPress={() => setDocumentSearch('')} accessibilityLabel="Limpar busca">
                    <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.documentFilterRow}>
                {DOCUMENT_TYPE_FILTERS.map((filter) => {
                  const isActive = documentTypeFilter === filter.value;
                  return (
                    <TouchableOpacity
                      key={filter.value}
                      style={[
                        styles.documentFilterChip,
                        { borderColor: theme.border, backgroundColor: theme.card },
                        isActive && { borderColor: theme.primary, backgroundColor: theme.primary + '16' },
                      ]}
                      onPress={() => setDocumentTypeFilter(filter.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={[styles.documentFilterChipText, { color: isActive ? theme.primary : theme.mutedForeground }]}>
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            {isSelectionMode && (
              <View style={styles.bulkActions}>
                <TouchableOpacity
                  onPress={handleSelectAllDocuments}
                  style={styles.selectAllButton}
                  disabled={isSharingDocuments}
                >
                  <Ionicons
                    name={filteredDocuments.length > 0 && filteredDocuments.every((document) => selectedDocumentIds.includes(document.id))
                      ? 'checkmark-circle'
                      : 'ellipse-outline'}
                    size={18}
                    color={theme.primary}
                  />
                  <Text style={[styles.selectAllText, { color: theme.primary }]}>
                    {filteredDocuments.length > 0 && filteredDocuments.every((document) => selectedDocumentIds.includes(document.id))
                      ? 'Desmarcar visíveis'
                      : 'Selecionar visíveis'}
                  </Text>
                </TouchableOpacity>
                {selectedDocumentIds.length > 0 && (
                  <TouchableOpacity
                    onPress={handleShareSelectedDocuments}
                    style={[
                      styles.shareSelectedButton,
                      {
                        backgroundColor: isSharingDocuments ? theme.mutedForeground : theme.primary,
                      },
                    ]}
                    disabled={isSharingDocuments}
                  >
                    {isSharingDocuments ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Ionicons name="share-outline" size={17} color="#fff" />
                    )}
                    <Text style={styles.shareSelectedText}>
                      Compartilhar ({selectedDocumentIds.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {filteredDocuments.length ? (
              <View style={[styles.documentsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {filteredDocuments.map((document) => {
                const isSelected = selectedDocumentIds.includes(document.id);
                return (
                  <TouchableOpacity
                    key={document.id}
                    style={[
                      styles.documentRow,
                      { borderBottomColor: theme.border },
                      isSelected && { backgroundColor: theme.primary + '0d' },
                    ]}
                    onPress={() => isSelectionMode && !isSharingDocuments && toggleDocumentSelection(document.id)}
                    disabled={!isSelectionMode || isSharingDocuments}
                    accessibilityRole={isSelectionMode ? 'checkbox' : undefined}
                    accessibilityState={isSelectionMode ? { checked: isSelected } : undefined}
                    accessibilityLabel={isSelectionMode ? `Selecionar ${document.name}` : undefined}
                  >
                    <View style={[styles.documentIcon, { backgroundColor: theme.primary + '18' }]}>
                      <Ionicons name="document-text-outline" size={21} color={theme.primary} />
                    </View>
                    {isSelectionMode && (
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={isSelected ? theme.primary : theme.mutedForeground}
                      />
                    )}
                    <View style={styles.documentInfo}>
                      <Text style={[styles.documentName, { color: theme.foreground }]} numberOfLines={1}>
                        {document.name}
                      </Text>
                      <Text style={[styles.documentMeta, { color: theme.mutedForeground }]} numberOfLines={1}>
                        {document.fileName}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleShareDocument(document)}
                      style={styles.documentAction}
                      disabled={isSharingDocuments}
                    >
                      <Ionicons name="share-outline" size={20} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteDocument(document)}
                      style={styles.documentAction}
                      disabled={isSharingDocuments}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
                })}
              </View>
            ) : (
              <View style={[styles.emptyDocuments, { borderColor: theme.border }]}>
                <Ionicons name="search-outline" size={24} color={theme.mutedForeground} />
                <Text style={[styles.emptyDocumentsText, { color: theme.mutedForeground }]}>
                  Nenhum documento encontrado para essa busca.
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={[styles.emptyDocuments, { borderColor: theme.border }]}>
            <Ionicons name="folder-open-outline" size={24} color={theme.mutedForeground} />
            <Text style={[styles.emptyDocumentsText, { color: theme.mutedForeground }]}>
              Nenhum documento salvo ainda.
            </Text>
          </View>
        )}
      </View>
      </ScrollView>
      <Modal
        visible={!!shareProgress}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <View style={styles.progressOverlay}>
          <View style={[styles.progressCard, { backgroundColor: theme.card }]}>
            <ActivityIndicator color={theme.primary} size="small" />
            <Text style={[styles.progressTitle, { color: theme.foreground }]}>
              {shareProgress?.phase}
            </Text>
            <Text style={[styles.progressDetail, { color: theme.mutedForeground }]}>
              {shareProgress?.detail}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${shareProgress?.percent ?? 0}%`,
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            </View>
            <View style={styles.progressMeta}>
              <Text style={[styles.progressPercent, { color: theme.foreground }]}>
                {shareProgress?.percent ?? 0}%
              </Text>
              <Text style={[styles.progressEta, { color: theme.mutedForeground }]}>
                {formatEta(shareProgress?.etaSeconds ?? null)}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20 },
  logoSection: { marginBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoPreview: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%' },
  logoActions: { flex: 1, gap: 8 },
  logoHint: { fontSize: 11, lineHeight: 16, fontFamily: 'PlusJakartaSans_400Regular' },
  logoButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  logoButtonText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  removeLogoButton: { padding: 9 },
  fieldGroup: { marginBottom: 16 },
  visibilityRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingLeft: 4 },
  visibilityText: { flex: 1, fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  label: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    height: 48,
    paddingRight: 12,
  },
  inputIcon: { paddingHorizontal: 12 },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    paddingVertical: 0,
  },
  textareaRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingRight: 12,
    minHeight: 80,
    alignItems: 'flex-start',
  },
  textarea: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  saveBtn: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  saveBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
  marketingSection: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 4 },
  marketingHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 14 },
  marketingHeadingCopy: { flex: 1 },
  marketingTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
  marketingSubtitle: { fontSize: 12, lineHeight: 17, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },
  documentsSection: { marginTop: 28 },
  documentFilters: { gap: 10, marginBottom: 12 },
  documentSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 42,
  },
  documentSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    paddingVertical: 9,
  },
  documentFilterRow: { gap: 8, paddingRight: 4 },
  documentFilterChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  documentFilterChipText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeaderText: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold' },
  sectionSubtitle: { fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 260, fontFamily: 'PlusJakartaSans_400Regular' },
  sectionHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  selectMultipleButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8 },
  selectMultipleText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
  addDocumentBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  bulkActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  selectAllButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  selectAllText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  shareSelectedButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  shareSelectedText: { color: '#fff', fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  documentsLoader: { paddingVertical: 18 },
  documentsCard: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12 },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  documentRowLast: { borderBottomWidth: 0 },
  documentIcon: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  documentInfo: { flex: 1, minWidth: 0 },
  documentName: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  documentMeta: { fontSize: 11, marginTop: 3, fontFamily: 'PlusJakartaSans_400Regular' },
  documentAction: { padding: 6 },
  emptyDocuments: { minHeight: 84, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyDocumentsText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  progressOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  progressCard: { width: '100%', maxWidth: 360, borderRadius: 14, padding: 20, gap: 10, elevation: 6 },
  progressTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', textAlign: 'center' },
  progressDetail: { fontSize: 12, lineHeight: 18, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  progressPercent: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  progressEta: { flex: 1, fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'right' },
});
