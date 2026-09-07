import {
  XmlDocumentModel,
  ChangeLogEntry,
  S3Config,
  S3UploadResult,
  AuditDocument,
  S3StoredDocument,
} from '../../types';

export interface XmlManagerContextType {
  document: XmlDocumentModel | null;
  rawXml: string;
  isDirty: boolean;
  history: ChangeLogEntry[];
  auditDocuments: AuditDocument[];
  s3StoredDocs: S3StoredDocument[];
  s3Config: S3Config;
  s3UploadHistory: S3UploadResult[];
  isSyncing: boolean;
  syncProgress: { step: string; percent: number };
  syncResult: S3UploadResult | null;
  loadXmlFile: (
    file: File
  ) => Promise<{ success: boolean; error?: string; fileName?: string; renamedFrom?: string }>;
  loadXmlString: (
    xml: string,
    fileName?: string
  ) => { success: boolean; error?: string; fileName?: string; renamedFrom?: string };
  updateNodeText: (nodeId: string, newText: string) => void;
  updateNodeAttribute: (nodeId: string, attrId: string, name: string, value: string) => void;
  addNodeAttribute: (nodeId: string, name: string, value: string) => void;
  deleteNodeAttribute: (nodeId: string, attrId: string) => void;
  addChildNode: (parentNodeId: string, tagName: string, textValue?: string) => void;
  deleteNode: (nodeId: string) => void;
  setRawXmlDirectly: (newRawXml: string) => { success: boolean; error?: string };
  updateS3Config: (updates: Partial<S3Config>) => void;
  performS3Sync: (
    customKey?: string,
    overwrite?: boolean
  ) => Promise<{ success: boolean; result?: S3UploadResult; error?: string; needsOverwrite?: boolean }>;
  syncExistingS3Doc: (s3Key: string, direction: 'pull' | 'push') => Promise<{ success: boolean; error?: string }>;
  loadAuditDocAsActive: (
    auditDocId: string,
    destinationKey?: string,
    overwrite?: boolean
  ) => Promise<{ success: boolean; error?: string; objectKey?: string; needsOverwrite?: boolean }>;
  createXmlFromAuditDoc: (
    auditDocId: string,
    newFileName: string,
    destinationKey?: string,
    overwrite?: boolean
  ) => Promise<{ success: boolean; fileName?: string; objectKey?: string; error?: string; needsOverwrite?: boolean }>;
  ensureStoredXml: (objectKey: string) => Promise<{ success: boolean; error?: string }>;
  suggestNameFromAuditDoc: (auditDocId: string) => string | null;
  renameActiveDocument: (
    newFileName: string,
    overwrite?: boolean
  ) => { success: boolean; fileName?: string; error?: string; needsOverwrite?: boolean };
  refreshS3Listing: (limit?: number, folderPrefix?: string, nameQuery?: string) => Promise<void>;
  isListingS3: boolean;
  listingError: string | null;
  isActiveDocumentInbound: boolean;
  s3ParentFolders: string[];
  downloadXmlFile: () => void;
}
