import './globals.css';

export const metadata = { title: 'ShelfHunt', description: 'Find what you are hunting for.' };

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
