# Frontend Integration Summary

## Architecture Changes

- Added strict runtime config validation in `src/config/runtimeConfig.js`.
- Added centralized API client in `src/api/httpClient.js` with:
  - Bearer token injection
  - unified error parsing integration
  - retry policy only for idempotent `GET` failures (network/5xx)
  - global unauthorized event dispatch
  - tracked in-flight request cancellation support
- Added global API guards hook in `src/hooks/useGlobalApiGuards.js`:
  - unauthorized response -> logout + redirect to `/login`
  - cancel in-flight requests on route change
- Added typed service modules (JSDoc typed where needed) in `src/api/services/*`.
- Added upload response mapping in `src/api/uploadMapper.js`.
- Added upload file validation in `src/utils/uploadValidation.js`.

## Endpoint Mapping Table

### Auth

- `POST /api/auth/register` -> `authService.register`
- `POST /api/auth/login` -> `authService.login`
- `GET /api/auth/me` -> `authService.me`
- `GET /api/auth/language-members` -> `authService.languageMembers`
- `POST /api/auth/forgot-password` -> `authService.forgotPassword`
- `POST /api/auth/reset-password/:token` -> `authService.resetPassword`
- `GET /api/auth/google` -> `authService.googleLoginEntry`
- `GET /api/auth/google/callback` -> `authService.googleCallback`

### Admin

- `GET /api/admin/users/pending` -> `adminService.getPendingUsers`
- `GET /api/admin/users/all` -> `adminService.getAllUsers`
- `PUT /api/admin/users/:userId/approve` -> `adminService.approveUser`
- `PUT /api/admin/users/:userId/reject` -> `adminService.rejectUser`
- `DELETE /api/admin/users/:userId` -> `adminService.deleteUser`

### Books

- `POST /api/books` -> `booksService.createBook`
- `GET /api/books` -> `booksService.listBooks`
- `GET /api/books/my-assignments` -> `booksService.myAssignments`
- `GET /api/books/:bookId` -> `booksService.getBook`
- `PUT /api/books/:bookId/versions/:versionId/assign` -> `booksService.assignVersion`
- `PUT /api/books/:bookId/versions/:versionId/reassign` -> `booksService.reassignVersion`
- `PUT /api/books/:bookId/versions/:versionId/blocker` -> `booksService.setBlocker`
- `PUT /api/books/:bookId/versions/:versionId/publish` -> `booksService.publishVersion`
- `PUT /api/books/:bookId/versions/:versionId/text-status` -> `booksService.updateTextStatus`
- `PUT /api/books/:bookId/versions/:versionId/audio-status` -> `booksService.updateAudioStatus`
- `POST /api/books/upload-translation-doc` -> `booksService.uploadTranslationDocument`
- `POST /api/books/upload-audio-file` -> `booksService.uploadAudioFile`
- `POST /api/books/:bookId/versions/:versionId/submit-translation` -> `booksService.submitTranslation`
- `POST /api/books/:bookId/versions/:versionId/submit-vetted-text` -> `booksService.submitVettedText`
- `PUT /api/books/:bookId/versions/:versionId/spoc-review` -> `booksService.submitSpocReview`
- `POST /api/books/:bookId/versions/:versionId/submit-audio` -> `booksService.submitAudio`
- `POST /api/books/:bookId/versions/:versionId/submit-audio-review` -> `booksService.submitAudioReview`
- `PUT /api/books/:bookId/versions/:versionId/spoc-audio-approval` -> `booksService.submitSpocAudioApproval`

### Claims

- `POST /api/claims/books/:bookId/send-interest` -> `claimsService.sendInterest`
- `POST /api/claims/books/:bookId/claim` -> `claimsService.claimBook`
- `GET /api/claims/available` -> `claimsService.available`
- `GET /api/claims/my-claim` -> `claimsService.myClaim`
- `GET /api/claims/my-history` -> `claimsService.myHistory`

### Feedback

- `POST /api/feedback/books/:bookId/versions/:versionId` -> `feedbackService.submit`
- `GET /api/feedback/books/:bookId/versions/:versionId` -> `feedbackService.list`
- `GET /api/feedback/books/:bookId/versions/:versionId/summary` -> `feedbackService.summary`

### Notifications

- `GET /api/notifications/my` -> `notificationsService.myNotifications`
- `PUT /api/notifications/:notificationId/read` -> `notificationsService.markRead`
- `PUT /api/notifications/read-all` -> `notificationsService.markAllRead`
- `DELETE /api/notifications/:notificationId` -> `notificationsService.deleteNotification`
- `DELETE /api/notifications/cleanup/old` -> `notificationsService.cleanupOld`

### Support

- `POST /api/support` -> `supportService.create`
- `GET /api/support/my` -> `supportService.myRequests`
- `GET /api/support` -> `supportService.allRequests`
- `PUT /api/support/:requestId/status` -> `supportService.updateStatus`

### Audit

- `GET /api/audit` -> `auditService.list`

## UI Integration Notes

- Added `Support Center` page at `/support` for all authenticated roles:
  - create support ticket
  - list my requests
  - SPOC/admin status management view
- Added `Audit Logs` page at `/audit` for `admin` and `spoc`:
  - filter by language/action/limit
- Updated role-based sidebar navigation for Support/Audit entries.

## Upload Metadata Handling

### Translation submit payload

`TranslatorUpload` now sends:

- `textFileUrl`
- `textFileUrls`
- `textFiles` (objects with `fileUrl` + metadata)
- `textFileMeta` (metadata-only array)

### Audio submit payload

`RecorderUpload` now sends:

- `audioUrl`
- `audioUrls`
- `audioFiles` (objects with `fileUrl` + metadata)
- `audioFileMeta` (metadata-only array)

Backward compatibility:

- If upload endpoint returns only single URL, payload still includes legacy URL fields.

## Env Setup

Required:

- `VITE_API_BASE_URL`

Example:

```bash
VITE_API_BASE_URL=http://localhost:5000
```

## Test Checklist

- Auth guard redirects unauthenticated and unauthorized users.
- API client derives base URL from env and supports cancel detection.
- Upload mapping converts backend upload response to URL + metadata structure.

Files:

- `src/components/ProtectedRoute.test.jsx`
- `src/api/httpClient.test.js`
- `src/api/uploadMapper.test.js`

## Known Limitations

- Some legacy pages still call `api` instance directly instead of service wrappers; they still benefit from centralized interceptors and guards.
- Exact support/audit response shapes can vary by backend deployment; UI uses tolerant parsing and may need minor field mapping tweaks if backend payload names differ.
- OAuth callback handling remains query-token based as currently implemented by backend flow.
