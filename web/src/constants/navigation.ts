import { CmsRole } from "@loom/dto/models";
import {
  ArrowsClockwise,
  Article,
  Browsers,
  ClockCounterClockwise,
  FolderSimple,
  GearSix,
  House,
  type Icon,
  ImageSquare,
  Key,
  Megaphone,
  Palette,
  PlugsConnected,
  ShieldCheck,
  Stack,
  Star,
  Tag,
  Translate,
  Trash,
  Tray,
  UserCircle,
  UserGear,
  UsersThree,
} from "@phosphor-icons/react";

export interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  /** Omitted means every role sees it. */
  roles?: CmsRole[];
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

// The Settings pages, listed on their own sub-navigation rather than in the sidebar
export const SETTINGS_NAVIGATION: NavItem[] = [
  {
    label: "Sites",
    href: "/settings/sites",
    icon: Browsers,
    roles: [CmsRole.ADMIN],
  },
  {
    label: "Spaces",
    href: "/settings/spaces",
    icon: Stack,
    roles: [CmsRole.ADMIN],
  },
  {
    label: "Languages",
    href: "/settings/languages",
    icon: Translate,
    roles: [CmsRole.ADMIN],
  },
  {
    label: "Protected terms",
    href: "/settings/protected-terms",
    icon: ShieldCheck,
    roles: [CmsRole.ADMIN],
  },
  {
    label: "API keys",
    href: "/settings/api-keys",
    icon: Key,
    roles: [CmsRole.ADMIN],
  },
  {
    label: "Refresh live pages",
    href: "/settings/refresh",
    icon: ArrowsClockwise,
    roles: [CmsRole.ADMIN, CmsRole.AUTHOR],
  },
  // Personal, not the Site's: each person's own password, and their own assistant
  { label: "Account", href: "/settings/account", icon: UserGear },
  {
    label: "MCP",
    href: "/settings/mcp",
    icon: PlugsConnected,
    roles: [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER],
  },
  { label: "Appearance", href: "/settings/appearance", icon: Palette },
];

export const NAVIGATION: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/", icon: House },
      {
        label: "Review",
        href: "/review",
        icon: Tray,
        roles: [CmsRole.ADMIN, CmsRole.AUTHOR],
      },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Posts", href: "/blogs", icon: Article },
      { label: "Categories", href: "/categories", icon: FolderSimple },
      { label: "Tags", href: "/tags", icon: Tag },
      { label: "Authors", href: "/authors", icon: UserCircle },
      { label: "CTAs", href: "/ctas", icon: Megaphone },
      { label: "Featured", href: "/featured-articles", icon: Star },
    ],
  },
  {
    label: "Library",
    items: [
      { label: "Media", href: "/media", icon: ImageSquare },
      { label: "Activity", href: "/activity", icon: ClockCounterClockwise },
      { label: "Trash", href: "/trash", icon: Trash },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        label: "Users",
        href: "/users",
        icon: UsersThree,
        roles: [CmsRole.ADMIN],
      },
      // Every role has Account and Appearance, so everyone has a settings page
      { label: "Settings", href: "/settings", icon: GearSix },
    ],
  },
];

export const isNavItemVisible = (
  item: NavItem,
  role: CmsRole | null | undefined,
) => !item.roles || (role ? item.roles.includes(role) : false);

/** The nav item a path belongs to — the deepest href that prefixes it. */
export const navItemFor = (pathname: string) =>
  [...NAVIGATION.flatMap((section) => section.items), ...SETTINGS_NAVIGATION]
    .filter((item) =>
      item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
