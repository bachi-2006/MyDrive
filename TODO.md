# MyDrive - Future Updates & Features To-Do List

## 1. Implement "Shared with Me" Functionality
- **Backend:** Update the Supabase RPCs and API endpoints to query the `folder_shares` table.
- **Frontend:** Update the `currentView === 'shared'` logic in `Explorer.tsx`. Currently, it is mocked with a placeholder ID (`00000000-0000-0000-0000-000000000000`). It needs to query Supabase for folders where the authenticated user's email exists in the `folder_shares` table.
- **Security:** Ensure Row Level Security (RLS) policies allow users to read folders/files if their email is in the `folder_shares` table for that specific folder.

## 2. Bulk Folder Downloading (ZIP Compilation)
- **Problem:** Currently, bulk downloading only works for individual files. Browsers block you from downloading entire folder structures synchronously.
- **Solution:** Create a Next.js API Route (e.g., `/api/download-zip`) or a Supabase Edge Function that takes a `folder_id` or an array of item IDs, fetches all nested files, compiles them into a `.zip` file on the server, and streams the ZIP file back to the browser.

## 3. Advanced Search & Filtering
- Add a search bar to the top of the Explorer.
- Implement a debounced Supabase `ilike` query to instantly filter files and folders by their names.
- Add filtering options (e.g., "Only show PDFs", "Only show images", "Sort by size").

## 4. Drag & Drop Visual Upgrades
- Implement visual drop-zones natively within the existing folders, allowing users to move a file from the root directory into a folder by dragging it over the folder icon.

## 5. Storage Quotas & Limits
- Display the user's total active storage usage in the Sidebar comparing it against a hard limit (e.g., `10 GB`).
- Prevent uploads when the user exceeds their allocated storage quota.

## 6. Pagination / Infinite Scroll
- If a user uploads 5,000 files to a single folder, the current query will attempt to fetch and render all 5,000 at once, lagging the browser.
- Implement standard pagination (`.range(0, 50)`) coupled with an Intersection Observer to progressively load files as the user scrolls down the page.

## 7. App Packaging & PWA Support (Native Installation)
- **Progressive Web App (PWA):** Wire up the `manifest.json` completely with a Service Worker logic to enable users to "Install" the web app directly to their computer/phone through Google Chrome or Safari.
- **Desktop Application (Tauri / Electron):** For a true desktop experience, convert the existing Next.js web application into an executable `.exe` or `.dmg` application. Using a modern engine framework like **Tauri** (Rust-based, incredibly lightweight) wrapper around the `/web` directory will instantly give users a native operating system experience.
- **Offline Mode:** Implement local caching with IndexedDB so users can browse their folder structures even if the Wi-Fi disconnects.

## 8. Theme Customization & UI Enhancements
- Inject a complete dynamic theming provider (Dark/Light mode toggle, or custom hex color accents for folders).
- Add highly interactive micro-animations for context menu pops, delete-confirms, and empty states.
- Support layout toggles between "Grid View" and "List View" for dense data scrolling.
