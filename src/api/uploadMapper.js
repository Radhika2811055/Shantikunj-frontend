const toNonEmptyString = (value) => {
    if (typeof value !== 'string') return ''
    return value.trim()
}

const normalizeUploadItem = (item) => {
    if (!item || typeof item !== 'object') return null

    const fileUrl = toNonEmptyString(item.fileUrl || item.url)
    if (!fileUrl) return null

    const metadata = {
        provider: toNonEmptyString(item.provider || item.storageProvider),
        publicId: toNonEmptyString(item.publicId || item.public_id),
        resourceType: toNonEmptyString(item.resourceType || item.resource_type),
        format: toNonEmptyString(item.format),
        bytes: Number.isFinite(Number(item.bytes)) ? Number(item.bytes) : null,
        uploadedAt: toNonEmptyString(item.uploadedAt || item.createdAt)
    }

    return {
        fileUrl,
        provider: metadata.provider || undefined,
        publicId: metadata.publicId || undefined,
        resourceType: metadata.resourceType || undefined,
        format: metadata.format || undefined,
        bytes: metadata.bytes,
        uploadedAt: metadata.uploadedAt || undefined,
        metadata
    }
}

export const mapUploadResponseFiles = (responseData) => {
    const files = Array.isArray(responseData?.files) ? responseData.files : []
    const fallbackSingle = responseData?.fileUrl ? [{ fileUrl: responseData.fileUrl }] : []
    const source = files.length > 0 ? files : fallbackSingle

    const normalizedFiles = source
        .map((item) => normalizeUploadItem(item))
        .filter(Boolean)

    const fileUrls = normalizedFiles.map((item) => item.fileUrl)

    return {
        fileUrls,
        files: normalizedFiles,
        fileMeta: normalizedFiles.map((item) => item.metadata)
    }
}
