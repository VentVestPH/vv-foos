import { parseZohoNumber, parseZohoTimestamp } from './zoho.mjs';
import { ATTACHMENT_KIND_BY_LABEL, looksLikeIdentityDocument, resolveStaff } from './lookups.mjs';

export function buildCategoryMap(categoryRecords) {
  const byId = new Map();
  for (const row of categoryRecords) {
    const id = (row['Attachment Category Id'] ?? '').trim();
    const label = (row['Label'] ?? '').trim();
    if (id && label) byId.set(id, label);
  }
  return byId;
}

export function mapAttachment(row, lookups, unresolved, resolveParent, categoryById, options) {
  const warnings = [];
  const zohoId = (row['Attachment Id'] ?? '').trim();
  if (!zohoId) return { skip: 'no Attachment Id', warnings };

  const fileName = (row['File Name'] ?? '').trim();
  if (!fileName) return { skip: 'no File Name', warnings };

  const parentZohoId = (row['Parent Id'] ?? '').trim();
  const parentId = parentZohoId ? resolveParent('candidate', parentZohoId) : null;
  if (!parentId) {
    unresolved.parent.set(`candidate:${parentZohoId}`, 1);
    return { skip: `parent candidate not imported: ${parentZohoId || '(blank)'}`, warnings };
  }

  const categoryId = (row['Attachment Category Id'] ?? '').trim();
  const label = categoryById.get(categoryId) ?? null;
  if (!label) {
    unresolved.category.set(categoryId || '(blank)', 1);
    return { skip: `unknown Attachment Category Id: ${categoryId || '(blank)'}`, warnings };
  }

  const kind = ATTACHMENT_KIND_BY_LABEL.get(label);
  if (!kind) {
    unresolved.category.set(label, 1);
    return { skip: `category has no attachment_kind mapping: ${label}`, warnings };
  }

  const identity = looksLikeIdentityDocument(fileName);
  if (identity && !options.includeIdentityDocuments) {
    return {
      skip: 'looks like an identity or employment record; needs --include-identity-documents',
      identity: true,
      warnings,
    };
  }
  if (identity) warnings.push('imported as an identity or employment record by explicit flag');

  const url = (row['Attachment URL'] ?? '').trim();
  if (!url) {
    warnings.push('no Attachment URL in the export, so no file bytes; metadata only');
  }

  const uploadedAt = parseZohoTimestamp(row['Created Time']);

  return {
    zohoId,
    fileName,
    hasBytes: Boolean(url),
    attachment: {
      // Deliberately namespaced so a metadata-only row can never be mistaken for
      // an uploaded file, and so the later bulk file import can find and replace it.
      storage_path: `zoho-import/pending/${parentId}/${fileName}`,
      parent_type: 'person',
      parent_id: parentId,
      kind,
      description: `Zoho category: ${label}`,
      file_size_bytes: parseZohoNumber(row['Size']),
      uploaded_by: resolveStaff(lookups, row['Attachment Owner Id'], unresolved),
      ...(uploadedAt ? { uploaded_at: uploadedAt } : {}),
    },
    warnings,
  };
}
