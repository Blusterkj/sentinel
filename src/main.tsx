
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import '@mysten/dapp-kit/dist/index.css';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

// Import Google Fonts
const link = document.createElement('link')
link.rel = 'preconnect'
link.href = 'https://fonts.googleapis.com'
document.head.appendChild(link)

const link2 = document.createElement('link')
link2.rel = 'stylesheet'
link2.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
document.head.appendChild(link2)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <SuiClientProvider networks={{ testnet: { url: 'https://fullnode.testnet.sui.io:443', network: 'testnet' as any } }} defaultNetwork="testnet">
      <WalletProvider autoConnect={true}>
        <App />
      </WalletProvider>
    </SuiClientProvider>
  </QueryClientProvider>
)
