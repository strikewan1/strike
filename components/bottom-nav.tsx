"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <path
        d="M3 12L12 4L21 12M5 10V20H19V10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClosetIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <rect x="4" y="3" width="16" height="18" rx="0" />
      <path d="M12 3V21" />
      <path d="M8 8H10M8 12H10" strokeLinecap="round" />
      <path d="M14 8H16M14 12H16" strokeLinecap="round" />
    </svg>
  );
}

function OutfitsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <path
        d="M8 4L4 8M16 4L20 8M8 4L12 8L16 4M4 8V20H20V8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InspireIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <path
        d="M12 3V5M12 19V21M5 12H3M21 12H19M5.6 5.6L7 7M17 17L18.4 18.4M5.6 18.4L7 17M17 7L18.4 5.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <circle cx="12" cy="8" r="4" />
      <path
        d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21"
        strokeLinecap="round"
      />
    </svg>
  );
}

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: <HomeIcon className="h-5 w-5" /> },
  {
    href: "/closet",
    label: "Closet",
    icon: <ClosetIcon className="h-5 w-5" />,
  },
  {
    href: "/outfits",
    label: "Outfits",
    icon: <OutfitsIcon className="h-5 w-5" />,
  },
  {
    href: "/inspire",
    label: "Inspire",
    icon: <InspireIcon className="h-5 w-5" />,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: <ProfileIcon className="h-5 w-5" />,
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border safe-bottom"
      aria-label="Navegación principal"
    >
      <ul className="flex items-stretch justify-around h-16">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "h-full flex flex-col items-center justify-center gap-1",
                  "transition-colors duration-150",
                  isActive
                    ? "text-foreground"
                    : "text-muted hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon}
                <span className="text-[10px] font-medium uppercase tracking-wider">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
