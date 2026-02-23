"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Folder, FileItem } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import {
    Folder as FolderIcon,
    File as FileIcon,
    Plus,
    Upload,
    ChevronRight,
    Loader2,
    X,
    Download,
    Share2,
    FileImage,
    MoreVertical,
    Palette,
    UserPlus,
    Trash2,
    Check,
    RotateCcw
} from "lucide-react";

export function Explorer({ currentView = 'files' }: { currentView?: 'files' | 'shared' | 'trash' }) {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [path, setPath] = useState<Folder[]>([]);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Share Folder Modal
    const [isShareFolderModalOpen, setIsShareFolderModalOpen] = useState(false);
    const [shareEmail, setShareEmail] = useState("");
    const [selectedFolderForShare, setSelectedFolderForShare] = useState<Folder | null>(null);

    // File Uploads & Drag-and-drop
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number, name: string } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Context Menu
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, folder: Folder | null } | null>(null);

    // File Preview
    const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [isDeletingFile, setIsDeletingFile] = useState(false);

    // Bulk Selection
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [isBulkActioning, setIsBulkActioning] = useState(false);

    useEffect(() => {
        fetchContents();
        setSelectedItemIds(new Set());
        setContextMenu(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentFolderId, currentView]);

    const fetchContents = async () => {
        setLoading(true);

        let folderQuery = supabase.from("folders").select("*");
        let fileQuery = supabase.from("files").select("*");

        if (currentView === 'trash') {
            folderQuery = folderQuery.eq("is_deleted", true).order("deleted_at", { ascending: false });
            fileQuery = fileQuery.eq("is_deleted", true).order("deleted_at", { ascending: false });
        } else if (currentView === 'shared') {
            folderQuery = folderQuery.eq("id", "00000000-0000-0000-0000-000000000000"); // Temporarily show nothing for shared view
            fileQuery = fileQuery.eq("id", "00000000-0000-0000-0000-000000000000");
        } else {
            folderQuery = currentFolderId
                ? folderQuery.eq("is_deleted", false).eq("parent_id", currentFolderId).order("name", { ascending: true })
                : folderQuery.eq("is_deleted", false).is("parent_id", null).order("name", { ascending: true });

            fileQuery = currentFolderId
                ? fileQuery.eq("is_deleted", false).eq("parent_folder_id", currentFolderId).order("created_at", { ascending: false })
                : fileQuery.eq("is_deleted", false).is("parent_folder_id", null).order("created_at", { ascending: false });
        }

        const [folderResult, fileResult] = await Promise.all([folderQuery, fileQuery]);

        if (folderResult.data) setFolders(folderResult.data);
        if (fileResult.data) setFiles(fileResult.data);

        setLoading(false);
    };

    // --- PREVIEWS ---
    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl(null);
            return;
        }
        const loadPreview = async () => {
            const { data } = await supabase.storage.from('vault').createSignedUrl(selectedFile.storage_path, 3600, { download: false });
            if (data?.signedUrl) setPreviewUrl(data.signedUrl);
        };
        loadPreview();
    }, [selectedFile]);

    const handleShareFile = async () => {
        if (!selectedFile) return;
        setIsSharing(true);
        const { data, error } = await supabase.storage.from('vault').createSignedUrl(selectedFile.storage_path, 604800);
        if (data?.signedUrl) {
            try {
                await navigator.clipboard.writeText(data.signedUrl);
                alert("Secure Share Link copied to clipboard! (Valid for 7 days)");
            } catch (err) {
                prompt("Copy this secure link (Valid for 7 days):", data.signedUrl);
            }
        } else {
            console.error(error);
            alert("Failed to create share link.");
        }
        setIsSharing(false);
    };

    const handleDownload = async () => {
        if (!selectedFile) return;
        const { data } = await supabase.storage.from('vault').createSignedUrl(selectedFile.storage_path, 3600, { download: true });
        if (data?.signedUrl) {
            const a = document.createElement('a');
            a.href = data.signedUrl;
            a.target = '_blank';
            a.download = selectedFile.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const handleDeleteFile = async () => {
        if (!selectedFile) return;
        if (!confirm(currentView === 'trash' ? "Permanently delete this file? This cannot be undone." : "Are you sure you want to move this file to the trash?")) return;

        setIsDeletingFile(true);
        if (currentView === 'trash') {
            await supabase.storage.from('vault').remove([selectedFile.storage_path]);
            const { error } = await supabase.from('files').delete().eq('id', selectedFile.id);
            if (!error) {
                setFiles((prev) => prev.filter(f => f.id !== selectedFile.id));
                setSelectedFile(null);
            } else {
                alert("Could not delete file: " + error.message);
            }
        } else {
            const { error } = await supabase.from('files').update({ is_deleted: true }).eq('id', selectedFile.id);
            if (!error) {
                setFiles((prev) => prev.filter(f => f.id !== selectedFile.id));
                setSelectedFile(null);
            } else {
                alert("Could not move file to trash: " + error.message);
            }
        }
        setIsDeletingFile(false);
    };

    // --- FOLDERS ---
    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        setIsCreating(true);
        const { data, error } = await supabase.from("folders").insert({
            name: newFolderName.trim(),
            parent_id: currentFolderId,
            color: "#3b82f6"
        }).select().single();

        if (!error && data) {
            setFolders((prev) => [...prev, data as Folder].sort((a, b) => a.name.localeCompare(b.name)));
            setIsCreateModalOpen(false);
            setNewFolderName("");
        }
        setIsCreating(false);
    };

    const navigateToFolder = (folder: Folder) => {
        setPath((prev) => [...prev, folder]);
        setCurrentFolderId(folder.id);
        setContextMenu(null);
        setSelectedItemIds(new Set());
    };

    const navigateToBreadcrumb = (index: number) => {
        if (index === -1) {
            setPath([]);
            setCurrentFolderId(null);
        } else {
            const newPath = path.slice(0, index + 1);
            setPath(newPath);
            setCurrentFolderId(newPath[newPath.length - 1].id);
        }
        setSelectedItemIds(new Set());
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;
        setIsUploading(true);
        try {
            const mappedFiles = Array.from(fileList).map(f => {
                let path = "";
                if (f.webkitRelativePath) {
                    const parts = f.webkitRelativePath.split('/');
                    parts.pop(); // Remove filename
                    path = parts.join('/');
                }
                return { file: f, path };
            });
            await uploadFilesDirectly(mappedFiles);
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to upload to the Vault.");
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
            if (event.target) event.target.value = '';
        }
    };

    const uploadFilesDirectly = async (fileList: { file: File, path: string }[]) => {
        const folderCache = new Map<string, string | null>();
        if (currentFolderId) folderCache.set("", currentFolderId);

        for (let i = 0; i < fileList.length; i++) {
            setUploadProgress({ current: i + 1, total: fileList.length, name: fileList[i].file.name });
            const { file, path } = fileList[i];

            let parentId = currentFolderId;

            // Build parent folders for drag-and-dropped directories recursively
            if (path) {
                const parts = path.split('/').filter(Boolean);
                let builtPath = "";
                let currentParent = currentFolderId;

                for (const part of parts) {
                    builtPath = builtPath ? `${builtPath}/${part}` : part;
                    if (folderCache.has(builtPath)) {
                        currentParent = folderCache.get(builtPath)!;
                    } else {
                        // Check if exists first to avoid duplicate folder recreation
                        const query = supabase.from('folders').select('id').eq('name', part).eq('is_deleted', false);
                        if (currentParent) query.eq('parent_id', currentParent);
                        else query.is('parent_id', null);

                        const { data: searchData } = await query.maybeSingle();

                        if (searchData) {
                            currentParent = searchData.id;
                            folderCache.set(builtPath, currentParent);
                        } else {
                            const { data: newFolder } = await supabase.from('folders').insert({
                                name: part,
                                parent_id: currentParent,
                                color: '#3b82f6'
                            }).select().single();

                            if (newFolder) {
                                currentParent = newFolder.id;
                                folderCache.set(builtPath, currentParent);
                                // Make it visible instantly if it belongs to root view
                                if (currentParent === currentFolderId || (!currentFolderId && builtPath === part)) {
                                    setFolders(prev => {
                                        if (!prev.find(f => f.id === newFolder.id)) {
                                            return [...prev, newFolder as Folder].sort((a, b) => a.name.localeCompare(b.name));
                                        }
                                        return prev;
                                    });
                                }
                            }
                        }
                    }
                }
                parentId = currentParent;
            }

            // Storage Upload Procedure
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const fileId = crypto.randomUUID();
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const storagePath = `originals/${year}/${month}/${fileId}_${safeName}`;

            const { error: uploadError } = await supabase.storage.from("vault")
                .upload(storagePath, file, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type || "application/octet-stream"
                });
            if (uploadError) throw uploadError;

            // Tie record to its real nested parent structure
            const { data: dbData, error: dbError } = await supabase.from("files").insert({
                filename: file.name,
                mime_type: file.type || "application/octet-stream",
                size: file.size,
                storage_path: storagePath,
                parent_folder_id: parentId
            }).select().single();

            if (dbError) throw dbError;
            // Only add to interface visually if it's dropped purely inside the active folder visually
            if (dbData && parentId === currentFolderId) setFiles((prev) => [dbData as FileItem, ...prev]);
        }
    };

    // --- DRAG AND DROP HANDLERS ---
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const { items, files } = e.dataTransfer;

        if (!items || items.length === 0) return;
        setIsUploading(true);

        try {
            const fileArray: { file: File, path: string }[] = [];

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry();
                    if (entry) {
                        await scanFiles(entry, fileArray, entry.isDirectory ? entry.name : "");
                    } else if (files[i]) {
                        fileArray.push({ file: files[i], path: "" });
                    }
                }
            }

            if (fileArray.length > 0) {
                await uploadFilesDirectly(fileArray);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to upload dragged items.");
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    };

    const scanFiles = async (entry: FileSystemEntry, fileArray: { file: File, path: string }[], currentPath: string = ""): Promise<void> => {
        if (entry.isFile) {
            return new Promise((resolve) => {
                (entry as FileSystemFileEntry).file((file: File) => {
                    fileArray.push({ file, path: currentPath });
                    resolve();
                });
            });
        } else if (entry.isDirectory) {
            const dirReader = (entry as FileSystemDirectoryEntry).createReader();
            return new Promise((resolve) => {
                const readAll = () => {
                    dirReader.readEntries(async (entries: FileSystemEntry[]) => {
                        if (entries.length === 0) {
                            resolve();
                        } else {
                            for (let i = 0; i < entries.length; i++) {
                                const childPath = entries[i].isDirectory ? (currentPath ? `${currentPath}/${entries[i].name}` : entries[i].name) : currentPath;
                                await scanFiles(entries[i], fileArray, childPath);
                            }
                            readAll();
                        }
                    });
                };
                readAll();
            });
        }
    };

    // --- CONTEXT MENU ACTIONS ---
    const handleContextMenu = (e: React.MouseEvent, folder: Folder) => {
        e.preventDefault();
        setContextMenu({ x: e.pageX, y: e.pageY, folder });
    };

    const handleChangeColor = async (folderId: string, color: string) => {
        setFolders(folders.map(f => f.id === folderId ? { ...f, color } : f));
        await supabase.from("folders").update({ color }).eq("id", folderId);
        setContextMenu(null);
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm("Move to trash?")) return;
        setFolders(folders.filter(f => f.id !== folderId));
        await supabase.rpc('soft_delete_folder_recursive', { target_folder_id: folderId });
        setContextMenu(null);
    };

    const handleRestoreFolder = async (folderId: string) => {
        setFolders(folders.filter(f => f.id !== folderId));
        await supabase.rpc('restore_folder_recursive', { target_folder_id: folderId });
        setContextMenu(null);
    };

    const handlePermanentDeleteFolder = async (folderId: string) => {
        if (!confirm("Permanently delete this folder and all its items? This cannot be undone.")) return;

        // Fetch all files nested under this folder to delete from Storage bucket
        const { data: allNestedFiles } = await supabase.rpc('get_all_nested_files_for_folder', { target_folder_id: folderId });
        if (allNestedFiles && allNestedFiles.length > 0) {
            const storagePaths = allNestedFiles.map((f: { storage_path: string }) => f.storage_path);
            await supabase.storage.from('vault').remove(storagePaths);
        }

        setFolders(folders.filter(f => f.id !== folderId));
        await supabase.from('folders').delete().eq('id', folderId);
        setContextMenu(null);
    };

    const executeShareFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFolderForShare || !shareEmail) return;
        setIsCreating(true);
        const { error } = await supabase.from('folder_shares').insert({
            folder_id: selectedFolderForShare.id,
            shared_email: shareEmail
        });
        if (error) {
            if (error.code === '23505') alert("This user already has access.");
            else alert("Failed to share folder: " + error.message);
        } else {
            alert(`Folder successfully shared securely with ${shareEmail}`);
        }
        setIsCreating(false);
        setIsShareFolderModalOpen(false);
        setShareEmail("");
        setSelectedFolderForShare(null);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('.context-menu-container') || target.closest('.file-inspect-modal')) return;
            setContextMenu(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const FOLDER_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#64748b"];

    // --- BULK ACTIONS ---
    const toggleSelection = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedItemIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAll = () => {
        const allIds = [...folders.map(f => f.id), ...files.map(f => f.id)];
        if (selectedItemIds.size === allIds.length && allIds.length > 0) {
            setSelectedItemIds(new Set());
        } else {
            setSelectedItemIds(new Set(allIds));
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(currentView === 'trash' ? `Are you sure you want to PERMANENTLY delete ${selectedItemIds.size} items?` : `Are you sure you want to move ${selectedItemIds.size} items to the trash?`)) return;

        setIsBulkActioning(true);
        try {
            const foldersToDelete = folders.filter(f => selectedItemIds.has(f.id));
            const filesToDelete = files.filter(f => selectedItemIds.has(f.id));

            if (currentView === 'trash') {
                const storagePathsToRemove: string[] = [];

                if (foldersToDelete.length > 0) {
                    for (const folder of foldersToDelete) {
                        const { data: nestedFiles } = await supabase.rpc('get_all_nested_files_for_folder', { target_folder_id: folder.id });
                        if (nestedFiles) storagePathsToRemove.push(...nestedFiles.map((f: { storage_path: string }) => f.storage_path));
                    }
                    const folderIds = foldersToDelete.map(f => f.id);
                    await supabase.from('folders').delete().in('id', folderIds);
                }

                if (filesToDelete.length > 0) {
                    storagePathsToRemove.push(...filesToDelete.map(f => f.storage_path));
                    const fileIds = filesToDelete.map(f => f.id);
                    await supabase.from('files').delete().in('id', fileIds);
                }

                if (storagePathsToRemove.length > 0) {
                    await supabase.storage.from('vault').remove(storagePathsToRemove);
                }
            } else {
                for (const f of foldersToDelete) {
                    await supabase.rpc('soft_delete_folder_recursive', { target_folder_id: f.id });
                }

                if (filesToDelete.length > 0) {
                    const fileIds = filesToDelete.map(f => f.id);
                    await supabase.from('files').update({ is_deleted: true }).in('id', fileIds);
                }
            }

            setFolders(prev => prev.filter(f => !selectedItemIds.has(f.id)));
            setFiles(prev => prev.filter(f => !selectedItemIds.has(f.id)));
            setSelectedItemIds(new Set());
        } catch (e) {
            console.error(e);
            alert("Failed to delete some items.");
        } finally {
            setIsBulkActioning(false);
        }
    };

    const handleBulkDownload = async () => {
        const filesToDownload = files.filter(f => selectedItemIds.has(f.id));
        const foldersSelected = folders.filter(f => selectedItemIds.has(f.id));

        if (foldersSelected.length > 0) {
            alert("We currently cannot bulk-download massive folders (requires zip compilation). Please select only files for bulk download.");
            return;
        }

        for (const file of filesToDownload) {
            const { data } = await supabase.storage.from('vault').createSignedUrl(file.storage_path, 3600, { download: true });
            if (data?.signedUrl) {
                const a = document.createElement('a');
                a.href = data.signedUrl;
                a.target = '_blank';
                // a.download doesn't always work securely cross-origin unless forced in storage settings, but we try:
                a.download = file.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        }
    };

    const handleBulkShare = () => {
        alert("Bulk secure folder-sharing generates complex permissions matrices. Please share nested folders individually for now!");
    };

    return (
        <div
            className="w-full flex flex-col gap-6 relative"
            onContextMenu={(e) => contextMenu && e.preventDefault()}
        >

            {/* Top Bar: Breadcrumbs & Actions */}
            <div className="glass-panel border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center shadow-lg w-full">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm text-zinc-400 overflow-x-auto whitespace-nowrap scrollbar-hide w-full sm:w-auto">
                    <button
                        onClick={() => navigateToBreadcrumb(-1)}
                        className={`hover:text-white transition-colors flex items-center gap-1.5 ${!currentFolderId ? 'text-white font-medium bg-white/10 px-3 py-1.5 rounded-lg' : 'px-3 py-1.5'}`}
                    >
                        <FolderIcon className="w-4 h-4" /> Root
                    </button>

                    {path.map((folder, idx) => (
                        <div key={folder.id} className="flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-zinc-600" />
                            <button
                                onClick={() => navigateToBreadcrumb(idx)}
                                className={`hover:text-white transition-colors truncate max-w-[150px] ${idx === path.length - 1 ? 'text-white font-medium bg-white/10 px-3 py-1.5 rounded-lg' : 'px-3 py-1.5'}`}
                            >
                                {folder.name}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                    {folders.length > 0 || files.length > 0 ? (
                        <button
                            onClick={handleSelectAll}
                            className="text-sm font-medium text-zinc-400 hover:text-white px-3 py-2 bg-white/5 rounded-lg transition-colors border border-white/5 shadow-sm"
                        >
                            Select All
                        </button>
                    ) : null}
                    {currentView === 'files' && (
                        <>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium border border-white/5 shadow-sm"
                            >
                                <Plus className="w-4 h-4" /> New Folder
                            </button>

                            {isUploading ? (
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-80 cursor-wait text-white px-4 py-2 rounded-xl text-sm font-medium border border-blue-400/20 min-w-[140px]">
                                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                    {uploadProgress ? (
                                        <div className="flex flex-col items-center truncate max-w-full w-full px-1">
                                            <span className="text-xs">{uploadProgress.current} / {uploadProgress.total}</span>
                                            <div className="w-full bg-black/40 h-1 rounded-full mt-1 overflow-hidden min-w-[60px]">
                                                <div className="bg-white h-full transition-all" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
                                            </div>
                                        </div>
                                    ) : (
                                        <span>Syncing...</span>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-2 rounded-xl transition-colors text-sm font-medium shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] border border-blue-400/20"
                                    >
                                        <Upload className="w-4 h-4 shrink-0" /> Files
                                    </button>
                                    <button
                                        onClick={() => folderInputRef.current?.click()}
                                        className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-2 rounded-xl transition-colors text-sm font-medium shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] border border-blue-400/20"
                                    >
                                        <FolderIcon className="w-4 h-4 shrink-0" /> Folder
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        onChange={handleFileUpload}
                    />
                    <input
                        type="file"
                        ref={folderInputRef}
                        className="hidden"
                        // @ts-expect-error webkitdirectory is non standard but widely supported
                        webkitdirectory="true"
                        directory="true"
                        multiple
                        onChange={handleFileUpload}
                    />
                </div>
            </div>

            {/* Main Content Area */}
            <div
                onDragOver={currentView === 'files' ? handleDragOver : undefined}
                onDragLeave={currentView === 'files' ? handleDragLeave : undefined}
                onDrop={currentView === 'files' ? handleDrop : undefined}
                className={`glass rounded-3xl p-6 min-h-[600px] border shadow-2xl relative transition-colors ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-white/5'}`}
            >
                {/* Drag Overlay */}
                <AnimatePresence>
                    {isDragging && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-blue-900/20 backdrop-blur-sm rounded-3xl border-2 border-dashed border-blue-500 pointer-events-none"
                        >
                            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                                <Upload className="w-10 h-10 text-blue-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2 tracking-tight shadow-md">Drop anything here</h3>
                            <p className="text-blue-200">Files and massive folders will instantly upload to the Vault.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    folders.length === 0 && files.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
                            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mb-6 shadow-inner">
                                <FolderIcon className="w-10 h-10 opacity-50" />
                            </div>
                            <p className="text-white text-xl font-medium tracking-tight mb-2">This folder is empty</p>
                            <p className="text-sm">Drag and drop files, or use the buttons above.</p>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {/* Folders */}
                            {folders.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-zinc-500 mb-4 tracking-widest uppercase ml-1">Folders</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {folders.map((folder, idx) => (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                transition={{ duration: 0.2, delay: idx * 0.03 }}
                                                key={folder.id}
                                                onContextMenu={(e) => handleContextMenu(e, folder)}
                                                onClick={() => navigateToFolder(folder)}
                                                className={`group relative glass-panel ${selectedItemIds.has(folder.id) ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'} rounded-2xl p-4 flex flex-col items-start gap-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg`}
                                            >
                                                {/* Checkbox */}
                                                <button
                                                    onClick={(e) => toggleSelection(e, folder.id)}
                                                    className={`absolute top-3 left-3 z-10 p-1 rounded-md transition-opacity duration-200 ${selectedItemIds.has(folder.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 bg-black/40 backdrop-blur-md border border-white/20'}`}
                                                >
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedItemIds.has(folder.id) ? 'bg-blue-500 border-blue-500' : 'border-white/40'}`}>
                                                        {selectedItemIds.has(folder.id) && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                                    </div>
                                                </button>

                                                <div className="flex justify-between w-full pl-6">
                                                    {/* Color dynamic icon */}
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-inner" style={{ backgroundColor: `${folder.color || '#3b82f6'}20`, color: folder.color || '#3b82f6' }}>
                                                        <FolderIcon className="w-6 h-6" style={{ fill: `${folder.color || '#3b82f6'}40` }} />
                                                    </div>
                                                    <button className="text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleContextMenu(e, folder)}>
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                </div>
                                                <span className="text-sm font-medium text-zinc-200 group-hover:text-white truncate w-full pr-2 text-left">
                                                    {folder.name}
                                                </span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Files */}
                            {files.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-zinc-500 mb-4 tracking-widest uppercase ml-1">Files</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                                        {files.map((file, idx) => {
                                            const isImage = file.mime_type?.startsWith('image/');
                                            const isVideo = file.mime_type?.startsWith('video/');

                                            return (
                                                <motion.button
                                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                                                    key={file.id}
                                                    onClick={() => setSelectedFile(file)}
                                                    className={`group relative glass-panel ${selectedItemIds.has(file.id) ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20' : 'bg-zinc-900/50 hover:bg-zinc-800/80 border-white/5 hover:border-white/10'} rounded-2xl p-4 flex flex-col items-center gap-3 text-center transition-all duration-200 shadow-sm`}
                                                >
                                                    {/* Checkbox */}
                                                    <div
                                                        onClick={(e) => toggleSelection(e, file.id)}
                                                        className={`absolute top-3 left-3 z-10 p-1 rounded-md transition-opacity duration-200 ${selectedItemIds.has(file.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 bg-black/40 backdrop-blur-md border border-white/20'}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedItemIds.has(file.id) ? 'bg-blue-500 border-blue-500' : 'border-white/40'}`}>
                                                            {selectedItemIds.has(file.id) && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                                        </div>
                                                    </div>

                                                    <div className="w-16 h-16 rounded-[1rem] bg-gradient-to-tr from-zinc-800 to-zinc-700/50 flex items-center justify-center group-hover:scale-105 transition-all duration-300 shadow-md">
                                                        {isImage ? (
                                                            <FileImage className="w-7 h-7 text-blue-400" />
                                                        ) : isVideo ? (
                                                            <FileIcon className="w-7 h-7 text-indigo-400" />
                                                        ) : (
                                                            <FileIcon className="w-7 h-7 text-zinc-400" />
                                                        )}
                                                    </div>
                                                    <span className="text-[13px] font-medium text-zinc-300 group-hover:text-white truncate w-full">
                                                        {file.filename}
                                                    </span>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>

            {/* Context Menu Dropdown */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed z-[100] glass-panel bg-zinc-900/90 border border-white/10 rounded-xl p-2 shadow-2xl backdrop-blur-3xl min-w-[200px] context-menu-container"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 py-2 border-b border-white/5 mb-1">
                            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider truncate">{contextMenu.folder?.name}</p>
                        </div>

                        <div className="p-2 mb-1">
                            <p className="text-[10px] text-zinc-500 mb-2 font-medium">SET COLOR</p>
                            <div className="flex gap-2">
                                {FOLDER_COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => handleChangeColor(contextMenu.folder!.id, c)}
                                        className="w-5 h-5 rounded-full hover:scale-125 transition-transform border border-black"
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        {currentView === 'trash' ? (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRestoreFolder(contextMenu.folder!.id); }}
                                    className="w-full mt-1 text-left px-3 py-2 text-sm text-green-400 hover:text-white hover:bg-green-500/20 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <RotateCcw className="w-4 h-4" /> Restore Folder
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handlePermanentDeleteFolder(contextMenu.folder!.id); }}
                                    className="w-full mt-1 text-left px-3 py-2 text-sm text-red-500 hover:text-white hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" /> Delete Forever
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedFolderForShare(contextMenu.folder);
                                        setIsShareFolderModalOpen(true);
                                        setContextMenu(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <UserPlus className="w-4 h-4 text-blue-400" /> Secure Share
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(contextMenu.folder!.id); }}
                                    className="w-full mt-1 text-left px-3 py-2 text-sm text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" /> Move to Trash
                                </button>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Share Folder Modal */}
            <AnimatePresence>
                {isShareFolderModalOpen && selectedFolderForShare && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                            onClick={() => !isCreating && setIsShareFolderModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="glass bg-zinc-950 border border-white/10 rounded-[2rem] p-8 w-full max-w-md relative z-10 shadow-2xl"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
                                <Share2 className="w-7 h-7 text-blue-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Access Control</h2>
                            <p className="text-sm text-zinc-400 mb-8">Grant specific email access to the folder <strong className="text-white">&quot;{selectedFolderForShare.name}&quot;</strong>.</p>

                            <form onSubmit={executeShareFolder}>
                                <div className="space-y-1 mb-6">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Guest Email</label>
                                    <input
                                        autoFocus
                                        type="email"
                                        required
                                        value={shareEmail}
                                        onChange={(e) => setShareEmail(e.target.value)}
                                        placeholder="colleague@company.com"
                                        disabled={isCreating}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsShareFolderModalOpen(false)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-3.5 rounded-xl transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!shareEmail.trim() || isCreating}
                                        className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50 font-medium py-3.5 rounded-xl transition-all flex justify-center items-center gap-2"
                                    >
                                        {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Invite"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Bulk Actions Floating Bar */}
            <AnimatePresence>
                {selectedItemIds.size > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[90] glass bg-zinc-900/95 border border-white/10 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-6"
                    >
                        <span className="text-white font-medium text-sm whitespace-nowrap bg-blue-500 text-blue-50 px-3 py-1 rounded-full">{selectedItemIds.size} Selected</span>

                        <div className="w-px h-6 bg-white/10" />

                        {currentView === 'files' && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); handleBulkDownload(); }} className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors">
                                    <Download className="w-4 h-4" /> Download
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleBulkShare(); }} className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors">
                                    <Share2 className="w-4 h-4" /> Share
                                </button>
                            </>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleBulkDelete(); }} disabled={isBulkActioning} className={`flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 ${currentView === 'trash' ? 'text-red-500 hover:text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg' : 'text-red-500 hover:text-red-400'}`}>
                            {isBulkActioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {currentView === 'trash' ? 'Delete Forever' : 'Delete'}
                        </button>

                        <div className="w-px h-6 bg-white/10" />

                        <button onClick={(e) => { e.stopPropagation(); setSelectedItemIds(new Set()); }} className="p-1.5 -mr-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Existing File Inspect & Folder Modals */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                            onClick={() => !isCreating && setIsCreateModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="glass bg-zinc-950 border border-white/10 rounded-[2rem] p-8 w-full max-w-sm relative z-10 shadow-2xl"
                        >
                            <h2 className="text-xl font-medium text-white mb-6">Create Folder</h2>
                            <form onSubmit={handleCreateFolder}>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    placeholder="Enter folder name..."
                                    disabled={isCreating}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-6"
                                />
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 text-sm text-zinc-400 hover:text-white">Cancel</button>
                                    <button
                                        type="submit"
                                        disabled={!newFolderName.trim() || isCreating}
                                        className="flex-1 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white font-medium py-3 rounded-xl transition-all flex justify-center items-center gap-2"
                                    >
                                        {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* File Inspection Modal (Preserved & Upgraded Look) */}
                {selectedFile && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                            onClick={() => setSelectedFile(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="glass bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden w-full max-w-4xl relative z-10 shadow-2xl flex flex-col file-inspect-modal"
                        >
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                                <h2 className="text-base font-semibold text-white truncate pr-8">{selectedFile.filename}</h2>
                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="bg-black/95 p-4 md:p-8 flex items-center justify-center min-h-[500px] w-full">
                                {!previewUrl ? (
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                ) : selectedFile.mime_type?.startsWith('image/') ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={previewUrl} alt={selectedFile.filename} className="max-w-full max-h-[600px] object-contain rounded-xl shadow-2xl ring-1 ring-white/10" />
                                ) : selectedFile.mime_type?.startsWith('video/') ? (
                                    <video src={previewUrl} controls className="max-w-full max-h-[600px] rounded-xl shadow-2xl ring-1 ring-white/10" />
                                ) : selectedFile.mime_type === 'application/pdf' ? (
                                    <iframe src={previewUrl} className="w-full h-full min-h-[60vh] max-h-[85vh] rounded-xl shadow-2xl ring-1 ring-white/10 bg-white" />
                                ) : (
                                    <div className="flex flex-col items-center text-zinc-500 gap-4">
                                        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
                                            <FileIcon className="w-10 h-10 opacity-50" />
                                        </div>
                                        <p className="font-medium text-zinc-400">No visual preview available for {selectedFile.mime_type}.</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-5 bg-zinc-900 border-t border-white/5 flex gap-3 justify-end items-center">
                                <span className="text-xs text-zinc-500 font-medium mr-auto hidden sm:block">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.mime_type}</span>
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl transition-colors text-sm font-medium"
                                >
                                    <Download className="w-4 h-4" /> Original
                                </button>
                                <button
                                    onClick={handleDeleteFile}
                                    disabled={isDeletingFile}
                                    className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 disabled:opacity-50 px-5 py-2.5 rounded-xl transition-colors text-sm font-medium min-w-[120px]"
                                >
                                    {isDeletingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    <span>{currentView === 'trash' ? 'Delete Forever' : 'Delete'}</span>
                                </button>
                                <button
                                    onClick={handleShareFile}
                                    disabled={isSharing}
                                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl transition-colors text-sm font-medium shadow-[0_0_15px_rgba(37,99,235,0.4)] ml-auto sm:ml-0 min-w-[130px]"
                                >
                                    {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                                    {isSharing ? "Generating..." : "Copy Link"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
