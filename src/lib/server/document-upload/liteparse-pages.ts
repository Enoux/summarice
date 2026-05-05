export type LiteParsePageLike = {
	pageNum: number;
	width: number;
	height: number;
	text: string;
	textItems: Array<{
		text?: string;
		str?: string;
		x: number;
		y: number;
		width: number;
		height: number;
		fontName?: string;
		fontSize?: number;
		confidence?: number;
	}>;
};

export type StoredPageLayout = {
	width: number;
	height: number;
	textItems: Array<{
		text: string;
		x: number;
		y: number;
		width: number;
		height: number;
		fontName?: string;
		fontSize?: number;
		confidence?: number;
	}>;
};

export type UploadPage = {
	page_number: number;
	text: string;
	layout: StoredPageLayout;
};

export function normalizePageText(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

export function liteParseResultToPages(result: { pages: LiteParsePageLike[] }): UploadPage[] {
	return result.pages.map((page) => ({
		page_number: page.pageNum,
		text: normalizePageText(page.text),
		layout: {
			width: page.width,
			height: page.height,
			textItems: page.textItems.map((item) => ({
				text: normalizePageText(item.text ?? item.str ?? ''),
				x: item.x,
				y: item.y,
				width: item.width,
				height: item.height,
				...(item.fontName ? { fontName: item.fontName } : {}),
				...(item.fontSize ? { fontSize: item.fontSize } : {}),
				...(item.confidence !== undefined ? { confidence: item.confidence } : {})
			}))
		}
	}));
}
