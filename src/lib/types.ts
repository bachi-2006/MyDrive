export interface Folder {
    id: string;
    name: string;
    color: string;
    parent_id: string | null;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
    deleted_at: string | null;
}

export interface FileItem {
    id: string;
    filename: string;
    mime_type: string;
    size: number;
    storage_path: string;
    checksum: string;
    parent_folder_id: string | null;
    created_at: string;
    updated_at: string;
    is_deleted: boolean;
    deleted_at: string | null;
}

export type DbResult<T> = T | null;
