import { requireAuth } from '@/lib/auth/helpers';
import ProfileForm from './profile-form';

export default async function MyProfilePage() {
  const user = await requireAuth();

  return (
    <ProfileForm
      profile={{
        email: user.email,
        fullName: user.full_name ?? '',
        avatarUrl: user.avatar_url ?? '',
        phone: user.phone ?? '',
        city: user.city ?? '',
      }}
    />
  );
}
