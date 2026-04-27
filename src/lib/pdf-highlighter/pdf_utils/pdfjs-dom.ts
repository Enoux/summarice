import type { Page } from '../types';

export const getDocument = (elm: Element | Node | null | undefined): Document =>
	(elm as Node | null | undefined)?.ownerDocument ?? document;

export const getWindow = (elm: Element | Node | null | undefined): typeof window =>
	getDocument(elm).defaultView || window;

export const isHTMLElement = (elm: unknown): elm is HTMLElement =>
	elm instanceof HTMLElement ||
	elm instanceof getWindow(elm as Element | Node | null | undefined).HTMLElement;

export const isHTMLCanvasElement = (elm: unknown): elm is HTMLCanvasElement =>
	elm instanceof HTMLCanvasElement ||
	elm instanceof getWindow(elm as Element | Node | null | undefined).HTMLCanvasElement;

export function asElement<T extends Element = HTMLElement>(
	x: EventTarget | Node | null | undefined
): T {
	return x as unknown as T;
}

export const getPageFromElement = (target: HTMLElement): Page | null => {
	const node = asElement(target.closest('.page'));

	if (!node || !isHTMLElement(node)) {
		return null;
	}

	const number = Number(asElement(node).dataset.pageNumber);

	return { node, number } as Page;
};

export const getPagesFromRange = (range: Range): Page[] => {
	const startParentElement = range.startContainer.parentElement;
	const endParentElement = range.endContainer.parentElement;

	if (!isHTMLElement(startParentElement) || !isHTMLElement(endParentElement)) {
		return [] as Page[];
	}

	const startPage = getPageFromElement(asElement(startParentElement));
	const endPage = getPageFromElement(asElement(endParentElement));

	if (!startPage?.number || !endPage?.number) {
		return [] as Page[];
	}

	if (startPage.number === endPage.number) {
		return [startPage] as Page[];
	}

	if (startPage.number === endPage.number - 1) {
		return [startPage, endPage] as Page[];
	}

	const pages: Page[] = [];

	let currentPageNumber = startPage.number;

	const document = startPage.node.ownerDocument;

	while (currentPageNumber <= endPage.number) {
		const currentPage = getPageFromElement(
			document.querySelector(`[data-page-number='${currentPageNumber}'`) as HTMLElement
		);
		if (currentPage) {
			pages.push(currentPage);
		}
		currentPageNumber++;
	}

	return pages as Page[];
};

export const findOrCreateContainerLayer = (container: HTMLElement, className: string) => {
	const doc = getDocument(container);
	let layer = container.querySelector(`.${className}`);

	// To ensure predictable zIndexing, wait until the pdfjs element has children.
	if (!layer && container.children.length) {
		layer = doc.createElement('div');
		layer.className = className;
		container.appendChild(layer);
	}

	return layer;
};
