import '@fontsource-variable/archivo/wght.css'
import '@fontsource-variable/ibm-plex-sans/wght.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/ibm-plex-mono/700.css'
import '@fontsource-variable/noto-sans-sc'
import '@fontsource-variable/noto-serif-sc'
import '@fontsource-variable/source-serif-4/wght.css'
import '../../style.css'
import { resolveAppMode } from './app-mode'

const mode = resolveAppMode(location)
if (mode === 'overview') await import('./overview-entry')
else if (mode === 'library') await import('./design-library-entry')
else if (mode === 'decks') await import('./deck-library-entry')
else await import('./presentation-entry')
