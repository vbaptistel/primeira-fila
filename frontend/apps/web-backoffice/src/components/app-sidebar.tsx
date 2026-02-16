"use client";

import * as React from "react";
import { Calendar, ShoppingCart, LayoutDashboard } from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@primeira-fila/shared";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";

const navItems = [
    {
        title: "Eventos",
        url: "/eventos",
        icon: Calendar,
    },
    {
        title: "Pedidos",
        url: "/pedidos",
        icon: ShoppingCart,
    },
];

export function AppSidebar({
    email,
    ...props
}: React.ComponentProps<typeof Sidebar> & { email: string }) {
    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:!p-1.5"
                        >
                            <a href="/eventos">
                                <LayoutDashboard className="!size-5" />
                                <span className="text-base font-semibold">Primeira Fila</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={navItems} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={{ email }} />
            </SidebarFooter>
        </Sidebar>
    );
}
