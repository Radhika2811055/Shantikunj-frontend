const toBytes = (mb) => mb * 1024 * 1024

export const translationUploadRules = {
    maxFileSizeBytes: toBytes(25),
    acceptedExtensions: ['pdf', 'doc', 'docx', 'txt'],
    acceptedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ]
}

export const audioUploadRules = {
    maxFileSizeBytes: toBytes(100),
    acceptedExtensions: ['mp3', 'mp4'],
    acceptedMimeTypes: ['audio/mpeg', 'audio/mp4', 'video/mp4']
}

const getExtension = (fileName) => {
    const parts = String(fileName || '').split('.')
    return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

export const validateFiles = (files, rules, label) => {
    if (!Array.isArray(files) || files.length === 0) {
        return { valid: false, message: `Please select at least one ${label} file.` }
    }

    for (const file of files) {
        const extension = getExtension(file?.name)
        const hasAcceptedExtension = rules.acceptedExtensions.includes(extension)
        const hasAcceptedMimeType = rules.acceptedMimeTypes.includes(String(file?.type || '').toLowerCase())

        if (!hasAcceptedExtension && !hasAcceptedMimeType) {
            return {
                valid: false,
                message: `${file?.name || 'Selected file'} is not a supported ${label} file type.`
            }
        }

        if (Number(file?.size || 0) > rules.maxFileSizeBytes) {
            const sizeInMb = Math.round(rules.maxFileSizeBytes / (1024 * 1024))
            return {
                valid: false,
                message: `${file?.name || 'Selected file'} exceeds ${sizeInMb}MB limit.`
            }
        }
    }

    return { valid: true, message: '' }
}
