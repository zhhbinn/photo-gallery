import { Outlet } from 'react-router'

import { RootProviders } from './providers/root-providers'

function App() {
  return (
    <RootProviders>
      <div className="min-h-screen">
        <Outlet />
      </div>
    </RootProviders>
  )
}

export default App
