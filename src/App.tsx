import { Outlet } from 'react-router'

import { RootProviders } from './providers/root-providers'

function App() {
  return (
    <RootProviders>
      {import.meta.env.VITE_OPENPANEL_CLIENT_ID && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
  window.op = window.op||function(...args){(window.op.q=window.op.q||[]).push(args);};
  window.op('init', {
    clientId: '${import.meta.env.VITE_OPENPANEL_CLIENT_ID}',
    trackScreenViews: true,
    trackOutgoingLinks: true,
    trackAttributes: true,
  });
`,
          }}
        />
      )}
      <script src="https://openpanel.dev/op1.js" defer async />
      <div className="h-svh">
        <Outlet />
      </div>
    </RootProviders>
  )
}

export default App
