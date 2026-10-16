"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { FormMessage, SubmitButton, type ActionState } from "./forms";
import { toast } from "./toaster";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const MAX = 5 * 1024 * 1024;

/** Image picker with client-side checks; the server re-validates and re-encodes everything. */
export function ImageUpload({
  uploadAction,
  removeAction,
  hidden,
  hasImage,
  label = "Image",
  rightsNotice = true,
}: {
  uploadAction: ServerAction;
  removeAction: ServerAction;
  hidden: ReactNode;
  hasImage: boolean;
  label?: string;
  rightsNotice?: boolean;
}) {
  const wrap = (action: ServerAction) => async (prev: ActionState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok && r.message) toast(r.message);
    return r;
  };
  const [state, upload] = useActionState(wrap(uploadAction), {} as ActionState);
  const [removeState, remove] = useActionState(wrap(removeAction), {} as ActionState);
  const [preview, setPreview] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <form action={upload} className="flex flex-wrap items-center gap-2">
        {hidden}
        <label className="text-sm font-medium" htmlFor="image-file">{label}</label>
        <input
          ref={input}
          id="image-file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm sm:w-auto"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setClientError(null);
            setPreview(null);
            if (!f) return;
            if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) setClientError("Use a JPEG, PNG or WebP image.");
            else if (f.size > MAX) setClientError("Images must be 5 MB or smaller.");
            else setPreview(URL.createObjectURL(f));
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="Preview" className="h-12 w-12 rounded-lg object-cover" />}
        <SubmitButton size="sm" variant="secondary" pendingLabel="Uploading…" disabled={Boolean(clientError) || !preview}>Upload</SubmitButton>
      </form>
      {hasImage && (
        <form action={remove}>
          {hidden}
          <SubmitButton size="sm" variant="ghost" pendingLabel="Removing…">Remove image</SubmitButton>
        </form>
      )}
      {clientError && <p className="text-xs text-danger">{clientError}</p>}
      <FormMessage state={state.ok ? null : state} />
      <FormMessage state={removeState.ok ? null : removeState} />
      {rightsNotice && <p className="text-xs text-muted">Only upload images you made or have permission to use. JPEG, PNG or WebP up to 5 MB; images are private to you unless you publish them.</p>}
    </div>
  );
}
