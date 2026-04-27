export { default as PdfLoader } from './components/PdfLoader.svelte';
export { default as PdfHighlighter } from './components/PdfHighlighter.svelte';
export { default as AreaHighlight } from './components/AreaHighlight.svelte';
export { default as TextHighlight } from './components/TextHighlight.svelte';
export { default as MonitoredHighlightContainer } from './components/MonitoredHighlightContainer.svelte';
export { default as LeftPanel } from './components/LeftPanel.svelte';

export { HighlightsModel } from './HighlightsModel.svelte.ts';

export { exportPdf } from './lib/export-pdf';
export { resolvePdfHighlighterTheme } from './lib/theme';
export type { PdfHighlighterTheme } from './lib/theme';
export type { ExportPdfOptions, ExportableHighlight } from './lib/export-pdf';

export * from './types';
export * from './utils';

export { scaledToViewport, viewportPositionToScaled } from './pdf_utils/coordinates';
