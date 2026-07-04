"use client"

import * as React from "react"

/** Focuses the element with `inputId` when Cmd/Ctrl+`key` is pressed. */
export function useFocusShortcut(inputId: string, key: string = "f") {
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault()
        document.getElementById(inputId)?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [inputId, key])
}
