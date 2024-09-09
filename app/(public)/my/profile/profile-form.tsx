'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { updateProfile } from '@/lib/actions/profile-actions';
import { toast } from 'sonner';
import { Save, Loader2, X, User } from 'lucide-react';

interface Props {
  profile: {
    email: string;
    fullName: string;
    avatarUrl: string;
    phone: string;
    city: string;
  };
}

export default function ProfileForm({ profile }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fullName, setFullName] = useState(profile.fullName);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [phone, setPhone] = useState(profile.phone);
  const [city, setCity] = useState(profile.city);

  function handleSave() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateProfile({
        fullName,
        phone,
        city,
        avatarUrl,
      });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to update profile');
        setError(result.error ?? 'Failed to update profile');
        return;
      }
      toast.success('Profile updated');
      setSuccess('Profile updated.');
      router.refresh();
    });
  }

  const initials = fullName
    ? fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="max-w-lg space-y-6">
      {/* Avatar + name */}
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-lg font-semibold">{fullName || 'Your Name'}</h2>
          <p className="text-muted-foreground text-sm">{profile.email}</p>
        </div>
      </div>

      <Separator />

      {/* Messages */}
      {(error || success) && (
        <div
          className={`flex items-center justify-between rounded-md p-3 text-sm ${
            error
              ? 'bg-destructive/10 text-destructive'
              : 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
          }`}
        >
          {error ?? success}
          <button onClick={() => { setError(null); setSuccess(null); }}>
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={profile.email} disabled className="bg-muted" />
          <p className="text-muted-foreground text-xs">Email cannot be changed here.</p>
        </div>
        <div className="space-y-2">
          <Label>Avatar URL</Label>
          <Input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
          />
          <p className="text-muted-foreground text-xs">Paste a link to your profile photo.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+359 ..." />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sofia" />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
        Save Changes
      </Button>
    </div>
  );
}
