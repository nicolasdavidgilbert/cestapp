import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/src/store/UserContext";
import { MeshBackground } from "@/src/features/auth/components/MeshBackground";

const geistSans = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cesta++ - Listas de la compra",
  description: "Gestiona tus listas de la compra y productos",
  applicationName: "Cesta++",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Cesta++",
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/pwa-icon/180", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2d7a44",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body
        className={`${geistSans.className} relative min-h-screen w-full overflow-x-hidden bg-background text-foreground selection:bg-secondary/30 selection:text-secondary-foreground`}
      >
        <MeshBackground />
        <UserProvider>
          <div className="relative z-10 w-full overflow-x-hidden">
            {children}
          </div>
        </UserProvider>
      </body>
    </html>
  );
}
