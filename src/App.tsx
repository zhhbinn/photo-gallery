import { Analytics } from '@vercel/analytics/next'
import { Outlet } from 'react-router'

import { RootProviders } from './providers/root-providers'

function App() {
  return (
    <RootProviders>
      <div className="h-svh">
        <Outlet />
      </div>
      <Analytics />
    </RootProviders>
  )
}

export default App
