"use client";

import { memo, useState } from "react";
import { Plus, FolderOpen, ChevronDown } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import WorkspaceItem from "./WorkspaceItem";
import type { WorkspaceWithState } from "@/lib/workspace-state/types";

interface WorkspaceListProps {
  workspaces: WorkspaceWithState[];
  currentWorkspaceId?: string;
  currentSlug?: string | null;
  onCreateWorkspace: () => void;
  onWorkspaceClick: (workspaceSlug: string) => void;
  onSettingsClick: (workspace: WorkspaceWithState) => void;
  onShareClick: (workspace: WorkspaceWithState) => void;
  excludeActive?: boolean;
}

function WorkspaceList({
  workspaces,
  currentWorkspaceId,
  currentSlug,
  onCreateWorkspace,
  onWorkspaceClick,
  onSettingsClick,
  onShareClick,
  excludeActive,
}: WorkspaceListProps) {
  const [isOpen, setIsOpen] = useState(false); // Default to collapsed

  // Filter workspaces if excludeActive is true
  const filteredWorkspaces = excludeActive
    ? workspaces.filter(w => w.slug !== currentSlug && w.id !== currentWorkspaceId)
    : workspaces;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center w-full cursor-pointer hover:bg-sidebar-accent/50 rounded">
              <div className="flex items-center gap-2 flex-1">
                <div className="group-data-[collapsible=icon]:cursor-pointer">
                  <FolderOpen className="size-4 text-blue-400" />
                </div>
                <div className="flex items-center gap-2 flex-1 group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-xs">Recent workspaces</span>
                </div>
                <ChevronDown 
                  className={`size-3.5 text-muted-foreground transition-transform duration-200 group-data-[collapsible=icon]:hidden ${
                    isOpen ? 'rotate-180' : ''
                  }`} 
                />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden transition-transform duration-200 hover:scale-110"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateWorkspace();
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Create new workspace
                </TooltipContent>
              </Tooltip>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <SidebarMenuSub className="group-data-[collapsible=icon]:hidden border-l-0">
              {/* Workspaces list */}
              {filteredWorkspaces.map((workspace) => (
                <WorkspaceItem
                  key={workspace.id}
                  workspace={workspace}
                  isActive={currentSlug === workspace.slug || currentWorkspaceId === workspace.id}
                  onWorkspaceClick={onWorkspaceClick}
                  onSettingsClick={onSettingsClick}
                  onShareClick={onShareClick}
                />
              ))}

              {/* Empty state */}
              {workspaces.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No workspaces yet
                </div>
              )}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(WorkspaceList);

