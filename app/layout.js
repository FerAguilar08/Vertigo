import './globals.css';

export const metadata = {
  title: 'VERTIGO — Bank or Push',
  description: 'A push-your-luck climbing game — bank your points or risk it all.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
