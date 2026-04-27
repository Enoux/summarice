import { PDFDocument, rgb, type PDFPage } from 'pdf-lib';
import type { Scaled, ScaledPosition } from '../types';

export interface ExportPdfOptions {
	textHighlightColor?: string;
	areaHighlightColor?: string;
	onProgress?: (current: number, total: number) => void;
}

export interface ExportableHighlight {
	id: string;
	type?: 'text' | 'area';
	content?: {
		text?: string;
		image?: string;
	};
	position: ScaledPosition;
	highlightColor?: string;
	highlightStyle?: 'highlight' | 'underline' | 'strikethrough';
}

function parseColor(color: string): { r: number; g: number; b: number; a: number } {
	const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
	if (rgbaMatch) {
		return {
			r: parseInt(rgbaMatch[1]) / 255,
			g: parseInt(rgbaMatch[2]) / 255,
			b: parseInt(rgbaMatch[3]) / 255,
			a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
		};
	}
	const hex = color.replace('#', '');
	if (hex.length === 3) {
		return {
			r: parseInt(hex[0] + hex[0], 16) / 255,
			g: parseInt(hex[1] + hex[1], 16) / 255,
			b: parseInt(hex[2] + hex[2], 16) / 255,
			a: 1
		};
	}
	if (hex.length === 6) {
		return {
			r: parseInt(hex.slice(0, 2), 16) / 255,
			g: parseInt(hex.slice(2, 4), 16) / 255,
			b: parseInt(hex.slice(4, 6), 16) / 255,
			a: 1
		};
	}
	return { r: 1, g: 0.89, b: 0.56, a: 0.5 };
}

function scaledToPdfPoints(
	scaled: Scaled,
	page: PDFPage
): { x: number; y: number; width: number; height: number } {
	const pdfWidth = page.getWidth();
	const pdfHeight = page.getHeight();
	const xRatio = pdfWidth / scaled.width;
	const yRatio = pdfHeight / scaled.height;
	const x = scaled.x1 * xRatio;
	const width = (scaled.x2 - scaled.x1) * xRatio;
	const height = (scaled.y2 - scaled.y1) * yRatio;
	const y = pdfHeight - scaled.y1 * yRatio - height;
	return { x, y, width, height };
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; type: 'png' | 'jpg' } {
	const base64 = dataUrl.split(',')[1];
	if (!base64) {
		throw new Error('Invalid image data URL');
	}
	const byteString = atob(base64);
	const bytes = new Uint8Array(byteString.length);
	for (let i = 0; i < byteString.length; i++) {
		bytes[i] = byteString.charCodeAt(i);
	}
	const type = dataUrl.includes('image/png') ? 'png' : 'jpg';
	return { bytes, type };
}

function transformToRawCoordinates(
	page: PDFPage,
	x: number,
	y: number,
	width: number,
	height: number
): { x: number; y: number; width: number; height: number } {
	const rotation = page.getRotation().angle;
	const pageWidth = page.getWidth();
	const pageHeight = page.getHeight();
	if (rotation === 90) {
		return { x: y, y: pageWidth - x - width, width: height, height: width };
	}
	if (rotation === 180) {
		return { x: pageWidth - x - width, y: pageHeight - y - height, width, height };
	}
	if (rotation === 270) {
		return { x: pageHeight - y - height, y: x, width: height, height: width };
	}
	return { x, y, width, height };
}

function groupByPage(highlights: ExportableHighlight[]): Map<number, ExportableHighlight[]> {
	const map = new Map<number, ExportableHighlight[]>();
	for (const h of highlights) {
		const pageNum = h.position.boundingRect.pageNumber;
		if (!map.has(pageNum)) map.set(pageNum, []);
		map.get(pageNum)!.push(h);
	}
	return map;
}

async function renderTextHighlight(
	page: PDFPage,
	highlight: ExportableHighlight,
	options: ExportPdfOptions
): Promise<void> {
	const colorStr =
		highlight.highlightColor || options.textHighlightColor || 'rgba(255, 226, 143, 0.5)';
	const color = parseColor(colorStr);
	const highlightStyle = highlight.highlightStyle || 'highlight';
	const rects =
		highlight.position.rects.length > 0
			? highlight.position.rects
			: [highlight.position.boundingRect];

	for (const rect of rects) {
		const { x, y, width, height } = scaledToPdfPoints(rect, page);
		if (highlightStyle === 'highlight') {
			page.drawRectangle({
				x,
				y,
				width,
				height,
				color: rgb(color.r, color.g, color.b),
				opacity: color.a
			});
		} else if (highlightStyle === 'underline') {
			const lineThickness = Math.max(1, height * 0.1);
			page.drawRectangle({
				x,
				y,
				width,
				height: lineThickness,
				color: rgb(color.r, color.g, color.b),
				opacity: color.a
			});
		} else if (highlightStyle === 'strikethrough') {
			const lineThickness = Math.max(1, height * 0.1);
			const lineY = y + height / 2 - lineThickness / 2;
			page.drawRectangle({
				x,
				y: lineY,
				width,
				height: lineThickness,
				color: rgb(color.r, color.g, color.b),
				opacity: color.a
			});
		}
	}
}

async function renderAreaRectangle(
	page: PDFPage,
	highlight: ExportableHighlight,
	options: ExportPdfOptions
): Promise<void> {
	const colorStr =
		highlight.highlightColor || options.areaHighlightColor || 'rgba(255, 226, 143, 0.5)';
	const color = parseColor(colorStr);
	const { x, y, width, height } = scaledToPdfPoints(highlight.position.boundingRect, page);
	page.drawRectangle({
		x,
		y,
		width,
		height,
		color: rgb(color.r, color.g, color.b),
		opacity: color.a
	});
}

async function renderAreaScreenshot(
	pdfDoc: PDFDocument,
	page: PDFPage,
	highlight: ExportableHighlight,
	options: ExportPdfOptions
): Promise<void> {
	const imageDataUrl = highlight.content?.image;
	if (!imageDataUrl) {
		await renderAreaRectangle(page, highlight, options);
		return;
	}
	try {
		const { bytes, type } = dataUrlToBytes(imageDataUrl);
		const image = type === 'png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
		const visualCoords = scaledToPdfPoints(highlight.position.boundingRect, page);
		const rawCoords = transformToRawCoordinates(
			page,
			visualCoords.x,
			visualCoords.y,
			visualCoords.width,
			visualCoords.height
		);
		page.drawImage(image, {
			x: rawCoords.x,
			y: rawCoords.y,
			width: rawCoords.width,
			height: rawCoords.height
		});
	} catch {
		await renderAreaRectangle(page, highlight, options);
	}
}

/**
 * Export a PDF with text and area highlights (area uses screenshot PNG when present).
 */
export async function exportPdf(
	pdfSource: string | Uint8Array | ArrayBuffer,
	highlights: ExportableHighlight[],
	options: ExportPdfOptions = {}
): Promise<Uint8Array> {
	let pdfBytes: ArrayBuffer;
	if (typeof pdfSource === 'string') {
		const response = await fetch(pdfSource);
		pdfBytes = await response.arrayBuffer();
	} else {
		pdfBytes = pdfSource instanceof Uint8Array ? pdfSource.slice().buffer : pdfSource;
	}

	const pdfDoc = await PDFDocument.load(pdfBytes);
	const pages = pdfDoc.getPages();
	const byPage = groupByPage(highlights);
	const totalPages = byPage.size;
	let currentPage = 0;

	for (const [pageNum, pageHighlights] of byPage) {
		const page = pages[pageNum - 1];
		if (!page) continue;

		for (const highlight of pageHighlights) {
			const t = highlight.type ?? 'area';
			if (t === 'text') {
				await renderTextHighlight(page, highlight, options);
			} else {
				if (highlight.content?.image) {
					await renderAreaScreenshot(pdfDoc, page, highlight, options);
				} else {
					await renderAreaRectangle(page, highlight, options);
				}
			}
		}
		currentPage++;
		options.onProgress?.(currentPage, totalPages);
	}

	return pdfDoc.save();
}
