import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import type { Company, Quote, Task } from '@workspace/api-client-react';

const PDF_ACCENT = '#f97316';

function escapeHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function getCompanyLogoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;

  if (/^https?:\/\//i.test(value)) {
    return value.replace('/api/objects/', '/api/storage/objects/');
  }
  if (value.startsWith('/objects/')) {
    return domain ? `https://${domain}/api/storage${value}` : null;
  }
  if (value.startsWith('/api/objects/')) {
    return domain
      ? `https://${domain}${value.replace('/api/objects/', '/api/storage/objects/')}`
      : null;
  }
  if (value.startsWith('/')) return domain ? `https://${domain}${value}` : null;
  return null;
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    result += alphabet[first >> 2];
    result += alphabet[((first & 3) << 4) | (second === undefined ? 0 : second >> 4)];
    result += second === undefined
      ? '=='
      : `${alphabet[((second & 15) << 2) | (third === undefined ? 0 : third >> 6)]}${third === undefined ? '=' : alphabet[third & 63]}`;
  }

  return result;
}

async function getImageDataUri(
  imageUrl: string | null | undefined,
  authToken: string | null,
): Promise<string | null> {
  const url = getCompanyLogoUrl(imageUrl);
  if (!url) return null;

  try {
    const headers: Record<string, string> = {};
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (authToken && domain && new URL(url).host === domain) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type')?.split(';')[0] ?? 'image/png';
    if (!contentType.startsWith('image/')) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) return null;
    return `data:${contentType};base64,${encodeBase64(bytes)}`;
  } catch {
    return null;
  }
}

export function getCompanyLogoDataUri(
  logoUrl: string | null | undefined,
  authToken: string | null,
): Promise<string | null> {
  return getImageDataUri(logoUrl, authToken);
}

function baseHtml(title: string, body: string): string {
  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page { margin: 28px; }
          body { font-family: Arial, sans-serif; color: #172033; font-size: 12px; line-height: 1.5; }
          h1 { color: ${PDF_ACCENT}; font-size: 23px; margin: 0 0 4px; }
          h2 { font-size: 14px; color: ${PDF_ACCENT}; margin: 22px 0 8px; text-transform: uppercase; letter-spacing: .08em; }
          .muted { color: #64748b; }
          .header { border-bottom: 2px solid ${PDF_ACCENT}; padding-bottom: 15px; margin-bottom: 20px; }
          .brand { display: flex; align-items: center; gap: 14px; }
          .brand img { width: 68px; height: 68px; object-fit: contain; }
          .meta { display: flex; justify-content: space-between; gap: 20px; }
          .card { border: 1px solid #dbe3ec; border-radius: 8px; padding: 12px; margin-top: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 4px; text-align: left; }
          th { background: ${PDF_ACCENT}; color: #ffffff; }
          th:last-child, td:last-child { text-align: right; }
          .total { font-size: 18px; font-weight: bold; color: ${PDF_ACCENT}; text-align: right; margin-top: 14px; }
          .task-photos { display: flex; flex-wrap: wrap; gap: 12px; }
          .task-photo { break-inside: avoid; margin: 0 0 8px; width: calc(50% - 6px); }
          .task-photo img { border: 1px solid #dbe3ec; border-radius: 8px; display: block; height: 230px; object-fit: contain; width: 100%; }
          .task-photo figcaption { color: #64748b; font-size: 10px; margin-top: 4px; }
          .footer { color: #94a3b8; font-size: 10px; margin-top: 28px; }
        </style>
      </head>
      <body>
        ${body}
        <p class="footer">Documento gerado pelo Gestão de Autônomos em ${escapeHtml(new Date().toLocaleDateString('pt-BR'))}.</p>
      </body>
    </html>`;
}

export function quotePdfHtml(quote: Quote, company?: Company): string {
  const items = quote.items.map(item => `
    <tr>
      <td>${escapeHtml(item.description)}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.unitPrice)}</td>
      <td>${formatCurrency(item.total)}</td>
    </tr>`).join('');
  const scope = quote.serviceScopeEnabled && quote.serviceDescription?.trim()
    ? `<h2>Escopo do serviço</h2><div class="card">${escapeHtml(quote.serviceDescription)}</div>`
    : '';
  const notes = quote.notes?.trim()
    ? `<h2>Observações</h2><div class="card">${escapeHtml(quote.notes)}</div>`
    : '';
  const companyDetails = company ? [
    company.showLegalNameOnQuotes && company.legalName ? `<p><strong>Razão social:</strong> ${escapeHtml(company.legalName)}</p>` : '',
    company.showTaxIdOnQuotes && company.taxId ? `<p><strong>CPF/CNPJ:</strong> ${escapeHtml(company.taxId)}</p>` : '',
    company.showAddressOnQuotes && company.address ? `<p><strong>Endereço:</strong> ${escapeHtml(company.address)}</p>` : '',
    company.showPhoneOnQuotes && company.phone ? `<p><strong>Telefone:</strong> ${escapeHtml(company.phone)}</p>` : '',
    company.showEmailOnQuotes && company.email ? `<p><strong>E-mail:</strong> ${escapeHtml(company.email)}</p>` : '',
    company.showWebsiteOnQuotes && company.website ? `<p><strong>Site:</strong> ${escapeHtml(company.website)}</p>` : '',
  ].filter(Boolean).join('') : '';
  const paymentDetails = company ? [
    company.showPixKeyOnQuotes && company.pixKey ? `<p><strong>Chave Pix:</strong> ${escapeHtml(company.pixKey)}</p>` : '',
    company.showBankDetailsOnQuotes && company.bankDetails ? `<p><strong>Dados bancários:</strong> ${escapeHtml(company.bankDetails)}</p>` : '',
    company.showPaymentInstructionsOnQuotes && company.paymentInstructions ? `<p><strong>Condições:</strong> ${escapeHtml(company.paymentInstructions)}</p>` : '',
  ].filter(Boolean).join('') : '';
  const additionalInfo = company?.showAdditionalInfoOnQuotes && company.additionalInfo
    ? `<h2>Informações adicionais</h2><div class="card">${escapeHtml(company.additionalInfo)}</div>`
    : '';

  return baseHtml(`Orçamento #${quote.id}`, `
    <div class="header">
      <div class="brand">
        ${company?.logoUrl ? `<img src="${escapeHtml(company.logoUrl)}" alt="Logo da empresa" />` : ''}
        <div>
          <h1>${escapeHtml(company?.name ?? 'Orçamento')}</h1>
        </div>
      </div>
      ${companyDetails ? `<div class="muted">${companyDetails}</div>` : ''}
      <div class="meta">
        <span class="muted">Cliente: <strong>${escapeHtml(quote.clientName)}</strong></span>
        <span class="muted">Data: <strong>${formatDate(quote.createdAt)}</strong></span>
      </div>
    </div>
    <h2>Itens do orçamento</h2>
    <table>
      <thead><tr><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead>
      <tbody>${items || '<tr><td colspan="4">Nenhum item informado.</td></tr>'}</tbody>
    </table>
    ${quote.laborCost > 0 ? `<p class="muted">Mão de obra: <strong>${formatCurrency(quote.laborCost)}</strong></p>` : ''}
    <p class="total">Total: ${formatCurrency(quote.total)}</p>
    ${scope}
    ${notes}
    ${paymentDetails ? `<h2>Dados para pagamento</h2><div class="card">${paymentDetails}</div>` : ''}
    ${additionalInfo}
  `);
}

export async function taskPdfHtml(
  task: Task,
  authToken: string | null,
): Promise<string> {
  const photoMarkup = await Promise.all(
    task.photos.map(async (photo, index) => {
      const imageDataUri = await getImageDataUri(photo.url, authToken);
      if (!imageDataUri) {
        throw new Error(
          `Não foi possível carregar a foto ${index + 1} para incluir na O.S.`,
        );
      }
      return `<figure class="task-photo"><img src="${imageDataUri}" alt="Foto ${index + 1} do serviço" /><figcaption>Foto ${index + 1}</figcaption></figure>`;
    }),
  );
  const photos = photoMarkup.length
    ? `<h2>Fotos do serviço (${photoMarkup.length})</h2><div class="task-photos">${photoMarkup.join('')}</div>`
    : '';
  return baseHtml(`Ordem de serviço #${task.id}`, `
    <div class="header">
      <h1>Ordem de serviço #${task.id}</h1>
      <div class="meta">
        <span class="muted">Serviço: <strong>${escapeHtml(task.title)}</strong></span>
        <span class="muted">Status: <strong>${escapeHtml(task.status)}</strong></span>
      </div>
    </div>
    <div class="card">
      <p><strong>Cliente:</strong> ${escapeHtml(task.clientName) || '—'}</p>
      <p><strong>Início:</strong> ${formatDate(task.dueAt)} ${new Date(task.dueAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
      ${task.endAt ? `<p><strong>Término:</strong> ${formatDate(task.endAt)} ${new Date(task.endAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>` : ''}
    </div>
    ${task.description ? `<h2>Descrição</h2><div class="card">${escapeHtml(task.description)}</div>` : ''}
    ${photos}
  `);
}

function safeFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'documento';
}

async function printBrowserHtml(html: string): Promise<void> {
  const popup = window.open('', '_blank');
  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
    popup.focus();
    popup.print();
    return;
  }

  // If the browser blocks popups, print an isolated iframe instead of the
  // current app screen. This preserves the document CSS and table layout.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '100%';
  iframe.style.bottom = '100%';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const frameDocument = iframe.contentDocument;
  if (!frameDocument) {
    iframe.remove();
    throw new Error('Não foi possível preparar a impressão do PDF.');
  }
  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  window.setTimeout(() => iframe.remove(), 1000);
}

async function waitForNonEmptyFile(uri: string): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && typeof info.size === 'number' && info.size > 0) {
      return info.size;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return 0;
}

async function createShareablePdf(title: string, html: string): Promise<string> {
  const result = await Print.printToFileAsync({ html });
  const sourceSize = await waitForNonEmptyFile(result.uri);
  if (sourceSize <= 0) {
    throw new Error('O PDF foi gerado vazio.');
  }

  const storageDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!storageDirectory) {
    throw new Error('O armazenamento do aparelho não está disponível.');
  }

  // expo-print returns a temporary URI. Copy it to persistent app storage
  // before opening the native share sheet so the receiving app can still read
  // the complete file while the user chooses where to save it.
  const shareableUri = `${storageDirectory}${safeFilePart(title)}-${Date.now()}.pdf`;
  await FileSystem.copyAsync({ from: result.uri, to: shareableUri });
  const copiedSize = await waitForNonEmptyFile(shareableUri);
  if (copiedSize <= 0) {
    throw new Error('Não foi possível preparar o arquivo PDF.');
  }

  return shareableUri;
}

export async function sharePdfDocument(title: string, html: string): Promise<void> {
  if (Platform.OS === 'web') {
    await printBrowserHtml(html);
    return;
  }

  const pdfUri = await createShareablePdf(title, html);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: title,
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  await Share.share({ url: pdfUri, title, message: title });
}