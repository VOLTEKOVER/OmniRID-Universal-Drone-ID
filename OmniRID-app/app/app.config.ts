export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'slate',
      success: 'green',
      warning: 'amber',
      error: 'red'
    },

    button: {
      defaultVariants: {
        color: 'neutral',
        variant: 'soft'
      }
    },

    badge: {
      defaultVariants: {
        color: 'neutral',
        variant: 'subtle'
      }
    },

    card: {
      slots: {
        root: 'rounded-md bg-default ring ring-default',
        header: 'px-4 py-3',
        body: 'p-4',
        footer: 'px-4 py-3'
      }
    },

    tabs: {
      slots: {
        root: 'gap-0'
      }
    },

    kbd: {
      base: 'inline-flex items-center justify-center px-1 rounded-sm font-medium font-mono uppercase'
    },

    formField: {
      slots: {
        label: 'block text-xs font-medium uppercase tracking-wide text-dimmed'
      }
    },

    input: {
      slots: {
        base: 'rounded-md'
      }
    },

    textarea: {
      slots: {
        base: 'rounded-md'
      }
    },

    select: {
      slots: {
        base: 'rounded-md',
        content: 'rounded-md shadow-md ring ring-default',
        separator: '-mx-1 my-1 h-px bg-accented'
      }
    },

    popover: {
      slots: {
        content: 'rounded-md shadow-md ring ring-default',
        arrow: 'fill-bg stroke-default'
      }
    },

    dropdownMenu: {
      slots: {
        content: 'rounded-md shadow-md ring ring-default',
        separator: '-mx-1 my-1 h-px bg-accented'
      }
    },

    navigationMenu: {
      slots: {
        viewport: 'rounded-md shadow-md ring ring-default',
        separator: 'px-2 h-px bg-accented'
      }
    },

    commandPalette: {
      slots: {
        empty: 'py-6 text-center text-sm text-muted'
      }
    },

    modal: {
      slots: {
        content: 'rounded-md shadow-md',
        header: 'px-4 py-3 min-h-(--ui-header-height)',
        body: 'p-4',
        footer: 'px-4 py-3',
        title: 'text-highlighted font-semibold tracking-tight',
        close: 'absolute top-4 end-4'
      }
    },

    slideover: {
      slots: {
        content: 'rounded-md',
        header: 'px-4 py-3 min-h-(--ui-header-height)',
        body: 'p-4',
        footer: 'px-4 py-3',
        title: 'text-highlighted font-semibold tracking-tight'
      }
    },

    tooltip: {
      slots: {
        content: 'rounded-sm shadow-sm ring ring-default'
      }
    },

    toast: {
      slots: {
        root: 'rounded-md shadow-md ring ring-default',
        title: 'text-sm font-semibold text-highlighted tracking-tight'
      }
    },

    alert: {
      slots: {
        root: 'rounded-md',
        title: 'text-sm font-semibold tracking-tight'
      }
    },

    empty: {
      slots: {
        root: 'rounded-md'
      }
    },

    accordion: {
      slots: {
        trigger: 'rounded-md',
        title: 'text-start break-words'
      }
    },

    table: {
      slots: {
        th: 'px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-dimmed text-start whitespace-nowrap',
        td: 'px-4 py-3 text-sm text-muted whitespace-nowrap'
      }
    },

    timeline: {
      slots: {
        title: 'font-medium text-highlighted text-sm tracking-tight'
      }
    }
  }
})
