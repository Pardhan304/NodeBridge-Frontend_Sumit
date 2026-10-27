import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { display, body, mono } from "./fonts";

export const metadata = {
  title: "NodeBridge",
  description: "Fund a compute job in escrow. A result is released only after its hash matches the committed spec.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <div className="shell">
            <Navbar />
            <div className="shell__content">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
