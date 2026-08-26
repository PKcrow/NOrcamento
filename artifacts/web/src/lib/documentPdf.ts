import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Company, Quote, Task } from "@workspace/api-client-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { normalizeStoredObjectUrl } from "@/lib/objectUrl";

type PdfCompany = Pick<Company, "name" | "logoUrl" | "phone" | "email" | "address">;

function safeFilePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function imageUrlToDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;

  try {
    const response = await fetch(normalizeStoredObjectUrl(url));
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addCompanyHeader(doc: jsPDF, company: PdfCompany, logoDataUrl: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const orange = [239, 115, 31] as [number, number, number];

  doc.setFillColor(...orange);
  doc.rect(0, 0, pageWidth, 5, "F");

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "AUTO", margin, 14, 24, 24, undefined, "FAST");
  }

  const textX = logoDataUrl ? margin + 31 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(company.name || "Negócio", textX, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(95, 95, 95);
  const contactLines = [company.address, company.phone, company.email].filter(Boolean) as string[];
  contactLines.slice(0, 3).forEach((line, index) => {
    const lines = doc.splitTextToSize(line, 92);
    doc.text(lines, textX, 25 + index * 5);
  });

  doc.setDrawColor(225, 225, 225);
  doc.line(margin, 45, pageWidth - margin, 45);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(145, 145, 145);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - 18, pageHeight - 10, { align: "right" });
  }
}

export async function generateQuotePdf(quote: Quote, company?: PdfCompany): Promise<File> {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const business = company ?? { name: "Negócio", logoUrl: null, phone: null, email: null, address: null };
  const logoDataUrl = await imageUrlToDataUrl(business.logoUrl);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 18;

  addCompanyHeader(pdf, business, logoDataUrl);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(30, 30, 30);
  pdf.text("ORÇAMENTO", pageWidth - margin, 19, { align: "right" });
  pdf.setFont("courier", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`#${quote.id.toString().padStart(4, "0")}`, pageWidth - margin, 26, { align: "right" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(130, 130, 130);
  pdf.text("DATA DE EMISSÃO", pageWidth - margin, 35, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(40, 40, 40);
  pdf.text(formatDate(quote.createdAt), pageWidth - margin, 40, { align: "right" });

  let tableStartY = 86;
  pdf.setFillColor(248, 249, 250);
  pdf.roundedRect(margin, 53, pageWidth - margin * 2, 22, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(130, 130, 130);
  pdf.text("PREPARADO PARA", margin + 6, 61);
  pdf.setFontSize(12);
  pdf.setTextColor(30, 30, 30);
  pdf.text(quote.clientName, margin + 6, 69);

  if (quote.serviceScopeEnabled && quote.serviceDescription?.trim()) {
    const scopeLines = pdf.splitTextToSize(quote.serviceDescription.trim(), pageWidth - margin * 2 - 12);
    const scopeHeight = Math.max(22, 12 + scopeLines.length * 4.5);
    const scopeTop = 81;
    pdf.setFillColor(248, 249, 250);
    pdf.roundedRect(margin, scopeTop, pageWidth - margin * 2, scopeHeight, 3, 3, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(130, 130, 130);
    pdf.text("ESCOPO DO SERVIÇO", margin + 6, scopeTop + 8);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(70, 70, 70);
    pdf.text(scopeLines, margin + 6, scopeTop + 15);
    tableStartY = scopeTop + scopeHeight + 10;
  }

  autoTable(pdf, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [["Descrição do Serviço/Produto", "Qtd", "Valor Unit.", "Total"]],
    body: [
      ...quote.items.map((item) => [
        item.description,
        String(item.quantity),
        formatCurrency(item.unitPrice),
        formatCurrency(item.total),
      ]),
      ...(quote.laborCost > 0 ? [["Mão de Obra", "", "", formatCurrency(quote.laborCost)]] : []),
    ],
    theme: "grid",
    headStyles: { fillColor: [35, 42, 52], textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: [45, 45, 45], cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 18, halign: "center" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
    },
  });

  const finalY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
  const pageHeight = pdf.internal.pageSize.getHeight();
  let totalY = finalY + 10;
  if (totalY + 22 > pageHeight - 18) {
    pdf.addPage();
    totalY = 20;
  }

  pdf.setFillColor(248, 249, 250);
  pdf.roundedRect(pageWidth - margin - 72, totalY, 72, 18, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(50, 50, 50);
  pdf.text("VALOR TOTAL", pageWidth - margin - 66, totalY + 8);
  pdf.setFontSize(13);
  pdf.setTextColor(239, 115, 31);
  pdf.text(formatCurrency(quote.total), pageWidth - margin - 6, totalY + 8, { align: "right" });

  if (quote.notes) {
    const noteLines = pdf.splitTextToSize(quote.notes, pageWidth - margin * 2);
    let notesY = totalY + 32;
    if (notesY + noteLines.length * 4.5 > pageHeight - 20) {
      pdf.addPage();
      notesY = 24;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(130, 130, 130);
    pdf.text("OBSERVAÇÕES E CONDIÇÕES", margin, notesY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(70, 70, 70);
    pdf.text(noteLines, margin, notesY + 7);
  }

  addFooter(pdf);
  const blob = pdf.output("blob");
  return new File([blob], `orcamento-${safeFilePart(quote.clientName)}-${quote.id}.pdf`, {
    type: "application/pdf",
  });
}

export async function generateTaskPdf(task: Task, company?: PdfCompany): Promise<File> {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const business = company ?? { name: "Negócio", logoUrl: null, phone: null, email: null, address: null };
  const logoDataUrl = await imageUrlToDataUrl(business.logoUrl);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 18;

  addCompanyHeader(pdf, business, logoDataUrl);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(21);
  pdf.setTextColor(30, 30, 30);
  pdf.text("ORDEM DE SERVIÇO", margin, 59);
  pdf.setFont("courier", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`#${task.id.toString().padStart(4, "0")}`, pageWidth - margin, 59, { align: "right" });

  autoTable(pdf, {
    startY: 68,
    margin: { left: margin, right: margin },
    body: [
      ["SERVIÇO", task.title],
      ["CLIENTE", task.clientName ?? "Não informado"],
      ["INÍCIO", formatDateTime(task.dueAt)],
      ["TÉRMINO PREVISTO", task.endAt ? formatDateTime(task.endAt) : "Não informado"],
      ["STATUS", task.status === "paid" ? "Pago" : task.status === "completed" ? "Concluído" : task.status === "in_progress" ? "Em andamento" : "Agendado"],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 4, textColor: [45, 45, 45] },
    columnStyles: { 0: { cellWidth: 42, fontStyle: "bold", textColor: [130, 130, 130] } },
    didDrawCell: (data) => {
      if (data.section === "body" && data.row.index % 2 === 0) {
        pdf.setFillColor(248, 249, 250);
        pdf.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
      }
    },
  });

  const finalY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 115;
  let currentY = finalY + 12;
  if (task.description) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    pdf.text("DETALHES DO SERVIÇO", margin, currentY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(45, 45, 45);
    currentY += 7;
    pdf.text(pdf.splitTextToSize(task.description, pageWidth - margin * 2), margin, currentY);
    currentY += pdf.splitTextToSize(task.description, pageWidth - margin * 2).length * 5 + 8;
  }

  if (task.photos.length > 0) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`FOTOS DO SERVIÇO (${task.photos.length})`, margin, currentY);
    currentY += 7;

    for (const [index, photo] of task.photos.entries()) {
      const imageDataUrl = await imageUrlToDataUrl(photo.url);
      if (!imageDataUrl) continue;
      if (currentY > 245) {
        pdf.addPage();
        currentY = 20;
      }
      pdf.addImage(imageDataUrl, "AUTO", margin, currentY, 48, 36, undefined, "FAST");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Foto ${index + 1}`, margin + 52, currentY + 7);
      currentY += 43;
    }
  }

  addFooter(pdf);
  const blob = pdf.output("blob");
  return new File([blob], `ordem-de-servico-${safeFilePart(task.title)}-${task.id}.pdf`, {
    type: "application/pdf",
  });
}

export async function sharePdfFile(file: File): Promise<"shared" | "downloaded"> {
  const shareData = { files: [file], title: file.name, text: file.name };
  if (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share(shareData);
    return "shared";
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}

export function downloadPdfFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}