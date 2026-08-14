# ADR-0008: Media Pipeline — S3 + sharp + CDN

- **Status**: accepted
- **Date**: 2026-08-14

## Context

Sellers upload product images (and later video). Files must be processed
(resize, WebP/AVIF), malware/moderation-scanned, served fast, and stored
durably — without tying the API to long uploads.

## Decision

- Storage: **S3** (MinIO locally, path-style) with versioning + lifecycle.
- Uploads: **presigned PUT URLs** (client → S3 directly, API never proxies
  bytes); size/type whitelist enforced at issue time.
- Processing: worker downloads → **sharp** (thumbnails, WebP/AVIF, EXIF
  strip) → re-upload → CDN flush; moderation hook (hash-based blocklist +
  provider API) on `media_assets.status`.
- Delivery: **CloudFront CDN** with signed URLs for private content
  (optional per shop), immutable cache keys (content hash in key).

## Consequences

- API stays lean; uploads scale with S3; images are consistent (known
  sizes for the storefront).
- Malware/moderation is a worker job, not a request blocker.
- Cost: presigned-URL logic + processing queue to build and secure
  (SSRF/abuse guards on callback).

## Alternatives

- API-proxied uploads: rejected (wasteful, slow).
- Serverless transforms (Lambda) later if volume demands.
