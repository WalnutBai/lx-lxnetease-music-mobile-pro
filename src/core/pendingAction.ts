type PendingAction = {
  type: 'searchFocus' | 'songlistImport'
  data?: any
}

let pendingAction: PendingAction | null = null

export const setPendingAction = (action: PendingAction) => {
  pendingAction = action
}

export const consumePendingAction = (type: PendingAction['type']): any | null => {
  if (pendingAction && pendingAction.type === type) {
    const data = pendingAction.data
    pendingAction = null
    return data
  }
  return null
}

export const hasPendingAction = (type: PendingAction['type']): boolean => {
  return pendingAction?.type === type
}
