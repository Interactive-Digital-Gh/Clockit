import { reportDiagnostic } from "@/lib/client-diagnostics"

window.addEventListener("error", (event) => {
  reportDiagnostic(event instanceof ErrorEvent ? "javascript_error" : "resource_error", event instanceof ErrorEvent ? event.error : undefined)
}, true)
window.addEventListener("unhandledrejection", (event) => reportDiagnostic("unhandled_rejection", event.reason))
reportDiagnostic("page_loaded")
export function onRouterTransitionStart() { reportDiagnostic("navigation") }
