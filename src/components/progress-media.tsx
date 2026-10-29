"use client";
/* eslint-disable @next/next/no-img-element -- Previews use private browser Blob URLs, not remotely optimizable images. */
import { useEffect, useRef, useState } from "react";
import { browserDb } from "@/lib/supabase";
import {
  mediaStore,
  mediaTypes,
  validateMedia,
  type Attachment,
  type PendingMedia,
} from "@/lib/progress-media";
function Preview({ file }: { file: File }) {
  const node = useRef<HTMLImageElement | HTMLAudioElement | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (node.current) node.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return file.type.startsWith("image/") ? (
    <img
      ref={(el) => {
        node.current = el;
      }}
      alt={file.name}
    />
  ) : (
    <audio
      ref={(el) => {
        node.current = el;
      }}
      controls
      aria-label={file.name}
    />
  );
}
export function MediaComposer({
  files,
  onChange,
  disabled,
  onRecording,
}: {
  files: PendingMedia[];
  onChange: (files: PendingMedia[]) => void;
  disabled: boolean;
  onRecording: (recording: boolean) => void;
}) {
  const [error, setError] = useState(""),
    [recording, setRecording] = useState(false),
    [requesting, setRequesting] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      onRecording(false);
    };
  }, [onRecording]);
  function add(newFiles: File[]) {
    try {
      const next = [
        ...files,
        ...newFiles.map((file) => ({ id: crypto.randomUUID(), file })),
      ];
      validateMedia(next);
      onChange(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo adjuntar.");
    }
  }
  async function start() {
    setError("");
    setRequesting(true);
    onRecording(true);
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Este navegador no permite grabar. Puedes adjuntar un archivo de audio.",
        );
      const source = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        source.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = source;
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      if (!mime)
        throw new Error(
          "No hay un formato de grabación compatible. Adjunta un archivo de audio.",
        );
      const rec = new MediaRecorder(source, { mimeType: mime });
      recorder.current = rec;
      const chunks: Blob[] = [];
      let size = 0;
      rec.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          size += e.data.size;
          if (size > 10 * 1024 * 1024 && rec.state === "recording") rec.stop();
        }
      };
      rec.onerror = () => {
        if (alive.current)
          setError("No se pudo completar la grabación. Intenta de nuevo.");
        source.getTracks().forEach((t) => t.stop());
        if (alive.current) {
          setRecording(false);
          onRecording(false);
        }
      };
      rec.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        source.getTracks().forEach((t) => t.stop());
        if (!alive.current) return;
        setRecording(false);
        onRecording(false);
        const file = new File(
          chunks,
          `Nota de voz.${mime === "audio/mp4" ? "m4a" : mime.split("/")[1]}`,
          { type: mime },
        );
        add([file]);
      };
      rec.start(1000);
      setRecording(true);
      timer.current = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 120000);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (alive.current) {
        setError(
          e instanceof Error && e.name !== "NotAllowedError"
            ? e.message
            : "Permite el micrófono para grabar o adjunta un audio existente.",
        );
        onRecording(false);
      }
    } finally {
      if (alive.current) setRequesting(false);
    }
  }
  return (
    <section className="progress-media">
      <h3>Fotos y nota de voz</h3>
      <p className="small muted">
        Hasta 5 fotos y un audio. Máximo 10 MB por archivo y 30 MB en total.
        Grabación de hasta 2 minutos.
      </p>
      <div className="form-grid">
        <label>
          Adjuntar fotos
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={disabled || recording || requesting}
            onChange={(e) => {
              add(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
        <label>
          Adjuntar audio
          <input
            type="file"
            accept={mediaTypes.filter((t) => t.startsWith("audio/")).join(",")}
            disabled={
              disabled ||
              recording ||
              requesting ||
              files.some((x) => x.file.type.startsWith("audio/"))
            }
            onChange={(e) => {
              add(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {recording ? (
        <button
          type="button"
          className="button outline"
          onClick={() => recorder.current?.stop()}
        >
          Detener grabación
        </button>
      ) : (
        <button
          type="button"
          className="button outline"
          disabled={
            disabled ||
            requesting ||
            files.some((x) => x.file.type.startsWith("audio/"))
          }
          onClick={() => void start()}
        >
          {requesting ? "Esperando permiso…" : "Grabar nota de voz"}
        </button>
      )}
      {recording && (
        <p role="status">Grabando… pulsa Detener grabación al terminar.</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="media-grid">
        {files.map((item) => (
          <figure key={item.id}>
            <Preview file={item.file} />
            <figcaption>{item.file.name}</figcaption>
            <button
              type="button"
              className="text-link"
              disabled={disabled || recording}
              onClick={() => onChange(files.filter((x) => x.id !== item.id))}
            >
              Quitar {item.file.name}
            </button>
          </figure>
        ))}
      </div>
      <p className="small muted">
        La voz se comparte como audio, sin transcripción automática.
      </p>
    </section>
  );
}
function SavedMedia({ item }: { item: Attachment }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const current = useRef(""),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (current.current) URL.revokeObjectURL(current.current);
    };
  }, []);
  async function open() {
    setLoading(true);
    setError("");
    try {
      let blob: Blob;
      if (item.path.startsWith("demo/")) {
        const saved = await mediaStore("get", item.path);
        if (!(saved instanceof Blob))
          throw new Error(
            "Este archivo de demostración no está disponible en este dispositivo.",
          );
        blob = saved;
      } else {
        const result = await browserDb()
          .storage.from("progress-media")
          .download(item.path);
        if (result.error)
          throw new Error(
            "No se pudo abrir el archivo. Revisa tu acceso y vuelve a intentar.",
          );
        blob = result.data;
      }
      if (alive.current) {
        current.current = URL.createObjectURL(blob);
        setUrl(current.current);
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "No se pudo abrir.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }
  return (
    <figure>
      {url ? (
        item.mime.startsWith("image/") ? (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={item.name} />
          </a>
        ) : (
          <audio controls src={url} aria-label={item.name} />
        )
      ) : (
        <button
          type="button"
          className="button outline"
          disabled={loading}
          onClick={() => void open()}
        >
          {loading
            ? "Abriendo…"
            : item.mime.startsWith("image/")
              ? "Ver foto"
              : "Escuchar audio"}
        </button>
      )}
      <figcaption>{item.name}</figcaption>
      {error && <p role="alert">{error}</p>}
    </figure>
  );
}
export function ProgressAttachments({
  attachments,
}: {
  attachments?: Attachment[];
}) {
  return attachments?.length ? (
    <div className="media-grid">
      {attachments.map((a) => (
        <SavedMedia key={a.path} item={a} />
      ))}
    </div>
  ) : null;
}
