from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.config import Settings
from app.models import StoredObject, StoredObjectSummary, http_error


def _existing_file(path: str, label: str) -> str:
    resolved = Path(path).expanduser()
    if not resolved.is_file():
        raise FileNotFoundError(
            f"{label} not found: {resolved}. Configure a readable PEM path, "
            "or leave the setting empty until a certificate is provided."
        )
    return str(resolved.resolve())


def s3_verify(settings: Settings) -> bool | str:
    """TLS verification for the S3 client.

    When ``s3_ca_bundle`` is set, boto3 verifies the server with that enterprise
    PKI CA (or CA chain). When unset, boto3 keeps its default (certifi / system
    CAs). HTTP endpoints such as local SeaweedFS are unchanged.
    """
    bundle = settings.s3_ca_bundle.strip()
    if not bundle:
        return True
    return _existing_file(bundle, "S3 CA bundle")


def s3_client_cert(settings: Settings) -> str | tuple[str, str] | None:
    cert = settings.s3_client_cert.strip()
    if not cert:
        return None
    cert_path = _existing_file(cert, "S3 client certificate")
    key = settings.s3_client_key.strip()
    if not key:
        return cert_path
    return cert_path, _existing_file(key, "S3 client private key")


class S3Store:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        config_kwargs: dict = {"s3": {"addressing_style": settings.s3_addressing_style}}
        client_cert = s3_client_cert(settings)
        if client_cert is not None:
            config_kwargs["client_cert"] = client_cert
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            verify=s3_verify(settings),
            config=Config(**config_kwargs),
        )
        self.bucket = settings.s3_bucket

    def ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError as exc:
            code = str(exc.response.get("Error", {}).get("Code", ""))
            if code in {"404", "NoSuchBucket", "NotFound"}:
                self.client.create_bucket(Bucket=self.bucket)
                return
            raise

    def put_xml(self, object_key: str, xml_content: str, file_name: str, if_match: str | None = None) -> dict:
        body = xml_content.encode("utf-8")
        kwargs: dict = {
            "Bucket": self.bucket,
            "Key": object_key,
            "Body": body,
            "ContentType": "application/xml",
            "Metadata": {"filename": file_name},
        }
        if if_match:
            kwargs["IfMatch"] = if_match
        try:
            response = self.client.put_object(**kwargs)
        except ClientError as exc:
            code = str(exc.response.get("Error", {}).get("Code", ""))
            if code in {"PreconditionFailed", "412"}:
                raise http_error(409, "conflict", "Object was modified. Refresh and try again.") from exc
            raise http_error(502, "storage_error", "Could not write the object to storage.") from exc
        last_modified = datetime.now(timezone.utc).isoformat()
        return {
            "etag": (response.get("ETag") or "").strip('"'),
            "version_id": response.get("VersionId"),
            "size_bytes": len(body),
            "last_modified": last_modified,
            "storage_uri": f"s3://{self.bucket}/{quote(object_key)}",
        }

    def get_xml(self, object_key: str) -> StoredObject:
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=object_key)
        except ClientError as exc:
            code = str(exc.response.get("Error", {}).get("Code", ""))
            if code in {"NoSuchKey", "404", "NotFound"}:
                raise http_error(404, "not_found", f"Object not found: {object_key}") from exc
            raise http_error(502, "storage_error", "Could not read the object from storage.") from exc
        try:
            body = response["Body"].read().decode("utf-8")
        except UnicodeDecodeError as exc:
            raise http_error(400, "validation_error", "Object is not UTF-8 XML.") from exc
        last_modified = response.get("LastModified")
        modified = last_modified.astimezone(timezone.utc).isoformat() if last_modified else datetime.now(timezone.utc).isoformat()
        file_name = (response.get("Metadata") or {}).get("filename") or object_key.rsplit("/", 1)[-1]
        etag = (response.get("ETag") or "").strip('"')
        return StoredObject(
            object_key=object_key,
            file_name=file_name,
            size_bytes=response.get("ContentLength") or len(body.encode("utf-8")),
            last_modified=modified,
            etag=etag or None,
            version_id=response.get("VersionId"),
            storage_uri=f"s3://{self.bucket}/{quote(object_key)}",
            xml_content=body,
        )

    def list_objects(self, prefix: str | None, limit: int) -> list[StoredObjectSummary]:
        kwargs: dict = {"Bucket": self.bucket, "MaxKeys": max(1, min(limit, 1000))}
        if prefix:
            kwargs["Prefix"] = prefix
        try:
            response = self.client.list_objects_v2(**kwargs)
        except ClientError as exc:
            raise http_error(502, "storage_error", "Could not list objects.") from exc
        items: list[StoredObjectSummary] = []
        for obj in response.get("Contents") or []:
            key = obj["Key"]
            last_modified = obj.get("LastModified")
            modified = (
                last_modified.astimezone(timezone.utc).isoformat()
                if last_modified
                else datetime.now(timezone.utc).isoformat()
            )
            etag = (obj.get("ETag") or "").strip('"')
            items.append(
                StoredObjectSummary(
                    object_key=key,
                    file_name=key.rsplit("/", 1)[-1],
                    size_bytes=int(obj.get("Size") or 0),
                    last_modified=modified,
                    etag=etag or None,
                    storage_uri=f"s3://{self.bucket}/{quote(key)}",
                )
            )
        items.sort(key=lambda item: item.last_modified, reverse=True)
        return items[:limit]
