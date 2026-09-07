from fastapi import APIRouter, Depends, Query, Response, status

from app.auth import get_current_user, require_editor
from app.deps import get_workspace
from app.models import (
    ChangeEntry,
    ChangeList,
    CreateChangeRequest,
    CreateDocumentRequest,
    Document,
    DocumentList,
    UpdateDocumentRequest,
    User,
)
from app.workspace import WorkspaceStore

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("", response_model=DocumentList)
def list_documents(
    limit: int = Query(50, ge=1, le=200),
    q: str | None = None,
    _user: User = Depends(get_current_user),
    store: WorkspaceStore = Depends(get_workspace),
) -> DocumentList:
    return DocumentList(items=store.list_documents(limit, q))


@router.post("", response_model=Document, status_code=status.HTTP_201_CREATED)
def create_document(
    body: CreateDocumentRequest,
    _user: User = Depends(require_editor),
    store: WorkspaceStore = Depends(get_workspace),
) -> Document:
    return store.create_document(body)


@router.get("/{document_id}", response_model=Document)
def get_document(
    document_id: str,
    _user: User = Depends(get_current_user),
    store: WorkspaceStore = Depends(get_workspace),
) -> Document:
    return store.get_document(document_id)


@router.put("/{document_id}", response_model=Document)
def update_document(
    document_id: str,
    body: UpdateDocumentRequest,
    _user: User = Depends(require_editor),
    store: WorkspaceStore = Depends(get_workspace),
) -> Document:
    return store.update_document(document_id, body)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    _user: User = Depends(require_editor),
    store: WorkspaceStore = Depends(get_workspace),
) -> Response:
    store.delete_document(document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{document_id}/changes", response_model=ChangeList)
def list_changes(
    document_id: str,
    limit: int = Query(50, ge=1, le=200),
    _user: User = Depends(get_current_user),
    store: WorkspaceStore = Depends(get_workspace),
) -> ChangeList:
    return ChangeList(items=store.list_changes(document_id, limit))


@router.post("/{document_id}/changes", response_model=ChangeEntry, status_code=status.HTTP_201_CREATED)
def append_change(
    document_id: str,
    body: CreateChangeRequest,
    user: User = Depends(require_editor),
    store: WorkspaceStore = Depends(get_workspace),
) -> ChangeEntry:
    return store.append_change(document_id, body, user.name, user.email)
