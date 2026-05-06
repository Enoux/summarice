import { LiteParse } from '@llamaindex/liteparse';

const parser = new LiteParse({
	ocrEnabled: false,
	outputFormat: 'json'
});

export async function parsePdfWithLiteParse(bytes: Uint8Array) {
	return parser.parse(bytes, true);
}
