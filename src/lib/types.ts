export type GroupStatus = 'open' | 'drawn';

export interface Group {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  event_at: string | null;
  location: string | null;
  location_url: string | null;
  min_value: number | null;
  max_value: number | null;
  gift_ideas: string | null;
  theme: string | null;
  dress_code: string | null;
  notes: string | null;
  rsvp_deadline: string | null;
  max_participants: number | null;
  invite_code: string;
  status: GroupStatus;
  drawn_at: string | null;
  created_at: string;
}

/** Campos que o organizador pode criar/editar. */
export type GroupInput = Pick<
  Group,
  | 'name'
  | 'description'
  | 'event_at'
  | 'location'
  | 'location_url'
  | 'min_value'
  | 'max_value'
  | 'gift_ideas'
  | 'theme'
  | 'dress_code'
  | 'notes'
  | 'rsvp_deadline'
  | 'max_participants'
>;

export interface Participant {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  joined_at: string;
}

export interface WishlistItem {
  id: string;
  participant_id: string;
  group_id: string;
  title: string;
  url: string | null;
  notes: string | null;
  created_at: string;
}

export interface InvitePreview {
  id: string;
  name: string;
  description: string | null;
  event_at: string | null;
  location: string | null;
  min_value: number | null;
  max_value: number | null;
  rsvp_deadline: string | null;
  max_participants: number | null;
  status: GroupStatus;
  owner_name: string;
  participant_count: number;
  is_member: boolean;
}

export interface MyMatch {
  receiver_id: string;
  display_name: string;
  avatar_url: string | null;
}

export type ChatThread = 'giftee' | 'santa';

export interface ChatMessage {
  id: number;
  thread: ChatThread;
  from_me: boolean;
  body: string;
  created_at: string;
}
