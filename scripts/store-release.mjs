export function getStorePackageBaseName(version) {
  return `history-record-lens-v${version}-cws`;
}

export function getStorePackageFileName(version) {
  return `${getStorePackageBaseName(version)}.zip`;
}

export function getStorePackageFilePath(version) {
  return `releases/${getStorePackageFileName(version)}`;
}
