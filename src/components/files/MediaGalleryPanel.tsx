"use client";

import React, { useState, useRef } from "react";
import { useRoom } from "../../lib/store/roomStore";
import { formatFileSize, formatTime } from "../../lib/utils/formatters";
import { stripImageMetadata } from "../../lib/security/metadataStripper";
import { FileAttachmentMetadata } from "../../../server/types";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Download,
  ShieldCheck,
  Eye,
  X,
  Sparkles,
} from "lucide-react";

export const MediaGalleryPanel: React.FC = () => {
  const { room, attachments, sendMessage, sessionToken } = useRoom();
  const [filter, setFilter] = useState<string>("all");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !room) return;
    setIsUploading(true);
    setUploadProgress(15);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(30 + Math.floor((i / files.length) * 50));

        // Strip metadata client-side before sending
        const sanitized = await stripImageMetadata(file);

        const formData = new FormData();
        formData.append("file", sanitized);
        formData.append("roomId", room.id);
        if (sessionToken) formData.append("token", sessionToken);

        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "File upload rejected.");

        // Send single authoritative chat message containing attachment
        await sendMessage(`Shared file: ${data.file.fileName}`, "file", undefined, data.file);
      }
      setUploadProgress(100);
    } catch (err: any) {
      alert(err.message || "Failed to upload file.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredFiles = attachments.filter((item) => {
    if (filter === "all") return true;
    return item.meta.category === filter;
  });

  return (
    <div className="h-full flex flex-col bg-surface-300 select-none overflow-y-auto">
      {/* Upload Drop Zone */}
      <div className="p-4 border-b border-white/10 bg-surface-200">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleUploadFiles(e.dataTransfer.files);
          }}
          className="w-full border-2 border-dashed border-white/15 hover:border-phantom-cyan/50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-surface-100/50 transition group text-center"
        >
          <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-phantom-cyan transition mb-2" />
          <p className="text-xs font-semibold text-white">Drag & drop files or click to browse</p>
          <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
            JPG, PNG, WEBP, MP4, MP3, PDF, DOCX, ZIP (Up to 50MB)
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-phantom-emerald bg-phantom-emerald/10 px-2.5 py-0.5 rounded-full border border-phantom-emerald/20">
            <ShieldCheck className="w-3 h-3" />
            <span>Client-Side Metadata Stripped Automatically</span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleUploadFiles(e.target.files)}
          className="hidden"
        />

        {isUploading && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[11px] font-mono text-phantom-cyan">
              <span>Sanitizing & Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-phantom-cyan transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Category Filter Tabs */}
      <div className="p-3 border-b border-white/10 flex items-center gap-2 overflow-x-auto">
        {[
          { id: "all", label: "All Media" },
          { id: "image", label: "Images" },
          { id: "video", label: "Videos" },
          { id: "audio", label: "Audio" },
          { id: "document", label: "Documents" },
          { id: "archive", label: "Archives" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition ${
              filter === tab.id
                ? "bg-phantom-cyan/15 border border-phantom-cyan/40 text-phantom-cyan"
                : "bg-surface-200 text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* File Gallery Grid */}
      <div className="flex-1 p-4">
        {filteredFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
            <FileText className="w-10 h-10 text-slate-600 mb-2" />
            <p className="text-xs font-mono">No shared media in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredFiles.map((item) => (
              <div
                key={item.meta.fileId}
                className="rounded-xl bg-surface-100 border border-white/10 overflow-hidden flex flex-col justify-between hover:border-white/20 transition group"
              >
                {/* Media Preview Box */}
                {item.meta.category === "image" ? (
                  <div
                    onClick={() => setLightboxUrl(item.meta.downloadUrl)}
                    className="relative w-full h-36 bg-surface-200 cursor-pointer overflow-hidden"
                  >
                    <img
                      src={item.meta.downloadUrl}
                      alt={item.meta.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                  </div>
                ) : item.meta.category === "video" ? (
                  <div className="w-full h-36 bg-surface-200">
                    <video
                      src={item.meta.downloadUrl}
                      controls
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-24 bg-surface-200 flex items-center justify-center text-slate-400">
                    {item.meta.category === "audio" && <Music className="w-8 h-8 text-phantom-purple" />}
                    {item.meta.category === "document" && <FileText className="w-8 h-8 text-phantom-cyan" />}
                    {item.meta.category === "archive" && <Archive className="w-8 h-8 text-phantom-amber" />}
                    {item.meta.category === "other" && <FileText className="w-8 h-8 text-slate-400" />}
                  </div>
                )}

                {/* File Details & Download */}
                <div className="p-3 bg-surface-100 flex items-center justify-between gap-2 border-t border-white/5">
                  <div className="truncate">
                    <p className="text-xs font-mono text-white truncate font-medium">{item.meta.fileName}</p>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                      <span>{formatFileSize(item.meta.fileSize)}</span>
                      <span>•</span>
                      <span>{item.sender}</span>
                    </div>
                  </div>

                  <a
                    href={item.meta.downloadUrl}
                    download={item.meta.fileName}
                    className="p-2 rounded-lg bg-surface-200 hover:bg-white/10 text-slate-300 hover:text-white transition flex-shrink-0"
                    title="Download File"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={lightboxUrl}
            alt="Fullscreen preview"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl border border-white/20 shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
