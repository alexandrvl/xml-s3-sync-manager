import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  XmlDocumentModel,
  XmlNode,
  ChangeLogEntry,
  ChangeStatus,
  ChangeType,
  S3Config,
  S3UploadResult,
  AuditDocument,
  S3StoredDocument,
  DocumentFieldValue,
} from '../types';
import { parseXmlStringToModel, xmlModelToString, generateNodeId } from '../utils/xmlParser';
import { extractDocumentValues, extractKeySummary } from '../utils/auditHelper';
import { validateObjectKey } from '../utils/objectKey';
import {
  collectParentFolders,
  fileNameFromObjectKey,
  folderListPrefix,
  inboundObjectKey,
  isInboundObjectKey,
  objectKeyForNewCopy,
  replaceObjectKeyFileName,
  sortParentFolders,
  suggestUniqueXmlFileName,
  uniqueObjectKey,
  validateNewXmlFileName,
} from '../utils/fileName';
import { readStorage, writeStorage } from '../utils/storage';
import { getApi, isApiError } from '../api';
import { useAuth } from './AuthContext';

interface XmlManagerContextType {
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
  revertChange: (changeId: string) => void;
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
  ) => { success: boolean; error?: string; objectKey?: string; needsOverwrite?: boolean };
  createXmlFromAuditDoc: (
    auditDocId: string,
    newFileName: string,
    destinationKey?: string,
    overwrite?: boolean
  ) => { success: boolean; fileName?: string; objectKey?: string; error?: string; needsOverwrite?: boolean };
  suggestNameFromAuditDoc: (auditDocId: string) => string | null;
  renameActiveDocument: (
    newFileName: string,
    overwrite?: boolean
  ) => { success: boolean; fileName?: string; error?: string; needsOverwrite?: boolean };
  refreshS3Listing: (limit?: number, folderPrefix?: string, nameQuery?: string) => Promise<void>;
  isListingS3: boolean;
  isActiveDocumentInbound: boolean;
  s3ParentFolders: string[];
  clearHistory: () => void;
  downloadXmlFile: () => void;
}

const XmlManagerContext = createContext<XmlManagerContextType | undefined>(undefined);

const DEFAULT_S3_CONFIG: S3Config = {
  objectKey: import.meta.env.VITE_OBJECT_KEY || '',
};

function readS3Config(): S3Config {
  const saved = readStorage<Partial<S3Config> & { bucketName?: string }>('storage_config', DEFAULT_S3_CONFIG);
  const objectKey = saved.objectKey || '';
  return { objectKey: isInboundObjectKey(objectKey) ? objectKey : '' };
}

export const XmlManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, canSyncS3 } = useAuth();

  const [document, setDocument] = useState<XmlDocumentModel | null>(null);
  const [rawXml, setRawXml] = useState<string>('');
  const [history, setHistory] = useState<ChangeLogEntry[]>(() =>
    readStorage<ChangeLogEntry[]>('change_history', [])
  );

  const [s3Config, setS3Config] = useState<S3Config>(() => readS3Config());

  const [s3UploadHistory, setS3UploadHistory] = useState<S3UploadResult[]>(() =>
    readStorage<S3UploadResult[]>('upload_history', [])
  );

  const [auditDocuments, setAuditDocuments] = useState<AuditDocument[]>(() =>
    readStorage<AuditDocument[]>('audit_docs', [])
  );

  const [s3StoredDocs, setS3StoredDocs] = useState<S3StoredDocument[]>(() =>
    readStorage<S3StoredDocument[]>('stored_docs', [])
  );

  const [s3ParentFolders, setS3ParentFolders] = useState<string[]>(() =>
    collectParentFolders(readStorage<S3StoredDocument[]>('stored_docs', []))
  );

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isListingS3, setIsListingS3] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ step: string; percent: number }>({
    step: '',
    percent: 0,
  });
  const [syncResult, setSyncResult] = useState<S3UploadResult | null>(null);
  const [originObjectKey, setOriginObjectKey] = useState<string | null>(null);

  useEffect(() => {
    writeStorage('change_history', history);
  }, [history]);

  useEffect(() => {
    writeStorage('storage_config', s3Config);
  }, [s3Config]);

  useEffect(() => {
    writeStorage('upload_history', s3UploadHistory);
  }, [s3UploadHistory]);

  useEffect(() => {
    writeStorage('audit_docs', auditDocuments);
  }, [auditDocuments]);

  useEffect(() => {
    writeStorage('stored_docs', s3StoredDocs);
  }, [s3StoredDocs]);

  const recordAuditDocument = useCallback(
    (params: {
      fileName: string;
      fileSize: number;
      s3Uri?: string;
      etag?: string;
      versionId?: string;
      status: 'synced' | 'local' | 'imported';
      description: string;
      root: XmlNode;
      rawXml: string;
    }) => {
      const values = extractDocumentValues(params.root);
      const keySummary = extractKeySummary(values);

      const auditEntry: AuditDocument = {
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        fileName: params.fileName,
        fileSize: params.fileSize,
        lastModified: Date.now(),
        timestamp: new Date().toLocaleString(),
        user: user?.name || 'Local Editor',
        userEmail: user?.email || 'editor@local.company',
        s3Uri: params.s3Uri,
        etag: params.etag,
        versionId: params.versionId,
        status: params.status,
        description: params.description,
        rootTag: params.root.tagName,
        rawXml: params.rawXml,
        values,
        keySummary,
      };

      setAuditDocuments((prev) => {
        const filtered = prev.filter((d) => d.fileName !== params.fileName);
        return [auditEntry, ...filtered].slice(0, 10);
      });
    },
    [user]
  );

  const addLogEntry = useCallback(
    (
      type: ChangeType,
      nodePath: string,
      nodeTag: string,
      oldVal: string,
      newVal: string,
      desc: string,
      fieldName?: string,
      status: ChangeStatus = 'pending'
    ) => {
      const entry: ChangeLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toLocaleString(),
        timeEpoch: Date.now(),
        user: user?.name || 'Local Editor',
        userEmail: user?.email || 'editor@local.company',
        nodePath,
        nodeTag,
        changeType: type,
        fieldName,
        oldValue: oldVal,
        newValue: newVal,
        status,
        description: desc,
      };

      setHistory((prev) => [entry, ...prev]);
    },
    [user]
  );

  const usedObjectKeys = (exclude?: string) => {
    const keys = [
      ...s3StoredDocs.map((d) => d.key),
      ...(s3Config.objectKey ? [s3Config.objectKey] : []),
    ];
    if (!exclude) return keys;
    const lower = exclude.toLowerCase();
    return keys.filter((key) => key.toLowerCase() !== lower);
  };

  const storedObjectKeyExists = (objectKey: string, exclude?: string) => {
    const lower = objectKey.toLowerCase();
    const excludeLower = exclude?.toLowerCase();
    return s3StoredDocs.some((doc) => {
      const key = doc.key.toLowerCase();
      return key === lower && key !== excludeLower;
    });
  };

  const overwriteWarning = (objectKey: string) =>
    `A file named "${fileNameFromObjectKey(objectKey) || objectKey}" already exists at ${objectKey}. Continuing will overwrite it.`;

  const loadXmlString = (xmlString: string, fileName: string = 'imported.xml') => {
    const requestedName = fileName;
    const objectKey = uniqueObjectKey(inboundObjectKey(requestedName), usedObjectKeys());
    const assignedName = fileNameFromObjectKey(objectKey) || requestedName;
    const result = parseXmlStringToModel(xmlString, assignedName);
    if (result.error || !result.document) {
      return { success: false, error: result.error || 'Failed to parse XML' };
    }

    setDocument(result.document);
    setRawXml(xmlModelToString(result.document.root));
    setS3Config({ objectKey });
    setOriginObjectKey(null);

    recordAuditDocument({
      fileName: assignedName,
      fileSize: result.document.fileSize,
      status: 'imported',
      description: `Loaded XML document "${assignedName}"`,
      root: result.document.root,
      rawXml: xmlString,
    });

    addLogEntry(
      'XML_UPLOADED',
      `/${result.document.root.tagName}`,
      result.document.root.tagName,
      'None',
      assignedName,
      assignedName.toLowerCase() !== requestedName.toLowerCase()
        ? `Loaded XML as "${assignedName}" because "${requestedName}" already exists`
        : `Loaded XML document "${assignedName}" (${(result.document.fileSize / 1024).toFixed(1)} KB)`
    );

    void getApi()
      .createDocument({ fileName: assignedName, xmlContent: xmlString })
      .catch(() => undefined);

    return {
      success: true,
      fileName: assignedName,
      renamedFrom: assignedName.toLowerCase() !== requestedName.toLowerCase() ? requestedName : undefined,
    };
  };

  const loadXmlFile = async (file: File) => {
    try {
      const text = await file.text();
      return loadXmlString(text, file.name);
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  };

  // Mutator helper to traverse and update tree
  const updateTree = (
    updater: (node: XmlNode) => boolean,
    onSuccess?: (serialized: string) => void
  ) => {
    if (!document) return;
    if (!isInboundObjectKey(s3Config.objectKey)) return;

    // Deep clone root
    const rootCopy = JSON.parse(JSON.stringify(document.root)) as XmlNode;

    function traverse(curr: XmlNode): boolean {
      if (updater(curr)) return true;
      for (const child of curr.children) {
        if (traverse(child)) return true;
      }
      return false;
    }

    const modified = traverse(rootCopy);
    if (modified) {
      const newRaw = xmlModelToString(rootCopy);
      setDocument({
        ...document,
        root: rootCopy,
        rawXml: newRaw,
        version: document.version + 1,
        lastModified: Date.now(),
      });
      setRawXml(newRaw);
      onSuccess?.(newRaw);
    }
  };

  const updateNodeText = (nodeId: string, newText: string) => {
    let oldVal = '';
    let targetPath = '';
    let targetTag = '';

    updateTree((node) => {
      if (node.id === nodeId) {
        oldVal = node.textValue ?? '';
        targetPath = node.path;
        targetTag = node.tagName;
        node.textValue = newText;
        return true;
      }
      return false;
    });

    if (targetPath) {
      addLogEntry(
        'FIELD_UPDATE',
        targetPath,
        targetTag,
        oldVal,
        newText,
        `Updated value of <${targetTag}> from "${oldVal}" to "${newText}"`,
        targetTag
      );
    }
  };

  const updateNodeAttribute = (
    nodeId: string,
    attrId: string,
    attrName: string,
    attrValue: string
  ) => {
    let oldVal = '';
    let targetPath = '';
    let targetTag = '';

    updateTree((node) => {
      if (node.id === nodeId) {
        targetPath = node.path;
        targetTag = node.tagName;
        const attr = node.attributes.find((a) => a.id === attrId);
        if (attr) {
          oldVal = `${attr.name}="${attr.value}"`;
          attr.name = attrName;
          attr.value = attrValue;
          return true;
        }
      }
      return false;
    });

    if (targetPath) {
      addLogEntry(
        'ATTRIBUTE_UPDATE',
        targetPath,
        targetTag,
        oldVal,
        `${attrName}="${attrValue}"`,
        `Updated attribute on <${targetTag}> to ${attrName}="${attrValue}"`,
        attrName
      );
    }
  };

  const addNodeAttribute = (nodeId: string, name: string, value: string) => {
    let targetPath = '';
    let targetTag = '';

    updateTree((node) => {
      if (node.id === nodeId) {
        targetPath = node.path;
        targetTag = node.tagName;
        node.attributes.push({
          id: `attr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name,
          value,
        });
        return true;
      }
      return false;
    });

    if (targetPath) {
      addLogEntry(
        'ATTRIBUTE_UPDATE',
        targetPath,
        targetTag,
        'None',
        `${name}="${value}"`,
        `Added attribute ${name}="${value}" to <${targetTag}>`,
        name
      );
    }
  };

  const deleteNodeAttribute = (nodeId: string, attrId: string) => {
    let oldVal = '';
    let targetPath = '';
    let targetTag = '';

    updateTree((node) => {
      if (node.id === nodeId) {
        targetPath = node.path;
        targetTag = node.tagName;
        const idx = node.attributes.findIndex((a) => a.id === attrId);
        if (idx !== -1) {
          const removed = node.attributes[idx];
          oldVal = `${removed.name}="${removed.value}"`;
          node.attributes.splice(idx, 1);
          return true;
        }
      }
      return false;
    });

    if (targetPath) {
      addLogEntry(
        'ATTRIBUTE_UPDATE',
        targetPath,
        targetTag,
        oldVal,
        '(deleted)',
        `Removed attribute ${oldVal} from <${targetTag}>`
      );
    }
  };

  const addChildNode = (parentNodeId: string, tagName: string, textValue?: string) => {
    let targetPath = '';
    let parentTag = '';

    const newNode: XmlNode = {
      id: generateNodeId(),
      tagName,
      path: '',
      attributes: [],
      textValue: textValue ?? '',
      children: [],
      isExpanded: true,
    };

    updateTree((node) => {
      if (node.id === parentNodeId) {
        parentTag = node.tagName;
        newNode.path = `${node.path}/${tagName}[${node.children.length}]`;
        node.children.push(newNode);
        targetPath = newNode.path;
        return true;
      }
      return false;
    });

    if (targetPath) {
      const addedSnippet = `<${tagName}>${textValue || ''}</${tagName}>`;
      addLogEntry(
        'NODE_ADDED',
        targetPath,
        tagName,
        'None',
        addedSnippet,
        `Added child element <${tagName}> under <${parentTag}>`
      );
    }
  };

  const deleteNode = (nodeId: string) => {
    if (!document || document.root.id === nodeId) {
      return; // Cannot delete root
    }

    let deletedTag = '';
    let deletedPath = '';
    let deletedXmlSnippet = '';

    const rootCopy = JSON.parse(JSON.stringify(document.root)) as XmlNode;

    function removeRecursive(curr: XmlNode): boolean {
      const idx = curr.children.findIndex((c) => c.id === nodeId);
      if (idx !== -1) {
        const removed = curr.children[idx];
        deletedTag = removed.tagName;
        deletedPath = removed.path;
        deletedXmlSnippet = xmlModelToString(removed);
        curr.children.splice(idx, 1);
        return true;
      }
      for (const child of curr.children) {
        if (removeRecursive(child)) return true;
      }
      return false;
    }

    if (removeRecursive(rootCopy)) {
      const newRaw = xmlModelToString(rootCopy);
      setDocument({
        ...document,
        root: rootCopy,
        rawXml: newRaw,
        version: document.version + 1,
        lastModified: Date.now(),
      });
      setRawXml(newRaw);

      addLogEntry(
        'NODE_DELETED',
        deletedPath,
        deletedTag,
        deletedXmlSnippet || `<${deletedTag}/>`,
        '(deleted)',
        `Deleted node <${deletedTag}> at path ${deletedPath}`
      );
    }
  };

  const revertChange = (changeId: string) => {
    const entry = history.find((h) => h.id === changeId);
    if (!entry) return;

    // Mark entry as reverted
    setHistory((prev) =>
      prev.map((item) => (item.id === changeId ? { ...item, status: 'reverted' as const } : item))
    );

    // If it was a field update, try to set value back to oldValue
    if (entry.changeType === 'FIELD_UPDATE' && entry.oldValue !== 'None') {
      updateTree((node) => {
        if (node.path === entry.nodePath || node.tagName === entry.nodeTag) {
          node.textValue = entry.oldValue;
          return true;
        }
        return false;
      });

      addLogEntry(
        'REVERT',
        entry.nodePath,
        entry.nodeTag,
        entry.newValue,
        entry.oldValue,
        `Reverted change: restored <${entry.nodeTag}> to "${entry.oldValue}"`
      );
    }
  };

  const setRawXmlDirectly = (newRawXml: string) => {
    if (!isInboundObjectKey(s3Config.objectKey)) {
      return { success: false, error: 'This object is outside IN/ and cannot be edited.' };
    }
    const oldRaw = rawXml || (document ? xmlModelToString(document.root) : '');
    const parsed = parseXmlStringToModel(newRawXml, document?.fileName || 'custom.xml');
    if (parsed.error || !parsed.document) {
      return { success: false, error: parsed.error || 'Syntax error' };
    }

    setDocument(parsed.document);
    setRawXml(newRawXml);

    addLogEntry(
      'FIELD_UPDATE',
      `/${parsed.document.root.tagName}`,
      parsed.document.root.tagName,
      oldRaw,
      newRawXml,
      `Updated XML directly through Raw Source editor (${newRawXml.length} chars)`
    );

    return { success: true };
  };

  const updateS3Config = (updates: Partial<S3Config>) => {
    setS3Config((prev) => ({ ...prev, ...updates }));
  };

  const clearActiveDocument = () => {
    setDocument(null);
    setRawXml('');
    setS3Config({ objectKey: '' });
    setOriginObjectKey(null);
  };

  const performS3Sync = async (
    customKey?: string,
    overwrite?: boolean
  ): Promise<{
    success: boolean;
    result?: S3UploadResult;
    error?: string;
    needsOverwrite?: boolean;
  }> => {
    if (!canSyncS3) {
      return { success: false, error: 'Only administrators can sync documents to S3.' };
    }

    if (!document) {
      return { success: false, error: 'No XML document loaded' };
    }

    const targetKey =
      customKey ||
      (isInboundObjectKey(s3Config.objectKey)
        ? replaceObjectKeyFileName(s3Config.objectKey, document.fileName, document.fileName)
        : inboundObjectKey(document.fileName));
    if (!customKey && targetKey !== s3Config.objectKey) {
      setS3Config((prev) => ({ ...prev, objectKey: targetKey }));
    }
    const configError = validateObjectKey(targetKey);
    if (configError) {
      return { success: false, error: configError };
    }

    const inPlace = Boolean(originObjectKey) && originObjectKey?.toLowerCase() === targetKey.toLowerCase();
    if (!overwrite && !inPlace && storedObjectKeyExists(targetKey)) {
      return { success: false, needsOverwrite: true, error: overwriteWarning(targetKey) };
    }

    setIsSyncing(true);
    setSyncProgress({ step: `Uploading ${document.fileName} via API...`, percent: 15 });

    try {
      const currentXml = rawXml || xmlModelToString(document.root);
      const apiResult = await getApi().putObject({
        objectKey: targetKey,
        fileName: document.fileName,
        xmlContent: currentXml,
      });
      setSyncProgress({ step: 'Storage write complete', percent: 100 });

      const result: S3UploadResult = {
        syncId: apiResult.syncId,
        timestamp: apiResult.timestamp,
        key: apiResult.objectKey,
        etag: apiResult.etag,
        versionId: apiResult.versionId,
        sizeBytes: apiResult.sizeBytes,
        s3Uri: apiResult.storageUri,
        itemsSyncedCount: 1,
      };

      setSyncResult(result);
      setS3UploadHistory((prev) => [result, ...prev]);

      setHistory((prev) =>
        prev.map((item) =>
          item.status === 'pending'
            ? { ...item, status: 'synced' as const, s3SyncId: result.syncId }
            : item
        )
      );

      const s3DocEntry: S3StoredDocument = {
        key: targetKey,
        fileName: document.fileName,
        sizeBytes: new Blob([currentXml]).size,
        lastModified: new Date().toISOString(),
        etag: result.etag,
        versionId: result.versionId,
        s3Uri: result.s3Uri,
        content: currentXml,
      };

      setS3StoredDocs((prev) => {
        const idx = prev.findIndex((d) => d.key === targetKey);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = s3DocEntry;
          return next;
        }
        return [s3DocEntry, ...prev];
      });

      // Record in Document Audit History
      recordAuditDocument({
        fileName: document.fileName,
        fileSize: s3DocEntry.sizeBytes,
        s3Uri: result.s3Uri,
        etag: result.etag,
        versionId: result.versionId,
        status: 'synced',
        description: `Synced document: ${result.s3Uri || targetKey}`,
        root: document.root,
        rawXml: currentXml,
      });

      // Add S3 Sync log entry
      addLogEntry(
        'S3_SYNC',
        targetKey,
        's3:object',
        'Local Workspace',
        result.s3Uri || targetKey,
        `Successfully synced document "${document.fileName}" (${result.etag || result.syncId})`,
        undefined,
        'synced'
      );

      clearActiveDocument();

      return { success: true, result };
    } catch (err) {
      const errorMsg = isApiError(err) ? err.message : (err as Error).message || 'Failed to sync';
      return { success: false, error: errorMsg };
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Sync an existing document directly to/from S3 (Pull into editor or Push active document to S3 key)
   */
  const syncExistingS3Doc = async (
    s3Key: string,
    direction: 'pull' | 'push'
  ): Promise<{ success: boolean; error?: string }> => {
    if (!canSyncS3) {
      return { success: false, error: 'Only administrators can sync documents to S3.' };
    }

    if (!isInboundObjectKey(s3Key)) {
      return {
        success: false,
        error: 'Objects outside IN/ are audit-only and cannot be pulled or overwritten.',
      };
    }

    setIsSyncing(true);
    setSyncProgress({
      step: `${direction === 'pull' ? 'Pulling' : 'Pushing'} S3 document [${s3Key}]...`,
      percent: 25,
    });

    try {
      if (direction === 'pull') {
        setSyncProgress({ step: `Fetching ${s3Key}...`, percent: 55 });
        const remote = await getApi().getObject(s3Key);
        const parsed = parseXmlStringToModel(remote.xmlContent, remote.fileName);
        if (!parsed.document) {
          throw new Error(parsed.error || 'Failed to parse stored document');
        }

        setDocument(parsed.document);
        setRawXml(remote.xmlContent);
        setS3Config((prev) => ({ ...prev, objectKey: remote.objectKey }));
        setOriginObjectKey(remote.objectKey);
        setSyncProgress({ step: `Loaded "${remote.fileName}"`, percent: 100 });

        setS3StoredDocs((prev) => {
          const entry: S3StoredDocument = {
            key: remote.objectKey,
            fileName: remote.fileName,
            sizeBytes: remote.sizeBytes,
            lastModified: remote.lastModified,
            etag: remote.etag,
            versionId: remote.versionId,
            s3Uri: remote.storageUri,
            content: remote.xmlContent,
          };
          const idx = prev.findIndex((d) => d.key === s3Key);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = entry;
            return next;
          }
          return [entry, ...prev];
        });

        recordAuditDocument({
          fileName: remote.fileName,
          fileSize: remote.sizeBytes,
          s3Uri: remote.storageUri,
          etag: remote.etag,
          versionId: remote.versionId,
          status: 'synced',
          description: `Pulled document ${remote.storageUri || remote.objectKey}`,
          root: parsed.document.root,
          rawXml: remote.xmlContent,
        });

        addLogEntry(
          'S3_SYNC',
          remote.objectKey,
          's3:object',
          'Storage',
          remote.storageUri || remote.objectKey,
          `Pulled "${remote.fileName}" into the editor`
        );

        return { success: true };
      }

      if (!document) throw new Error('No active document to push');
      const currentXml = rawXml || xmlModelToString(document.root);
      const uploadResult = await getApi().putObject({
        objectKey: s3Key,
        fileName: document.fileName,
        xmlContent: currentXml,
      });

      const updatedDoc: S3StoredDocument = {
        key: s3Key,
        fileName: document.fileName,
        sizeBytes: new Blob([currentXml]).size,
        lastModified: new Date().toISOString(),
        etag: uploadResult.etag,
        versionId: uploadResult.versionId,
        s3Uri: uploadResult.storageUri,
        content: currentXml,
      };

      setS3StoredDocs((prev) => {
        const idx = prev.findIndex((d) => d.key === s3Key);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedDoc;
          return next;
        }
        return [updatedDoc, ...prev];
      });

      recordAuditDocument({
        fileName: document.fileName,
        fileSize: updatedDoc.sizeBytes,
        s3Uri: uploadResult.storageUri,
        etag: uploadResult.etag,
        versionId: uploadResult.versionId,
        status: 'synced',
        description: `Pushed document to ${uploadResult.storageUri || s3Key}`,
        root: document.root,
        rawXml: currentXml,
      });

      addLogEntry(
        'S3_SYNC',
        s3Key,
        's3:object',
        'Local Workspace',
        uploadResult.storageUri || s3Key,
        `Successfully synced document "${document.fileName}"`,
        undefined,
        'synced'
      );

      clearActiveDocument();

      return { success: true };
    } catch (err) {
      return { success: false, error: isApiError(err) ? err.message : (err as Error).message };
    } finally {
      setIsSyncing(false);
    }
  };

  const resolveValueSource = (
    id: string
  ): { fileName: string; rawXml: string; values: DocumentFieldValue[] } | null => {
    const audit = auditDocuments.find((d) => d.id === id);
    if (audit) {
      return { fileName: audit.fileName, rawXml: audit.rawXml, values: audit.values };
    }

    const s3Doc = s3StoredDocs.find((d) => d.key === id);
    if (!s3Doc) return null;

    const parsed = parseXmlStringToModel(s3Doc.content, s3Doc.fileName);
    const values = parsed.document ? extractDocumentValues(parsed.document.root) : [];
    return { fileName: s3Doc.fileName, rawXml: s3Doc.content, values };
  };

  const refreshS3Listing = useCallback(async (limit = 10, folderPrefix?: string, nameQuery?: string) => {
    const capped = Math.min(Math.max(Math.trunc(limit) || 10, 1), 200);
    const listingLimit = 200;
    const q = nameQuery?.trim().toLowerCase() || '';
    setIsListingS3(true);
    setSyncProgress({ step: 'Listing stored objects...', percent: 40 });
    try {
      const { items } = await getApi().listObjects(folderListPrefix(folderPrefix || ''), listingLimit);
      const folders = collectParentFolders(items);
      setS3ParentFolders((prev) =>
        folderPrefix ? sortParentFolders([...prev, ...folders]) : folders
      );
      const named = q
        ? items.filter((item) => {
            const fileName = item.fileName.toLowerCase();
            const key = item.objectKey.toLowerCase();
            return fileName.includes(q) || key.includes(q);
          })
        : items;
      const toLoad = named.slice(0, q ? listingLimit : capped);
      setSyncProgress({ step: 'Loading XML contents...', percent: 70 });
      const mapped = await Promise.all(
        toLoad.map(async (item) => {
          let content = '';
          try {
            const full = await getApi().getObject(item.objectKey);
            content = full.xmlContent;
          } catch {
            content = '';
          }
          return {
            key: item.objectKey,
            fileName: item.fileName,
            sizeBytes: item.sizeBytes,
            lastModified: item.lastModified,
            etag: item.etag,
            versionId: item.versionId,
            s3Uri: item.storageUri,
            content,
          };
        })
      );
      setS3StoredDocs(mapped);
      setSyncProgress({ step: 'Listing up to date', percent: 100 });
    } finally {
      setIsListingS3(false);
    }
  }, []);

  const loadAuditDocAsActive = (auditDocId: string, destinationKey?: string, overwrite?: boolean) => {
    const stored = s3StoredDocs.find((d) => d.key === auditDocId);
    if (stored && !isInboundObjectKey(stored.key)) {
      return { success: false, error: 'Objects outside IN/ are audit-only and cannot be reactivated.' };
    }
    if (auditDocId.includes('/') && !isInboundObjectKey(auditDocId)) {
      return { success: false, error: 'Objects outside IN/ are audit-only and cannot be reactivated.' };
    }
    const targetDoc = resolveValueSource(auditDocId);
    if (!targetDoc) {
      return { success: false, error: 'Source document was not found.' };
    }

    const requestedKey = (destinationKey || stored?.key || inboundObjectKey(targetDoc.fileName)).trim();
    const keyError = validateObjectKey(requestedKey);
    if (keyError) {
      return { success: false, error: keyError };
    }
    const inPlace = Boolean(stored) && requestedKey.toLowerCase() === stored!.key.toLowerCase();
    if (!overwrite && !inPlace && storedObjectKeyExists(requestedKey, stored?.key)) {
      return { success: false, needsOverwrite: true, error: overwriteWarning(requestedKey) };
    }
    const nextKey = requestedKey;

    const parsed = parseXmlStringToModel(targetDoc.rawXml, targetDoc.fileName);
    if (!parsed.document) {
      return { success: false, error: parsed.error || 'Failed to parse stored document.' };
    }

    setS3Config((prev) => ({ ...prev, objectKey: nextKey }));
    setOriginObjectKey(inPlace || overwrite ? nextKey : null);
    setDocument(parsed.document);
    setRawXml(targetDoc.rawXml);
    addLogEntry(
      'XML_UPLOADED',
      `/${parsed.document.root.tagName}`,
      parsed.document.root.tagName,
      'S3 Storage',
      nextKey,
      nextKey === stored?.key
        ? `Reactivated "${targetDoc.fileName}" in the editor`
        : `Reactivated "${targetDoc.fileName}" for folder ${nextKey}`
    );
    return { success: true, objectKey: nextKey };
  };

  const collectUsedFileNames = (exclude?: string) => {
    const names = [
      ...s3StoredDocs.map((d) => d.fileName),
      ...auditDocuments.map((d) => d.fileName),
      ...(document ? [document.fileName] : []),
    ];
    if (!exclude) return names;
    const lower = exclude.toLowerCase();
    return names.filter((n) => n.toLowerCase() !== lower);
  };

  const suggestNameFromAuditDoc = (auditDocId: string) => {
    const targetDoc = resolveValueSource(auditDocId);
    if (!targetDoc) return null;
    return suggestUniqueXmlFileName(targetDoc.fileName, collectUsedFileNames());
  };

  /**
   * Initializes a brand-new XML document using a current S3 document as template.
   * Requires a file name that does not match the source or any existing document.
   */
  const createXmlFromAuditDoc = (
    auditDocId: string,
    newFileName: string,
    destinationKey?: string,
    overwrite?: boolean
  ) => {
    const targetDoc = resolveValueSource(auditDocId);
    if (!targetDoc) {
      return { success: false, error: 'Source document was not found.' };
    }

    const validated = validateNewXmlFileName(newFileName, overwrite ? [] : collectUsedFileNames(targetDoc.fileName), {
      mustDifferFrom: overwrite ? undefined : targetDoc.fileName,
    });
    if ('error' in validated) {
      const requested = validateNewXmlFileName(newFileName, []);
      if ('fileName' in requested) {
        const conflictKey = (destinationKey || objectKeyForNewCopy('', requested.fileName)).trim();
        return { success: false, needsOverwrite: true, error: overwriteWarning(conflictKey) };
      }
      return { success: false, error: validated.error };
    }

    const generatedName = validated.fileName;
    const parsed = parseXmlStringToModel(targetDoc.rawXml, generatedName);
    if (!parsed.document) {
      return { success: false, error: parsed.error || 'Failed to parse source XML.' };
    }

    const requestedKey = (destinationKey || objectKeyForNewCopy('', generatedName)).trim();
    const keyError = validateObjectKey(requestedKey);
    if (keyError) {
      return { success: false, error: keyError };
    }
    if (!overwrite && storedObjectKeyExists(requestedKey)) {
      return { success: false, needsOverwrite: true, error: overwriteWarning(requestedKey) };
    }
    const nextKey = overwrite ? requestedKey : uniqueObjectKey(requestedKey, s3StoredDocs.map((d) => d.key));

    setDocument(parsed.document);
    setRawXml(targetDoc.rawXml);
    setOriginObjectKey(overwrite ? nextKey : null);
    setS3Config((prev) => ({
      ...prev,
      objectKey: nextKey,
    }));

    recordAuditDocument({
      fileName: generatedName,
      fileSize: parsed.document.fileSize,
      status: 'local',
      description: `Created new XML "${generatedName}" from "${targetDoc.fileName}"`,
      root: parsed.document.root,
      rawXml: targetDoc.rawXml,
    });

    addLogEntry(
      'XML_UPLOADED',
      `/${parsed.document.root.tagName}`,
      parsed.document.root.tagName,
      targetDoc.fileName,
      generatedName,
      `Created new XML document "${generatedName}" using current S3 values from "${targetDoc.fileName}"`
    );

    void getApi()
      .createDocument({ fileName: generatedName, xmlContent: targetDoc.rawXml })
      .catch(() => undefined);

    return { success: true, fileName: generatedName, objectKey: nextKey };
  };

  const renameActiveDocument = (newFileName: string, overwrite?: boolean) => {
    if (!document) {
      return { success: false, error: 'No active document to rename.' };
    }
    if (!isInboundObjectKey(s3Config.objectKey)) {
      return { success: false, error: 'Objects outside IN/ cannot be renamed.' };
    }

    const validated = validateNewXmlFileName(newFileName, overwrite ? [] : collectUsedFileNames(document.fileName));
    if ('error' in validated) {
      const requested = validateNewXmlFileName(newFileName, []);
      if ('fileName' in requested && requested.fileName.toLowerCase() !== document.fileName.toLowerCase()) {
        const conflictKey = replaceObjectKeyFileName(s3Config.objectKey, document.fileName, requested.fileName);
        return { success: false, needsOverwrite: true, error: overwriteWarning(conflictKey) };
      }
      return { success: false, error: validated.error };
    }

    const nextName = validated.fileName;
    if (nextName.toLowerCase() === document.fileName.toLowerCase()) {
      if (nextName !== document.fileName) {
        setDocument((prev) => (prev ? { ...prev, fileName: nextName } : prev));
      }
      return { success: true, fileName: nextName };
    }

    const previousName = document.fileName;
    const nextKey = replaceObjectKeyFileName(s3Config.objectKey, previousName, nextName);
    if (!overwrite && storedObjectKeyExists(nextKey, s3Config.objectKey)) {
      return { success: false, needsOverwrite: true, error: overwriteWarning(nextKey) };
    }

    setDocument((prev) => (prev ? { ...prev, fileName: nextName } : prev));
    setS3Config((prev) => ({
      ...prev,
      objectKey: nextKey,
    }));
    setOriginObjectKey(overwrite ? nextKey : null);
    addLogEntry(
      'FIELD_UPDATE',
      `/${document.root.tagName}`,
      document.root.tagName,
      previousName,
      nextName,
      `Renamed active document from "${previousName}" to "${nextName}"`
    );
    return { success: true, fileName: nextName };
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const downloadXmlFile = () => {
    if (!document) return;
    const content = rawXml || xmlModelToString(document.root);
    const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = document.fileName || 'document.xml';
    link.click();
    URL.revokeObjectURL(url);
  };

  const isDirty = history.some((h) => h.status === 'pending');
  const isActiveDocumentInbound = isInboundObjectKey(s3Config.objectKey);

  return (
    <XmlManagerContext.Provider
      value={{
        document,
        rawXml,
        isDirty,
        history,
        auditDocuments,
        s3StoredDocs,
        s3Config,
        s3UploadHistory,
        isSyncing,
        syncProgress,
        syncResult,
        loadXmlFile,
        loadXmlString,
        updateNodeText,
        updateNodeAttribute,
        addNodeAttribute,
        deleteNodeAttribute,
        addChildNode,
        deleteNode,
        revertChange,
        setRawXmlDirectly,
        updateS3Config,
        performS3Sync,
        syncExistingS3Doc,
        loadAuditDocAsActive,
        createXmlFromAuditDoc,
        suggestNameFromAuditDoc,
        renameActiveDocument,
        refreshS3Listing,
        isListingS3,
        isActiveDocumentInbound,
        s3ParentFolders,
        clearHistory,
        downloadXmlFile,
      }}
    >
      {children}
    </XmlManagerContext.Provider>
  );
};

export const useXmlManager = () => {
  const context = useContext(XmlManagerContext);
  if (!context) {
    throw new Error('useXmlManager must be used within an XmlManagerProvider');
  }
  return context;
};
