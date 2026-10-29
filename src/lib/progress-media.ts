import { browserDb } from "./supabase";
import type { Report } from "./model";
export type Attachment = {
  path: string;
  name: string;
  mime: string;
  size: number;
};
export type PendingMedia = { id: string; file: File };
export const mediaTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
];
export function validateMedia(files: PendingMedia[]) {
  if (
    files.filter((x) => x.file.type.startsWith("image/")).length > 5 ||
    files.filter((x) => x.file.type.startsWith("audio/")).length > 1
  )
    throw new Error("Adjunta hasta 5 fotos y una nota de voz.");
  if (files.reduce((n, x) => n + x.file.size, 0) > 30 * 1024 * 1024)
    throw new Error("Los adjuntos no pueden superar 30 MB en total.");
  for (const { file } of files) {
    if (!mediaTypes.includes(file.type) || file.size === 0)
      throw new Error(
        "Formato no admitido. Usa fotos JPG, PNG o WebP, y audio MP3, M4A, WebM, OGG o WAV.",
      );
    if (file.size > 10 * 1024 * 1024)
      throw new Error("Cada archivo debe pesar como máximo 10 MB.");
  }
}
export async function mediaStore(
  action: "get" | "put" | "delete",
  key: string,
  value?: unknown,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("housewrap-media-v1", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("files");
    open.onerror = () =>
      reject(
        new Error(
          "No se pudo abrir el almacenamiento de archivos de este dispositivo.",
        ),
      );
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(
        "files",
        action === "get" ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("files");
      const req =
        action === "get"
          ? store.get(key)
          : action === "put"
            ? store.put(value, key)
            : store.delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve(req.result);
      };
      tx.onerror = () => {
        db.close();
        reject(
          new Error("No se pudieron guardar los archivos en este dispositivo."),
        );
      };
    };
  });
}
export async function sendProgress(
  row: Report,
  files: PendingMedia[],
  demo: boolean,
): Promise<Report> {
  validateMedia(files);
  const attachments: Attachment[] = [];
  const db = demo ? null : browserDb();
  if (db) {
    const found = await db
      .from("field_reports")
      .select("*")
      .eq("id", row.id)
      .maybeSingle();
    if (found.error)
      throw new Error(
        "No se pudo verificar el avance anterior. Intenta nuevamente.",
      );
    if (found.data) return found.data;
  }
  try {
    for (const { id, file } of files) {
      const path = `${demo ? "demo" : row.submitted_by || row.author_id}/${row.project_id}/${row.id}/${id}-${crypto.randomUUID()}`;
      if (demo) await mediaStore("put", path, file);
      else {
        const uploaded = await db!.storage
          .from("progress-media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploaded.error)
          throw new Error(
            "No se pudo subir un archivo. Conservamos tu avance para reintentar.",
          );
      }
      attachments.push({
        path,
        name: file.name.slice(0, 160),
        mime: file.type,
        size: file.size,
      });
    }
    const complete = { ...row, attachments };
    if (!db) return complete;
    const result = await db
      .from("field_reports")
      .insert(complete)
      .select()
      .single();
    if (result.error)
      throw new Error(
        "No se pudo confirmar el avance. Conservamos el contenido para reintentar.",
      );
    return result.data;
  } catch (error) {
    // Resolve an ambiguous response before removing files; never delete committed media.
    if (db) {
      const found = await db
        .from("field_reports")
        .select("*")
        .eq("id", row.id)
        .maybeSingle();
      if (found.data) return found.data;
      if (!found.error && attachments.length)
        await db.storage
          .from("progress-media")
          .remove(attachments.map((a) => a.path));
    } else for (const a of attachments) await mediaStore("delete", a.path);
    throw error;
  }
}
