export type ErrorMessageContext = {
	operation: string;
	params: Record<string, string | number | boolean | null>;
};

type StructuredError = {
	message?: unknown;
	code?: unknown;
	details?: unknown;
	hint?: unknown;
	status?: unknown;
	statusCode?: unknown;
	responseBody?: unknown;
	body?: unknown;
	cause?: unknown;
};

export function errorMessage(error: unknown, context: ErrorMessageContext): string {
	const parts = [`${context.operation} failed`, `params=${JSON.stringify(context.params)}`];
	const normalized = normalizeError(error);

	if (normalized) {
		parts.push(normalized);
	} else {
		parts.push('error=null');
	}

	return parts.join(' | ');
}

function normalizeError(error: unknown): string | null {
	if (error === null || error === undefined) return null;
	if (error instanceof Error) return normalizeErrorObject(error);
	if (typeof error === 'string') return error;
	if (typeof error === 'number' || typeof error === 'boolean') return String(error);
	if (typeof error === 'object') return normalizePlainError(error as StructuredError);
	return String(error);
}

function normalizeErrorObject(error: Error): string {
	const objectDetails = normalizePlainError(error as StructuredError);
	if (objectDetails) return objectDetails;
	return `${error.name}: ${error.message}`;
}

function normalizePlainError(error: StructuredError): string {
	const fields: Record<string, unknown> = {};

	copyKnownField(fields, 'message', error.message);
	copyKnownField(fields, 'code', error.code);
	copyKnownField(fields, 'details', error.details);
	copyKnownField(fields, 'hint', error.hint);
	copyKnownField(fields, 'status', error.status);
	copyKnownField(fields, 'statusCode', error.statusCode);
	copyKnownField(fields, 'responseBody', error.responseBody);
	copyKnownField(fields, 'body', error.body);
	copyKnownField(fields, 'cause', normalizeError(error.cause));

	if (Object.keys(fields).length > 0) return stringifyErrorFields(fields);
	return stringifyErrorFields(error);
}

function copyKnownField(fields: Record<string, unknown>, key: string, value: unknown): void {
	if (value === undefined || value === null || value === '') return;
	fields[key] = value;
}

function stringifyErrorFields(value: unknown): string {
	try {
		const serialized = JSON.stringify(value);
		return serialized ?? String(value);
	} catch {
		return '[unserializable error object]';
	}
}
