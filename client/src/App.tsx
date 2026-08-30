import { BrowserRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { Loader } from '@/components/layout/Loader'
import { HomePage } from '@/pages/HomePage'
import { ServicesPage } from '@/pages/ServicesPage'
import { CalculatorPage } from '@/features/calculator/CalculatorPage'
import { ArticlesPage } from '@/pages/ArticlesPage'
import { ContactPage } from '@/features/contact/ContactPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Legacy semantics: silent failure everywhere - external data must
      // never block the UI.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Loader />
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/calculators" element={<CalculatorPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<HomePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
