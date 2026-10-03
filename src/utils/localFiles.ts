import { toByteArray } from 'base64-js';
import { File } from 'expo-file-system';
import { deleteAsync, EncodingType, getInfoAsync, readAsStringAsync, StorageAccessFramework } from 'expo-file-system/legacy';

export function isLocalMediaUri(uri: string) {
  return /^(file|content):\/\//i.test(uri);
}

export async function getLocalMediaInfo(uri: string) {
  if (uri.startsWith('content://')) {
    const info = await getInfoAsync(uri);
    const documentName = decodeURIComponent(uri.split('/').pop() ?? '').split('/').pop() ?? '';
    return { size: info.exists && !info.isDirectory ? info.size : 0, name: documentName };
  }
  const file = new File(uri);
  return { size: file.size, name: file.name };
}

export async function deleteLocalMediaFile(uri: string) {
  if (uri.startsWith('content://')) {
    // Resolve the individual document, not the enclosing SAF tree directory.
    const before = await getInfoAsync(uri);
    if (!before.exists || before.isDirectory) return false;
    await deleteAsync(uri);
    // Android rejects getInfoAsync for a deleted document as unreadable.
    // Check the granted parent directory instead of probing the deleted URI.
    const documentIndex = uri.indexOf('/document/');
    if (documentIndex >= 0 && uri.includes('/tree/')) {
      const children = await StorageAccessFramework.readDirectoryAsync(uri.slice(0, documentIndex));
      return !children.includes(uri);
    }
    return !(await getInfoAsync(uri)).exists;
  }
  const file = new File(uri);
  if (!file.exists) return false;
  file.delete();
  return !file.exists;
}

// Android folder picks use SAF content URIs. File.open() only handles file URIs.
// Read bounded sections so syncing doesn't need a second full-sized local copy.
export async function readContentUriChunk(uri: string, offset: number, length: number) {
  const result = new Uint8Array(length);
  let filled = 0;
  while (filled < length) {
    const encoded = await readAsStringAsync(uri, {
      encoding: EncodingType.Base64,
      position: offset + filled,
      length: length - filled,
    });
    const bytes = toByteArray(encoded);
    if (!bytes.length) throw new Error('The device could not read the complete video. The local file was kept.');
    result.set(bytes, filled);
    filled += bytes.length;
  }
  return result;
}
