"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRoom } from "../../lib/store/roomStore";
import { formatTime, formatFileSize } from "../../lib/utils/formatters";
import { stripImageMetadata } from "../../lib/security/metadataStripper";
import { ChatMessage, FileAttachmentMetadata } from "../../../server/types";
import { getApiUrl } from "../../lib/utils/apiUrl";
import {
  Send,
  Paperclip,
  Code,
  Smile,
  Search,
  Reply,
  Trash2,
  Copy,
  Check,
  Download,
  FileText,
  Lock,
  X,
  Sparkles,
} from "lucide-react";

const EMOJI_REACTIONS = ["👍", "❤️", "🔥", "🛡️", "⚡", "🚀"];

export const ChatPanel: React.FC = () => {
  const {
    room,
    currentParticipant,
    messages,
    sendMessage,
    sendReaction,
    deleteMessage,
    startTyping,
    stopTyping,
    typingUsers,
    sessionToken,
  } = useRoom();

  const [inputVal, setInputVal] = useState("");
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [codeLang, setCodeLang] = useState("typescript");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputVal(e.target.value);
    startTyping();

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const handleSend = async () => {
    const text = inputVal.trim();
    if (!text && !replyingTo) return;

    const replyId = replyingTo?.id;
    const replySnippet = replyingTo?.plaintextFallback?.slice(0, 60);

    if (isCodeMode) {
      await sendMessage(text, "code", codeLang, undefined, replyId, replySnippet);
      setIsCodeMode(false);
    } else {
      await sendMessage(text, "text", undefined, undefined, replyId, replySnippet);
    }

    setInputVal("");
    setReplyingTo(null);
    stopTyping();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!room) return;
    setIsUploading(true);

    try {
      const sanitizedFile = await stripImageMetadata(file);

      const formData = new FormData();
      formData.append("file", sanitizedFile);
      formData.append("roomId", room.id);
      if (sessionToken) formData.append("token", sessionToken);

      const res = await fetch(getApiUrl("/api/uploads"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "File upload failed.");

      const fileMeta: FileAttachmentMetadata = data.file;
      await sendMessage(
        `Shared file: ${fileMeta.fileName}`,
        "file",
        undefined,
        fileMeta,
        replyingTo?.id,
        replyingTo?.plaintextFallback?.slice(0, 60)
      );

      setReplyingTo(null);
    } catch (err: any) {
      alert(err.message || "Failed to upload file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileUpload(file);
          break;
        }
      }
    }
  };

  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const filteredMessages = messages.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.plaintextFallback?.toLowerCase().includes(q) ||
      m.senderCodename.toLowerCase().includes(q) ||
      m.fileMetadata?.fileName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full bg-surface-300 relative select-text" onPaste={handlePaste}>
      {/* Search Header */}
      <div className="p-3 border-b border-white/10 bg-surface-200/60 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search room messages..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-surface-100 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phantom-cyan/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          {filteredMessages.length} {filteredMessages.length === 1 ? "message" : "messages"}
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-surface-100 border border-white/5 flex items-center justify-center text-phantom-cyan mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-300">Encrypted Ephemeral Session</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs font-mono">
              Messages are encrypted on your device and destroyed when the room expires.
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.senderId === currentParticipant?.id;
            return (
              <div
                key={msg.id}
                className={`group relative flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                {/* Reply preview */}
                {msg.replySnippet && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 ml-1">
                    <Reply className="w-3 h-3 rotate-180 text-phantom-cyan" />
                    <span className="italic bg-surface-200 px-2 py-0.5 rounded border border-white/5 font-mono">
                      Replying to: {msg.replySnippet}
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-2 max-w-[85%] sm:max-w-[75%]">
                  {!isMe && (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono text-white flex-shrink-0"
                      style={{ backgroundColor: msg.senderAvatarColor || "#3A86FF" }}
                    >
                      {msg.senderCodename.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="flex flex-col">
                    {/* Header info */}
                    <div className={`flex items-center gap-2 mb-1 text-[11px] font-mono ${isMe ? "justify-end" : "justify-start"}`}>
                      <span className="font-semibold text-slate-200">{msg.senderCodename}</span>
                      <span className="text-[10px] text-slate-500">{formatTime(msg.createdAt)}</span>
                      {msg.encryptedContent && (
                        <span title="Client-Side E2EE Encrypted">
                          <Lock className="w-2.5 h-2.5 text-phantom-cyan" />
                        </span>
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                        isMe
                          ? "bg-gradient-to-r from-phantom-blue/30 to-phantom-cyan/20 border border-phantom-cyan/30 text-white rounded-tr-sm"
                          : "bg-surface-100 border border-white/10 text-slate-100 rounded-tl-sm"
                      }`}
                    >
                      {/* Text */}
                      {msg.type === "text" && (
                        <p className="whitespace-pre-wrap">{msg.plaintextFallback}</p>
                      )}

                      {/* Code Block */}
                      {msg.type === "code" && (
                        <div className="mt-1 rounded-lg bg-surface-400 border border-white/10 overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-1 bg-surface-200 border-b border-white/10 text-[10px] font-mono text-slate-400">
                            <span>{msg.codeLanguage || "code"}</span>
                            <button
                              onClick={() => handleCopyCode(msg.plaintextFallback || "", msg.id)}
                              className="flex items-center gap-1 hover:text-white transition"
                            >
                              {copiedCodeId === msg.id ? (
                                <Check className="w-3 h-3 text-phantom-emerald" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedCodeId === msg.id ? "COPIED" : "COPY"}</span>
                            </button>
                          </div>
                          <pre className="p-3 font-mono text-[11px] text-phantom-cyan overflow-x-auto">
                            <code>{msg.plaintextFallback}</code>
                          </pre>
                        </div>
                      )}

                      {/* File Attachment */}
                      {msg.type === "file" && msg.fileMetadata && (
                        <div className="mt-1 space-y-2">
                          {/* Image preview */}
                          {msg.fileMetadata.category === "image" && (
                            <div
                              onClick={() => setLightboxMedia(getApiUrl(msg.fileMetadata?.downloadUrl || ""))}
                              className="cursor-pointer rounded-lg overflow-hidden border border-white/10 max-w-sm hover:opacity-90 transition"
                            >
                              <img
                                src={getApiUrl(msg.fileMetadata.downloadUrl)}
                                alt={msg.fileMetadata.fileName}
                                className="w-full max-h-64 object-cover"
                              />
                            </div>
                          )}

                          {/* Video preview */}
                          {msg.fileMetadata.category === "video" && (
                            <div className="rounded-lg overflow-hidden border border-white/10 max-w-sm">
                              <video
                                src={getApiUrl(msg.fileMetadata.downloadUrl)}
                                controls
                                className="w-full max-h-64"
                              />
                            </div>
                          )}

                          {/* Audio preview */}
                          {msg.fileMetadata.category === "audio" && (
                            <div className="p-2 rounded-lg bg-surface-200 border border-white/10">
                              <audio
                                src={getApiUrl(msg.fileMetadata.downloadUrl)}
                                controls
                                className="w-full h-8"
                              />
                            </div>
                          )}

                          {/* File info card & download */}
                          <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-surface-200/80 border border-white/10">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-phantom-cyan flex-shrink-0" />
                              <div className="truncate">
                                <p className="font-mono text-[11px] text-white truncate">
                                  {msg.fileMetadata.fileName}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {formatFileSize(msg.fileMetadata.fileSize)}
                                </p>
                              </div>
                            </div>

                            <a
                              href={getApiUrl(msg.fileMetadata.downloadUrl)}
                              download={msg.fileMetadata.fileName}
                              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition flex-shrink-0"
                              title="Download File"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reactions display */}
                    {Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                          <button
                            key={emoji}
                            onClick={() => sendReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border transition ${
                              users.includes(currentParticipant?.id || "")
                                ? "bg-phantom-cyan/15 border-phantom-cyan/40 text-white"
                                : "bg-surface-200 border-white/10 text-slate-400 hover:text-white"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="font-mono">{users.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Hover Quick Actions Bar */}
                <div
                  className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-100 border border-white/15 rounded-lg p-1 flex items-center gap-1 shadow-lg z-10 ${
                    isMe ? "right-0 -translate-y-2/3" : "left-8 -translate-y-2/3"
                  }`}
                >
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded transition"
                    title="Reply"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setShowEmojiPickerFor(showEmojiPickerFor === msg.id ? null : msg.id)}
                    className="p-1 text-slate-400 hover:text-phantom-amber hover:bg-white/5 rounded transition"
                    title="React"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>

                  {(isMe || currentParticipant?.isHost) && (
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="p-1 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded transition"
                      title="Delete Message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Emoji Picker Popover */}
                {showEmojiPickerFor === msg.id && (
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-surface-100 border border-white/20 rounded-xl p-1.5 flex items-center gap-1 shadow-2xl z-20 animate-in fade-in zoom-in-95">
                    {EMOJI_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          sendReaction(msg.id, emoji);
                          setShowEmojiPickerFor(null);
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-sm transition hover:scale-125"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator Bar */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1.5 bg-surface-200/40 text-[11px] font-mono text-phantom-cyan flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-phantom-cyan animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-phantom-cyan animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-phantom-cyan animate-bounce [animation-delay:0.4s]" />
          </div>
          <span>{typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...</span>
        </div>
      )}

      {/* Reply Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-surface-200 border-t border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-phantom-cyan" />
            <span className="text-slate-400 font-mono">Replying to {replyingTo.senderCodename}:</span>
            <span className="text-white truncate italic">{replyingTo.plaintextFallback}</span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Code Language Selector Bar */}
      {isCodeMode && (
        <div className="px-4 py-2 bg-surface-200 border-t border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-mono">
            <Code className="w-3.5 h-3.5 text-phantom-cyan" />
            <span className="text-slate-300">Code Snippet Mode:</span>
            <select
              value={codeLang}
              onChange={(e) => setCodeLang(e.target.value)}
              className="bg-surface-100 border border-white/10 rounded px-2 py-0.5 text-phantom-cyan font-mono text-xs focus:outline-none"
            >
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="rust">Rust</option>
              <option value="go">Go</option>
              <option value="html">HTML / CSS</option>
              <option value="json">JSON</option>
              <option value="bash">Bash / Shell</option>
            </select>
          </div>
          <button
            onClick={() => setIsCodeMode(false)}
            className="text-[11px] text-slate-400 hover:text-white"
          >
            Cancel Code Mode
          </button>
        </div>
      )}

      {/* Input Form */}
      <div className="p-3 border-t border-white/10 bg-surface-200">
        <div className="flex items-end gap-2">
          {/* File Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2.5 rounded-xl bg-surface-100 border border-white/10 text-slate-400 hover:text-phantom-cyan hover:border-phantom-cyan/30 transition disabled:opacity-50"
            title="Attach File (Metadata Stripped)"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
            }}
            className="hidden"
          />

          {/* Code Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsCodeMode(!isCodeMode)}
            className={`p-2.5 rounded-xl border transition ${
              isCodeMode
                ? "bg-phantom-cyan/15 border-phantom-cyan text-phantom-cyan"
                : "bg-surface-100 border-white/10 text-slate-400 hover:text-white"
            }`}
            title="Toggle Code Snippet Mode"
          >
            <Code className="w-4 h-4" />
          </button>

          {/* Text Area */}
          <div className="flex-1 relative">
            <textarea
              value={inputVal}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={isCodeMode ? 3 : 1}
              placeholder={isCodeMode ? "Paste code snippet..." : "Type a message (Enter to send)..."}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phantom-cyan/50 focus:ring-1 focus:ring-phantom-cyan/30 resize-none font-mono"
            />
          </div>

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputVal.trim() && !replyingTo}
            className="p-2.5 rounded-xl bg-gradient-to-r from-phantom-cyan to-phantom-blue text-phantom-dark font-bold hover:opacity-95 active:scale-95 transition shadow-cyan-glow disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxMedia && (
        <div
          onClick={() => setLightboxMedia(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={lightboxMedia}
            alt="Fullscreen preview"
            className="max-w-full max-h-[90vh] object-contain rounded-xl border border-white/20 shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
