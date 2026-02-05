"use client";

import { useState, useCallback } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountModal } from "@/components/auth/AccountModal";


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function UserProfileDropdown() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const userName = session?.user?.name || session?.user?.email || "User";
  const userImage = session?.user?.image || undefined;

  const getInitials = (name: string) => {
    if (name === "User") return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/");
  }, [router]);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/user/delete", {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete account");
      }

      toast.success("Account deleted successfully");
      await signOut();
      router.push("/");
    } catch (error: any) {
      toast.error(error.message);
      setIsDeleting(false);
      setShowDeleteAlert(false);
    }
  };

  // Anonymous user: show sign in/up buttons
  if (session?.user?.isAnonymous) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Link href="/auth/sign-in">
          <Button variant="ghost" size="sm" className="text-foreground">
            Sign in
          </Button>
        </Link>
        <Link href="/auth/sign-up">
          <Button size="sm">Sign up</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={`Open menu for ${userName}`}
            aria-haspopup="menu"
          >
            <Avatar className="h-8 w-8 rounded-md">
              {userImage && <AvatarImage src={userImage} alt={userName} />}
              <AvatarFallback className="rounded-md bg-primary/10 text-sm">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>

          <DropdownMenuItem onClick={() => setShowAccountModal(true)} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteAlert(true)}
            className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
          >
            <LogOut className="mr-2 h-4 w-4 rotate-180" /> {/* Re-using icon, maybe Trash is better but keeping simple */}
            Delete Account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountModal open={showAccountModal} onOpenChange={setShowAccountModal} />

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account
              and remove your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAccount();
              }}
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
