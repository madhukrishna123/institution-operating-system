export type SeedUser = {
  email: string;
  name: string;
  role: string;
  password: string;
};

export type SocialProfile = {
  name: string;
  email: string;
  role: string;
  avatar: string;
  headline: string;
  skills: string[];
  badges: string[];
  stats: { label: string; value: string }[];
};

export type SocialFeedItem = {
  id: number;
  author: string;
  role: string;
  avatar: string;
  workspace: string;
  kind: string;
  content: string;
  signal: string;
  reactions: number;
  replies: number;
  time: string;
};

export type SocialWorkspace = {
  id: string;
  name: string;
  agent: string;
  accent: string;
  status: string;
  members: number;
  threads: number;
  pinned: string[];
};

export type CopilotSuggestion = {
  agent: string;
  title: string;
  summary: string;
  confidence: string;
  action: string;
};

export type MessagePreview = {
  channel: string;
  sender: string;
  preview: string;
  unread: number;
  tone: string;
};

export type SocialHome = {
  profile: SocialProfile;
  feed: SocialFeedItem[];
  workspaces: SocialWorkspace[];
  copilots: CopilotSuggestion[];
  messages: MessagePreview[];
};
