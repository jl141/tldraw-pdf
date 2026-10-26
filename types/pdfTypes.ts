import type { Box, TLAssetId, TLShapeId } from 'tldraw'

export interface PdfPage {
	src: string
	bounds: Box
	assetId: TLAssetId
	shapeId: TLShapeId
}

export interface Pdf {
	id: string
	name: string
	pages: PdfPage[]
	source: string | ArrayBuffer
}

// File System Access API types (Chromium only; not in TypeScript's DOM lib)
export interface PdfFileHandle {
	name: string
	getFile(): Promise<File>
	isSameEntry(other: PdfFileHandle): Promise<boolean>
	queryPermission(opts: { mode: 'read' }): Promise<PermissionState>
	requestPermission(opts: { mode: 'read' }): Promise<PermissionState>
}

export interface RecentPdf {
	id: string
	name: string
	handle: PdfFileHandle
	lastOpened: number
}
