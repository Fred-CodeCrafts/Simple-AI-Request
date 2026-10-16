import * as React from 'react'

interface ToastState {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  open: boolean
}

type ToastAction =
  | { type: 'ADD_TOAST'; toast: Omit<ToastState, 'open'> }
  | { type: 'DISMISS_TOAST'; id: string }
  | { type: 'REMOVE_TOAST'; id: string }

let count = 0
function generateId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function reducer(state: ToastState[], action: ToastAction): ToastState[] {
  switch (action.type) {
    case 'ADD_TOAST':
      return [{ ...action.toast, open: true }, ...state].slice(0, 5)
    case 'DISMISS_TOAST':
      return state.map(t => t.id === action.id ? { ...t, open: false } : t)
    case 'REMOVE_TOAST':
      return state.filter(t => t.id !== action.id)
  }
}

const listeners: Array<(state: ToastState[]) => void> = []
let memoryState: ToastState[] = []

function dispatch(action: ToastAction) {
  memoryState = reducer(memoryState, action)
  listeners.forEach(l => l(memoryState))
}

function toast({ title, description, variant }: {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}) {
  const id = generateId()
  dispatch({ type: 'ADD_TOAST', toast: { id, title, description, variant } })
  const timeout = setTimeout(() => {
    dispatch({ type: 'DISMISS_TOAST', id })
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', id }), 300)
  }, 5000)
  toastTimeouts.set(id, timeout)
  return id
}

export function useToast() {
  const [state, setState] = React.useState<ToastState[]>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const idx = listeners.indexOf(setState)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return {
    toasts: state,
    toast,
    dismiss: (id: string) => dispatch({ type: 'DISMISS_TOAST', id }),
  }
}

export { toast }
