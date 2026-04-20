# Image Upload & Display Fix - Complete Guide

## Problem

Images uploaded in templates were showing as broken image icons when opening the template in the canvas editor.

## Root Causes Identified & Fixed

### 1. **Missing Type Definition for `rawCss` and `rawJs`**

- **Issue**: The `Template` interface didn't include `rawCss` and `rawJs` optional fields
- **Impact**: TypeScript was ignoring these fields even though they were being saved to Firestore
- **Fix**: Updated [src/types/index.ts](src/types/index.ts) to include:
  ```typescript
  export interface Template {
    // ... existing fields ...
    rawCss?: string; // ✅ Added
    rawJs?: string; // ✅ Added
  }
  ```

### 2. **Base64 Encoding Size Limit**

- **Issue**: Firestore has a 1MB document size limit. Base64-encoded images are ~33% larger than the original files
- **Impact**: Large templates with many/large images would exceed the limit and fail to save
- **Fix**: Switched from base64 embedding to **Firebase Storage uploads**

### 3. **Missing Firebase Storage Configuration**

- **Issue**: Firebase Storage wasn't exported from [src/firebase.ts](src/firebase.ts)
- **Fix**: Added Storage export:
  ```typescript
  import { getStorage } from "firebase/storage";
  export const storage = getStorage(app);
  ```

## How the Image Pipeline Works Now

### Upload Flow (TemplateUpload.tsx)

```
1. User uploads template ZIP
   ↓
2. Extract images from `images/` folder
   ↓
3. Upload each image to Firebase Storage at:
   `templates/{templateId}/images/{filename}`
   ↓
4. Get download URLs from Firebase Storage
   ↓
5. Replace all image references in HTML/CSS with these URLs:
   - <img src="./images/hero.png"> → <img src="https://firebasestorage.../hero.png">
   - background-image: url(./images/bg.png) → background-image: url(https://firebasestorage.../bg.png)
   ↓
6. Save template to Firestore (now with external URLs, not embedded data)
```

### Canvas Display Flow (Canvas.tsx → EditorPage.tsx)

```
1. User opens editor
   ↓
2. EditorPage fetches template from Firestore (includes rawCss with image URLs)
   ↓
3. Canvas.tsx receives template via store
   ↓
4. writeIframe() extracts rawCss from template
   ↓
5. buildIframeHtml() injects rawCss as inline <style> tag in iframe
   ↓
6. Iframe loads and renders - images display from Firebase Storage URLs ✅
```

## Debugging Logs Added

Open browser DevTools Console (F12) and look for these logs:

### Template Upload Logs

```javascript
[extractImages] All ZIP files: [...]
[extractImages] Found image path: images/hero.png, hasImageExt: true
[extractImages] Found N image files
[uploadImages] Uploading N images to Firebase Storage
[uploadImages] ✅ Uploaded: hero.png
[embedImages] Replaced src for: images/hero.png
[embedImages] Replaced url() for: images/bg.png
[TemplateUpload] rawCss sample (first 500 chars): ...
[TemplateUpload] Document size: X.XX MB (limit: 1 MB)
```

### Canvas Display Logs

```javascript
[Canvas.writeIframe] rawCss present: true, length: XXXX
[Canvas.writeIframe] rawCss sample (first 300 chars): ...
```

## Testing Steps

### 1. Prepare a Template ZIP

Create a template ZIP with this structure:

```
template.zip
├── index.html          (with data-block sections)
├── public/
│   ├── style.css       (with background-image URLs)
│   └── script.js       (optional)
└── images/
    ├── hero.png
    ├── logo.svg
    └── background.jpg
```

### 2. Upload Template (Admin)

1. Go to Admin Panel → Upload Template
2. Select your ZIP file
3. Watch the upload progress and console logs
4. You should see:
   - "Uploading images..." message
   - Console logs showing uploaded images
   - Final message showing N images uploaded

### 3. Assign Template to User

1. After upload succeeds, find the template in the template list
2. Click "Assign" and select a user
3. Save

### 4. Open in Canvas (User/Editor)

1. Log in as the assigned user
2. Click "Open with Editor"
3. Wait for template to load
4. **Images should now display in the canvas** ✅
5. Check console for `[Canvas.writeIframe] rawCss present: true`

## File Changes Summary

| File                                      | Change                                                             | Reason                             |
| ----------------------------------------- | ------------------------------------------------------------------ | ---------------------------------- |
| `src/types/index.ts`                      | Added `rawCss?: string` and `rawJs?: string` to Template interface | Proper TypeScript typing           |
| `src/firebase.ts`                         | Exported `storage` from Firebase                                   | Enable Storage operations          |
| `src/components/admin/TemplateUpload.tsx` | Added Firebase Storage upload function; Updated embedding logic    | Use Storage URLs instead of base64 |
| `src/components/editor/Canvas.tsx`        | Removed `(as any)` cast for rawCss access                          | Use proper typing                  |
| `src/store/editorStore.ts`                | No changes needed                                                  | Store already preserves rawCss     |

## Performance Considerations

### Before (Base64)

- ✅ No external dependencies
- ❌ Images loaded inline - large document size (1MB limit)
- ❌ Slower initial render
- ❌ More bandwidth per user

### After (Firebase Storage)

- ✅ Small Firestore documents (<500KB typically)
- ✅ Images cached by CDN
- ✅ Faster render
- ✅ Shared bandwidth across users
- ⚠️ Requires Firebase Storage bucket

## Troubleshooting

### Images still showing as broken?

1. **Check console for errors**:

   ```
   Missing file in ZIP? → "NO IMAGES FOUND in ZIP"
   Upload failed? → Look for [uploadImages] error logs
   rawCss not passed to Canvas? → Check [Canvas.writeIframe] logs
   ```

2. **Verify Firebase Storage rules** (in Firebase Console):
   - Navigate to Storage → Rules
   - Ensure public read access or authenticated read:

   ```
   allow read: if request.auth != null;
   ```

3. **Check image folder name**:
   - Must be named exactly `images/` (lowercase)
   - Must be at root of ZIP (not nested deeper)

4. **Large images failing?**:
   - Individual images should be under 10MB
   - Check browser console for upload errors
   - Consider compressing images before upload

### Still not working?

1. Open browser DevTools Console (F12)
2. Go through template upload process
3. Share the console logs showing:
   - What files are found in ZIP
   - Whether images are detected
   - Whether upload succeeds
   - Whether rawCss makes it to Canvas

## Security Notes

- Images stored in Firebase Storage at: `templates/{templateId}/images/`
- Only users with access to the template can see the images
- Storage URLs are public download links (standard for CDN)
- Consider Firebase Storage rules for additional control

## Future Improvements

- [ ] Add image compression during upload
- [ ] Generate thumbnails for template preview
- [ ] Support for image cropping in editor
- [ ] Bulk image import from URL list
