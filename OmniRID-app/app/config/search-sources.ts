// Raw page and component sources used to build the automatic search index.
// This module is imported dynamically (see `loadAutoSearchIndex`) so all the
// sources ship as a single, lazily-loaded chunk that is only fetched when the
// user actually opens the search palette.
export const pageSources = import.meta.glob<string>('../pages/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true
})

export const componentSources = import.meta.glob<string>('../components/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true
})
