"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import { Loader2, User, Lock, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountModal({ open, onOpenChange }: AccountModalProps) {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="profile" className="w-full mt-4">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
            <TabsTrigger
              value="profile"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2"
            >
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-2"
            >
              <Lock className="mr-2 h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="profile" className="space-y-6">
              <ProfileForm user={session.user} />
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <SecurityForm />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ProfileForm({ user }: { user: any }) {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(user.name || "");

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authClient.updateUser({
        name,
      });
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpdateProfile} className="space-y-4">
      <div className="flex items-center gap-4 mb-6">
        <Avatar className="h-16 w-16">
          <AvatarImage src={user.image} />
          <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-lg">{user.name}</span>
          <span className="text-sm text-muted-foreground">{user.email}</span>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="name">Display Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Changes
        </Button>
      </div>
    </form>
  );
}

function SecurityForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleChangePassword} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="current-password">Current Password</Label>
        <Input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Confirm New Password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Update Password
        </Button>
      </div>
    </form>
  );
}

