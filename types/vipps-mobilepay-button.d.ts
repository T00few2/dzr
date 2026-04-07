import type * as React from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'vipps-mobilepay-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        brand?: string
        language?: string
        variant?: string
        verb?: string
        rounded?: string | boolean
        stretched?: string | boolean
        branded?: string | boolean
      }
    }
  }
}

export {}
