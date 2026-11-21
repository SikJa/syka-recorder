const AUTHORIZATION_LIFETIME_MS = 60_000;

type Authorization = { folder: string; expiresAt: number };

const authorizations = new Map<number, Authorization>();

/**
 * Lets the next "Editar en Syka" of one window save into `folder` without the
 * folder dialog (an agent chose it through the MCP). One use, short-lived;
 * without it the dialog opens as always. Returns a function that revokes it.
 */
export function authorizeTransferDestination(
	contentsId: number,
	folder: string,
	now = Date.now(),
): () => void {
	const authorization = { folder, expiresAt: now + AUTHORIZATION_LIFETIME_MS };
	authorizations.set(contentsId, authorization);
	return () => {
		if (authorizations.get(contentsId) === authorization) authorizations.delete(contentsId);
	};
}

/** Consumes the window's authorization, if one is still valid. */
export function takeTransferDestination(contentsId: number, now = Date.now()): string | null {
	const authorization = authorizations.get(contentsId);
	if (!authorization) return null;
	authorizations.delete(contentsId);
	return authorization.expiresAt >= now ? authorization.folder : null;
}
