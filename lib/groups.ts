import { supabase } from './supabase';

export type GroupRole = 'admin' | 'member';
export type JoinStatus = 'pending' | 'accepted' | 'declined';

export type GroupCard = {
  id: string;
  name: string;
  description: string;
  city: string;
  createdAt: number;
  memberCount: number;
  pendingCount: number;
  myRole: GroupRole | null;
  myRequest: JoinStatus | null;
};

export type GroupMember = {
  id: string;
  name: string;
  photo: string;
  city: string;
  role: GroupRole;
  online: boolean;
};

export type GroupJoinRequest = {
  id: string;
  userId: string;
  name: string;
  photo: string;
  createdAt: number;
};

function rowToCard(r: Record<string, any>): GroupCard {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    description: String(r.description ?? ''),
    city: String(r.city ?? ''),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
    memberCount: Number(r.member_count ?? 0),
    pendingCount: Number(r.pending_count ?? 0),
    myRole: r.my_role ? (String(r.my_role) as GroupRole) : null,
    myRequest: r.my_request ? (String(r.my_request) as JoinStatus) : null,
  };
}

export async function listGroups(search?: string): Promise<GroupCard[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('list_groups', {
    p_search: search?.trim() || null,
  });
  if (error || !data) return [];
  return (data as Record<string, any>[]).map(rowToCard);
}

export async function createGroup(
  name: string,
  description: string,
  city: string
): Promise<string> {
  if (!supabase) throw new Error('Backend not configured');
  const { data, error } = await supabase.rpc('create_group', {
    p_name: name.trim(),
    p_description: description.trim(),
    p_city: city.trim(),
  });
  if (error) throw error;
  return String(data);
}

export async function requestJoinGroup(groupId: string): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.rpc('request_join_group', { p_group: groupId });
  if (error) throw error;
}

export async function respondJoinRequest(requestId: string, accept: boolean): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.rpc('respond_join_request', {
    p_request: requestId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function leaveGroup(groupId: string): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.rpc('leave_group', { p_group: groupId });
  if (error) throw error;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.rpc('remove_group_member', {
    p_group: groupId,
    p_user: userId,
  });
  if (error) throw error;
}

export async function deleteGroup(groupId: string): Promise<void> {
  if (!supabase) throw new Error('Backend not configured');
  const { error } = await supabase.rpc('delete_group', { p_group: groupId });
  if (error) throw error;
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('group_member_list', { p_group: groupId });
  if (error || !data) return [];
  return (data as Record<string, any>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    photo: String(r.photo ?? ''),
    city: String(r.city ?? ''),
    role: (String(r.role) as GroupRole) || 'member',
    online: Boolean(r.online),
  }));
}

export async function fetchGroupPendingRequests(groupId: string): Promise<GroupJoinRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('group_pending_requests', { p_group: groupId });
  if (error || !data) return [];
  return (data as Record<string, any>[]).map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    name: String(r.name ?? ''),
    photo: String(r.photo ?? ''),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
  }));
}

export async function fetchAdminPendingCount(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('my_group_admin_pending');
  if (error || data == null) return 0;
  return Number(data);
}
