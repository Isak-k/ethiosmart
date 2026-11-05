import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Send,
  Trash2,
  Headphones,
  Clock,
  Sparkles,
  ArrowLeft,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  HelpCircle,
} from "lucide-react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useTranslation } from "react-i18next";

const QUICK_TOPICS = [
  { label: "Exam Question 📝", prefix: "[Exam Help] " },
  { label: "App / Technical Bug ⚙️", prefix: "[Technical Issue] " },
  { label: "Notes & Material Request 📚", prefix: "[Study Material] " },
  { label: "Department / Course 🏛️", prefix: "[Department Update] " },
  { label: "General Question 💬", prefix: "[General Question] " },
];

export default function StudentMessages() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Array<any>>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [replies, setReplies] = useState<Array<any>>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  // Mobile view state: 'list' | 'thread' | 'compose'
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [isComposingNew, setIsComposingNew] = useState(false);

  const loadReplies = useCallback(async (messageId: string) => {
    setLoadingReplies(true);
    try {
      const q = query(
        collection(db, "studentFeedback", messageId, "replies")
      );
      const snap = await getDocs(q);
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return aTime - bTime;
        });
      setReplies(data);
    } catch (e) {
      console.error("Failed to load replies:", e);
      setReplies([]);
    } finally {
      setLoadingReplies(false);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "studentFeedback"),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      setMessages(data);
      if (data.length > 0) {
        if (!selected) {
          setSelected(data[0]);
          loadReplies(data[0].id);
        } else {
          const updatedSelected = data.find((m) => m.id === selected.id) || data[0];
          setSelected(updatedSelected);
          loadReplies(updatedSelected.id);
        }
      } else {
        setSelected(null);
        setReplies([]);
        setIsComposingNew(true);
      }
    } catch (e: any) {
      console.error("Error loading messages:", e);
      toast({
        title: "Error loading inquiries",
        description: e.message || "Please check your network connection.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, selected, loadReplies]);

  useEffect(() => {
    loadMessages();
  }, [user]);

  const handleSelectMessage = (msg: any) => {
    setSelected(msg);
    setIsComposingNew(false);
    setMobileView('detail');
    loadReplies(msg.id);
  };

  const handleStartNewInquiry = () => {
    setIsComposingNew(true);
    setSelected(null);
    setMobileView('detail');
  };

  const handleApplyTopic = (prefix: string) => {
    if (newMessage.startsWith(prefix)) return;
    // Replace any existing bracket tag or prepend
    const cleaned = newMessage.replace(/^\[[^\]]+\]\s*/, '');
    setNewMessage(`${prefix}${cleaned}`);
  };

  const sendNewMessage = async () => {
    if (!user || !profile) return;
    if (!newMessage.trim()) {
      toast({
        title: "Message cannot be empty",
        description: "Please type your question or request before sending.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);
      const docRef = await addDoc(collection(db, "studentFeedback"), {
        userId: user.uid,
        email: profile.email || user.email || '',
        fullName: profile.full_name || user.email?.split('@')[0] || 'Student',
        departmentId: profile.departmentId || null,
        message: newMessage.trim(),
        status: "open",
        createdAt: Timestamp.now(),
      });

      setNewMessage("");
      setIsComposingNew(false);
      toast({
        title: "Message sent to Admin! 🎉",
        description: "Your inquiry has been submitted. Instructors and administrators will review and reply shortly.",
      });

      await loadMessages();
      setMobileView('detail');
    } catch (e: any) {
      console.error("Error sending message:", e);
      toast({
        title: "Failed to send",
        description: e.message || "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const sendReply = async () => {
    if (!user || !selected) return;
    if (!reply.trim()) return;

    try {
      setSending(true);
      await addDoc(collection(db, "studentFeedback", selected.id, "replies"), {
        message: reply.trim(),
        createdAt: Timestamp.now(),
        authorRole: "student",
        authorName: profile?.full_name || user.email?.split('@')[0] || 'Student',
      });

      setReply("");
      toast({
        title: "Reply sent",
        description: "Your response has been added to this inquiry thread.",
      });
      loadReplies(selected.id);
    } catch (e: any) {
      toast({
        title: "Failed to send reply",
        description: e.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message thread?")) return;
    try {
      await deleteDoc(doc(db, "studentFeedback", messageId));
      toast({ title: "Inquiry thread deleted" });
      if (selected?.id === messageId) {
        setSelected(null);
        setReplies([]);
        setMobileView('list');
      }
      loadMessages();
    } catch (e: any) {
      toast({
        title: "Failed to delete",
        description: e.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
        {/* Modern Header Banner */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-sky-600 via-blue-700 to-indigo-800 text-white p-5 sm:p-7 shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-sky-200 text-xs font-bold backdrop-blur-md border border-white/10">
                <Headphones className="h-3.5 w-3.5" />
                <span>Student Support & Inquiry Desk</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
                Contact Admin & Support
              </h1>
              <p className="text-xs sm:text-sm text-sky-100/90 leading-relaxed">
                Send direct questions, report exam or chapter issues, or ask for guidance. Our administrators and instructors review and reply to every message.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                type="button"
                onClick={handleStartNewInquiry}
                className="h-10 px-4 rounded-xl bg-white text-blue-700 hover:bg-sky-50 font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 hover:scale-105"
              >
                <PlusCircle className="h-4 w-4 mr-1.5" />
                <span>New Inquiry</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation View Switcher (Visible only on small screens) */}
        <div className="flex sm:hidden items-center justify-between gap-2 bg-muted/60 p-1.5 rounded-2xl border">
          <button
            type="button"
            onClick={() => {
              setMobileView('list');
              setIsComposingNew(false);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              mobileView === 'list'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Past Messages ({messages.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileView('detail');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              mobileView === 'detail'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isComposingNew ? 'Compose New' : selected ? 'Conversation' : 'New Message'}
          </button>
        </div>

        {/* 2-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Messages List (4 cols on large screens) */}
          <div
            className={`lg:col-span-5 space-y-3 ${
              mobileView === 'detail' ? 'hidden sm:block' : 'block'
            }`}
          >
            <Card className="rounded-2xl border shadow-xs overflow-hidden">
              <CardHeader className="p-4 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">Your Inquiries</CardTitle>
                    <CardDescription className="text-[11px]">
                      {messages.length} total {messages.length === 1 ? 'thread' : 'threads'}
                    </CardDescription>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartNewInquiry}
                  className="h-8 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 rounded-lg px-2.5"
                >
                  <PlusCircle className="h-3.5 w-3.5 mr-1" />
                  New
                </Button>
              </CardHeader>

              <CardContent className="p-2 space-y-1.5 max-h-[580px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center space-y-2">
                    <div className="h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-muted-foreground">Loading your conversations...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="h-12 w-12 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center mx-auto">
                      <HelpCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">No inquiries yet</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">
                        Need help with exams, chapters, or your account? Ask our admins below.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleStartNewInquiry}
                      className="rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white"
                    >
                      Write your first inquiry
                    </Button>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isSelected = !isComposingNew && selected?.id === m.id;
                    const formattedDate = m.createdAt?.toDate?.()
                      ? new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(m.createdAt.toDate())
                      : "Recently";

                    const isAnswered = m.status === 'answered' || (m.replyCount && m.replyCount > 0);

                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelectMessage(m)}
                        className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-sky-500/10 border-sky-500/40 shadow-xs ring-1 ring-sky-500/30"
                            : "hover:bg-muted/50 border-border/70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                isAnswered ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-amber-500 ring-2 ring-amber-500/20'
                              }`}
                            />
                            <span className="text-xs font-bold text-foreground truncate">
                              {m.message.slice(0, 45)}
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMessage(m.id);
                            }}
                            className="h-6 w-6 rounded-md text-muted-foreground hover:text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Delete thread"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 pl-4">
                          {m.message}
                        </p>

                        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/40 pl-4 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3" />
                            {formattedDate}
                          </span>

                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              isAnswered
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold'
                            }`}
                          >
                            {isAnswered ? 'Answered' : 'Awaiting Reply'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Conversation Thread or Compose New (7 cols) */}
          <div
            className={`lg:col-span-7 space-y-4 ${
              mobileView === 'list' ? 'hidden sm:block' : 'block'
            }`}
          >
            {/* Mobile Return to List button */}
            <div className="sm:hidden flex items-center justify-between pb-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileView('list')}
                className="text-xs font-bold text-sky-600 dark:text-sky-400 p-0 h-auto"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back to all messages
              </Button>
            </div>

            {isComposingNew ? (
              /* COMPOSE NEW INQUIRY */
              <Card className="rounded-2xl border shadow-xs overflow-hidden">
                <CardHeader className="p-4 sm:p-5 border-b bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">New Message to Admin</CardTitle>
                      <CardDescription className="text-xs">
                        Ask a question, report a problem, or request assistance.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* Topic Quick Pickers */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Select Topic (Optional):
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_TOPICS.map((topic) => (
                        <button
                          key={topic.label}
                          type="button"
                          onClick={() => handleApplyTopic(topic.prefix)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                            newMessage.startsWith(topic.prefix)
                              ? 'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300 font-bold'
                              : 'bg-muted/50 border-border/70 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {topic.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message Input Box */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Your Message:</label>
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message here with details so the administration can help you fast..."
                      className="min-h-[140px] rounded-xl resize-none text-sm p-3.5 focus-visible:ring-sky-500"
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Be specific (mention course, exam title or chapter if applicable)</span>
                      <span>{newMessage.length} characters</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    {messages.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsComposingNew(false);
                          if (messages[0]) {
                            setSelected(messages[0]);
                            loadReplies(messages[0].id);
                          }
                        }}
                        className="rounded-xl text-xs font-semibold text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    )}

                    <Button
                      type="button"
                      onClick={sendNewMessage}
                      disabled={sending || !newMessage.trim()}
                      className="h-9 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 text-white shadow-md active:scale-95 hover:opacity-95"
                    >
                      {sending ? (
                        <span className="flex items-center gap-1.5">
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          <span>Sending...</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Send className="h-3.5 w-3.5" />
                          <span>Send Message to Admin</span>
                        </span>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : selected ? (
              /* ACTIVE CONVERSATION THREAD */
              <Card className="rounded-2xl border shadow-xs overflow-hidden flex flex-col min-h-[500px]">
                {/* Thread Header */}
                <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-sky-500/15 text-sky-600 flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground truncate">
                          Inquiry Thread
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0 rounded-full font-semibold border-sky-400/40 text-sky-600 dark:text-sky-400"
                        >
                          #{selected.id.slice(0, 6)}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono mt-0.5">
                        <Clock className="h-3 w-3" />
                        {selected.createdAt?.toDate?.()?.toLocaleString?.() || 'Recently'}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStartNewInquiry}
                    className="h-8 text-xs font-bold rounded-xl text-sky-600 border-sky-400/30 hover:bg-sky-500/10"
                  >
                    <PlusCircle className="h-3.5 w-3.5 mr-1" />
                    New
                  </Button>
                </CardHeader>

                {/* Conversation Flow */}
                <CardContent className="p-4 sm:p-5 flex-1 space-y-4 overflow-y-auto max-h-[460px]">
                  {/* Original Student Message Bubble */}
                  <div className="flex flex-col items-end space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                      <span className="font-semibold text-foreground">You</span>
                      <span>•</span>
                      <span className="font-mono text-[11px]">
                        {selected.createdAt?.toDate?.()?.toLocaleTimeString?.([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        }) || ''}
                      </span>
                    </div>

                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-gradient-to-r from-sky-600 to-blue-600 text-white p-3.5 shadow-xs text-sm leading-relaxed whitespace-pre-wrap">
                      {selected.message}
                    </div>
                  </div>

                  {/* Replies List */}
                  {loadingReplies ? (
                    <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                      <span>Loading responses...</span>
                    </div>
                  ) : replies.length > 0 ? (
                    replies.map((r) => {
                      const isAdmin = r.authorRole === "admin" || r.authorRole === "examiner" || r.authorRole === "superadmin";

                      return (
                        <div
                          key={r.id}
                          className={`flex flex-col space-y-1 ${
                            isAdmin ? 'items-start' : 'items-end'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                            {isAdmin ? (
                              <>
                                <span className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400">
                                  <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
                                  Admin / Instructor
                                </span>
                                <span>•</span>
                              </>
                            ) : (
                              <>
                                <span className="font-semibold text-foreground">You</span>
                                <span>•</span>
                              </>
                            )}
                            <span className="font-mono text-[11px]">
                              {r.createdAt?.toDate?.()?.toLocaleTimeString?.([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              }) || ''}
                            </span>
                          </div>

                          <div
                            className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-3.5 text-sm leading-relaxed whitespace-pre-wrap shadow-xs ${
                              isAdmin
                                ? 'rounded-tl-xs bg-muted/80 text-foreground border border-sky-500/20'
                                : 'rounded-tr-xs bg-gradient-to-r from-sky-600 to-blue-600 text-white'
                            }`}
                          >
                            {r.message}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 px-4 rounded-xl bg-muted/40 border border-dashed text-center space-y-1">
                      <p className="text-xs font-semibold text-foreground">Inquiry received!</p>
                      <p className="text-[11px] text-muted-foreground">
                        Our administrative and teaching staff have been notified and will reply here soon.
                      </p>
                    </div>
                  )}
                </CardContent>

                {/* Reply Input Box */}
                <div className="p-3 sm:p-4 border-t bg-muted/15 space-y-2">
                  <div className="relative">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Write a follow-up reply..."
                      className="min-h-[80px] rounded-xl text-xs sm:text-sm p-3 resize-none focus-visible:ring-sky-500 pr-24"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                    />

                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={sendReply}
                        disabled={sending || !reply.trim()}
                        className="h-8 px-3 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
                      >
                        {sending ? (
                          <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <>
                            <Send className="h-3 w-3 mr-1" />
                            <span>Reply</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 text-right pr-1">
                    Press Ctrl + Enter to send
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="rounded-2xl border p-12 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Select an inquiry or start a new message</h4>
                <Button
                  size="sm"
                  onClick={handleStartNewInquiry}
                  className="rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white"
                >
                  Write New Message
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
