import Link from "next/link";

export function MobileHeader() {
  return (
    <header className="bg-background/80 sticky top-0 z-40 w-full border-b backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center px-4">
        <Link href="/" prefetch={false} className="group flex items-center gap-2">
          <div className="bg-qwer-rockation h-2.5 w-2.5 rounded-full" />
          <span className="text-foreground text-lg font-black tracking-tighter uppercase">
            <span className="text-qwer-q">O</span>
            <span className="text-qwer-w">I</span>
            <span className="text-qwer-e">O</span>
            <span className="text-qwer-r">I</span>
            <span className="text-white">BWG</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
