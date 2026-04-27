import type { GhostHighlight, Highlight } from '../types';

type GroupedHighlights = {
	[pageNumber: number]: Array<Highlight | GhostHighlight>;
};

const groupHighlightsByPage = (
	highlights: Array<Highlight | GhostHighlight | null>
): GroupedHighlights => {
	return highlights.reduce<GroupedHighlights>((acc, highlight) => {
		if (!highlight) {
			return acc;
		}

		if (!highlight.position) {
			return acc;
		}

		const pageNumbers = new Set<number>();
		pageNumbers.add(highlight.position.boundingRect.pageNumber);
		highlight.position.rects.forEach((item) => {
			pageNumbers.add(item.pageNumber ? item.pageNumber : 0);
		});

		pageNumbers.forEach((pageNumber) => {
			acc[pageNumber] ||= [];
			const position = highlight.position!;
			const pageSpecificHighlight = {
				...highlight,
				position: {
					...position,
					rects: position.rects.filter((rect) => pageNumber === rect.pageNumber)
				}
			} as Highlight | GhostHighlight;
			acc[pageNumber].push(pageSpecificHighlight);
		});
		return acc;
	}, {});
};

export default groupHighlightsByPage;
