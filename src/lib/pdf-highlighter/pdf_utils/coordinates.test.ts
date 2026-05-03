import { describe, expect, it } from 'vitest';
import type { PDFViewer } from 'pdfjs-dist/types/web/pdf_viewer';
import type { ScaledPosition } from '$lib/pdf-highlighter/types';
import { scaledPositionToViewport, viewportPositionToScaled } from './coordinates';

function viewerWithViewport(width: number, height: number): PDFViewer {
	return {
		getPageView: () => ({
			viewport: { width, height }
		})
	} as unknown as PDFViewer;
}

describe('highlight coordinate conversion', () => {
	it('keeps text highlight positions stable across viewport scale changes', () => {
		const position = viewportPositionToScaled(
			{
				boundingRect: { left: 100, top: 120, width: 200, height: 40, pageNumber: 1 },
				rects: [
					{ left: 100, top: 120, width: 90, height: 18, pageNumber: 1 },
					{ left: 100, top: 142, width: 200, height: 18, pageNumber: 1 }
				]
			},
			viewerWithViewport(1000, 1200)
		);

		const zoomedOut = scaledPositionToViewport(position, viewerWithViewport(500, 600));
		const zoomedIn = scaledPositionToViewport(position, viewerWithViewport(2000, 2400));

		expect(zoomedOut.boundingRect).toMatchObject({
			left: 50,
			top: 60,
			width: 100,
			height: 20
		});
		expect(zoomedOut.rects[0]).toMatchObject({ left: 50, top: 60, width: 45, height: 9 });
		expect(zoomedIn.boundingRect).toMatchObject({
			left: 200,
			top: 240,
			width: 400,
			height: 80
		});
	});

	it('keeps area highlight bounding boxes proportional across viewport scale changes', () => {
		const position: ScaledPosition = {
			boundingRect: {
				x1: 150,
				y1: 240,
				x2: 350,
				y2: 360,
				width: 1000,
				height: 1200,
				pageNumber: 1
			},
			rects: []
		};

		const viewportPosition = scaledPositionToViewport(position, viewerWithViewport(250, 300));

		expect(viewportPosition.boundingRect).toMatchObject({
			left: 37.5,
			top: 60,
			width: 50,
			height: 30
		});
	});
});
