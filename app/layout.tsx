import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luna YouTube Downloader",
  description: "Download YouTube videos in every available resolution directly from your browser.",
  openGraph: {
    title: "Luna YouTube Downloader",
    description: "Paste a YouTube link and download in the resolution that works best for you.",
    url: "https://example.com",
    siteName: "Luna YouTube Downloader",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Luna YouTube Downloader",
    description: "Download any YouTube video directly from your device.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
