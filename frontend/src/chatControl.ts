// Lets any page open Dan (optionally asking a question) without prop-drilling into the widget.
const EVENT = 'cc:open-dan'

export function openDan(question?: string) {
  window.dispatchEvent(new CustomEvent<string | undefined>(EVENT, { detail: question }))
}

export function onOpenDan(handler: (question?: string) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<string | undefined>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
