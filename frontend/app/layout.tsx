import "./globals.css";

export const metadata = {
  title: "ProofWork — evidence-backed work verification",
  description: "A GenLayer dApp for consensus-backed deliverable verification.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
