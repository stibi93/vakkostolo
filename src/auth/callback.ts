export interface AuthCallback { code: string | null; failed: boolean; flowId?: string }

export function readAuthCallback(url: URL): AuthCallback | null {
  if (url.pathname.replace(/\/+$/, '') !== '/auth/callback') return null;
  const hash = new URLSearchParams(url.hash.slice(1));
  return {
    code: url.searchParams.get('code'),
    failed: url.searchParams.has('error') || url.searchParams.has('error_description') ||
      hash.has('error') || hash.has('error_description'),
    flowId: url.searchParams.get('sb_flow_id') ?? undefined,
  };
}
