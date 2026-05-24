type MergePdfHighlighterUtilsInput<TBase extends object, TIncoming extends object> = {
	baseUtils: TBase;
	incomingUtils: TIncoming;
};

export function mergePdfHighlighterUtils<TBase extends object, TIncoming extends object>({
	baseUtils,
	incomingUtils
}: MergePdfHighlighterUtilsInput<TBase, TIncoming>): TBase & TIncoming {
	return {
		...incomingUtils,
		...baseUtils
	};
}
