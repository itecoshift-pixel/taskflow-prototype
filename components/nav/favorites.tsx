"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

export function NavFavorites({
  favorites,
}: {
  favorites: {
    name: string;
    url: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }[];
}) {
  const { isMobile } = useSidebar();

  if (favorites.length === 0) return null;

  return (
    <ProtectedPageWrapper>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Leads</SidebarGroupLabel>
        <SidebarMenu>
          {favorites.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild>
                  <a href={item.url} title={item.name} className="flex items-center space-x-2">
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    </ProtectedPageWrapper>
  );
}
