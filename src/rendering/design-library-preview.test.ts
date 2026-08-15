import { describe, expect, it } from 'vitest'
import { renderDesignLibraryPreview } from './design-library-preview'

describe('Design Library preview dialog contract', () => {
  it('renders one accessible native dialog with a stable content host', () => {
    const html = renderDesignLibraryPreview()

    expect(html).toContain('<dialog')
    expect(html).toContain('data-testid="design-library-preview"')
    expect(html).toContain('data-design-library-preview-content')
    expect(html).toContain('data-design-library-preview-close')
    expect(html).toContain('aria-labelledby="design-library-preview-title"')
  })
})
