import { StrictMode, startTransition } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { queryClient } from '@/app/query-client'
import { createAppRouter } from '@/router'

export function mount(element: HTMLElement) {
  const router = createAppRouter(queryClient)
  const root = createRoot(element)
  // montagem inicial como transição: o React fatia a renderização e cede o thread principal
  startTransition(() => {
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>,
    )
  })
}
