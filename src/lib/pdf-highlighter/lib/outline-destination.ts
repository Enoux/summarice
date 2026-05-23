/** PDF destination array shape from PDF.js (resolved). */
type PdfDestArray = unknown[];

type DestTypeName = 'XYZ' | 'Fit' | 'FitB' | 'FitH' | 'FitBH' | 'FitV' | 'FitBV' | 'FitR';

function destTypeName(dest: PdfDestArray): DestTypeName | null {
	const type = dest[1];
	if (type && typeof type === 'object' && 'name' in type && typeof type.name === 'string') {
		return type.name as DestTypeName;
	}
	return null;
}

/**
 * Extract vertical PDF user-space coordinate from a resolved destination.
 * Returns null when the destination has no meaningful Y (page-top / page-only).
 * Matches PDF.js scrollPageIntoView destination handling.
 */
export function pdfTopFromDestination(dest: PdfDestArray | null): number | null {
	if (!dest || !Array.isArray(dest) || dest.length < 2) {
		return null;
	}

	const type = destTypeName(dest);
	if (!type) {
		return null;
	}

	switch (type) {
		case 'XYZ': {
			const y = dest[3];
			return typeof y === 'number' ? y : null;
		}
		case 'FitH':
		case 'FitBH': {
			const y = dest[2];
			return typeof y === 'number' ? y : null;
		}
		case 'Fit':
		case 'FitB':
		case 'FitV':
		case 'FitBV':
		case 'FitR':
		default:
			return null;
	}
}
