export const galleryComponentIds = ['text', 'image', 'shape', 'table', 'code', 'video', 'chart', 'html'] as const
export type GalleryComponentId = typeof galleryComponentIds[number]
