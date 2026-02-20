'use client';
import "@/shims/lockdown-shim";

import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MidlProvider } from "@midl/react";
import { WagmiMidlProvider } from "@midl/executor-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { PageTransition } from "@/components/layout/PageTransition";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { midlConfig } from "@/lib/midl/config";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

function WebSocketProvider({ children }: { children: React.ReactNode }) {
  useWebSocket();
  return <>{children}</>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  return (
    <html lang="en" className="dark">
      <head>
        <title>MidlLaunch - Bitcoin Token Issuance Protocol</title>
        <meta name="description" content="Trust-minimized Bitcoin-native token launches on Midl network. Create and trade tokens with bonding curves." />
        <meta name="keywords" content="Bitcoin,Midl,token,launch,bonding curve,DeFi" />
      </head>
      <body className="antialiased">
        <MidlProvider config={midlConfig}>
          <QueryClientProvider client={queryClient}>
            <WagmiMidlProvider>
              <WebSocketProvider>
                <a href="#main-content" className="skip-link">Skip to content</a>
                <Header />
                <main id="main-content" className="min-h-screen pb-16 md:pb-0">
                  <PageTransition>{children}</PageTransition>
                </main>
                <Footer />
                <MobileNav />
                <Toaster
                  position="bottom-right"
                  toastOptions={{
                    style: {
                      background: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                    },
                    success: { iconTheme: { primary: '#f97316', secondary: '#fff' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                  }}
                />
              </WebSocketProvider>
            </WagmiMidlProvider>
          </QueryClientProvider>
        </MidlProvider>
      </body>
    </html>
  );
}
