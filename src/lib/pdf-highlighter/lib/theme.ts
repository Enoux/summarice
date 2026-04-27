export type PdfHighlighterTheme = {
	mode: 'light' | 'dark';
	containerBackgroundColor?: string;
	scrollbarThumbColor?: string;
	scrollbarTrackColor?: string;
	/** 0..1 strength of page inversion in dark mode */
	darkModeInvertIntensity?: number;
};

const defaultLight: Required<
	Pick<
		PdfHighlighterTheme,
		| 'containerBackgroundColor'
		| 'scrollbarThumbColor'
		| 'scrollbarTrackColor'
		| 'darkModeInvertIntensity'
	>
> = {
	containerBackgroundColor: '#f5f5f5',
	scrollbarThumbColor: '#9f9f9f',
	scrollbarTrackColor: '#e8e8e8',
	darkModeInvertIntensity: 0.93
};

const defaultDark: typeof defaultLight = {
	containerBackgroundColor: '#1a1a1a',
	scrollbarThumbColor: '#555',
	scrollbarTrackColor: '#2c2c2c',
	darkModeInvertIntensity: 0.93
};

export function resolvePdfHighlighterTheme(
	user?: PdfHighlighterTheme
): Required<PdfHighlighterTheme> {
	const mode = user?.mode ?? 'light';
	const base = mode === 'dark' ? defaultDark : defaultLight;
	return {
		mode,
		containerBackgroundColor: user?.containerBackgroundColor ?? base.containerBackgroundColor,
		scrollbarThumbColor: user?.scrollbarThumbColor ?? base.scrollbarThumbColor,
		scrollbarTrackColor: user?.scrollbarTrackColor ?? base.scrollbarTrackColor,
		darkModeInvertIntensity: user?.darkModeInvertIntensity ?? base.darkModeInvertIntensity
	};
}
