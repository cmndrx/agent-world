/** Older running bridges may return a plain-text 404 for newly added routes. */
export async function homeResponse(response) {
  let data;
  try { data = await response.json(); }
  catch {
    if (response.status === 404) throw Error('Home overview is unavailable from the running server. Reopen Agent World, or restart its local bridge after queued and running work finishes.');
    throw Error('The home server returned an invalid response. Reopen Agent World after queued and running work finishes.');
  }
  if (!response.ok) throw Error(data.error || 'Home request failed.');
  return data;
}
