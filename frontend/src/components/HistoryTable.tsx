import React from 'react';
import { DocumentAuditView } from './DocumentAuditView';

interface HistoryTableProps {
  onSwitchToEditor?: () => void;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ onSwitchToEditor }) => {
  return <DocumentAuditView onSwitchToEditor={onSwitchToEditor} />;
};
