import { ApiError } from "../api/client"

/** Shows what failed plus the request ID, which matches the server's log lines. */
export function ErrorNotice({ error }: { error: unknown }) {
  const message=error instanceof Error ? error.message : "Something went wrong."
  const apiError=error instanceof ApiError ? error : null
  return (
    <div role="alert" className="rounded-md border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200">
      <p>{message}</p>
      {apiError && (
        <p className="mt-1 font-mono text-xs text-red-300/80">
          {apiError.errorCode}
          {apiError.requestId && <> · request {apiError.requestId}</>}
        </p>
      )}
    </div>
  )
}
