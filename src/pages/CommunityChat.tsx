import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Search,
  Send,
  Pin,
  Reply,
  Trash2,
  Smile,
  Shield,
  GraduationCap,
  Sparkles,
  ArrowLeft,
  X,
  Info,
  Check,
  Flame,
  Heart,
  Lightbulb,
  ThumbsUp,
  Brain,
  MessageCircle,
  Copy,
  ExternalLink,
  ShieldAlert,
  ChevronDown,
  Hash,
  Layers,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CommunityChannel,
  CommunityMessage,
  ReplyReference,
} from '@/types/community';
import {
  buildCommunityChannels,
  subscribeToChannelMessages,
  sendCommunityMessage,
  toggleMessageReaction,
  pinCommunityMessage,
  deleteCommunityMessage,
} from '@/lib/community';
import { getDepartments } from '@/lib/departments';
import { getCachedDefaultDepartmentId } from '@/lib/system-settings';
import { Department } from '@/integrations/firebase/types';
import { AdminChatCleanupDialog } from '@/components/community/AdminChatCleanupDialog';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🧠', '💡', '🎉'];

export default function CommunityChat() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Channels & active selection
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('announcements');
  const [channelSearch, setChannelSearch] = useState<string>('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  // Messages in active channel
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);

  // Message input state
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CommunityMessage | null>(null);

  // Mobile navigation state (true = viewing chat stream, false = viewing channels list)
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // Scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);

  // Firestore permission helper modal state
  const [permissionErrorDetected, setPermissionErrorDetected] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [copiedRule, setCopiedRule] = useState(false);

  // Admin chat storage cleanup dialog state
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);

  const FIRESTORE_COMMUNITY_RULE_SNIPPET = `    // --- Community Channels & Messages Collection ---
    match /communityChannels/{channelId} {
      allow read: if true;
      allow write: if true;

      match /messages/{messageId} {
        allow read: if true;
        allow create, update: if true;
        allow delete: if true;
      }

      match /{allChildren=**} {
        allow read: if true;
        allow write: if true;
      }
    }

    match /communityMessages/{document=**} {
      allow read: if true;
      allow write: if true;
    }`;

  const handleCopyRule = () => {
    navigator.clipboard.writeText(FIRESTORE_COMMUNITY_RULE_SNIPPET);
    setCopiedRule(true);
    toast({
      title: 'Rule Copied to Clipboard! 📋',
      description: 'Paste it into Firebase Console > Firestore Database > Rules before the closing "}".',
    });
    setTimeout(() => setCopiedRule(false), 3000);
  };

  // User role determination
  const userRole: 'admin' | 'examiner' | 'student' | 'teacher' =
    profile?.role === 'admin'
      ? 'admin'
      : profile?.role === 'examiner'
      ? 'examiner'
      : profile?.role === 'teacher'
      ? 'teacher'
      : 'student';

  const isAdminOrExaminer = userRole === 'admin' || userRole === 'examiner' || userRole === 'teacher';

  // Load departments on mount and build role-scoped channels
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const deptList = await getDepartments();
        if (!isMounted) return;
        setDepartments(deptList);

        const defaultDeptId = getCachedDefaultDepartmentId();
        const effectiveDeptId = profile?.departmentId || (profile as any)?.department_id || defaultDeptId;

        const allChannels = buildCommunityChannels(deptList, {
          userRole,
          userDepartmentId: effectiveDeptId || undefined,
        });

        setChannels(allChannels);

        // Auto select first channel (department channel or announcements)
        if (allChannels.length > 0) {
          const deptChannel = allChannels.find((c) => c.category === 'department');
          const defaultChannel = deptChannel ? deptChannel.id : allChannels[0].id;
          setActiveChannelId((prev) => (allChannels.some((c) => c.id === prev) ? prev : defaultChannel));
        }
      } catch (err) {
        console.error('Failed to load community channel data:', err);
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [profile, userRole]);

  // Subscribe to active channel messages
  useEffect(() => {
    if (!activeChannelId) return;
    setLoadingMessages(true);

    const unsubscribe = subscribeToChannelMessages(
      activeChannelId,
      (newMessages) => {
        setMessages(newMessages);
        setLoadingMessages(false);
      },
      (error) => {
        console.error('Channel subscription error:', error);
        setLoadingMessages(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeChannelId]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loadingMessages]);

  // Handle scroll detection for "Scroll to bottom" button
  const handleScroll = () => {
    const el = chatScrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBottomPill(!isNearBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottomPill(false);
  };

  // Smooth scroll to a quoted message
  const scrollToQuotedMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-sky-400', 'bg-sky-500/10');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-sky-400', 'bg-sky-500/10');
      }, 2000);
    }
  };

  // Active channel object
  const activeChannel = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId) || channels[0];
  }, [channels, activeChannelId]);

  // Pinned message in current channel (if any)
  const pinnedMessage = useMemo(() => {
    return messages.slice().reverse().find((m) => m.isPinned);
  }, [messages]);

  // Filtered channels list
  const filteredChannels = useMemo(() => {
    let list = channels;
    if (activeCategoryFilter !== 'all') {
      list = list.filter((c) => c.category === activeCategoryFilter);
    }
    if (channelSearch.trim()) {
      const q = channelSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [channels, activeCategoryFilter, channelSearch]);

  // Send message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !user || isSending) return;

    if (activeChannel?.isOfficialOnly && !isAdminOrExaminer) {
      toast({
        title: 'Announcements Only',
        description: 'Only instructors and administrators can post top-level announcements.',
        variant: 'destructive',
      });
      return;
    }

    const messageText = inputText.trim();
    setInputText('');

    let replyRef: ReplyReference | undefined;
    if (replyingTo) {
      replyRef = {
        id: replyingTo.id,
        userName: replyingTo.userName,
        userRole: replyingTo.userRole,
        text: replyingTo.text.slice(0, 140),
      };
      setReplyingTo(null);
    }

    try {
      setIsSending(true);
      await sendCommunityMessage({
        channelId: activeChannelId,
        userId: user.uid,
        userName: profile?.full_name || user.email?.split('@')[0] || 'Student',
        userEmail: user.email || '',
        userRole,
        userAvatar: profile?.avatar_url,
        text: messageText,
        replyTo: replyRef,
      });

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      const isPermError =
        err?.code === 'permission-denied' ||
        String(err?.message || '').toLowerCase().includes('permission') ||
        String(err?.message || '').toLowerCase().includes('missing or insufficient');

      if (isPermError) {
        setPermissionErrorDetected(true);
        toast({
          title: 'Firestore Permission Rule Required',
          description: 'Firebase security rules need to be published for communityChannels. Click the alert banner to copy the rule.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error sending message',
          description: err.message || 'Check your internet connection and try again.',
          variant: 'destructive',
        });
      }
      setInputText(messageText);
    } finally {
      setIsSending(false);
    }
  };

  // Toggle reaction handler
  const handleToggleReaction = async (message: CommunityMessage, emoji: string) => {
    if (!user) return;
    try {
      await toggleMessageReaction({
        channelId: activeChannelId,
        messageId: message.id,
        emoji,
        userId: user.uid,
        currentReactions: message.reactions,
      });
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Pin message handler
  const handlePinMessage = async (message: CommunityMessage) => {
    if (!isAdminOrExaminer) return;
    try {
      const willPin = !message.isPinned;
      await pinCommunityMessage({
        channelId: activeChannelId,
        messageId: message.id,
        isPinned: willPin,
        pinnedBy: profile?.full_name || 'Admin',
      });
      toast({
        title: willPin ? 'Message Pinned 📌' : 'Message Unpinned',
        description: willPin
          ? 'This message is now pinned to the top of the channel.'
          : 'The message was unpinned.',
      });
    } catch (err: any) {
      toast({
        title: 'Failed to pin message',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (message: CommunityMessage) => {
    const canDelete = message.userId === user?.uid || isAdminOrExaminer;
    if (!canDelete) return;

    if (!window.confirm('Are you sure you want to delete this message?')) return;

    try {
      await deleteCommunityMessage({
        channelId: activeChannelId,
        messageId: message.id,
      });
      toast({
        title: 'Message Deleted',
        description: 'The message has been removed from the channel.',
      });
    } catch (err: any) {
      toast({
        title: 'Failed to delete message',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Format message timestamp
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Date grouping for clean Discord/Telegram style date separators
  const groupedMessageSections = useMemo(() => {
    const groups: { dateLabel: string; items: CommunityMessage[] }[] = [];
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    messages.forEach((msg) => {
      const date = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt || Date.now());
      let dateLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      if (date.toDateString() === now.toDateString()) {
        dateLabel = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateLabel = 'Yesterday';
      }

      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.dateLabel === dateLabel) {
        lastGroup.items.push(msg);
      } else {
        groups.push({ dateLabel, items: [msg] });
      }
    });

    return groups;
  }, [messages]);

  return (
    <DashboardLayout contentClassName="p-0 sm:p-2 lg:p-4 max-w-none w-full !pb-0 lg:!pb-3">
      {/* Edge-to-Edge Full Height Chat Container: On mobile it is fixed inset-0 z-[60] full page, on desktop it is inside DashboardLayout */}
      <div className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto w-full h-[100dvh] lg:h-[calc(100dvh-5.2rem)] flex rounded-none lg:rounded-3xl border-0 lg:border border-white/60 dark:border-white/10 shadow-none lg:shadow-2xl bg-background lg:bg-card/75 dark:bg-slate-950 lg:dark:bg-slate-950/70 backdrop-blur-none lg:backdrop-blur-2xl overflow-hidden">
        {/* ========================================================= */}
        {/* LEFT PANE: CHANNELS DIRECTORY                            */}
        {/* ========================================================= */}
        <aside
          className={`w-full lg:w-80 xl:w-96 shrink-0 flex flex-col border-r border-border/60 bg-background lg:bg-muted/25 dark:bg-slate-950 lg:dark:bg-slate-950/40 backdrop-blur-xl transition-all duration-300 ${
            mobileShowChat ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Header Branding */}
          <div className="p-3 sm:p-4 border-b border-border/60 flex items-center justify-between gap-2.5 bg-muted/20">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Back to other page button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="h-9 px-2 sm:px-2.5 rounded-xl border border-border/70 hover:bg-muted text-foreground flex items-center gap-1.5 font-bold text-xs shrink-0 active:scale-95 transition-all shadow-xs"
                title="Back to previous page"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>

              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm sm:text-base font-display font-bold text-foreground truncate">
                    Community
                  </h2>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                  {isAdminOrExaminer ? 'All Department Study Halls' : 'Department & Announcements'}
                </p>
              </div>
            </div>

            <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full border-sky-400/30 text-sky-600 dark:text-sky-300 bg-sky-500/10 shrink-0 font-bold">
              Live
            </Badge>
          </div>

          {/* Search Bar & Filters */}
          <div className="p-3 border-b border-border/50 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
              <Input
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                placeholder="Search channels..."
                className="pl-9 h-9 rounded-2xl text-xs bg-background/80 border-border/60 shadow-inner"
              />
              {channelSearch && (
                <button
                  type="button"
                  onClick={() => setChannelSearch('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Pills (Admins with multiple channels) */}
            {isAdminOrExaminer && channels.length > 2 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'announcements', label: 'Official' },
                  { id: 'department', label: 'Departments' },
                  { id: 'general', label: 'Lounge' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategoryFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold tracking-tight whitespace-nowrap transition-all ${
                      activeCategoryFilter === tab.id
                        ? 'bg-sky-500 text-white shadow-xs scale-102'
                        : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {filteredChannels.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-1.5">
                <p className="text-xs font-semibold">No channels match filter</p>
                <p className="text-[11px] opacity-80">Try clearing your search term.</p>
              </div>
            ) : (
              filteredChannels.map((channel) => {
                const isActive = channel.id === activeChannelId;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => {
                      setActiveChannelId(channel.id);
                      setMobileShowChat(true);
                    }}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-start gap-3 group cursor-pointer relative ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-500/15 via-indigo-500/10 to-purple-500/15 border border-sky-400/40 shadow-sm'
                        : 'hover:bg-muted/60 border border-transparent'
                    }`}
                  >
                    {/* Active vertical accent bar */}
                    {isActive && (
                      <div className="absolute left-1 top-2.5 bottom-2.5 w-1 rounded-full bg-gradient-to-b from-sky-400 to-indigo-600 shadow-[0_0_8px_#38bdf8]" />
                    )}

                    <div
                      className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 text-lg shadow-xs transition-transform group-hover:scale-105 ${
                        isActive
                          ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sky-500/25 ring-2 ring-sky-400/30'
                          : 'bg-background/80 border border-border/60 text-foreground'
                      }`}
                    >
                      {channel.icon || (channel.category === 'department' ? '🏛️' : '#')}
                    </div>

                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className={`text-xs font-bold truncate ${
                            isActive ? 'text-sky-600 dark:text-sky-300 font-extrabold' : 'text-foreground'
                          }`}
                        >
                          {channel.name}
                        </h4>
                        {channel.isOfficialOnly && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30 font-semibold"
                          >
                            Official
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate line-clamp-1 mt-0.5">
                        {channel.description}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* User Profile Pill at Bottom of Sidebar */}
          <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <Avatar className="h-9 w-9 rounded-2xl border border-white/50 shadow-xs">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-tr from-sky-500 to-indigo-600 text-white text-xs font-bold">
                    {profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">
                  {profile?.full_name || 'Student'}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {userRole === 'admin' ? (
                    <span className="text-amber-600 dark:text-amber-400 font-bold">👑 Admin</span>
                  ) : userRole === 'examiner' || userRole === 'teacher' ? (
                    <span className="text-purple-600 dark:text-purple-400 font-bold">🎓 Instructor</span>
                  ) : (
                    <span>Student</span>
                  )}
                </div>
              </div>
            </div>

            <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
              Online
            </Badge>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* RIGHT PANE: ACTIVE CHAT FEED & MESSAGE STREAM             */}
        {/* ========================================================= */}
        <section
          className={`flex-1 flex flex-col h-full overflow-hidden bg-card/30 dark:bg-slate-950/30 backdrop-blur-xl ${
            !mobileShowChat ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Active Channel Header */}
          <header className="p-2.5 sm:p-3.5 lg:p-4 border-b border-border/60 bg-muted/15 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
              {/* Back to previous page button on mobile */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="lg:hidden h-8 px-2 rounded-xl text-foreground hover:bg-muted border border-border/60 flex items-center gap-1 font-bold text-xs shrink-0 active:scale-95 transition-all shadow-xs"
                title="Back to previous page"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>

              {/* Channels Switcher button on mobile */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMobileShowChat(false)}
                className="lg:hidden h-8 px-2 rounded-xl border-sky-400/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 flex items-center gap-1 text-xs shrink-0 font-semibold active:scale-95 transition-all"
                title="Switch channel"
              >
                <Layers className="h-3.5 w-3.5 text-sky-500" />
                <span className="text-[11px]">Channels</span>
              </Button>

              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center text-base sm:text-lg shrink-0 shadow-md shadow-sky-500/20">
                {activeChannel?.icon || (activeChannel?.category === 'department' ? '🏛️' : '#')}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm lg:text-base font-display font-bold text-foreground truncate">
                    {activeChannel?.name}
                  </h3>
                  {activeChannel?.isOfficialOnly && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30 font-semibold"
                    >
                      Official
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate max-w-[140px] xs:max-w-[200px] sm:max-w-md">
                  {activeChannel?.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Badge variant="secondary" className="text-[10px] sm:text-[11px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-400/25 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl">
                {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
              </Badge>

              {isAdminOrExaminer && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCleanupDialogOpen(true)}
                  className="h-7 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-semibold rounded-xl border-rose-300/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-400 gap-1 sm:gap-1.5 shadow-sm"
                  title="Clear or prune old chat storage"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Storage</span>
                </Button>
              )}
            </div>
          </header>

          {/* Firestore Permission Alert Banner (if needed) */}
          {permissionErrorDetected && (
            <div className="p-3 bg-rose-500/10 border-b border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
                <div className="text-xs min-w-0">
                  <p className="font-bold text-rose-600 dark:text-rose-400">
                    Firebase Rule Update Required:
                  </p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    Firestore security rules blocked writing to communityChannels until published.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setRulesModalOpen(true)}
                  className="h-7 text-xs font-semibold rounded-xl border-rose-400/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  View Rule & Steps
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCopyRule}
                  className="h-7 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy Rule
                </Button>
              </div>
            </div>
          )}

          {/* Pinned Message Sticky Banner (if any) */}
          {pinnedMessage && (
            <div className="px-4 py-2 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-b border-amber-500/30 flex items-center justify-between gap-2 animate-fade-in shrink-0">
              <div
                onClick={() => scrollToQuotedMessage(pinnedMessage.id)}
                className="flex items-center gap-2 min-w-0 text-xs cursor-pointer hover:opacity-90"
              >
                <div className="h-6 w-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Pin className="h-3 w-3" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-amber-700 dark:text-amber-300 mr-1.5">
                    Pinned by {pinnedMessage.pinnedBy || 'Instructor'}:
                  </span>
                  <span className="text-foreground truncate">{pinnedMessage.text}</span>
                </div>
              </div>

              {isAdminOrExaminer && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePinMessage(pinnedMessage)}
                  className="h-6 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                >
                  Unpin
                </Button>
              )}
            </div>
          )}

          {/* Main Messages Stream Area */}
          <div
            ref={chatScrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-6"
          >
            {loadingMessages ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2.5">
                <div className="h-8 w-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                <p className="text-xs font-medium">Connecting to live feed...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3.5 max-w-md mx-auto">
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-sky-500/20 via-indigo-500/20 to-purple-500/20 text-sky-600 dark:text-sky-300 flex items-center justify-center text-4xl shadow-inner border border-white/20">
                  {activeChannel?.icon || (activeChannel?.category === 'department' ? '🏛️' : '💬')}
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-foreground">
                    Welcome to #{activeChannel?.name}!
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This is the beginning of the #{activeChannel?.name} discussion space. Say hello, collaborate with peers, or ask a question!
                  </p>
                </div>
              </div>
            ) : (
              groupedMessageSections.map((group) => (
                <div key={group.dateLabel} className="space-y-4">
                  {/* Clean Date Separator Badge */}
                  <div className="relative flex items-center justify-center my-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/50" />
                    </div>
                    <span className="relative px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-background/90 text-muted-foreground border border-border/60 backdrop-blur-md shadow-xs">
                      {group.dateLabel}
                    </span>
                  </div>

                  {/* Messages in this date block */}
                  {group.items.map((message) => {
                    const isCurrentUser = message.userId === user?.uid;
                    const canDelete = isCurrentUser || isAdminOrExaminer;

                    return (
                      <div
                        key={message.id}
                        id={`msg-${message.id}`}
                        className={`group relative flex items-start gap-2.5 sm:gap-3 transition-all rounded-3xl p-1.5 -mx-1.5 ${
                          isCurrentUser ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {/* Avatar (for others) */}
                        {!isCurrentUser && (
                          <Avatar className="h-9 w-9 rounded-2xl border border-white/50 shrink-0 mt-0.5 shadow-xs">
                            <AvatarImage src={message.userAvatar} />
                            <AvatarFallback
                              className={`text-xs font-bold text-white ${
                                message.userRole === 'admin'
                                  ? 'bg-gradient-to-tr from-amber-500 to-amber-600'
                                  : message.userRole === 'examiner' || message.userRole === 'teacher'
                                  ? 'bg-gradient-to-tr from-purple-500 to-indigo-600'
                                  : 'bg-gradient-to-tr from-sky-500 to-blue-600'
                              }`}
                            >
                              {message.userName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        {/* Message Bubble Container */}
                        <div
                          className={`flex flex-col max-w-[88%] sm:max-w-[76%] ${
                            isCurrentUser ? 'items-end' : 'items-start'
                          }`}
                        >
                          {/* Sender Info Header (Only for others) */}
                          {!isCurrentUser && (
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <span className="text-xs font-bold text-foreground">
                                {message.userName}
                              </span>

                              {message.userRole === 'admin' && (
                                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold border-0 shadow-xs">
                                  👑 Admin
                                </Badge>
                              )}
                              {(message.userRole === 'examiner' || message.userRole === 'teacher') && (
                                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold border-0 shadow-xs">
                                  🎓 Instructor
                                </Badge>
                              )}
                              {message.isPinned && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-amber-600 border-amber-400/40 bg-amber-500/10 flex items-center gap-0.5 font-bold">
                                  <Pin className="h-2 w-2" /> Pinned
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Actual Chat Bubble */}
                          <div
                            className={`relative rounded-3xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed transition-all shadow-md ${
                              isCurrentUser
                                ? 'rounded-br-sm bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 text-white shadow-sky-500/20'
                                : message.userRole === 'admin'
                                ? 'rounded-tl-sm bg-gradient-to-br from-amber-500/10 via-card to-background border border-amber-400/40 text-foreground'
                                : message.userRole === 'examiner' || message.userRole === 'teacher'
                                ? 'rounded-tl-sm bg-gradient-to-br from-purple-500/10 via-card to-background border border-purple-400/40 text-foreground'
                                : 'rounded-tl-sm bg-card/90 dark:bg-slate-800/90 border border-white/60 dark:border-white/10 text-foreground'
                            }`}
                          >
                            {/* Quoted Reply Context Box */}
                            {message.replyTo && (
                              <div
                                onClick={() => scrollToQuotedMessage(message.replyTo!.id)}
                                className={`mb-2 p-2 rounded-2xl border-l-2 text-xs flex items-start gap-1.5 cursor-pointer transition-opacity hover:opacity-90 ${
                                  isCurrentUser
                                    ? 'bg-white/15 border-white text-white/90'
                                    : 'bg-muted/70 border-sky-500 text-muted-foreground'
                                }`}
                              >
                                <Reply className="h-3 w-3 shrink-0 mt-0.5 rotate-180" />
                                <div className="min-w-0">
                                  <span className="font-bold mr-1">
                                    @{message.replyTo.userName}:
                                  </span>
                                  <span className="italic truncate">{message.replyTo.text}</span>
                                </div>
                              </div>
                            )}

                            {/* Message Text */}
                            <p className="break-words whitespace-pre-wrap selection:bg-white/30">
                              {message.text}
                            </p>

                            {/* Timestamp indicator */}
                            <div
                              className={`flex items-center justify-end gap-1 mt-1.5 text-[10px] ${
                                isCurrentUser ? 'text-white/75' : 'text-muted-foreground'
                              }`}
                            >
                              <span>{formatTimestamp(message.createdAt)}</span>
                              {isCurrentUser && <Check className="h-3 w-3" />}
                            </div>
                          </div>

                          {/* Reaction Badges Pill Row */}
                          {message.reactions && Object.keys(message.reactions).length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5 px-1">
                              {Object.entries(message.reactions).map(([emoji, userIds]) => {
                                if (!userIds || userIds.length === 0) return null;
                                const hasReacted = user ? userIds.includes(user.uid) : false;

                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(message, emoji)}
                                    className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border transition-all active:scale-90 ${
                                      hasReacted
                                        ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-400/60 shadow-xs'
                                        : 'bg-background/80 text-muted-foreground border-border/70 hover:bg-muted'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-[11px] font-bold">{userIds.length}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Floating Quick Action Toolbar (visible on hover) */}
                        <div
                          className={`opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 flex items-center gap-0.5 bg-background/95 backdrop-blur-md border border-border/80 rounded-2xl p-1 shadow-lg z-10 ${
                            isCurrentUser ? 'right-4 -top-3' : 'left-12 -top-3'
                          }`}
                        >
                          {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(message, emoji)}
                              className="h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center text-xs transition-transform hover:scale-110"
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(message);
                              textareaRef.current?.focus();
                            }}
                            className="h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            title="Reply"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>

                          {isAdminOrExaminer && (
                            <button
                              type="button"
                              onClick={() => handlePinMessage(message)}
                              className={`h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center transition-colors ${
                                message.isPinned ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'
                              }`}
                              title={message.isPinned ? 'Unpin message' : 'Pin message'}
                            >
                              <Pin className="h-3 w-3" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(message)}
                              className="h-6 w-6 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 flex items-center justify-center transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Floating Scroll-to-bottom Pill */}
          {showScrollBottomPill && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute bottom-24 right-6 px-3.5 py-1.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-xl text-xs font-bold flex items-center gap-1.5 animate-bounce z-20"
            >
              <span>↓ Latest messages</span>
            </button>
          )}

          {/* Replying-To Context Banner */}
          {replyingTo && (
            <div className="px-4 py-2 bg-gradient-to-r from-sky-500/15 via-indigo-500/10 to-transparent border-t border-sky-400/30 flex items-center justify-between gap-3 animate-fade-in shrink-0">
              <div className="flex items-center gap-2 min-w-0 text-xs">
                <Reply className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="font-bold text-sky-700 dark:text-sky-300 truncate">
                  Replying to @{replyingTo.userName}:
                </span>
                <span className="text-muted-foreground truncate">{replyingTo.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Bottom Chat Input Bar */}
          <footer className="p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border/60 bg-background/95 lg:bg-muted/20 backdrop-blur-md shrink-0 space-y-2">
            {activeChannel?.isOfficialOnly && !isAdminOrExaminer ? (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1.5">
                  <Info className="h-4 w-4" />
                  Official Announcements is broadcast-only for students. You can react to messages using emojis!
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-2">
                {/* Quick Emoji Bar */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                  <span className="text-[11px] font-bold text-muted-foreground mr-1">React:</span>
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setInputText((prev) => prev + emoji)}
                      className="px-2 py-0.5 rounded-lg hover:bg-muted text-sm transition-transform hover:scale-115 active:scale-95"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Input Textarea & Send Button */}
                <div className="flex items-end gap-2.5">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Message #${activeChannel?.name || 'channel'}... (Enter to send, Shift+Enter for new line)`}
                    className="flex-1 min-h-[44px] max-h-36 p-3 rounded-2xl bg-background/90 border border-border/80 focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-xs sm:text-sm text-foreground resize-none transition-all placeholder:text-muted-foreground/60 shadow-inner"
                  />

                  <Button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="h-11 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white font-bold shadow-lg shadow-sky-500/25 flex items-center gap-2 shrink-0 active:scale-95 transition-all"
                  >
                    {isSending ? (
                      <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span className="hidden sm:inline text-xs">Send</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </footer>
        </section>
      </div>

      {/* Firestore Rules Instructions Dialog */}
      <Dialog open={rulesModalOpen} onOpenChange={setRulesModalOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5 text-rose-500" />
              Firestore Security Rules Update
            </DialogTitle>
            <DialogDescription className="text-xs">
              To enable live chat in production, your Firebase project requires permissions for communityChannels.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-foreground">Steps to enable (Takes ~30 seconds):</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground pl-1">
                <li>Open the <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-sky-500 hover:text-sky-600 underline font-semibold inline-flex items-center gap-1">Firebase Console <ExternalLink className="h-3 w-3" /></a></li>
                <li>Select your project <strong>online-exam-f443c</strong></li>
                <li>Navigate to <strong>Firestore Database</strong> → <strong>Rules</strong> tab</li>
                <li>Paste the snippet below right before the last closing brace <code>{"}"}</code></li>
                <li>Click <strong>Publish</strong></li>
              </ol>
            </div>

            <div className="relative">
              <pre className="p-3.5 rounded-2xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                {FIRESTORE_COMMUNITY_RULE_SNIPPET}
              </pre>
              <Button
                size="sm"
                onClick={handleCopyRule}
                className="absolute top-2.5 right-2.5 h-7 px-2.5 rounded-xl text-xs bg-sky-600 hover:bg-sky-700 text-white font-semibold"
              >
                {copiedRule ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Snippet
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Chat Storage & Retention Cleanup Dialog */}
      {isAdminOrExaminer && (
        <AdminChatCleanupDialog
          open={cleanupDialogOpen}
          onOpenChange={setCleanupDialogOpen}
          channels={channels}
          initialChannelId={activeChannelId}
        />
      )}
    </DashboardLayout>
  );
}
