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
    card: {
      slots: {
        root: 'rounded-[12px] border border-default bg-default shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
        header: 'px-4 py-3',
        body: 'p-4'
      }
    }
  }
})
