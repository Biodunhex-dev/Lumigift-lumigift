export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Uploads a file to Cloudinary via the server-side `/api/uploads` route.
 *
 * File validation (size limit and MIME type allowlist) is enforced on the
 * server before the upload reaches Cloudinary, so the Cloudinary API secret
 * never leaves the server.
 *
 * @param file - The `File` object selected by the user.
 * @param fetchFn - Optional fetch function (use `csrfFetch` from `useCsrf` hook
 *   to automatically attach the CSRF token). Defaults to the global `fetch`.
 * @returns An object containing the public CDN `url` and the Cloudinary `publicId`.
 * @throws If the server returns a non-OK response or the response body contains
 *   `success: false`.
 */
export async function uploadGiftMedia(
  file: File,
  fetchFn: typeof fetch = fetch
): Promise<CloudinaryUploadResult> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetchFn("/api/uploads", { method: "POST", body: form });
  const body = await res.json();

  if (!res.ok || !body.success) {
    throw new Error(body.error ?? "Upload failed");
  }

  return body.data as CloudinaryUploadResult;
}
