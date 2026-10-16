const SETTINGS_KEY = 'portal_ai_tool_settings'

export interface PortalAIToolSettings {
  defaultAiToolId?: string
  isChangeable: boolean
}

export function getPortalAIToolSettings(): PortalAIToolSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        defaultAiToolId: parsed.defaultAiToolId || undefined,
        isChangeable: Boolean(parsed.isChangeable),
      }
    }
  } catch {
    // ignore localStorage errors
  }
  return {
    defaultAiToolId: undefined,
    isChangeable: false,
  }
}

export function savePortalAIToolSettings(settings: PortalAIToolSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore localStorage errors
  }
}
