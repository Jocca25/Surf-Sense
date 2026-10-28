import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/components/app-provider";
import { Shell } from "@/components/shell";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: {
    default: "Barlavento",
    template: "%s · Barlavento",
  },
  description:
    "Previsão de surf para a costa de Lisboa. Pontuação hora a hora, janelas para entrar na água e alertas quando o mar encaixa no que pedes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt" className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full text-foreground">
        <TooltipProvider>
          <AppProvider>
            <Shell>{children}</Shell>
          </AppProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
