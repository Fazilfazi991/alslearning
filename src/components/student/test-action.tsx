import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TestAction({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return <Button href={href} variant={primary ? "primary" : "secondary"} className="shrink-0 px-3! shadow-none!">
    {children}<ArrowRight size={15} aria-hidden="true" />
  </Button>;
}
