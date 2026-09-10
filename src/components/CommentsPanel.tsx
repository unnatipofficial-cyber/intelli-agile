import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Reply, Trash2, Send } from "lucide-react";

interface CommentsPanelProps {
  taskId: Id<"tasks">;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CommentsPanel({ taskId }: CommentsPanelProps) {
  const comments = useQuery(api.comments.listByTask, { taskId });
  const createComment = useMutation(api.comments.create);
  const removeComment = useMutation(api.comments.remove);

  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<Id<"comments"> | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      // Parse @mentions
      const mentionRegex = /@(\w+)/g;
      const mentions: Id<"users">[] = [];
      let match;
      while ((match = mentionRegex.exec(newComment)) !== null) {
        // In a real app, we'd look up users by name. For now, just send the text.
      }

      await createComment({
        taskId,
        content: newComment,
        mentions: mentions.length > 0 ? mentions : undefined,
      });
      setNewComment("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: Id<"comments">) => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createComment({
        taskId,
        content: replyText,
        parentId,
      });
      setReplyText("");
      setReplyTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!comments) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No comments yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Start the discussion</p>
          </div>
        )}

        <AnimatePresence>
          {comments.map((comment) => (
            <motion.div
              key={comment._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="group"
            >
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-medium text-muted-foreground">
                  {comment.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.userName}</span>
                    <span className="text-[11px] text-muted-foreground/60">{timeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm text-foreground/80 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      onClick={() => setReplyTo(replyTo === comment._id ? null : comment._id)}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      <Reply className="w-3 h-3" /> Reply
                    </button>
                    <button
                      onClick={() => removeComment({ commentId: comment._id })}
                      className="text-[11px] text-muted-foreground hover:text-red-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 ml-2 pl-3 border-l-2 border-border/50 space-y-3">
                      {comment.replies.map((reply) => (
                        <div key={reply._id} className="flex gap-2">
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0 text-[8px] font-medium text-muted-foreground">
                            {reply.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{reply.userName}</span>
                              <span className="text-[10px] text-muted-foreground/60">{timeAgo(reply.createdAt)}</span>
                            </div>
                            <p className="text-xs text-foreground/80 mt-0.5">{reply.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply input */}
                  <AnimatePresence>
                    {replyTo === comment._id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 flex gap-2"
                      >
                        <input
                          autoFocus
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleReply(comment._id);
                            }
                            if (e.key === "Escape") setReplyTo(null);
                          }}
                          placeholder="Write a reply..."
                          className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-border/50 bg-muted/40 outline-none focus:border-primary/50"
                        />
                        <button
                          onClick={() => handleReply(comment._id)}
                          disabled={!replyText.trim()}
                          className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* New comment input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Add a comment... (use @name to mention)"
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-border/50 bg-muted/40 outline-none focus:border-primary/50"
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 text-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
