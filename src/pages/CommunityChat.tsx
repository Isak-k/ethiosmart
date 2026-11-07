import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  CheckCheck,
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
  Bold,
  Code,
  Quote,
  MoreVertical,
  BookOpen,
  Filter,
  CornerDownLeft,
  Crown,
  Image as ImageIcon,
  Paperclip,
  Eye,
  Download,
  Radio,
  RefreshCw,
  ArrowRight,
  ArrowLeftRight,
  Zap,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CommunityChannel,
  CommunityMessage,
  ReplyReference,
  CommunityChatMode,
} from '@/types/community';
import {
  buildCommunityChannels,
  subscribeToChannelMessages,
  sendCommunityMessage,
  toggleMessageReaction,
  pinCommunityMessage,
  deleteCommunityMessage,
  getCommunityChatMode,
  subscribeToCommunityChatMode,
  setCommunityChatMode,
} from '@/lib/community';
import { uploadQuestionImage } from '@/lib/image-upload';
import { getDepartments } from '@/lib/departments';
import { getCachedDefaultDepartmentId } from '@/lib/system-settings';
import { Department } from '@/integrations/firebase/types';
import { AdminChatCleanupDialog } from '@/components/community/AdminChatCleanupDialog';

export const EMOJI_CATEGORIES = [
  {
    name: 'Reactions',
    emojis: ['👍', '❤️', '🔥', '🎉', '🧠', '💡', '👏', '🙌', '💯', '✨', '🎯', '🚀', '👀', '💪'],
  },
  {
    name: 'Study & Campus',
    emojis: ['📚', '📖', '📝', '✏️', '🎓', '🔬', '💻', '📐', '📊', '📌', '📎', '⌛', '🏆', '🥇'],
  },
  {
    name: 'Smilies & Faces',
    emojis: ['😀', '😂', '😎', '🤔', '🥳', '🤩', '😇', '🤝', '🙏', '⚡', '☕', '🌟', '🫡', '👌'],
  },
];

export const QUICK_EMOJIS = ['👍', '❤️', '🔥', '💡', '🧠', '🎉'];

export const ICEBREAKER_PROMPTS = [
  { label: 'Say Hello 👋', text: 'Hello everyone! 👋 Excited to study and collaborate here.' },
  { label: 'Ask a Question ❓', text: 'Does anyone have the past exam questions or notes for this week?' },
  { label: 'Share Study Tip 💡', text: '💡 Quick study tip: Review chapter key formulas before doing practice tests!' },
];

/**
 * Formats URLs, bold, inline code and linebreaks in chat text
 */
function renderFormattedChatText(text: string, isCurrentUser: boolean) {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    const tokens = line.split(/(https?:\/\/[^\s]+|\*\*[^*]+\*\*|`[^`]+`)/g);

    return (
      <span key={lineIdx} className="block leading-relaxed">
        {tokens.map((token, tokenIdx) => {
          if (/^https?:\/\//.test(token)) {
            return (
              <a
                key={tokenIdx}
                href={token}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`underline font-semibold break-all inline-flex items-center gap-0.5 ${
                  isCurrentUser ? 'text-amber-200 hover:text-white' : 'text-sky-600 dark:text-sky-400 hover:underline'
                }`}
              >
                {token}
              </a>
            );
          }
          if (token.startsWith('**') && token.endsWith('**')) {
            return (
              <strong key={tokenIdx} className="font-extrabold">
                {token.slice(2, -2)}
              </strong>
            );
          }
          if (token.startsWith('`') && token.endsWith('`')) {
            return (
              <code
                key={tokenIdx}
                className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] ${
                  isCurrentUser ? 'bg-white/20 text-white' : 'bg-muted text-foreground'
                }`}
              >
                {token.slice(1, -1)}
              </code>
            );
          }
          return token;
        })}
      </span>
    );
  });
}

export default function CommunityChat() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Session start timestamp: When chatMode is 'live', messages before this session are hidden so returning users see a blank history.
  // Other users who were already in the chat when a message was sent will see it, and it will disappear for them only when they exit.
  const sessionStartTimeRef = useRef<number>(Date.now());
  const sentInThisSessionRef = useRef<Set<string>>(new Set());

  const handleGoBack = () => {
    // When a user leaves, we do NOT delete live messages from Firestore so other active users can still see them.
    // When this user returns later, their sessionStartTimeRef resets, giving them a blank chat history.
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Channels & active selection (starts empty so students auto-land on their Department Chat)
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('');
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
  // Defaults to true so students jump directly into their feed with TikTok-style top tabs
  const [mobileShowChat, setMobileShowChat] = useState(true);

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

  // Community Chat Mode ('stored' | 'live')
  const [chatMode, setChatMode] = useState<CommunityChatMode>('stored');
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);

  // Image & Screenshot sharing state
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [viewingImage, setViewingImage] = useState<{ url: string; caption?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modern UI states
  const [inputEmojiPickerOpen, setInputEmojiPickerOpen] = useState(false);
  const [emojiCategoryTab, setEmojiCategoryTab] = useState<string>('Reactions');
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [inChannelSearchOpen, setInChannelSearchOpen] = useState(false);
  const [inChannelSearchQuery, setInChannelSearchQuery] = useState('');

  // Subscribe to real-time Community Chat Mode
  useEffect(() => {
    const unsubscribeMode = subscribeToCommunityChatMode((mode) => {
      setChatMode(mode);
    });
    return () => {
      unsubscribeMode();
    };
  }, []);

  // Admin switch between Stored Mode and Live Mode
  const handleToggleChatMode = async () => {
    if (!isAdminOrExaminer || !user || isUpdatingMode) return;
    const nextMode: CommunityChatMode = chatMode === 'stored' ? 'live' : 'stored';
    setIsUpdatingMode(true);
    try {
      await setCommunityChatMode({
        mode: nextMode,
        adminId: user.uid,
        adminName: profile?.full_name || user.email?.split('@')[0] || 'Admin',
      });
      setChatMode(nextMode);
      toast({
        title: nextMode === 'live' ? '⚡ Live Mode Active' : '💾 Stored Mode Active',
        description:
          nextMode === 'live'
            ? 'Real-time student communication is now active across the community.'
            : 'Messages are stored in the database so students can access previous conversations.',
      });
    } catch (err: any) {
      console.error('Failed to change chat mode:', err);
      toast({
        title: 'Mode update failed',
        description: err.message || 'Could not update community chat mode.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingMode(false);
    }
  };

  // Stage an image file or screenshot for sending
  const handleStageImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Unsupported file type',
        description: 'Please select an image (JPEG, PNG, or WebP).',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Image too large',
        description: 'Please attach an image smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }
    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }
    setPendingImageFile(file);
    const url = URL.createObjectURL(file);
    setPendingImagePreview(url);
  };

  const handleClearStagedImage = () => {
    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }
    setPendingImageFile(null);
    setPendingImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Capture pasted screenshots from clipboard directly into the chat input
  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleStageImage(file);
          toast({
            title: 'Screenshot Captured 📸',
            description: 'Screenshot attached. Ready to send with your message.',
          });
        }
        break;
      }
    }
  };

  // Clean up object URL when component unmounts
  useEffect(() => {
    return () => {
      if (pendingImagePreview) {
        URL.revokeObjectURL(pendingImagePreview);
      }
    };
  }, [pendingImagePreview]);

  const handleInsertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleInsertFormatting = (prefix: string, suffix: string = prefix, placeholder: string = 'text') => {
    const el = textareaRef.current;
    if (!el) {
      setInputText((prev) => prev + prefix + placeholder + suffix);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = inputText.substring(start, end) || placeholder;
    const replacement = prefix + selected + suffix;
    const nextVal = inputText.substring(0, start) + replacement + inputText.substring(end);
    setInputText(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 10);
  };

  const handleCopyMessageText = (message: CommunityMessage) => {
    navigator.clipboard.writeText(message.text);
    setCopiedMessageId(message.id);
    toast({
      title: 'Message Copied 📋',
      description: 'Text copied to your clipboard.',
    });
    setTimeout(() => {
      setCopiedMessageId(null);
    }, 2000);
  };

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

        // Auto select first channel: students land directly in their Department Chat with open textarea!
        if (allChannels.length > 0) {
          const deptChannel = allChannels.find((c) => c.category === 'department');
          const defaultChannel = deptChannel ? deptChannel.id : allChannels[0].id;
          setActiveChannelId((prev) => (prev && allChannels.some((c) => c.id === prev) ? prev : defaultChannel));
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
        const isPerm =
          (error as any)?.code === 'permission-denied' ||
          String(error?.message || '').toLowerCase().includes('permission') ||
          String(error?.message || '').toLowerCase().includes('missing or insufficient');
        if (isPerm) {
          setPermissionErrorDetected(true);
        }
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

  // Announcements channel (Official Notices)
  const announcementsChannel = useMemo(() => {
    return channels.find((c) => c.category === 'announcements' || c.id === 'announcements') || channels[0];
  }, [channels]);

  // All Department channels
  const departmentChannels = useMemo(() => {
    return channels.filter((c) => c.category === 'department');
  }, [channels]);

  // Current active or default department channel
  const currentDeptChannel = useMemo(() => {
    if (activeChannel?.category === 'department') return activeChannel;
    return departmentChannels[0] || null;
  }, [activeChannel, departmentChannels]);

  // Active status checks for TikTok switcher tabs
  const isAnnouncementsActive = activeChannel?.id === 'announcements' || activeChannel?.category === 'announcements';
  const isDeptActive = activeChannel?.category === 'department';

  // Short display label for department tab
  const deptShortName = useMemo(() => {
    if (!currentDeptChannel) return 'Department';
    const cleaned = (currentDeptChannel.name || '').replace(/\s*Department\s*/i, '').trim();
    return cleaned || 'Department';
  }, [currentDeptChannel]);

  // Mobile-optimized short label for Department tab (clean & balanced like TikTok "Following")
  const deptMobileLabel = useMemo(() => {
    if (!currentDeptChannel) return 'Department';
    const cleaned = (currentDeptChannel.name || '').replace(/\s*Department\s*/i, '').trim();
    if (cleaned.length <= 11) return cleaned;
    return 'Department';
  }, [currentDeptChannel]);

  // Mobile swipe gestures between Department and Announcements (like TikTok)
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

    // Minimum swipe distance of 50px, and horizontal movement dominant (1.4x vertical)
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      if (deltaX < -50 && isDeptActive) {
        // Swiped Left -> go to Announcements (TikTok: following -> for you)
        if (announcementsChannel) {
          try {
            navigator.vibrate?.(10);
          } catch {}
          setActiveChannelId(announcementsChannel.id);
        }
      } else if (deltaX > 50 && isAnnouncementsActive) {
        // Swiped Right -> go to Department (TikTok: for you -> following)
        if (currentDeptChannel) {
          try {
            navigator.vibrate?.(10);
          } catch {}
          setActiveChannelId(currentDeptChannel.id);
        }
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

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

  // Send message handler (supporting text, image upload, and screenshots)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const hasText = Boolean(inputText.trim());
    const hasImage = Boolean(pendingImageFile);
    if ((!hasText && !hasImage) || !user || isSending) return;

    if (activeChannel?.isOfficialOnly && !isAdminOrExaminer) {
      toast({
        title: 'Announcements Only',
        description: 'Only instructors and administrators can post top-level announcements.',
        variant: 'destructive',
      });
      return;
    }

    const messageText = inputText.trim();
    const imageFileToSend = pendingImageFile;

    setInputText('');
    handleClearStagedImage();

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
      let uploadedImageUrl: string | undefined;
      let uploadedImagePublicId: string | undefined;

      if (imageFileToSend) {
        setIsUploadingImage(true);
        try {
          const uploadRes = await uploadQuestionImage(imageFileToSend);
          uploadedImageUrl = uploadRes.url;
          uploadedImagePublicId = uploadRes.publicId;
        } catch (uploadErr: any) {
          console.warn('Image upload error, continuing with fallback:', uploadErr);
          toast({
            title: 'Image notice',
            description: 'Could not upload image attachment. Sending text.',
            variant: 'destructive',
          });
        } finally {
          setIsUploadingImage(false);
        }
      }

      const sentDocId = await sendCommunityMessage({
        channelId: activeChannelId,
        userId: user.uid,
        userName: profile?.full_name || user.email?.split('@')[0] || 'Student',
        userEmail: user.email || '',
        userRole,
        userAvatar: profile?.avatar_url,
        text: messageText,
        imageUrl: uploadedImageUrl,
        imagePublicId: uploadedImagePublicId,
        replyTo: replyRef,
        chatMode,
      });

      if (sentDocId) {
        sentInThisSessionRef.current.add(sentDocId);
      }

      if (inChannelSearchQuery) {
        setInChannelSearchQuery('');
      }

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      // Restore input text if send failed
      setInputText(messageText);
      const isPermError =
        err?.code === 'permission-denied' ||
        String(err?.message || '').toLowerCase().includes('permission') ||
        String(err?.message || '').toLowerCase().includes('missing or insufficient');

      if (isPermError) {
        setPermissionErrorDetected(true);
        setRulesModalOpen(true);
        // Optimistically add message so user does not lose their typed message
        const optimisticMsg: CommunityMessage = {
          id: `local_${Date.now()}`,
          channelId: activeChannelId,
          userId: user.uid,
          userName: profile?.full_name || user.email?.split('@')[0] || 'Student',
          userEmail: user.email || '',
          userRole,
          userAvatar: profile?.avatar_url,
          text: messageText,
          replyTo: replyRef,
          reactions: {},
          isPinned: false,
          deleted: false,
          createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        toast({
          title: 'Firestore Permission Rule Required (1-Minute Setup)',
          description: 'Your message was saved locally. Please paste the Firestore rule in Firebase Console so all students receive it.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error sending message',
          description: err.message || 'Check your internet connection and try again.',
          variant: 'destructive',
        });
        setInputText(messageText);
      }
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

  // Messages filtered by in-channel search and Live Mode session boundary
  const displayedMessages = useMemo(() => {
    let list = messages;

    // When chatMode is 'live', past chat history does not stay when user closes chat.
    // Returning users see a blank history of chat; only messages arriving in this active session appear.
    // However, users who are in the chat at that time still see the messages until they exit.
    if (chatMode === 'live') {
      list = list.filter((m) => {
        // Any message sent by the user during this session is always visible
        if (sentInThisSessionRef.current.has(m.id)) {
          return true;
        }

        const msgTime = m.createdAt?.toDate
          ? m.createdAt.toDate().getTime()
          : (typeof m.createdAt?.seconds === 'number'
              ? m.createdAt.seconds * 1000
              : (m.createdAt ? Number(m.createdAt) : Date.now()));

        // Visible only if the message was created after the user entered this active session
        return msgTime >= sessionStartTimeRef.current - 3000;
      });
    }

    if (!inChannelSearchQuery.trim()) return list;
    const q = inChannelSearchQuery.toLowerCase();
    return list.filter(
      (m) =>
        m.text.toLowerCase().includes(q) ||
        m.userName.toLowerCase().includes(q)
    );
  }, [messages, inChannelSearchQuery, chatMode]);

  // Date grouping for clean Discord/Telegram style date separators
  const groupedMessageSections = useMemo(() => {
    const groups: { dateLabel: string; items: CommunityMessage[] }[] = [];
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    displayedMessages.forEach((msg) => {
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
  }, [displayedMessages]);

  return (
    <>
      {/* Completely standalone, dedicated page (No DashboardLayout, No global navbar/notification/3-line menu, No mobile bottom dock) */}
      <div className="w-screen h-[100dvh] flex flex-col lg:flex-row bg-background dark:bg-slate-950 overflow-hidden select-text">
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
          {/* Top Header with TikTok-style "Department | Announcements" Feeds Switcher */}
          <header className="px-2.5 sm:px-4 py-2 sm:py-3 border-b border-border/60 bg-background/95 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-between gap-1 sm:gap-3 shrink-0 relative">
            {/* Left Controls: Top Back Button & Channel Icon */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Back to previous page button (prominently visible on both desktop and mobile) */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="h-8.5 px-2.5 sm:px-3 rounded-xl border border-border/70 hover:bg-muted text-foreground flex items-center gap-1.5 font-bold text-xs shrink-0 active:scale-95 transition-all shadow-xs"
                title="Back to dashboard / previous page"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>

              {/* Desktop channel icon indicator */}
              <div className="hidden lg:flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center text-sm shadow-xs">
                  {activeChannel?.icon || (activeChannel?.category === 'department' ? '🏛️' : '#')}
                </div>
              </div>
            </div>

            {/* CENTER: SMALL BUTTONS TO CHANGE FROM DEP CHAT TO ANNOUNCEMENT AND VICE VERSA */}
            <div className="flex-1 flex items-center justify-center min-w-0 px-1">
              <div className="inline-flex items-center p-1 rounded-2xl bg-muted/60 dark:bg-slate-900/80 border border-border/60 shadow-xs max-w-full">
                {/* 1. DEPARTMENT CHAT SMALL BUTTON */}
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentDeptChannel) {
                        setActiveChannelId(currentDeptChannel.id);
                        setMobileShowChat(true);
                      }
                    }}
                    className={`h-7.5 sm:h-8 px-2.5 sm:px-3 rounded-xl text-xs sm:text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 ${
                      isDeptActive
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sm shadow-sky-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                    }`}
                    title="Switch to Department Chat"
                  >
                    <span className="text-xs sm:text-sm">🏛️</span>
                    <span className="truncate max-w-[85px] xs:max-w-[110px] sm:max-w-[150px]">
                      <span className="hidden sm:inline">{deptShortName}</span>
                      <span className="sm:hidden">{deptMobileLabel}</span>
                    </span>
                  </button>

                  {/* Multi-department dropdown for Admin */}
                  {isAdminOrExaminer && departmentChannels.length > 1 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-7 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg transition-colors -ml-1 mr-0.5"
                          title="Switch department"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-56 rounded-2xl p-1.5 shadow-xl bg-background/95 backdrop-blur-xl border border-border/80">
                        <div className="text-[10px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                          Departments
                        </div>
                        {departmentChannels.map((dept) => (
                          <DropdownMenuItem
                            key={dept.id}
                            onClick={() => {
                              setActiveChannelId(dept.id);
                              setMobileShowChat(true);
                            }}
                            className={`text-xs rounded-xl cursor-pointer font-medium flex items-center justify-between ${
                              dept.id === activeChannelId ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold' : ''
                            }`}
                          >
                            <span className="truncate">{dept.name}</span>
                            {dept.id === activeChannelId && <Check className="h-3.5 w-3.5 text-sky-500 shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Turn / Swap Quick Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isAnnouncementsActive && currentDeptChannel) {
                      setActiveChannelId(currentDeptChannel.id);
                    } else if (announcementsChannel) {
                      setActiveChannelId(announcementsChannel.id);
                    }
                    setMobileShowChat(true);
                  }}
                  className="h-6 w-6 mx-0.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 flex items-center justify-center transition-transform active:rotate-180"
                  title="Turn between Department Chat and Announcements"
                >
                  <ArrowLeftRight className="h-3 w-3" />
                </button>

                {/* 2. ANNOUNCEMENTS SMALL BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    if (announcementsChannel) {
                      setActiveChannelId(announcementsChannel.id);
                      setMobileShowChat(true);
                    }
                  }}
                  className={`h-7.5 sm:h-8 px-2.5 sm:px-3 rounded-xl text-xs sm:text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 ${
                    isAnnouncementsActive
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm shadow-amber-500/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                  }`}
                  title="Switch to Announcements"
                >
                  <span className="text-xs sm:text-sm">📢</span>
                  <span className="truncate max-w-[95px] xs:max-w-none">Announcements</span>
                </button>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* In-Channel Live Search Trigger */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setInChannelSearchOpen(!inChannelSearchOpen);
                  if (inChannelSearchOpen) setInChannelSearchQuery('');
                }}
                className={`h-8 w-8 rounded-full transition-colors ${
                  inChannelSearchOpen || inChannelSearchQuery
                    ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300'
                    : 'text-foreground/80 hover:text-foreground hover:bg-muted/70'
                }`}
                title="Search messages in this channel"
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Mobile Options & Channels Drawer Dropdown */}
              <div className="lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-foreground/80 hover:text-foreground hover:bg-muted/70 active:scale-95"
                      title="More options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5 shadow-xl bg-background/95 backdrop-blur-xl border border-border/80">
                    <DropdownMenuItem
                      onClick={() => setMobileShowChat(false)}
                      className="text-xs rounded-xl cursor-pointer font-medium flex items-center gap-2 py-2"
                    >
                      <Layers className="h-4 w-4 text-sky-500" />
                      <span>Browse All Channels</span>
                    </DropdownMenuItem>

                    {isAdminOrExaminer && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={handleToggleChatMode}
                          disabled={isUpdatingMode}
                          className="text-xs rounded-xl cursor-pointer font-medium flex items-center gap-2 py-2"
                        >
                          <span>{chatMode === 'live' ? '💾 Switch to Stored Mode' : '⚡ Switch to Live Mode'}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setCleanupDialogOpen(true)}
                          className="text-xs rounded-xl cursor-pointer font-medium flex items-center gap-2 py-2 text-rose-600 dark:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Clear Old Chat Storage</span>
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      <div className="font-semibold text-foreground truncate">{activeChannel?.name}</div>
                      <div className="truncate opacity-80">{activeChannel?.description}</div>
                      <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Mode: {chatMode === 'live' ? '⚡ Real-time Live' : '💾 History Stored'}
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Desktop Direct Controls (hidden on mobile) */}
              <div className="hidden lg:flex items-center gap-1.5">
                {/* Community Mode Switcher (Admin) or Status Badge (Student) */}
                {isAdminOrExaminer ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleChatMode}
                    disabled={isUpdatingMode}
                    className={`h-7 px-2.5 text-[11px] font-bold rounded-xl gap-1.5 shadow-xs transition-all ${
                      chatMode === 'live'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                        : 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20'
                    }`}
                    title={`Admin Control: Click to switch to ${chatMode === 'live' ? 'Stored Mode' : 'Live Mode'}`}
                  >
                    {chatMode === 'live' ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>⚡ Live Mode</span>
                      </>
                    ) : (
                      <>
                        <span className="text-blue-500 font-normal">💾</span>
                        <span>Stored Mode</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold gap-1 ${
                      chatMode === 'live'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {chatMode === 'live' ? '⚡ Live' : '💾 Stored'}
                  </Badge>
                )}

                {isAdminOrExaminer && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCleanupDialogOpen(true)}
                    className="h-7 px-2.5 text-[11px] font-semibold rounded-xl border-rose-300/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-400 gap-1 shadow-sm"
                    title="Clear or prune old chat storage"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Storage</span>
                  </Button>
                )}
              </div>
            </div>
          </header>

          {/* Active Feed Info Subtitle Bar with TikTok Swipe hint */}
          <div className="px-3 sm:px-4 py-1 bg-muted/20 border-b border-border/40 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-foreground truncate">
                {activeChannel?.name}:
              </span>
              <span className="truncate opacity-80">
                {activeChannel?.description}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden xs:inline-block text-[10px] text-muted-foreground/60 select-none">
                👈 Swipe ↔ 👉
              </span>
              {activeChannel?.isOfficialOnly && !isAdminOrExaminer && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-400/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 shrink-0 font-medium">
                  Official Broadcast
                </Badge>
              )}
            </div>
          </div>

          {/* Mode Announcement Banner (Live Mode vs Stored Mode) */}
          <div
            className={`px-3 sm:px-4 py-1.5 border-b text-[11px] font-medium flex items-center justify-between gap-2 shrink-0 transition-colors ${
              chatMode === 'live'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-800 dark:text-blue-300'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs shrink-0">{chatMode === 'live' ? '⚡' : '💾'}</span>
              <span className="truncate">
                {chatMode === 'live'
                  ? 'Live Mode Active: Real-time communication between students enabled.'
                  : 'Stored Mode Active: Chat history is saved in the database so you can access previous conversations.'}
              </span>
            </div>
            {isAdminOrExaminer && (
              <button
                type="button"
                onClick={handleToggleChatMode}
                className="text-[10px] sm:text-[11px] font-bold underline shrink-0 hover:opacity-80 ml-2"
              >
                Switch to {chatMode === 'live' ? 'Stored' : 'Live'}
              </button>
            )}
          </div>

          {/* Mobile Quick Turn Button: Helps students turn between Announcements and Department chat */}
          <div className="lg:hidden px-3 py-1.5 bg-background/80 border-b border-border/50 shrink-0">
            {isAnnouncementsActive ? (
              <div className="flex items-center justify-between gap-2 p-1.5 px-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm">📢</span>
                  <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 truncate">
                    Official Announcements
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (currentDeptChannel) {
                      setActiveChannelId(currentDeptChannel.id);
                      setMobileShowChat(true);
                    }
                  }}
                  className="h-7 px-2.5 rounded-lg text-xs font-bold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shrink-0 shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                  title="Turn to Department Chat"
                >
                  <span>Turn to Dept</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 p-1.5 px-2.5 rounded-xl bg-sky-500/10 border border-sky-400/30">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm">🏛️</span>
                  <span className="text-[11px] font-semibold text-sky-800 dark:text-sky-300 truncate">
                    {deptShortName} Chat
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (announcementsChannel) {
                      setActiveChannelId(announcementsChannel.id);
                      setMobileShowChat(true);
                    }
                  }}
                  className="h-7 px-2.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shrink-0 shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                  title="Turn to Announcements"
                >
                  <span>Turn to Announcements</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* In-Channel Live Search Bar */}
          {inChannelSearchOpen && (
            <div className="p-2 sm:p-2.5 bg-sky-500/5 dark:bg-sky-950/20 border-b border-sky-500/20 flex items-center gap-2 animate-fade-in shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-sky-500" />
                <Input
                  value={inChannelSearchQuery}
                  onChange={(e) => setInChannelSearchQuery(e.target.value)}
                  placeholder={`Search in #${activeChannel?.name || 'channel'}...`}
                  className="pl-8.5 h-8 rounded-xl text-xs bg-background/90 border-sky-400/30"
                  autoFocus
                />
                {inChannelSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setInChannelSearchQuery('')}
                    className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {displayedMessages.length} match{displayedMessages.length === 1 ? '' : 'es'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInChannelSearchOpen(false);
                  setInChannelSearchQuery('');
                }}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </Button>
            </div>
          )}

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

          {/* Main Messages Stream Area (supports mobile TikTok horizontal swipe between feeds) */}
          <div
            ref={chatScrollContainerRef}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-6 select-text touch-pan-y"
          >
            {loadingMessages ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2.5">
                <div className="h-8 w-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                <p className="text-xs font-medium">Connecting to live feed...</p>
              </div>
            ) : displayedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3.5 max-w-md mx-auto">
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-sky-500/20 via-indigo-500/20 to-purple-500/20 text-sky-600 dark:text-sky-300 flex items-center justify-center text-4xl shadow-inner border border-white/20">
                  {chatMode === 'live' ? '⚡' : activeChannel?.icon || (activeChannel?.category === 'department' ? '🏛️' : '💬')}
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-foreground">
                    {chatMode === 'live' ? '⚡ Live Mode Active' : `Welcome to #${activeChannel?.name}!`}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                    {inChannelSearchQuery
                      ? 'No messages matched your search query in this channel.'
                      : chatMode === 'live'
                      ? 'Chat history is ephemeral. Real-time messages sent during this session appear here and automatically clear when you exit.'
                      : `This is the beginning of the #${activeChannel?.name} discussion space. Say hello, collaborate with peers, or ask a question!`}
                  </p>
                </div>

                {chatMode === 'live' && (
                  <Badge variant="outline" className="text-[11px] px-3 py-1 rounded-full text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-bold">
                    ⚡ Real-time Session • Blank History on Return
                  </Badge>
                )}

                {!inChannelSearchQuery && (
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                    {ICEBREAKER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt.label}
                        type="button"
                        onClick={() => {
                          setInputText(prompt.text);
                          textareaRef.current?.focus();
                        }}
                        className="px-3 py-1.5 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-400/30 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-xs"
                      >
                        {prompt.label}
                      </button>
                    ))}
                  </div>
                )}
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
                            {message.text && (
                              <div className="break-words select-text text-xs sm:text-[13.5px] leading-relaxed">
                                {renderFormattedChatText(message.text, isCurrentUser)}
                              </div>
                            )}

                            {/* Shared Image / Screenshot Attachment */}
                            {message.imageUrl && (
                              <div className="mt-1.5 mb-1 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-xs cursor-pointer group/img relative bg-black/5 max-w-sm">
                                <img
                                  src={message.imageUrl}
                                  alt="Shared image"
                                  className="max-h-72 w-auto max-w-full rounded-2xl object-cover hover:opacity-95 transition-opacity"
                                  loading="lazy"
                                  onClick={() =>
                                    setViewingImage({
                                      url: message.imageUrl!,
                                      caption: message.imageCaption || message.text,
                                    })
                                  }
                                />
                                <div className="absolute bottom-2 right-2 bg-black/70 text-white rounded-lg px-2 py-0.5 text-[10px] font-medium backdrop-blur-xs flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none">
                                  <Eye className="w-3 h-3" />
                                  <span>View</span>
                                </div>
                              </div>
                            )}

                            {/* Timestamp indicator */}
                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                isCurrentUser ? 'text-white/80' : 'text-muted-foreground'
                              }`}
                            >
                              <span>{formatTimestamp(message.createdAt)}</span>
                              {isCurrentUser && <CheckCheck className="h-3 w-3 text-white/90" />}
                            </div>
                          </div>

                          {/* Reaction Badges Pill Row with Add Reaction button */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-1 px-1">
                            {message.reactions &&
                              Object.entries(message.reactions).map(([emoji, userIds]) => {
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

                            {/* Add Reaction Button (+) accessible on both mobile and desktop */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="h-6 px-1.5 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 flex items-center gap-0.5 text-[11px] transition-all active:scale-90"
                                  title="Add reaction"
                                >
                                  <Smile className="h-3 w-3 text-sky-500" />
                                  <span className="text-[10px] font-bold">+</span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-64 p-2 rounded-2xl shadow-xl z-50 bg-background/95 backdrop-blur-md border border-border/80"
                                align={isCurrentUser ? 'end' : 'start'}
                              >
                                <div className="text-[11px] font-bold text-muted-foreground px-1 pb-1 mb-1 border-b border-border/50">
                                  React to message
                                </div>
                                <div className="grid grid-cols-6 gap-1">
                                  {QUICK_EMOJIS.concat(['👏', '🙌', '💯', '✨', '🎯', '🚀']).map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleToggleReaction(message, emoji)}
                                      className="h-8 w-8 rounded-lg hover:bg-sky-500/15 flex items-center justify-center text-sm transition-transform hover:scale-125 active:scale-95"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        {/* Floating Quick Action Toolbar (visible on hover for desktop) */}
                        <div
                          className={`hidden md:flex opacity-0 group-hover:opacity-100 transition-all duration-150 absolute top-0 items-center gap-0.5 bg-background/95 backdrop-blur-md border border-border/80 rounded-2xl p-1 shadow-lg z-10 ${
                            isCurrentUser ? 'right-4 -top-3.5' : 'left-12 -top-3.5'
                          }`}
                        >
                          {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(message, emoji)}
                              className="h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center text-xs transition-transform hover:scale-115 active:scale-90"
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}

                          {/* Full Emoji Popover on Hover Bar */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                title="More reactions"
                              >
                                <Smile className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-64 p-2 rounded-2xl shadow-xl z-50 bg-background/95 backdrop-blur-md border border-border/80"
                              align="center"
                            >
                              <div className="grid grid-cols-6 gap-1">
                                {EMOJI_CATEGORIES[0].emojis.concat(EMOJI_CATEGORIES[1].emojis.slice(0, 4)).map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(message, emoji)}
                                    className="h-7 w-7 rounded-lg hover:bg-sky-500/15 flex items-center justify-center text-sm transition-transform hover:scale-125"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>

                          <div className="h-3.5 w-[1px] bg-border/80 mx-0.5" />

                          {/* Reply Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(message);
                              textareaRef.current?.focus();
                            }}
                            className="h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            title="Reply to message"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>

                          {/* Copy text */}
                          <button
                            type="button"
                            onClick={() => handleCopyMessageText(message)}
                            className="h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy text"
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Pin Button */}
                          {isAdminOrExaminer && (
                            <button
                              type="button"
                              onClick={() => handlePinMessage(message)}
                              className={`h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center transition-colors ${
                                message.isPinned ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground hover:text-foreground'
                              }`}
                              title={message.isPinned ? 'Unpin message' : 'Pin message'}
                            >
                              <Pin className="h-3 w-3" />
                            </button>
                          )}

                          {/* Delete Button */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(message)}
                              className="h-6 w-6 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 flex items-center justify-center transition-colors"
                              title="Delete message"
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

          {/* Replying-To Context Banner (when replying) */}
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
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-background/60 transition-colors"
                title="Cancel reply"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Bottom Chat Input Bar */}
          <footer className="p-2 sm:p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border/60 bg-background/95 dark:bg-slate-950/95 backdrop-blur-md shrink-0 sticky bottom-0 z-20">
            {activeChannel?.isOfficialOnly && !isAdminOrExaminer ? (
              <div className="p-2.5 sm:p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">📢</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300 truncate">
                      Official Announcements is broadcast-only
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Switch to Department Chat to send messages & questions
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (currentDeptChannel) {
                      setActiveChannelId(currentDeptChannel.id);
                      setMobileShowChat(true);
                    }
                  }}
                  className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-bold shrink-0 h-8 px-3 shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Go to Dept Chat</span>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-2">
                {/* Floating Frosted Glass Input Card */}
                <div className="relative rounded-3xl bg-background/90 dark:bg-slate-900/90 border border-border/80 focus-within:border-sky-500/70 focus-within:ring-4 focus-within:ring-sky-500/15 shadow-lg shadow-black/5 dark:shadow-black/20 transition-all overflow-hidden">
                  {/* Staged Image / Screenshot Preview Banner */}
                  {pendingImagePreview && (
                    <div className="p-2.5 sm:p-3 bg-muted/40 dark:bg-slate-950/50 border-b border-border/40 flex items-center justify-between gap-3 animate-fade-in">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-12 w-12 rounded-xl overflow-hidden border border-border/80 shrink-0 bg-black/10">
                          <img
                            src={pendingImagePreview}
                            alt="Pending upload"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-foreground truncate">
                            {pendingImageFile?.name || 'Screenshot attached'}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {pendingImageFile ? `${(pendingImageFile.size / 1024).toFixed(1)} KB` : 'Ready to send'}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleClearStagedImage}
                        className="h-7 w-7 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                        title="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Multi-line auto-growing textarea */}
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onPaste={handleTextareaPaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      } else if (e.key === 'Escape' && replyingTo) {
                        setReplyingTo(null);
                      }
                    }}
                    placeholder={`Message #${activeChannel?.name || 'channel'}...`}
                    className="w-full min-h-[48px] max-h-40 px-4 pt-3 pb-2 bg-transparent text-xs sm:text-sm text-foreground focus:outline-none resize-none transition-all placeholder:text-muted-foreground/60 leading-relaxed"
                  />

                  {/* Input Card Bottom Action Toolbar */}
                  <div className="px-3 py-2 bg-muted/30 dark:bg-slate-950/40 border-t border-border/40 flex items-center justify-between gap-2">
                    {/* Left Toolbar: Image/Screenshot + Emoji Picker Popover + Rich text helpers */}
                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                      {/* Hidden Image File Input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleStageImage(file);
                        }}
                      />

                      {/* Image / Screenshot Upload Trigger */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8 px-2 sm:px-2.5 rounded-xl hover:bg-sky-500/10 text-muted-foreground hover:text-sky-600 dark:hover:text-sky-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Upload image or screenshot (or press Ctrl+V to paste)"
                      >
                        <ImageIcon className="h-4 w-4 text-sky-500" />
                        <span className="hidden sm:inline text-[11px]">Image</span>
                      </Button>

                      {/* Emoji Picker Popover */}
                      <Popover open={inputEmojiPickerOpen} onOpenChange={setInputEmojiPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2.5 rounded-xl hover:bg-sky-500/10 text-muted-foreground hover:text-sky-600 dark:hover:text-sky-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            title="Insert Emoji"
                          >
                            <Smile className="h-4 w-4 text-sky-500" />
                            <span className="hidden sm:inline text-[11px]">Emoji</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-72 sm:w-80 p-2.5 rounded-3xl shadow-2xl z-50 bg-background/95 backdrop-blur-xl border border-border/80"
                          align="start"
                          side="top"
                        >
                          {/* Category Tabs */}
                          <div className="flex items-center gap-1 pb-2 mb-2 border-b border-border/50 overflow-x-auto no-scrollbar">
                            {EMOJI_CATEGORIES.map((cat) => (
                              <button
                                key={cat.name}
                                type="button"
                                onClick={() => setEmojiCategoryTab(cat.name)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                                  emojiCategoryTab === cat.name
                                    ? 'bg-sky-500 text-white shadow-xs'
                                    : 'text-muted-foreground hover:bg-muted'
                                }`}
                              >
                                {cat.name}
                              </button>
                            ))}
                          </div>

                          {/* Emoji Grid */}
                          <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto p-1">
                            {(
                              EMOJI_CATEGORIES.find((c) => c.name === emojiCategoryTab)?.emojis ||
                              EMOJI_CATEGORIES[0].emojis
                            ).map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleInsertEmoji(emoji)}
                                className="h-8 w-8 rounded-xl hover:bg-sky-500/15 flex items-center justify-center text-lg transition-transform hover:scale-125 active:scale-95"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>

                          <div className="pt-2 mt-2 border-t border-border/50 text-[10px] text-muted-foreground text-center">
                            Click any emoji to insert into your message
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Formatting Helper Buttons */}
                      <div className="hidden sm:flex items-center gap-0.5 pl-1 border-l border-border/60">
                        <button
                          type="button"
                          onClick={() => handleInsertFormatting('**', '**', 'bold text')}
                          className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                          title="Bold (**text**)"
                        >
                          <Bold className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleInsertFormatting('`', '`', 'code')}
                          className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                          title="Code (`code`)"
                        >
                          <Code className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleInsertFormatting('> ', '', 'quote')}
                          className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                          title="Quote (> quote)"
                        >
                          <Quote className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Right Toolbar: Character count + Keyboard hint + Gradient Send button */}
                    <div className="flex items-center gap-2 shrink-0">
                      {inputText.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => setInputText('')}
                          className="text-[10px] text-muted-foreground hover:text-rose-500 px-1.5 py-0.5 rounded-md hover:bg-muted transition-colors hidden sm:inline"
                          title="Clear text"
                        >
                          Clear
                        </button>
                      )}

                      <span className="hidden lg:flex items-center gap-1 text-[10px] text-muted-foreground/70 font-mono">
                        <CornerDownLeft className="h-2.5 w-2.5" />
                        Enter to send
                      </span>

                      <Button
                        type="submit"
                        disabled={(!inputText.trim() && !pendingImageFile) || isSending || isUploadingImage}
                        className={`h-8 sm:h-9 px-3.5 sm:px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                          (inputText.trim() || pendingImageFile) && !isSending && !isUploadingImage
                            ? 'bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white shadow-sky-500/25 ring-2 ring-sky-400/30'
                            : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60 shadow-none'
                        }`}
                      >
                        {isSending || isUploadingImage ? (
                          <>
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            <span className="hidden sm:inline">Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Send</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
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
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground pl-1">
                <li>
                  Open the{' '}
                  <a
                    href="https://console.firebase.google.com/project/online-exam-f443c/firestore/rules"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-500 hover:text-sky-600 underline font-semibold inline-flex items-center gap-1"
                  >
                    online-exam-f443c Firestore Rules <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>Copy the snippet below and paste it right before the last closing brace <code>{"}"}</code></li>
                <li>Click <strong>Publish</strong> in the Firebase Console</li>
                <li>Or if you have Firebase CLI installed: run <code>deploy-rules.bat</code> in the project folder</li>
              </ol>

              <div className="pt-1">
                <a
                  href="https://console.firebase.google.com/project/online-exam-f443c/firestore/rules"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-all hover:scale-[1.02] active:scale-95"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Firebase Console Rules Directly</span>
                </a>
              </div>
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

      {/* Community Image / Screenshot Lightbox Modal */}
      <Dialog open={Boolean(viewingImage)} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent className="max-w-4xl p-2 sm:p-4 rounded-3xl bg-background/95 backdrop-blur-xl border border-border/80">
          <DialogHeader className="sr-only">
            <DialogTitle>View Shared Image</DialogTitle>
            <DialogDescription>Full resolution view of image shared in community chat</DialogDescription>
          </DialogHeader>
          {viewingImage && (
            <div className="space-y-3">
              <div className="relative max-h-[80vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black/40">
                <img
                  src={viewingImage.url}
                  alt={viewingImage.caption || 'Shared screenshot'}
                  className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
                />
              </div>

              <div className="flex items-center justify-between gap-3 px-2 pt-1 flex-wrap">
                <p className="text-xs text-muted-foreground truncate max-w-md">
                  {viewingImage.caption || 'Community image attachment'}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(viewingImage.url, '_blank')}
                    className="h-8 px-3 rounded-xl text-xs gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => setViewingImage(null)}
                    className="h-8 px-3.5 rounded-xl text-xs"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
