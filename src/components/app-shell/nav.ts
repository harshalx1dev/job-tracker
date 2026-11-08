import {
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MessageSquareQuote,
  Send,
  Settings,
  UserRound,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, soon: false },
  { href: "/app/jobs", label: "Jobs", icon: BriefcaseBusiness, soon: false },
  { href: "/app/profile", label: "Profile", icon: UserRound, soon: false },
  { href: "/app/resumes", label: "Resumes", icon: FileText, soon: false },
  { href: "/app/outreach", label: "Outreach", icon: Send, soon: false },
  {
    href: "/app/answers",
    label: "Answer bank",
    icon: MessageSquareQuote,
    soon: false,
  },
  {
    href: "/app/prep",
    label: "Interview prep",
    icon: GraduationCap,
    soon: false,
  },
  { href: "/app/settings", label: "Settings", icon: Settings, soon: false },
] as const;
