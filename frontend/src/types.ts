export type UserRole = 'Administrator' | 'Content Editor' | 'Viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  authProvider?: 'local' | 'remote' | 'entra' | 'test';
}

export interface XmlAttribute {
  id: string;
  name: string;
  value: string;
}

export interface XmlNode {
  id: string;
  tagName: string;
  path: string;
  attributes: XmlAttribute[];
  textValue?: string;
  children: XmlNode[];
  isExpanded?: boolean;
}

export interface XmlDocumentModel {
  fileName: string;
  fileSize: number;
  lastModified: number;
  root: XmlNode;
  rawXml: string;
  version: number;
}

export type ChangeType =
  | 'FIELD_UPDATE'
  | 'ATTRIBUTE_UPDATE'
  | 'NODE_ADDED'
  | 'NODE_DELETED'
  | 'S3_SYNC'
  | 'XML_UPLOADED'
  | 'REVERT';

export type ChangeStatus = 'pending' | 'synced' | 'failed' | 'reverted';

export interface DocumentFieldValue {
  path: string;
  tag: string;
  value: string;
}

export interface AuditDocument {
  id: string;
  fileName: string;
  fileSize: number;
  lastModified: number;
  timestamp: string;
  user: string;
  userEmail: string;
  s3Uri?: string;
  etag?: string;
  versionId?: string;
  status: 'synced' | 'local' | 'imported';
  description: string;
  rawXml: string;
  rootTag: string;
  values: DocumentFieldValue[];
  keySummary: { tag: string; value: string }[];
}

export interface S3StoredDocument {
  key: string;
  fileName: string;
  sizeBytes: number;
  lastModified: string;
  etag?: string;
  versionId?: string;
  s3Uri?: string;
  content: string;
}

export interface ChangeLogEntry {
  id: string;
  timestamp: string;
  timeEpoch: number;
  user: string;
  userEmail: string;
  nodePath: string;
  nodeTag: string;
  changeType: ChangeType;
  fieldName?: string;
  oldValue: string;
  newValue: string;
  status: ChangeStatus;
  s3SyncId?: string;
  description: string;
}

export interface S3Config {
  objectKey: string;
}

export interface S3UploadResult {
  syncId: string;
  timestamp: string;
  key: string;
  etag?: string;
  versionId?: string;
  sizeBytes: number;
  s3Uri?: string;
  itemsSyncedCount: number;
}

export type ThemeMode = 'light' | 'dark';

export interface BrandConfig {
  companyName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  themeMode: ThemeMode;
  borderRadius: number;
}
