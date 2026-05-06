export type UploadStage = 'uploading' | 'extracting' | 'parsing' | 'committing' | 'ready' | 'error';

export interface UploadProgressData {
	stage: UploadStage;
	progress: number;
	message?: string;
}

export async function upload(file: File, onProgress?: (progress: UploadProgressData) => void) {
	try {
		onProgress?.({ stage: 'uploading', progress: 10, message: 'Uploading PDF...' });

		const formData = new FormData();
		formData.append('file', file);

		onProgress?.({ stage: 'extracting', progress: 35, message: 'Parsing text with LiteParse...' });
		onProgress?.({ stage: 'parsing', progress: 60, message: 'Collecting layout and outline...' });

		const response = await fetch('/documents/upload', {
			method: 'POST',
			body: formData
		});
		const payload = await response.json().catch(() => null);

		if (!response.ok) {
			throw new Error(payload?.message ?? 'Failed to upload document');
		}

		onProgress?.({ stage: 'committing', progress: 90, message: 'Saving document...' });
		onProgress?.({ stage: 'ready', progress: 100, message: 'Document is ready!' });

		return payload as { documentId: string; pageCount: number; title: string };
	} catch (error) {
		console.error('Upload failed:', error);
		onProgress?.({
			stage: 'error',
			progress: 0,
			message: error instanceof Error ? error.message : 'Unknown error occurred'
		});
		throw error;
	}
}
