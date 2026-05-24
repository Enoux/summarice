export type FastSearchOptimisticTarget = {
	documentId: string;
	documentTitle: string;
	href: string;
	highlightId: string | null;
};

export type FastSearchLocalJumpTarget = {
	documentId: string;
	highlightId: string;
	requestId: number;
};

const navigationState = $state<{
	optimisticTarget: FastSearchOptimisticTarget | null;
	localJumpTarget: FastSearchLocalJumpTarget | null;
	nextLocalJumpRequestId: number;
}>({
	optimisticTarget: null,
	localJumpTarget: null,
	nextLocalJumpRequestId: 0
});

export function getFastSearchOptimisticTarget(): FastSearchOptimisticTarget | null {
	return navigationState.optimisticTarget;
}

export function setFastSearchOptimisticTarget(target: FastSearchOptimisticTarget): void {
	navigationState.optimisticTarget = target;
}

export function clearFastSearchOptimisticTarget(): void {
	navigationState.optimisticTarget = null;
}

export function getFastSearchLocalJumpTarget(): FastSearchLocalJumpTarget | null {
	return navigationState.localJumpTarget;
}

export function requestFastSearchLocalJump(documentId: string, highlightId: string): void {
	const requestId: number = navigationState.nextLocalJumpRequestId + 1;
	navigationState.nextLocalJumpRequestId = requestId;
	navigationState.localJumpTarget = {
		documentId,
		highlightId,
		requestId
	};
}
