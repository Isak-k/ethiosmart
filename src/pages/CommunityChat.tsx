import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Hash,
  Volume2,
  Shield,
  GraduationCap,
  Sparkles,
  ArrowLeft,
  ChevronDown,
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
import { getSubjects } from '@/lib/subjects';
import { Department } from '@/integrations/firebase/types';
import { Subject } from '@/types/subject';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🧠', '💡', '🎉'];

export default function CommunityChat() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Channels & active selection
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('general');
  const [channelSearch, setChannelSearch] = useState<string>('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  // Messages in active channel
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);

  // Message input state
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CommunityMessage | null>(null);

  // Mobile navigation state
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // Scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);

  // Firestore permission helper modal state
  const [permissionErrorDetected, setPermissionErrorDetected] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [copiedRule, setCopiedRule] = useState(false);

  const FIRESTORE_COMMUNITY_RULE_SNIPPET = `    // --- Community Channels & Messages Collection ---
    match /communityChannels/{channelId} {
      allow read: if true;
      allow write: if isAuthenticated() || isAdminOrSuper();

      match /{allChildren=**} {
        allow read: if true;
        allow write: if isAuthenticated();
      }
    }

    match /communityMessages/{document=**} {
      allow read: if true;
      allow write: if isAuthenticated();
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

  // Load departments and subjects on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [deptList, subjList] = await Promise.all([
          getDepartments(),
          getSubjects(),
        ]);
        if (!isMounted) return;
        setDepartments(deptList);
        setSubjects(subjList);
        const allChannels = buildCommunityChannels(deptList, subjList);
        setChannels(allChannels);
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
  }, []);

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

      // Scroll to bottom immediately
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
      setInputText(messageText); // restore text on error
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

    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = yesterday.toDateString() === date.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return timeStr;
    if (isYesterday) return `Yesterday at ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${timeStr}`;
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-4 animate-fade-in pb-12">
        {/* Top Header Card */}
        <div className="liquid-glass-card rounded-3xl p-5 sm:p-6 border border-white/60 dark:border-white/10 shadow-xl bg-gradient-to-r from-sky-500/10 via-purple-500/10 to-indigo-500/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">
                    EthioSmart Community
                  </h1>
                  <Badge variant="secondary" className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/30 text-xs font-semibold">
                    Live Chat
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Connect, collaborate, and study together across departments, subjects, and lounges.
                </p>
              </div>
            </div>

            {/* Quick Stats or Welcome */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-xl px-3 py-1.5 bg-background/80 backdrop-blur-md border-border/80 text-xs font-medium flex items-center gap-1.5 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{channels.length} Study Channels</span>
              </Badge>
            </div>
          </div>
        </div>

        {/* Main 2-Column Chat Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[750px] max-h-[82vh]">
          {/* ========================================================= */}
          {/* LEFT COLUMN: CHANNELS & ROOMS DIRECTORY                   */}
          {/* ========================================================= */}
          <Card
            className={`lg:col-span-4 xl:col-span-3.5 flex flex-col rounded-3xl border border-white/60 dark:border-white/10 shadow-lg bg-card/85 backdrop-blur-xl overflow-hidden ${
              mobileShowChat ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Search and Filters */}
            <div className="p-3.5 border-b border-border/60 space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Search channels & subjects..."
                  className="pl-9 h-9 rounded-2xl text-xs bg-muted/40 border-border/70"
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

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'announcements', label: 'Official' },
                  { id: 'general', label: 'Lounges' },
                  { id: 'department', label: 'Depts' },
                  { id: 'subject', label: 'Subjects' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategoryFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all ${
                      activeCategoryFilter === tab.id
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-transparent">
              {filteredChannels.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground space-y-1">
                  <p className="text-xs font-semibold">No channels found</p>
                  <p className="text-[11px]">Try adjusting your search filter.</p>
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
                      className={`w-full text-left p-2.5 rounded-2xl transition-all flex items-start gap-2.5 group cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-sky-500/15 via-indigo-500/10 to-purple-500/15 border border-sky-400/40 shadow-xs'
                          : 'hover:bg-muted/60 border border-transparent'
                      }`}
                    >
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-base shadow-xs transition-transform group-hover:scale-105 ${
                          isActive
                            ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sky-500/20'
                            : 'bg-muted/80 text-foreground'
                        }`}
                      >
                        {channel.icon || (channel.category === 'subject' ? '📚' : '#')}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4
                            className={`text-xs font-bold truncate ${
                              isActive ? 'text-sky-600 dark:text-sky-400' : 'text-foreground'
                            }`}
                          >
                            {channel.name}
                          </h4>
                          {channel.isOfficialOnly && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1 py-0 h-4 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30"
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

            {/* Bottom Current User Snippet */}
            <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-8 w-8 rounded-xl border border-white/40">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-sky-500 text-white text-xs font-bold">
                    {profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {profile?.full_name || 'Student'}
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize truncate">
                    {userRole === 'admin' ? '👑 Admin' : userRole === 'examiner' ? '🎓 Instructor' : 'Student'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                Online
              </Badge>
            </div>
          </Card>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: ACTIVE CHAT ROOM & MESSAGING AREA           */}
          {/* ========================================================= */}
          <Card
            className={`lg:col-span-8 xl:col-span-8.5 flex flex-col rounded-3xl border border-white/60 dark:border-white/10 shadow-lg bg-card/90 backdrop-blur-xl overflow-hidden relative ${
              !mobileShowChat ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Active Channel Header */}
            <div className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Back button on mobile */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileShowChat(false)}
                  className="lg:hidden h-8 w-8 rounded-xl -ml-1 text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center text-lg shrink-0 shadow-xs">
                  {activeChannel?.icon || '#'}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground truncate">
                      {activeChannel?.name}
                    </h3>
                    {activeChannel?.isOfficialOnly && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30"
                      >
                        Announcements
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {activeChannel?.description}
                  </p>
                </div>
              </div>

              {/* Channel Stats / Action */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="secondary" className="text-[11px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-400/20">
                  {messages.length} messages
                </Badge>
              </div>
            </div>

            {/* Firestore Permission Alert Banner */}
            {permissionErrorDetected && (
              <div className="p-3 bg-rose-500/10 border-b border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in">
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

            {/* Pinned Message Banner (if any) */}
            {pinnedMessage && (
              <div className="px-4 py-2 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/30 flex items-center justify-between gap-2 animate-fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Pin className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 text-xs">
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
                    className="h-6 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                    title="Unpin message"
                  >
                    Unpin
                  </Button>
                )}
              </div>
            )}

            {/* Messages Feed */}
            <div
              ref={chatScrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4"
            >
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
                  <div className="h-7 w-7 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                  <p className="text-xs">Loading channel messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                  <div className="h-16 w-16 rounded-3xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center text-3xl shadow-sm">
                    {activeChannel?.icon || '💬'}
                  </div>
                  <div className="max-w-sm space-y-1">
                    <h4 className="text-sm font-bold text-foreground">
                      Welcome to #{activeChannel?.name}!
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This is the beginning of the #{activeChannel?.name} discussion room. Say hello, ask a study question, or share ideas!
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isCurrentUser = message.userId === user?.uid;
                  const canDelete = isCurrentUser || isAdminOrExaminer;

                  return (
                    <div
                      key={message.id}
                      className={`group flex items-start gap-3 transition-colors rounded-2xl p-2 -mx-2 hover:bg-muted/40 ${
                        message.isPinned ? 'bg-amber-500/5 ring-1 ring-amber-500/20' : ''
                      }`}
                    >
                      {/* Avatar */}
                      <Avatar className="h-9 w-9 rounded-xl border border-white/40 shrink-0 mt-0.5">
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

                      {/* Message Content Body */}
                      <div className="flex-1 min-w-0">
                        {/* Header: Name, Badges, Timestamp */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-bold text-foreground">
                            {message.userName}
                          </span>

                          {/* Role Badges */}
                          {message.userRole === 'admin' && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold border-0 shadow-xs">
                              👑 Admin
                            </Badge>
                          )}
                          {(message.userRole === 'examiner' || message.userRole === 'teacher') && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold border-0 shadow-xs">
                              🎓 Instructor
                            </Badge>
                          )}

                          {message.isPinned && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-600 border-amber-400/40 bg-amber-500/10 flex items-center gap-1">
                              <Pin className="h-2.5 w-2.5" /> Pinned
                            </Badge>
                          )}

                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {formatTimestamp(message.createdAt)}
                          </span>
                        </div>

                        {/* Reply Quote (if this message is replying to another) */}
                        {message.replyTo && (
                          <div className="mb-2 p-2 rounded-xl bg-muted/60 border-l-2 border-sky-500 text-xs text-muted-foreground flex items-start gap-1.5">
                            <Reply className="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5 rotate-180" />
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground mr-1">
                                @{message.replyTo.userName}:
                              </span>
                              <span className="italic truncate">{message.replyTo.text}</span>
                            </div>
                          </div>
                        )}

                        {/* Text */}
                        <p className="text-xs sm:text-sm text-foreground leading-relaxed break-words whitespace-pre-wrap">
                          {message.text}
                        </p>

                        {/* Reactions Bar */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {/* Render existing reaction buttons */}
                          {Object.entries(message.reactions || {}).map(([emoji, userIds]) => {
                            if (!userIds || userIds.length === 0) return null;
                            const hasReacted = user ? userIds.includes(user.uid) : false;

                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleToggleReaction(message, emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                                  hasReacted
                                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/50 shadow-xs'
                                    : 'bg-muted/50 text-muted-foreground border-border/60 hover:bg-muted'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-[11px]">{userIds.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Hover Action Bar */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-card/90 backdrop-blur-md border border-border/80 rounded-2xl p-1 shadow-sm shrink-0 self-start">
                        {/* Quick Reaction Emojis */}
                        {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(message, emoji)}
                            className="h-7 w-7 rounded-xl hover:bg-muted flex items-center justify-center text-sm transition-transform hover:scale-110"
                            title={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}

                        {/* Reply Button */}
                        <button
                          type="button"
                          onClick={() => setReplyingTo(message)}
                          className="h-7 w-7 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          title="Reply"
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>

                        {/* Pin Button (Admins only) */}
                        {isAdminOrExaminer && (
                          <button
                            type="button"
                            onClick={() => handlePinMessage(message)}
                            className={`h-7 w-7 rounded-xl hover:bg-muted flex items-center justify-center transition-colors ${
                              message.isPinned ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title={message.isPinned ? 'Unpin message' : 'Pin message'}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Delete Button */}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(message)}
                            className="h-7 w-7 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 flex items-center justify-center transition-colors"
                            title="Delete message"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to Bottom Floating Pill */}
            {showScrollBottomPill && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute bottom-20 right-6 px-3 py-1.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg text-xs font-semibold flex items-center gap-1.5 animate-bounce z-10"
              >
                <span>↓ New messages</span>
              </button>
            )}

            {/* Replying Banner */}
            {replyingTo && (
              <div className="px-4 py-2 bg-sky-500/10 border-t border-sky-400/30 flex items-center justify-between gap-2 animate-fade-in">
                <div className="flex items-center gap-2 min-w-0 text-xs">
                  <Reply className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="font-semibold text-sky-700 dark:text-sky-300 truncate">
                    Replying to @{replyingTo.userName}:
                  </span>
                  <span className="text-muted-foreground truncate">{replyingTo.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Input Bar / Read-Only Notice */}
            {activeChannel?.isOfficialOnly && !isAdminOrExaminer ? (
              <div className="p-4 border-t border-border/60 bg-muted/40 text-center">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1.5">
                  <Info className="h-4 w-4" />
                  Official Announcements is read-only for students. You can react to posts using emojis!
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 border-t border-border/60 bg-muted/20 space-y-2"
              >
                {/* Quick Emoji Bar */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                  <span className="text-[11px] font-semibold text-muted-foreground mr-1">React:</span>
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setInputText((prev) => prev + emoji)}
                      className="px-2 py-0.5 rounded-lg hover:bg-muted text-sm transition-transform hover:scale-110"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Input and Send Button */}
                <div className="flex items-end gap-2">
                  <textarea
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
                    className="flex-1 min-h-[42px] max-h-32 p-2.5 rounded-2xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-xs sm:text-sm text-foreground resize-none transition-all placeholder:text-muted-foreground/70"
                  />

                  <Button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="h-10 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white font-semibold shadow-md shadow-sky-500/25 flex items-center gap-1.5 shrink-0"
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
          </Card>
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
      </div>
    </DashboardLayout>
  );
}
