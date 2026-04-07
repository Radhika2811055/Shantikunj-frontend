import { describe, expect, it } from 'vitest'
import { mapUploadResponseFiles } from './uploadMapper'

describe('mapUploadResponseFiles', () => {
    it('maps file URLs and metadata from files array', () => {
        const input = {
            files: [
                {
                    fileUrl: 'https://cdn.example.com/a.pdf',
                    provider: 'cloudinary',
                    publicId: 'books/a',
                    resourceType: 'raw',
                    format: 'pdf',
                    bytes: 12345,
                    uploadedAt: '2026-04-08T10:00:00.000Z'
                }
            ]
        }

        const result = mapUploadResponseFiles(input)

        expect(result.fileUrls).toEqual(['https://cdn.example.com/a.pdf'])
        expect(result.files[0]).toMatchObject({
            fileUrl: 'https://cdn.example.com/a.pdf',
            provider: 'cloudinary',
            publicId: 'books/a',
            resourceType: 'raw',
            format: 'pdf',
            bytes: 12345
        })
        expect(result.fileMeta[0]).toMatchObject({
            provider: 'cloudinary',
            publicId: 'books/a',
            resourceType: 'raw',
            format: 'pdf',
            bytes: 12345
        })
    })

    it('falls back to single fileUrl response', () => {
        const result = mapUploadResponseFiles({ fileUrl: 'https://cdn.example.com/fallback.mp3' })
        expect(result.fileUrls).toEqual(['https://cdn.example.com/fallback.mp3'])
        expect(result.files).toHaveLength(1)
    })
})
