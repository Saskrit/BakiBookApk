import { request } from './client';

export type TeamRole = 'partner' | 'staff';

export type ShopTeamMember = {
  id: string;
  membershipId: string;
  fullName: string;
  email: string;
  profileImage?: string;
  teamRole: TeamRole;
  status: string;
  invitedAt?: string;
};

export const listShopTeam = () =>
  request<{
    success: boolean;
    members: ShopTeamMember[];
    owner: { id: string; fullName: string; email: string; teamRole: 'owner' };
  }>('/shop/team');

export const inviteShopTeamMember = (payload: { email: string; teamRole: TeamRole }) =>
  request<{ success: boolean; message: string; member: ShopTeamMember }>('/shop/team/invite', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const revokeShopTeamMember = (memberId: string) =>
  request<{ success: boolean; message: string }>(`/shop/team/${memberId}`, {
    method: 'DELETE',
  });
