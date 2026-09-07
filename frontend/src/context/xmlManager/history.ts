import { ChangeLogEntry, ChangeStatus, ChangeType } from '../../types';

export function isDirtyHistory(history: ChangeLogEntry[]): boolean {
  return history.some((h) => h.status === 'pending');
}

export function createLogEntry(
  userName: string,
  userEmail: string,
  type: ChangeType,
  nodePath: string,
  nodeTag: string,
  oldVal: string,
  newVal: string,
  desc: string,
  fieldName?: string,
  status: ChangeStatus = 'pending'
): ChangeLogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleString(),
    timeEpoch: Date.now(),
    user: userName,
    userEmail,
    nodePath,
    nodeTag,
    changeType: type,
    fieldName,
    oldValue: oldVal,
    newValue: newVal,
    status,
    description: desc,
  };
}
