import { UserRole } from '../types';

export function canEditXml(role: UserRole | undefined | null): boolean {
  return role === 'Administrator' || role === 'Content Editor';
}
