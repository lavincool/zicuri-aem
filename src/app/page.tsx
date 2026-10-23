import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <Logo />
      <h1 className="max-w-sm text-4xl font-extrabold">
        Reporta lo que inunda tu calle.
      </h1>
      <Button size="lg" className="h-14 rounded-full px-8 text-base font-bold">
        Reportar
      </Button>
    </main>
  );
}
