import { Home, Upload, FileText, Calculator, ClipboardCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    testId: "link-dashboard",
  },
  {
    title: "Upload Documents",
    url: "/upload",
    icon: Upload,
    testId: "link-upload",
  },
  {
    title: "Review Data",
    url: "/review",
    icon: FileText,
    testId: "link-review",
  },
  {
    title: "Tax Calculation",
    url: "/calculate",
    icon: Calculator,
    testId: "link-calculate",
  },
  {
    title: "Form 1040",
    url: "/form1040",
    icon: ClipboardCheck,
    testId: "link-form1040",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold text-foreground">
            Tax Filing 2024
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={item.testId}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
