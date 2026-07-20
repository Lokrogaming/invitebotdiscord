function parseInviteInput(input) {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?discord(?:app)?\.(?:gg|com\/invite)\/([a-zA-Z0-9-]+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }

  if (/^[a-zA-Z0-9-]+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

module.exports = { parseInviteInput };
